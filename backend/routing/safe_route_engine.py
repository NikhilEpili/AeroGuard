from __future__ import annotations

from collections.abc import Sequence
from concurrent.futures import ThreadPoolExecutor
from os import cpu_count

from backend.core.config import get_settings
from backend.routing.pollution_cost import PollutionCostCalculator
from backend.services.directions_service import DirectionsService


class SafeRouteEngine:
    def __init__(self) -> None:
        self.settings = get_settings()
        self.directions_service = DirectionsService()
        self.pollution_cost_calculator = PollutionCostCalculator()

    def find_safest_route(
        self,
        start_location: tuple[float, float],
        destination: tuple[float, float],
        pollution_grid: Sequence[dict[str, float | int]],
        travel_mode: str = "walking",
    ) -> dict[str, float | str | list[dict[str, float]]]:
        """Compute and return the safest route.

        Steps:
        1) Call route provider API (OpenRouteService/OSRM) for candidate routes
        2) Compute pollution exposure for each route
        3) Rank routes by exposure score
        4) Return safest route in required output format
        """
        candidates = self.directions_service.get_candidate_routes(
            start_location=start_location,
            destination=destination,
            travel_mode=travel_mode,
        )

        if not candidates:
            raise ValueError("No candidate routes found")

        scored_candidates = self._score_routes_parallel(candidates, pollution_grid)

        ranked = self._rank_weighted(scored_candidates)

        safest = ranked[0]
        return {
            "route_geometry": safest.get("geometry", []),
            "duration": safest.get("duration_minutes", 0.0),
            "distance": safest.get("distance_km", 0.0),
            "exposure_score": safest.get("exposure_score", 0.0),
            "average_aqi": safest.get("average_aqi", 0.0),
            "risk_level": safest.get("risk_level", "Low"),
        }

    def rank_routes_by_exposure(
        self,
        candidates: Sequence[dict],
        pollution_grid: Sequence[dict[str, float | int]],
    ) -> list[dict]:
        scored = self._score_routes_parallel(candidates, pollution_grid)
        return self._rank_weighted(scored)

    def _rank_weighted(self, routes: Sequence[dict]) -> list[dict]:
        ranked_input = [dict(route) for route in routes]
        if not ranked_input:
            return []

        min_exposure = min(float(route.get("exposure_score", 0.0)) for route in ranked_input)
        min_duration = min(float(route.get("duration_minutes", 0.0)) for route in ranked_input)
        min_distance = min(float(route.get("distance_km", 0.0)) for route in ranked_input)

        min_exposure = max(min_exposure, 1e-6)
        min_duration = max(min_duration, 1e-6)
        min_distance = max(min_distance, 1e-6)

        wp = max(float(self.settings.route_weight_pollution), 0.0)
        wt = max(float(self.settings.route_weight_duration), 0.0)
        wd = max(float(self.settings.route_weight_distance), 0.0)
        total = wp + wt + wd
        if total <= 0:
            wp, wt, wd = 0.7, 0.2, 0.1
            total = 1.0
        wp, wt, wd = wp / total, wt / total, wd / total

        for route in ranked_input:
            exposure_norm = float(route.get("exposure_score", 0.0)) / min_exposure
            duration_norm = float(route.get("duration_minutes", 0.0)) / min_duration
            distance_norm = float(route.get("distance_km", 0.0)) / min_distance
            weighted_score = (wp * exposure_norm) + (wt * duration_norm) + (wd * distance_norm)
            route["weighted_score"] = float(weighted_score)

        return sorted(
            ranked_input,
            key=lambda item: (
                float(item.get("weighted_score", 0.0)),
                float(item.get("exposure_score", 0.0)),
                float(item.get("duration_minutes", 0.0)),
                float(item.get("distance_km", 0.0)),
            ),
        )

    def _score_routes_parallel(
        self,
        candidates: Sequence[dict],
        pollution_grid: Sequence[dict[str, float | int]],
    ) -> list[dict]:
        routes = [dict(route) for route in candidates]
        if not routes:
            return []
        max_workers = min(max(2, cpu_count() or 2), len(routes))

        def _score_one(route: dict) -> dict:
            exposure = self.pollution_cost_calculator.compute_grid_pollution(
                route_geometry=route.get("geometry", []),
                pollution_grid=pollution_grid,
                duration_minutes=float(route.get("duration_minutes", 0.0) or 0.0),
                travel_mode=str(route.get("travel_mode", "walking")),
                strategy=str(route.get("strategy", "")),
                sample_distance_m=100,
            )
            route["exposure_score"] = float(exposure["total_exposure"])
            route["average_aqi"] = float(exposure["average_aqi"])
            route["traffic_factor"] = float(exposure.get("traffic_factor", 1.0))
            route["road_factor"] = float(exposure.get("road_factor", 1.0))
            route["risk_level"] = str(exposure["risk_level"])
            return route

        with ThreadPoolExecutor(max_workers=max_workers) as executor:
            return list(executor.map(_score_one, routes))

    def select_best_route(self, candidates: list[dict]) -> tuple[dict, list[dict]]:
        """Backward-compatible selector for previously-scored candidates."""
        if not candidates:
            raise ValueError("No route candidates available for scoring")

        ranked = self._rank_weighted(candidates)
        return ranked[0], ranked[1:]
