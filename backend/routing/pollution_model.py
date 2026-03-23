from __future__ import annotations

from dataclasses import dataclass
from hashlib import sha1
from typing import Literal

from backend.routing.pollution_cost import PollutionCostCalculator
from backend.services.pollution_service import PollutionService

RouteType = Literal["fastest", "balanced", "safe"]


@dataclass(slots=True)
class EvaluatedRoute:
    route_id: str
    strategy: str
    travel_mode: str
    geometry_points: list[dict[str, float]]
    coordinates: list[list[float]]
    distance_km: float
    duration_minutes: float
    exposure_score: float
    average_aqi: float
    risk_level: str
    signature: str


class PollutionModel:
    OBJECTIVE_WEIGHTS: dict[RouteType, tuple[float, float, float]] = {
        # (pollution, time, distance)
        "fastest": (0.2, 0.7, 0.1),
        "balanced": (0.4, 0.4, 0.2),
        "safe": (0.6, 0.3, 0.1),
    }

    def __init__(self) -> None:
        self.cost_calculator = PollutionCostCalculator()
        self.pollution_service = PollutionService()

    def evaluate_candidates(
        self,
        *,
        candidates: list[dict],
        pollution_grid: list[dict[str, float | int]],
        travel_mode: str,
    ) -> list[EvaluatedRoute]:
        evaluated: list[EvaluatedRoute] = []

        for candidate in candidates:
            geometry_points = self._normalize_geometry(candidate.get("geometry", []))
            if len(geometry_points) < 2:
                continue

            distance_km = max(float(candidate.get("distance_km", 0.0) or 0.0), 0.001)
            duration_minutes = max(float(candidate.get("duration_minutes", 0.0) or 0.0), 0.001)
            exposure = self.cost_calculator.compute_grid_pollution(
                route_geometry=geometry_points,
                pollution_grid=pollution_grid,
                duration_minutes=duration_minutes,
                travel_mode=travel_mode,
                strategy=str(candidate.get("strategy", "")),
                sample_distance_m=75,
            )

            evaluated.append(
                EvaluatedRoute(
                    route_id=str(candidate.get("route_id", "")) or self._signature_for(geometry_points),
                    strategy=str(candidate.get("strategy", "candidate")),
                    travel_mode=travel_mode,
                    geometry_points=geometry_points,
                    coordinates=[[float(point["lng"]), float(point["lat"])] for point in geometry_points],
                    distance_km=round(distance_km, 3),
                    duration_minutes=round(duration_minutes, 3),
                    exposure_score=round(float(exposure.get("total_exposure", 0.0)), 3),
                    average_aqi=round(float(exposure.get("average_aqi", 0.0)), 2),
                    risk_level=str(exposure.get("risk_level", "Low")),
                    signature=self._signature_for(geometry_points),
                )
            )

        return evaluated

    def select_strategy_routes(self, evaluated_routes: list[EvaluatedRoute]) -> dict[RouteType, dict]:
        if not evaluated_routes:
            raise ValueError("No evaluated routes available")

        selected: dict[RouteType, dict] = {}
        used_signatures: set[str] = set()

        # Sort routes by different criteria for each strategy to ensure diversity
        metrics = self._build_normalized_metrics(evaluated_routes)

        for route_type, (wp, wt, wd) in self.OBJECTIVE_WEIGHTS.items():
            if route_type == "fastest":
                # For fastest: prioritize ETA and distance while still considering exposure.
                ranked = sorted(
                    evaluated_routes,
                    key=lambda route: (
                        metrics[route.signature]["time_norm"],
                        metrics[route.signature]["distance_norm"],
                        metrics[route.signature]["exposure_norm"],
                    ),
                )
            elif route_type == "balanced":
                # For balanced: equal focus on exposure and ETA.
                ranked = sorted(
                    evaluated_routes,
                    key=lambda route: (
                        self._objective_cost(route, metrics=metrics, wp=wp, wt=wt, wd=wd),
                        metrics[route.signature]["time_norm"],
                        metrics[route.signature]["distance_norm"],
                    ),
                )
            else:  # safe
                # For safe: research-style objective (0.6 pollution, 0.3 time, 0.1 distance).
                ranked = sorted(
                    evaluated_routes,
                    key=lambda route: (
                        self._objective_cost(route, metrics=metrics, wp=wp, wt=wt, wd=wd),
                        metrics[route.signature]["exposure_norm"],
                        metrics[route.signature]["time_norm"],
                    ),
                )

            # Try to find an unused route, but allow reuse if necessary
            chosen = next((route for route in ranked if route.signature not in used_signatures), ranked[0])
            used_signatures.add(chosen.signature)
            selected[route_type] = self._serialize_route(
                chosen,
                route_type=route_type,
                wp=wp,
                wt=wt,
                wd=wd,
                metrics=metrics,
            )

        return selected

    def build_route_bundle(
        self,
        *,
        selected_routes: dict[RouteType, dict],
        use_predicted_pollution: bool,
    ) -> dict:
        fastest = selected_routes["fastest"]
        balanced = selected_routes["balanced"]
        safe = selected_routes["safe"]

        fastest_exposure = float(fastest["exposure_score"])
        safe_exposure = float(safe["exposure_score"])
        fastest_distance = float(fastest["distance_km"])
        safe_distance = float(safe["distance_km"])
        worst_exposure = max(
            float(fastest.get("exposure_score", 0.0)),
            float(balanced.get("exposure_score", 0.0)),
            float(safe.get("exposure_score", 0.0)),
        )

        pollution_saved_percent = ((worst_exposure - safe_exposure) / worst_exposure * 100.0) if worst_exposure > 0 else 0.0
        avoided_exposure = max(0.0, worst_exposure - safe_exposure)
        distance_increase_percent = ((safe_distance - fastest_distance) / fastest_distance * 100.0) if fastest_distance > 0 else 0.0

        for route in (fastest, balanced, safe):
            route["pollution_saved_percent"] = round(
                ((worst_exposure - float(route["exposure_score"])) / worst_exposure * 100.0) if worst_exposure > 0 else 0.0,
                2,
            )

        return {
            "route": safe,
            "routes": [fastest, balanced, safe],
            "route_type": "safe",
            "uses_predicted_pollution": use_predicted_pollution,
            "exposure_score": safe["exposure_score"],
            "average_aqi": safe["average_aqi"],
            "risk_level": safe["risk_level"],
            "fastest": fastest["coordinates"],
            "balanced": balanced["coordinates"],
            "safe": safe["coordinates"],
            "fastest_route": fastest,
            "balanced_route": balanced,
            "safe_route": safe,
            "cleanest_route": safe,
            "safest_route": safe,
            "fastest_route_exposure": round(fastest_exposure, 3),
            "safe_route_exposure": round(safe_exposure, 3),
            "reduction_percentage": round(pollution_saved_percent, 2),
            "avoided_exposure": round(avoided_exposure, 3),
            "pollution_saved_percent": round(pollution_saved_percent, 2),
            "equivalent_cigarettes_avoided": round(avoided_exposure / 60.0, 2),
            "exposure_reduction_percent": round(pollution_saved_percent, 2),
            "distance_increase_percent": round(distance_increase_percent, 2),
        }

    def _objective_cost(
        self,
        route: EvaluatedRoute,
        *,
        metrics: dict[str, dict[str, float]],
        wp: float,
        wt: float,
        wd: float,
    ) -> float:
        norm = metrics[route.signature]
        return (wp * norm["exposure_norm"]) + (wt * norm["time_norm"]) + (wd * norm["distance_norm"])

    def _serialize_route(
        self,
        route: EvaluatedRoute,
        *,
        route_type: RouteType,
        wp: float,
        wt: float,
        wd: float,
        metrics: dict[str, dict[str, float]],
    ) -> dict:
        norm = metrics[route.signature]
        return {
            "route_id": route.route_id,
            "route_type": route_type,
            "strategy": route.strategy,
            "coordinates": route.coordinates,
            "geometry": route.geometry_points,
            "distance_km": route.distance_km,
            "duration_minutes": route.duration_minutes,
            "exposure_score": route.exposure_score,
            "average_aqi": route.average_aqi,
            "risk_level": route.risk_level,
            "objective_score": round(self._objective_cost(route, metrics=metrics, wp=wp, wt=wt, wd=wd), 4),
            "norm_exposure": round(norm["exposure_norm"], 4),
            "norm_time": round(norm["time_norm"], 4),
            "norm_distance": round(norm["distance_norm"], 4),
            "weight_pollution": round(wp, 2),
            "weight_time": round(wt, 2),
            "weight_distance": round(wd, 2),
        }

    def _build_normalized_metrics(self, evaluated_routes: list[EvaluatedRoute]) -> dict[str, dict[str, float]]:
        exp_values = [float(route.exposure_score) for route in evaluated_routes]
        time_values = [float(route.duration_minutes) for route in evaluated_routes]
        dist_values = [float(route.distance_km) for route in evaluated_routes]

        def _minmax(value: float, lo: float, hi: float) -> float:
            if hi <= lo + 1e-9:
                return 1.0
            return (value - lo) / (hi - lo)

        exp_min, exp_max = min(exp_values), max(exp_values)
        time_min, time_max = min(time_values), max(time_values)
        dist_min, dist_max = min(dist_values), max(dist_values)

        normalized: dict[str, dict[str, float]] = {}
        for route in evaluated_routes:
            normalized[route.signature] = {
                "exposure_norm": _minmax(float(route.exposure_score), exp_min, exp_max),
                "time_norm": _minmax(float(route.duration_minutes), time_min, time_max),
                "distance_norm": _minmax(float(route.distance_km), dist_min, dist_max),
            }

        return normalized

    def _normalize_geometry(self, geometry: list) -> list[dict[str, float]]:
        normalized: list[dict[str, float]] = []
        for point in geometry:
            if isinstance(point, dict):
                lat = float(point.get("lat", point.get("latitude", 0.0)))
                lng = float(point.get("lng", point.get("lon", point.get("longitude", 0.0))))
                if abs(lat) <= 90 and abs(lng) <= 180:
                    normalized.append({"lat": lat, "lng": lng})
                continue

            if isinstance(point, (list, tuple)) and len(point) >= 2:
                first = float(point[0])
                second = float(point[1])
                if abs(first) <= 180 and abs(second) <= 90:
                    normalized.append({"lat": second, "lng": first})
                elif abs(first) <= 90 and abs(second) <= 180:
                    normalized.append({"lat": first, "lng": second})

        return normalized

    def _signature_for(self, geometry_points: list[dict[str, float]]) -> str:
        digest_source = "|".join(
            f"{point['lat']:.5f}:{point['lng']:.5f}"
            for point in geometry_points[:: max(1, len(geometry_points) // 12)]
        )
        return sha1(digest_source.encode("utf-8")).hexdigest()[:16]