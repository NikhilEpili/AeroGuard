from __future__ import annotations

import hashlib
import json
from uuid import uuid4

import requests

from backend.cache.redis_client import get_sync_redis_client
from backend.core.config import get_settings
from backend.core.logging import get_logger
from backend.utils.geo_utils import compute_distance_km


class DirectionsService:
    GOOGLE_DIRECTIONS_URL = "https://maps.googleapis.com/maps/api/directions/json"
    ROUTE_CACHE_TTL_SECONDS = 300

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
        cache_key = self._route_cache_key(start_location, destination, travel_mode)
        cached = self.redis.get(cache_key)
        if cached:
            return json.loads(cached)

        if not self.settings.google_directions_api_key:
            self.logger.warning("GOOGLE_DIRECTIONS_API_KEY not set; returning fallback routes")
            routes = self._fallback_candidates(start_location, destination)
            self.redis.setex(cache_key, self.ROUTE_CACHE_TTL_SECONDS, json.dumps(routes))
            return routes

        params = {
            "origin": f"{start_location[0]},{start_location[1]}",
            "destination": f"{destination[0]},{destination[1]}",
            "mode": travel_mode,
            "alternatives": "true",
            "key": self.settings.google_directions_api_key,
        }

        response = requests.get(self.GOOGLE_DIRECTIONS_URL, params=params, timeout=5)
        response.raise_for_status()
        payload = response.json()

        routes: list[dict] = []
        for route in payload.get("routes", []):
            legs = route.get("legs", [])
            if not legs:
                continue

            total_distance_m = sum(float(leg["distance"]["value"]) for leg in legs)
            total_duration_s = sum(float(leg["duration"]["value"]) for leg in legs)

            encoded_polyline = route.get("overview_polyline", {}).get("points", "")
            polyline_coordinates = self.decode_polyline(encoded_polyline) if encoded_polyline else []

            routes.append(
                {
                    "route_id": uuid4().hex,
                    "distance_km": round(total_distance_m / 1000.0, 2),
                    "duration_minutes": round(total_duration_s / 60.0, 2),
                    "polyline_coordinates": polyline_coordinates,
                    "geometry": polyline_coordinates,
                    "exposure_score": 0.0,
                    "strategy": "google_candidate",
                }
            )

        result = routes or self._fallback_candidates(start_location, destination)
        self.redis.setex(cache_key, self.ROUTE_CACHE_TTL_SECONDS, json.dumps(result))
        return result

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
                "strategy": "fallback_balanced",
            },
        ]
