from __future__ import annotations

import hashlib
import json
from math import sqrt
from uuid import uuid4

import requests

from backend.cache.redis_client import get_sync_redis_client
from backend.core.config import get_settings
from backend.core.logging import get_logger
from backend.utils.geo_utils import compute_distance_km


class DirectionsService:
    ORS_DIRECTIONS_PATH = "/v2/directions/{profile}/geojson"
    ROUTE_CACHE_TTL_SECONDS = 300
    OSRM_MAX_WAYPOINTS = 25

    def __init__(self) -> None:
        self.settings = get_settings()
        self.logger = get_logger(__name__)
        self.redis = get_sync_redis_client()

    def get_candidate_routes(
        self,
        start_location: tuple[float, float],
        destination: tuple[float, float],
        travel_mode: str = "walking",
    ) -> list[dict]:
        """Return the best available OSRM/ORS candidate routes for an O-D pair.

        Always returns ≥ 1 route; call ``get_synthetic_candidates()`` afterwards
        to pad the pool to ≥ 3 geometrically distinct paths when necessary.
        """
        cache_key = self._route_cache_key(start_location, destination, travel_mode)
        cached = self.redis.get(cache_key)
        if cached:
            return json.loads(cached)

        # 1) OSRM base route (CH-backed if local osrm-routed was started with --algorithm ch)
        base_route = self.get_osrm_base_route(start_location, destination, travel_mode)

        # 2) OSRM alternatives around the same OD pair
        osrm_alternatives = self._osrm_candidates(
            start_location,
            destination,
            travel_mode,
            alternatives=True,
        )

        detour_candidates = self._osrm_waypoint_candidates(
            start_location,
            destination,
            travel_mode,
        )

        routes = self.merge_unique_routes(
            [base_route, *osrm_alternatives, *detour_candidates] if base_route else [*osrm_alternatives, *detour_candidates]
        )

        # 3) Optional ORS enrichment when key exists (kept as additive source)
        if self.settings.openrouteservice_api_key:
            routes = self.merge_unique_routes([*routes, *self._openrouteservice_candidates(start_location, destination, travel_mode)])

        if routes:
            self.redis.setex(cache_key, self.ROUTE_CACHE_TTL_SECONDS, json.dumps(routes))
            return routes

        self.logger.warning("OSRM route fetch failed, falling back to synthetic candidates")
        routes = self._fallback_candidates(start_location, destination)
        self.redis.setex(cache_key, self.ROUTE_CACHE_TTL_SECONDS, json.dumps(routes))
        return routes

    def _openrouteservice_candidates(
        self,
        start_location: tuple[float, float],
        destination: tuple[float, float],
        travel_mode: str,
    ) -> list[dict]:
        if not self.settings.openrouteservice_api_key:
            return []

        profile = {
            "walking": "foot-walking",
            "cycling": "cycling-regular",
            "driving": "driving-car",
        }.get(travel_mode, "foot-walking")
        url = f"{self.settings.openrouteservice_base_url}{self.ORS_DIRECTIONS_PATH.format(profile=profile)}"

        headers = {
            "Authorization": self.settings.openrouteservice_api_key,
            "Content-Type": "application/json",
        }
        body = {
            "coordinates": [
                [start_location[1], start_location[0]],
                [destination[1], destination[0]],
            ],
            "alternative_routes": {
                "target_count": 3,
                "share_factor": 0.8,
                "weight_factor": 1.8,
            },
            "instructions": False,
        }

        try:
            response = requests.post(url, headers=headers, json=body, timeout=8)
            response.raise_for_status()
            payload = response.json()
        except requests.RequestException as exc:
            self.logger.warning("OpenRouteService fetch failed: %s", exc)
            return []

        routes: list[dict] = []
        for feature in payload.get("features", []):
            properties = feature.get("properties", {})
            summary = properties.get("summary", {})
            geometry_data = feature.get("geometry", {})
            coordinates_geojson = geometry_data.get("coordinates", [])

            if not coordinates_geojson:
                continue

            polyline_coordinates = [
                {"lat": float(coord[1]), "lng": float(coord[0])}
                for coord in coordinates_geojson
                if isinstance(coord, list) and len(coord) >= 2
            ]
            if not polyline_coordinates:
                continue

            routes.append(
                {
                    "route_id": uuid4().hex,
                    "distance_km": round(float(summary.get("distance", 0.0)) / 1000.0, 2),
                    "duration_minutes": round(float(summary.get("duration", 0.0)) / 60.0, 2),
                    "polyline_coordinates": polyline_coordinates,
                    "geometry": polyline_coordinates,
                    "exposure_score": 0.0,
                    "travel_mode": travel_mode,
                    "strategy": "openrouteservice_candidate",
                }
            )

        return routes

    def get_osrm_base_route(
        self,
        start_location: tuple[float, float],
        destination: tuple[float, float],
        travel_mode: str,
    ) -> dict | None:
        routes = self._request_osrm_routes(
            start_location=start_location,
            destination=destination,
            travel_mode=travel_mode,
            alternatives=False,
            strategy_prefix="osrm_ch_base",
        )
        return routes[0] if routes else None

    def _osrm_candidates(
        self,
        start_location: tuple[float, float],
        destination: tuple[float, float],
        travel_mode: str,
        *,
        alternatives: bool = True,
    ) -> list[dict]:
        return self._request_osrm_routes(
            start_location=start_location,
            destination=destination,
            travel_mode=travel_mode,
            alternatives=alternatives,
            strategy_prefix="osrm_candidate",
        )

    def _osrm_waypoint_candidates(
        self,
        start_location: tuple[float, float],
        destination: tuple[float, float],
        travel_mode: str,
    ) -> list[dict]:
        waypoint_sets = self._build_detour_waypoints(start_location, destination)
        routes: list[dict] = []
        for index, waypoint in enumerate(waypoint_sets, start=1):
            routes.extend(
                self._request_osrm_routes(
                    start_location=start_location,
                    destination=destination,
                    travel_mode=travel_mode,
                    alternatives=False,
                    via_points=[waypoint],
                    strategy_prefix=f"osrm_detour_{index}",
                )
            )
        return routes

    def _request_osrm_routes(
        self,
        *,
        start_location: tuple[float, float],
        destination: tuple[float, float],
        travel_mode: str,
        alternatives: bool,
        strategy_prefix: str,
        via_points: list[tuple[float, float]] | None = None,
    ) -> list[dict]:
        profile = {
            "walking": "foot",
            "cycling": "bike",
            "driving": "driving",
        }.get(travel_mode, "foot")

        waypoint_coords = [start_location, *(via_points or []), destination]
        coordinates = ";".join(f"{lon},{lat}" for lat, lon in waypoint_coords)
        url = f"{self.settings.osrm_base_url}/route/v1/{profile}/{coordinates}"
        params = {
            "alternatives": "true" if alternatives else "false",
            "overview": "full",
            "geometries": "geojson",
            "steps": "false",
            "annotations": "false",
            "continue_straight": "false",
        }

        try:
            response = requests.get(url, params=params, timeout=8)
            response.raise_for_status()
            payload = response.json()
        except requests.RequestException as exc:
            self.logger.warning("OSRM route fetch failed for %s: %s", strategy_prefix, exc)
            return []

        routes: list[dict] = []
        for index, route in enumerate(payload.get("routes", []), start=1):
            coordinates_geojson = route.get("geometry", {}).get("coordinates", [])
            geometry = [
                {"lat": float(coord[1]), "lng": float(coord[0])}
                for coord in coordinates_geojson
                if isinstance(coord, list) and len(coord) >= 2
            ]
            if len(geometry) < 2:
                continue

            routes.append(
                {
                    "route_id": uuid4().hex,
                    "distance_km": round(float(route.get("distance", 0.0)) / 1000.0, 3),
                    "duration_minutes": round(float(route.get("duration", 0.0)) / 60.0, 3),
                    "polyline_coordinates": geometry,
                    "geometry": geometry,
                    "exposure_score": 0.0,
                    "travel_mode": travel_mode,
                    "strategy": f"{strategy_prefix}_{index}",
                }
            )

        return routes

    def _build_detour_waypoints(
        self,
        start_location: tuple[float, float],
        destination: tuple[float, float],
    ) -> list[tuple[float, float]]:
        start_lat, start_lon = start_location
        end_lat, end_lon = destination
        delta_lat = end_lat - start_lat
        delta_lon = end_lon - start_lon
        magnitude = sqrt((delta_lat * delta_lat) + (delta_lon * delta_lon))
        if magnitude <= 1e-9:
            return []

        offset = min(max(magnitude * 0.35, 0.008), 0.025)
        normal_lat = -delta_lon / magnitude
        normal_lon = delta_lat / magnitude
        mid_lat = (start_lat + end_lat) / 2.0
        mid_lon = (start_lon + end_lon) / 2.0

        return [
            (mid_lat + (normal_lat * offset), mid_lon + (normal_lon * offset)),
            (mid_lat - (normal_lat * offset), mid_lon - (normal_lon * offset)),
        ]

    def merge_unique_routes(self, routes: list[dict | None]) -> list[dict]:
            def get_synthetic_candidates(
                self,
                origin: tuple[float, float],
                destination: tuple[float, float],
            ) -> list[dict]:
                """Return three geometrically distinct synthetic candidates.

                Used by ``RouteController`` to pad the candidate pool when OSRM
                returns fewer than three unique routes (e.g. short trips where
                only one road exists between the two points).

                Candidate shapes
                ----------------
                1. Straight (fastest-biased)  – direct O→D line
                2. L-shape  (balanced-biased) – go north/south first then east/west
                3. U-shape  (safe-biased)     – detour around the mid-point
                """
                return self._fallback_candidates(origin, destination)

        unique: list[dict] = []
        seen: set[str] = set()

        for route in routes:
            if not route:
                continue
            geometry = route.get("geometry", [])
            if len(geometry) < 2:
                continue
            start = geometry[0]
            end = geometry[-1]
            sampled = geometry[:: max(1, len(geometry) // 10)]
            signature = "|".join(
                f"{float(point.get('lat', 0.0)):.5f}:{float(point.get('lng', 0.0)):.5f}"
                for point in sampled
            )
            key = (
                f"{float(start.get('lat', 0.0)):.5f}:{float(start.get('lng', 0.0)):.5f}:"
                f"{float(end.get('lat', 0.0)):.5f}:{float(end.get('lng', 0.0)):.5f}:"
                f"{float(route.get('distance_km', 0.0)):.3f}:{float(route.get('duration_minutes', 0.0)):.3f}:"
                f"{signature}"
            )
            if key in seen:
                continue
            seen.add(key)
            unique.append(route)

        return unique

    def decode_polyline(self, encoded: str) -> list[dict[str, float]]:
        coordinates: list[dict[str, float]] = []
        index = 0
        lat = 0
        lng = 0

        while index < len(encoded):
            shift = 0
            result = 0
            while True:
                byte = ord(encoded[index]) - 63
                index += 1
                result |= (byte & 0x1F) << shift
                shift += 5
                if byte < 0x20:
                    break
            d_lat = ~(result >> 1) if (result & 1) else (result >> 1)
            lat += d_lat

            shift = 0
            result = 0
            while True:
                byte = ord(encoded[index]) - 63
                index += 1
                result |= (byte & 0x1F) << shift
                shift += 5
                if byte < 0x20:
                    break
            d_lng = ~(result >> 1) if (result & 1) else (result >> 1)
            lng += d_lng

            coordinates.append({"lat": lat / 1e5, "lng": lng / 1e5})

        return coordinates

    def refine_route_with_osrm(
        self,
        *,
        geometry: list[dict[str, float]],
        travel_mode: str,
    ) -> dict[str, float | list[dict[str, float]]] | None:
        if len(geometry) < 2:
            return None

        profile = {
            "walking": "foot",
            "cycling": "bike",
            "driving": "driving",
        }.get(str(travel_mode).lower(), "foot")

        waypoints = self._downsample_waypoints(geometry, self.OSRM_MAX_WAYPOINTS)
        coordinates = ";".join(f"{float(p['lng']):.6f},{float(p['lat']):.6f}" for p in waypoints)
        url = f"{self.settings.osrm_base_url}/route/v1/{profile}/{coordinates}"
        params = {
            "overview": "full",
            "geometries": "geojson",
            "steps": "false",
        }

        try:
            response = requests.get(url, params=params, timeout=8)
            response.raise_for_status()
            payload = response.json()
            route = (payload.get("routes") or [None])[0]
            if not route:
                return None

            coordinates_geojson = (route.get("geometry") or {}).get("coordinates") or []
            route_geometry = [
                {"lat": float(coord[1]), "lng": float(coord[0])}
                for coord in coordinates_geojson
                if isinstance(coord, list) and len(coord) >= 2
            ]
            if not route_geometry:
                return None

            return {
                "geometry": route_geometry,
                "distance_km": round(float(route.get("distance", 0.0)) / 1000.0, 2),
                "duration_minutes": round(float(route.get("duration", 0.0)) / 60.0, 2),
            }
        except requests.RequestException as exc:
            self.logger.warning("OSRM metric refinement failed: %s", exc)
            return None

    def _downsample_waypoints(
        self,
        points: list[dict[str, float]],
        max_points: int,
    ) -> list[dict[str, float]]:
        if len(points) <= max_points:
            return points

        first = points[0]
        last = points[-1]
        middle = points[1:-1]
        keep_middle = max(0, max_points - 2)
        if keep_middle <= 0 or not middle:
            return [first, last]

        step = len(middle) / keep_middle
        selected = [middle[int(i * step)] for i in range(keep_middle)]
        return [first, *selected, last]

    def _route_cache_key(
        self,
        start_location: tuple[float, float],
        destination: tuple[float, float],
        travel_mode: str,
    ) -> str:
        key_payload = (
            f"{start_location[0]:.6f}:{start_location[1]:.6f}:"
            f"{destination[0]:.6f}:{destination[1]:.6f}:{travel_mode}"
        )
        digest = hashlib.sha256(key_payload.encode("utf-8")).hexdigest()[:24]
        return f"candidate_routes:{digest}"

    def _fallback_candidates(self, origin: tuple[float, float], destination: tuple[float, float]) -> list[dict]:
        distance_km = compute_distance_km(origin[0], origin[1], destination[0], destination[1])
        base_geometry = [
            {"lat": origin[0], "lng": origin[1]},
            {"lat": destination[0], "lng": destination[1]},
        ]
        return [
            {
                "route_id": uuid4().hex,
                "distance_km": round(distance_km, 2),
                "duration_minutes": round(distance_km * 12, 2),
                "polyline_coordinates": base_geometry,
                "geometry": base_geometry,
                "exposure_score": 0.0,
                "travel_mode": "walking",
                "strategy": "fallback_fastest",
            },
            {
                "route_id": uuid4().hex,
                "distance_km": round(distance_km * 1.05, 2),
                "duration_minutes": round(distance_km * 13.2, 2),
                "polyline_coordinates": [
                    {"lat": origin[0], "lng": origin[1]},
                    {"lat": (origin[0] + destination[0]) / 2.0, "lng": origin[1]},
                    {"lat": destination[0], "lng": destination[1]},
                ],
                "geometry": [
                    {"lat": origin[0], "lng": origin[1]},
                    {"lat": (origin[0] + destination[0]) / 2.0, "lng": origin[1]},
                    {"lat": destination[0], "lng": destination[1]},
                ],
                "exposure_score": 0.0,
                "travel_mode": "walking",
                "strategy": "fallback_balanced",
            },
            {
                "route_id": uuid4().hex,
                "distance_km": round(distance_km * 1.12, 2),
                "duration_minutes": round(distance_km * 14.1, 2),
                "polyline_coordinates": [
                    {"lat": origin[0], "lng": origin[1]},
                    {"lat": origin[0], "lng": (origin[1] + destination[1]) / 2.0},
                    {"lat": destination[0], "lng": (origin[1] + destination[1]) / 2.0},
                    {"lat": destination[0], "lng": destination[1]},
                ],
                "geometry": [
                    {"lat": origin[0], "lng": origin[1]},
                    {"lat": origin[0], "lng": (origin[1] + destination[1]) / 2.0},
                    {"lat": destination[0], "lng": (origin[1] + destination[1]) / 2.0},
                    {"lat": destination[0], "lng": destination[1]},
                ],
                "exposure_score": 0.0,
                "travel_mode": "walking",
                "strategy": "fallback_safe",
            },
        ]
