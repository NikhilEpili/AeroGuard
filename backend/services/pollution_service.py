from __future__ import annotations

import math
from datetime import UTC, datetime, timedelta
from random import Random

import httpx

from backend.core.config import get_settings
from backend.core.logging import get_logger
from backend.grid.grid_generator import CityBoundingBox, generate_city_grid
from backend.grid.pollution_interpolator import PollutionInterpolator, compute_grid_pollution
from backend.routing.pollution_cost import PollutionCostCalculator
from backend.utils.geo_utils import compute_distance_km, midpoint


AQI_BREAKPOINTS_PM25 = [
    (0.0, 12.0, 0, 50),
    (12.1, 35.4, 51, 100),
    (35.5, 55.4, 101, 150),
    (55.5, 150.4, 151, 200),
    (150.5, 250.4, 201, 300),
    (250.5, 350.4, 301, 400),
    (350.5, 500.4, 401, 500),
]


class PollutionService:
    def __init__(self) -> None:
        self.settings = get_settings()
        self.logger = get_logger(__name__)
        self.interpolator = PollutionInterpolator()
        self.cost_calculator = PollutionCostCalculator()
        self._sample_points = [
            {"latitude": 19.0760, "longitude": 72.8777, "pm25": 54.0, "pm10": 92.0, "no2": 31.0},  # Bandra
            {"latitude": 19.1000, "longitude": 72.8500, "pm25": 63.0, "pm10": 101.0, "no2": 39.0},  # Andheri
            {"latitude": 19.1364, "longitude": 72.9042, "pm25": 47.0, "pm10": 83.0, "no2": 27.0},  # Powai
            {"latitude": 19.0178, "longitude": 72.8577, "pm25": 72.0, "pm10": 115.0, "no2": 45.0},  # Dadar (high pollution)
            {"latitude": 19.0607, "longitude": 72.8365, "pm25": 58.0, "pm10": 93.0, "no2": 36.0},  # Mahim
            {"latitude": 19.1136, "longitude": 72.8697, "pm25": 49.0, "pm10": 79.0, "no2": 29.0},  # Goregaon
            {"latitude": 18.9750, "longitude": 72.8258, "pm25": 85.0, "pm10": 136.0, "no2": 52.0},  # Colaba (very high)
            {"latitude": 19.0400, "longitude": 72.8650, "pm25": 41.0, "pm10": 66.0, "no2": 25.0},  # Lower Parel (lower)
            {"latitude": 19.1200, "longitude": 72.9300, "pm25": 38.0, "pm10": 61.0, "no2": 23.0},  # Mulund (cleaner)
            {"latitude": 19.0800, "longitude": 72.9000, "pm25": 55.0, "pm10": 88.0, "no2": 33.0},  # Vikhroli
        ]
        self._rng = Random(42)
        self._grid_cache: dict[str, list[dict[str, float | int]]] = {}
        self._heatmap_cache: dict[str, list[dict[str, float | int | str]]] = {}

    async def _fetch_fused_pollution_points(
        self,
        latitude: float,
        longitude: float,
        radius_m: int,
    ) -> list[dict[str, float]]:
        """Priority stack: AQICN (main) -> OpenAQ (backup) -> simulated grid (fallback)."""
        aqicn_points = await self._fetch_aqicn_points(latitude, longitude, radius_m)
        if aqicn_points:
            return aqicn_points

        openaq_points = await self._fetch_openaq_points(latitude, longitude, radius_m)
        if openaq_points:
            return openaq_points

        self.logger.warning("AQICN and OpenAQ unavailable; using simulated pollution fallback")
        return self._simulate_pollution_points(latitude, longitude)

    async def _fetch_aqicn_points(
        self,
        latitude: float,
        longitude: float,
        radius_m: int,
    ) -> list[dict[str, float]]:
        """Fetch pollution data from AQICN (World Air Quality Index)."""
        api_key = self.settings.aqicn_api_key
        if not api_key:
            return []
        
        base_url = self.settings.aqicn_base_url.rstrip("/")
        
        try:
            async with httpx.AsyncClient() as client:
                url = f"{base_url}/feed/geo:{latitude};{longitude}/?token={api_key}"
                
                response = await client.get(url, timeout=8.0)
                response.raise_for_status()
                payload = response.json()
                if payload.get("status") != "ok":
                    return []
                points = self._extract_aqicn_points(payload, latitude, longitude, radius_m)
                return points
        except httpx.HTTPError as exc:
            self.logger.warning("AQICN fetch failed: %s", exc)
            return []

    def _extract_aqicn_points(
        self,
        payload: dict,
        center_lat: float,
        center_lon: float,
        radius_m: int,
    ) -> list[dict[str, float]]:
        """Extract and standardize pollution data from AQICN response."""
        points: list[dict[str, float]] = []
        
        # AQICN returns single station or list of stations
        data = payload.get("data")
        if not data:
            return points
        
        # Handle both single city and multiple cities response
        if isinstance(data, dict):
            data = [data]
        elif isinstance(data, list):
            pass
        else:
            return points
        
        for station in data:
            # Extract coordinates
            city_obj = station.get("city") or {}
            lat = station.get("lat") or city_obj.get("lat")
            lon = station.get("lon") or city_obj.get("lon")
            
            if lat is None or lon is None:
                continue
            
            # Check if within radius
            distance_km = compute_distance_km(center_lat, center_lon, lat, lon)
            if distance_km * 1000 > radius_m:
                continue
            
            # Extract pollutant values from iaqi
            iaqi = station.get("iaqi", {})
            pm25_val = iaqi.get("pm25", {}).get("v")
            pm10_val = iaqi.get("pm10", {}).get("v")
            no2_val = iaqi.get("no2", {}).get("v")
            
            # If no PM2.5, skip
            if pm25_val is None:
                continue
            
            points.append({
                "latitude": float(lat),
                "longitude": float(lon),
                "pm25": float(pm25_val),
                "pm10": float(pm10_val) if pm10_val else float(pm25_val) * 1.6,
                "no2": float(no2_val) if no2_val else max(10.0, float(pm25_val) * 0.35),
            })
        
        return points

    async def score_candidates(self, candidates: list[dict]) -> list[dict]:
        scored_routes: list[dict] = []
        for candidate in candidates:
            geometry = candidate.get("geometry", [])
            if not geometry:
                candidate["exposure_score"] = 0.0
                scored_routes.append(candidate)
                continue

            speed_kmph = {
                "walking": 5.0,
                "cycling": 15.0,
                "bike": 20.0,
                "driving": 30.0,
            }.get(str(candidate.get("travel_mode", "walking")).lower(), 5.0)

            strategy_name = str(candidate.get("strategy", "")).lower()
            traffic_density = 70.0 if "fastest" in strategy_name else 50.0 if "balanced" in strategy_name else 35.0

            segment_distance_km = max(float(candidate["distance_km"]) / max(len(geometry), 1), 0.01)
            segments: list[dict[str, float]] = []

            for point in geometry:
                pollution = self.interpolator.interpolate(point["lat"], point["lng"], self._sample_points)
                pm25 = float(pollution["pm25"])
                high_aqi_penalty = max(0.0, pm25 - 100.0)
                segments.append(
                    {
                        "distance_km": segment_distance_km,
                        "average_speed_kmph": speed_kmph,
                        "pm25": pm25,
                        "traffic_density": traffic_density,
                        "high_aqi_penalty": high_aqi_penalty,
                    }
                )

            candidate["exposure_score"] = self.cost_calculator.cumulative_route_score(segments)
            scored_routes.append(candidate)
        return scored_routes

    async def build_pollution_grid_snapshot(
        self,
        start_location: tuple[float, float],
        destination: tuple[float, float],
        *,
        use_forecast: bool = False,
    ) -> list[dict[str, float | int]]:
        time_bucket = int(datetime.now(UTC).timestamp() // 600)  # 10-minute cache buckets
        cache_key = (
            f"{start_location[0]:.3f}:{start_location[1]:.3f}:"
            f"{destination[0]:.3f}:{destination[1]:.3f}:{int(use_forecast)}:{time_bucket}"
        )
        cached_grid = self._grid_cache.get(cache_key)
        if cached_grid is not None:
            return cached_grid

        # Refresh source points first (AQICN/OpenAQ/simulated fallback).
        await self._source_points_for_route(start_location, destination)

        start_lat, start_lon = start_location
        end_lat, end_lon = destination
        route_distance_km = compute_distance_km(start_lat, start_lon, end_lat, end_lon)

        # Local bbox around the O-D corridor with distance-aware padding.
        padding_deg = min(max((route_distance_km / 111.0) * 0.5, 0.01), 0.08)
        min_lat = min(start_lat, end_lat) - padding_deg
        max_lat = max(start_lat, end_lat) + padding_deg
        min_lon = min(start_lon, end_lon) - padding_deg
        max_lon = max(start_lon, end_lon) + padding_deg

        heatmap_points = self.get_pollution_heatmap(
            min_lat=min_lat,
            min_lon=min_lon,
            max_lat=max_lat,
            max_lon=max_lon,
            grid_size_m=max(int(self.settings.pollution_grid_cell_size_m), 100),
            use_forecast=use_forecast,
        )

        grid: list[dict[str, float | int]] = [
            {
                "grid_id": idx,
                "center_lat": float(point.get("lat", 0.0)),
                "center_lon": float(point.get("lon", 0.0)),
                "pm25": float(point.get("pm25", 0.0)),
                "aqi": int(point.get("aqi", 0)),
            }
            for idx, point in enumerate(heatmap_points, start=1)
        ]

        if not grid:
            # Safety fallback if local bbox generation fails for any reason.
            for idx, point in enumerate(self._sample_points, start=1):
                pm25 = float(point["pm25"])
                grid.append(
                    {
                        "grid_id": idx,
                        "center_lat": float(point["latitude"]),
                        "center_lon": float(point["longitude"]),
                        "pm25": pm25,
                        "aqi": self.pm25_to_aqi(pm25),
                    }
                )

        self._grid_cache = {k: v for k, v in self._grid_cache.items() if k.endswith(f":{time_bucket}")}
        self._grid_cache[cache_key] = grid
        return grid

    async def _source_points_for_route(
        self,
        start_location: tuple[float, float],
        destination: tuple[float, float],
    ) -> list[dict[str, float]]:
        route_distance_km = compute_distance_km(
            start_location[0],
            start_location[1],
            destination[0],
            destination[1],
        )
        mid_lat, mid_lon = midpoint(
            start_location[0],
            start_location[1],
            destination[0],
            destination[1],
        )
        radius_m = int(max(self.settings.openaq_radius_m, route_distance_km * 1000 * 0.6))

        # Use multi-source fused pollution data
        fused_points = await self._fetch_fused_pollution_points(mid_lat, mid_lon, radius_m)
        if fused_points:
            self._sample_points.extend(fused_points)
            self._sample_points = self._sample_points[-500:]
            return fused_points

        return self._sample_points

    def get_pollution_heatmap(
        self,
        *,
        min_lat: float,
        min_lon: float,
        max_lat: float,
        max_lon: float,
        grid_size_m: int = 200,
        use_forecast: bool = False,
    ) -> list[dict[str, float | int | str]]:
        """Return city-grid heatmap points using IDW, cached per 5-minute bucket."""
        time_bucket = int(datetime.now(UTC).timestamp() // 300)
        cache_key = (
            f"{min_lat:.3f}:{min_lon:.3f}:{max_lat:.3f}:{max_lon:.3f}:"
            f"{grid_size_m}:{int(use_forecast)}:{time_bucket}"
        )
        cached = self._heatmap_cache.get(cache_key)
        if cached is not None:
            return cached

        bbox = CityBoundingBox(
            min_lat=min(min_lat, max_lat),
            min_lon=min(min_lon, max_lon),
            max_lat=max(min_lat, max_lat),
            max_lon=max(min_lon, max_lon),
        )
        grid_cells = generate_city_grid(bbox, grid_size_m=grid_size_m)
        if not grid_cells:
            return []

        source_points = list(self._sample_points)
        if use_forecast:
            source_points = [
                {
                    **point,
                    "pm25": self.predict_pm25_next_30_minutes(
                        latitude=float(point["latitude"]),
                        longitude=float(point["longitude"]),
                        base_pm25=float(point["pm25"]),
                    ),
                }
                for point in source_points
            ]

        pm25_values = compute_grid_pollution(
            sensor_readings=source_points,
            grid_cell_coordinates=grid_cells,
            pollutant_key="pm25",
            power=2.0,
        )

        heatmap_points: list[dict[str, float | int | str]] = []
        for cell, pm25 in zip(grid_cells, pm25_values, strict=False):
            pm25_value = float(pm25)
            aqi_value = self.pm25_to_aqi(pm25_value)
            heatmap_points.append(
                {
                    "lat": float(cell["center_lat"]),
                    "lon": float(cell["center_lon"]),
                    "pm25": round(pm25_value, 2),
                    "aqi": int(aqi_value),
                    "risk_level": self.aqi_risk_level(aqi_value),
                }
            )

        self._heatmap_cache = {k: v for k, v in self._heatmap_cache.items() if k.endswith(f":{time_bucket}")}
        self._heatmap_cache[cache_key] = heatmap_points
        return heatmap_points

    async def _fetch_openaq_points(
        self,
        latitude: float,
        longitude: float,
        radius_m: int,
    ) -> list[dict[str, float]]:
        base_url = self.settings.openaq_base_url.rstrip("/")
        api_key = self.settings.openaq_api_key
        
        headers = {}
        if api_key:
            headers["Authorization"] = f"Bearer {api_key}"
        
        shared_params = {
            "coordinates": f"{latitude},{longitude}",
            "radius": radius_m,
            "limit": self.settings.openaq_location_limit,
            "sort": "desc",
            "order_by": "datetime",
        }

        async with httpx.AsyncClient() as client:
            for path in ("latest", "locations"):
                url = f"{base_url}/{path}"
                try:
                    response = await client.get(url, params=shared_params, headers=headers, timeout=8.0)
                    response.raise_for_status()
                    payload = response.json()
                    points = self._extract_openaq_points(payload)
                    if points:
                        return points
                except httpx.HTTPError as exc:
                    self.logger.warning("OpenAQ fetch failed (%s): %s", path, exc)
            return []

    def _extract_openaq_points(self, payload: dict) -> list[dict[str, float]]:
        raw_items = payload.get("results") or payload.get("data") or []
        points: list[dict[str, float]] = []

        for item in raw_items:
            coords = item.get("coordinates") or item.get("location", {}).get("coordinates") or {}
            lat = coords.get("latitude")
            lon = coords.get("longitude")

            if lat is None and isinstance(coords, (list, tuple)) and len(coords) >= 2:
                lon, lat = coords[0], coords[1]

            if lat is None or lon is None:
                continue

            metrics = {"pm25": 0.0, "pm10": 0.0, "no2": 0.0}

            measurements = item.get("measurements") or item.get("parameters") or []
            for measurement in measurements:
                parameter = str(
                    measurement.get("parameter")
                    or measurement.get("name")
                    or measurement.get("parameter_name")
                    or ""
                ).lower()
                value = measurement.get("value")
                if value is None:
                    value = measurement.get("lastValue")
                if value is None:
                    continue
                if parameter in metrics:
                    metrics[parameter] = float(value)

            if metrics["pm25"] <= 0:
                continue

            points.append(
                {
                    "latitude": float(lat),
                    "longitude": float(lon),
                    "pm25": metrics["pm25"],
                    "pm10": metrics["pm10"] or metrics["pm25"] * 1.6,
                    "no2": metrics["no2"] or max(10.0, metrics["pm25"] * 0.35),
                }
            )

        return points

    def _simulate_pollution_points(self, center_lat: float, center_lon: float, count: int = 12) -> list[dict[str, float]]:
        simulated: list[dict[str, float]] = []
        for _ in range(count):
            lat_offset = self._rng.uniform(-0.03, 0.03)
            lon_offset = self._rng.uniform(-0.03, 0.03)
            pm25 = float(self._rng.randint(40, 120))
            simulated.append(
                {
                    "latitude": round(center_lat + lat_offset, 6),
                    "longitude": round(center_lon + lon_offset, 6),
                    "pm25": pm25,
                    "pm10": round(pm25 * self._rng.uniform(1.4, 1.9), 2),
                    "no2": round(max(8.0, pm25 * self._rng.uniform(0.25, 0.45)), 2),
                }
            )
        return simulated

    @staticmethod
    def pm25_to_aqi(pm25: float) -> int:
        clamped_pm25 = max(0.0, float(pm25))
        for c_low, c_high, i_low, i_high in AQI_BREAKPOINTS_PM25:
            if c_low <= clamped_pm25 <= c_high:
                return int(((i_high - i_low) / (c_high - c_low)) * (clamped_pm25 - c_low) + i_low)
        return 500

    @staticmethod
    def aqi_risk_level(aqi: float) -> str:
        if aqi <= 50:
            return "Low"
        if aqi <= 100:
            return "Moderate"
        if aqi <= 150:
            return "High"
        if aqi <= 200:
            return "Very High"
        return "Severe"

    def predict_pm25_next_hour(self, latitude: float, longitude: float, base_pm25: float | None = None) -> float:
        """Lightweight next-hour PM2.5 forecaster for hackathon use.

        Uses current base PM2.5 and applies time-of-day + local hotspot effects.
        """
        if base_pm25 is None:
            nearest = self.interpolator.interpolate(latitude, longitude, self._sample_points)
            base_pm25 = float(nearest["pm25"])

        target_time = datetime.now(UTC) + timedelta(hours=1)
        hour = target_time.hour + (target_time.minute / 60.0)

        morning_peak = 1.22 if 7.0 <= hour <= 10.0 else 1.0
        evening_peak = 1.28 if 17.0 <= hour <= 21.0 else 1.0
        night_drop = 0.90 if 0.0 <= hour <= 5.0 else 1.0

        # Stable geo-based factor to mimic recurring local hotspots (highways/industrial pockets).
        hotspot_factor = 1.0 + (0.10 * math.sin((latitude * 31.0) + (longitude * 17.0)))

        predicted = base_pm25 * morning_peak * evening_peak * night_drop * hotspot_factor
        return round(max(5.0, predicted), 2)

    def predict_aqi_next_30_minutes(
        self,
        latitude: float,
        longitude: float,
        base_pm25: float | None = None,
    ) -> dict[str, float]:
        """Predict AQI 30 minutes ahead.

        Formula:
          future_aqi =
            0.6 * current_aqi +
            0.3 * previous_hour +
            0.1 * weather_factor
        """
        if base_pm25 is None:
            nearest = self.interpolator.interpolate(latitude, longitude, self._sample_points)
            base_pm25 = float(nearest["pm25"])

        current_aqi = float(self.pm25_to_aqi(float(base_pm25)))
        previous_hour_aqi = self._estimate_previous_hour_aqi(current_aqi, latitude, longitude)
        weather_factor = self._estimate_weather_factor(latitude, longitude)

        future_aqi = (0.6 * current_aqi) + (0.3 * previous_hour_aqi) + (0.1 * weather_factor)
        future_aqi = max(0.0, min(500.0, future_aqi))

        return {
            "current_aqi": round(current_aqi, 2),
            "previous_hour_aqi": round(previous_hour_aqi, 2),
            "weather_factor": round(weather_factor, 2),
            "future_aqi": round(future_aqi, 2),
        }

    def predict_pm25_next_30_minutes(
        self,
        latitude: float,
        longitude: float,
        base_pm25: float | None = None,
    ) -> float:
        forecast = self.predict_aqi_next_30_minutes(latitude, longitude, base_pm25=base_pm25)
        return round(self.aqi_to_pm25_approx(float(forecast["future_aqi"])), 2)

    def _estimate_previous_hour_aqi(self, current_aqi: float, latitude: float, longitude: float) -> float:
        now = datetime.now(UTC)
        hour = now.hour + (now.minute / 60.0)
        trend = 1.0 + (0.05 * math.sin((hour / 24.0) * 2.0 * math.pi))
        spatial = 1.0 + (0.03 * math.cos((latitude * 13.0) + (longitude * 7.0)))
        return max(0.0, min(500.0, current_aqi * trend * spatial))

    def _estimate_weather_factor(self, latitude: float, longitude: float) -> float:
        now = datetime.now(UTC)
        hour = now.hour + (now.minute / 60.0)

        # Deterministic lightweight surrogate for weather impact.
        # Higher values indicate more stagnant/poor dispersion conditions.
        baseline = 70.0 + (15.0 * math.cos((hour / 24.0) * 2.0 * math.pi))
        microclimate = 8.0 * math.sin((latitude * 9.0) - (longitude * 5.0))
        return max(10.0, min(220.0, baseline + microclimate))

    @staticmethod
    def aqi_to_pm25_approx(aqi: float) -> float:
        value = max(0.0, float(aqi))

        if value <= 50:
            return value * (12.0 / 50.0)
        if value <= 100:
            return 12.1 + ((value - 51.0) * ((35.4 - 12.1) / (100.0 - 51.0)))
        if value <= 150:
            return 35.5 + ((value - 101.0) * ((55.4 - 35.5) / (150.0 - 101.0)))
        if value <= 200:
            return 55.5 + ((value - 151.0) * ((150.4 - 55.5) / (200.0 - 151.0)))
        return 150.5 + ((min(value, 300.0) - 201.0) * ((250.4 - 150.5) / (300.0 - 201.0)))

    async def ingest_sensor_reading(self, reading: dict) -> None:
        self._sample_points.append(
            {
                "latitude": reading["latitude"],
                "longitude": reading["longitude"],
                "pm25": reading["pm25"],
                "pm10": reading["pm10"],
                "no2": reading["no2"],
            }
        )
