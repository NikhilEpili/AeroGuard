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
    OBJECTIVE_WEIGHTS: dict[RouteType, tuple[float, float]] = {
        "fastest": (0.9, 0.1),
        "balanced": (0.5, 0.5),
        "safe": (0.2, 0.8),
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
        for route_type, (alpha, beta) in self.OBJECTIVE_WEIGHTS.items():
            if route_type == "fastest":
                # For fastest: prioritize speed (low alpha, low beta)
                ranked = sorted(
                    evaluated_routes,
                    key=lambda route: (
                        route.duration_minutes,  # Primary: duration
                        route.distance_km,       # Secondary: distance
                        route.exposure_score,    # Tertiary: exposure
                    ),
                )
            elif route_type == "balanced":
                # For balanced: balance speed and pollution
                ranked = sorted(
                    evaluated_routes,
                    key=lambda route: (
                        self._objective_cost(route, alpha=alpha, beta=beta),
                        route.duration_minutes,
                        route.distance_km,
                    ),
                )
            else:  # safe
                # For safe: prioritize low pollution
                ranked = sorted(
                    evaluated_routes,
                    key=lambda route: (
                        route.exposure_score,    # Primary: exposure
                        route.duration_minutes,  # Secondary: duration
                        route.distance_km,       # Tertiary: distance
                    ),
                )

            # Try to find an unused route, but allow reuse if necessary
            chosen = next((route for route in ranked if route.signature not in used_signatures), ranked[0])
            used_signatures.add(chosen.signature)
            selected[route_type] = self._serialize_route(chosen, route_type=route_type, alpha=alpha, beta=beta)

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

        pollution_saved_percent = ((fastest_exposure - safe_exposure) / fastest_exposure * 100.0) if fastest_exposure > 0 else 0.0
        avoided_exposure = max(0.0, fastest_exposure - safe_exposure)
        distance_increase_percent = ((safe_distance - fastest_distance) / fastest_distance * 100.0) if fastest_distance > 0 else 0.0

        for route in (fastest, balanced, safe):
            route["pollution_saved_percent"] = round(
                ((fastest_exposure - float(route["exposure_score"])) / fastest_exposure * 100.0) if fastest_exposure > 0 else 0.0,
                2,
            )

        print("Fastest route length:", len(fastest["coordinates"]))
        print("Safe route length:", len(safe["coordinates"]))

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

    def _objective_cost(self, route: EvaluatedRoute, *, alpha: float, beta: float) -> float:
        return (float(alpha) * route.duration_minutes) + (float(beta) * route.exposure_score)

    def _serialize_route(self, route: EvaluatedRoute, *, route_type: RouteType, alpha: float, beta: float) -> dict:
        return {
            "route_id": route.route_id,
            "route_type": route_type,
            "strategy": route.strategy,
            "coordinates": route.coordinates,
            "geometry": route.coordinates,
            "distance_km": route.distance_km,
            "duration_minutes": route.duration_minutes,
            "exposure_score": route.exposure_score,
            "average_aqi": route.average_aqi,
            "risk_level": route.risk_level,
            "objective_score": round(self._objective_cost(route, alpha=alpha, beta=beta), 3),
            "alpha": round(alpha, 2),
            "beta": round(beta, 2),
        }

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