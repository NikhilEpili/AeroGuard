from __future__ import annotations

from collections.abc import Sequence
from concurrent.futures import ThreadPoolExecutor
from os import cpu_count

from backend.routing.pollution_cost import PollutionCostCalculator
from backend.services.directions_service import DirectionsService


class SafeRouteEngine:
    def __init__(self) -> None:
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
        1) Call Google Directions API for candidate routes
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

        ranked = sorted(
            scored_candidates,
            key=lambda item: (
                float(item.get("exposure_score", 0.0)),
                float(item.get("duration_minutes", 0.0)),
                float(item.get("distance_km", 0.0)),
            ),
        )

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

        return sorted(
            scored,
            key=lambda item: (
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
                sample_distance_m=100,
            )
            route["exposure_score"] = float(exposure["total_exposure"])
            route["average_aqi"] = float(exposure["average_aqi"])
            route["risk_level"] = str(exposure["risk_level"])
            return route

        with ThreadPoolExecutor(max_workers=max_workers) as executor:
            return list(executor.map(_score_one, routes))

    def select_best_route(self, candidates: list[dict]) -> tuple[dict, list[dict]]:
        """Backward-compatible selector for previously-scored candidates."""
        if not candidates:
            raise ValueError("No route candidates available for scoring")

        ranked = sorted(
            candidates,
            key=lambda route: (
                float(route.get("exposure_score", 0.0)),
                float(route.get("duration_minutes", 0.0)),
                float(route.get("distance_km", 0.0)),
            ),
        )
        return ranked[0], ranked[1:]
