from __future__ import annotations

from collections.abc import Sequence
from math import atan2, ceil, cos, radians, sin, sqrt

import numpy as np


class PollutionCostCalculator:
    """Route exposure scoring based on AQI along sampled route points."""

    EARTH_RADIUS_M = 6_371_000.0

    def distance(self, point_a: dict[str, float], point_b: dict[str, float]) -> float:
        """Haversine distance in meters between two coordinates."""
        lat1 = radians(float(point_a["lat"]))
        lon1 = radians(float(point_a["lng"]))
        lat2 = radians(float(point_b["lat"]))
        lon2 = radians(float(point_b["lng"]))

        d_lat = lat2 - lat1
        d_lon = lon2 - lon1
        a = (sin(d_lat / 2.0) ** 2) + (cos(lat1) * cos(lat2) * (sin(d_lon / 2.0) ** 2))
        c = 2.0 * atan2(sqrt(a), sqrt(max(1.0 - a, 1e-12)))
        return self.EARTH_RADIUS_M * c

    def calculate_weight(self, aqi: float, distance_km: float) -> float:
        """Exposure contribution for one sampled step.

        Formula: exposure = Σ (AQI × distance)
        """
        return float(aqi) * float(distance_km)

    def compute_grid_pollution(
        self,
        route_geometry: Sequence[dict[str, float]],
        pollution_grid: Sequence[dict[str, float | int]],
        sample_distance_m: int = 100,
        chunk_size: int = 2_000,
    ) -> dict[str, float | str]:
        """Compute exposure metrics for a route.

        Steps:
        1) Sample route points every `sample_distance_m`
        2) Find nearest pollution grid AQI for each sampled point
        3) Aggregate exposure as Σ(AQI × sampled_distance_km)
        """
        if not route_geometry or len(route_geometry) < 2:
            return {"total_exposure": 0.0, "average_aqi": 0.0, "risk_level": "Low"}

        sampled_points = self._sample_route_points(route_geometry, sample_distance_m=sample_distance_m)
        if not sampled_points:
            return {"total_exposure": 0.0, "average_aqi": 0.0, "risk_level": "Low"}

        if not pollution_grid:
            return {"total_exposure": 0.0, "average_aqi": 0.0, "risk_level": "Low"}

        filtered_grid = self._filter_grid_by_bbox(route_geometry, pollution_grid)
        if not filtered_grid:
            filtered_grid = pollution_grid

        nearest_aqi = self._nearest_grid_aqi(sampled_points, filtered_grid, chunk_size=chunk_size)

        distances_km = np.array([p["distance_km"] for p in sampled_points], dtype=np.float64)
        exposure_values = nearest_aqi * distances_km

        total_exposure = float(np.sum(exposure_values))
        total_distance_km = float(np.sum(distances_km))
        average_aqi = float(total_exposure / total_distance_km) if total_distance_km > 0 else 0.0

        return {
            "total_exposure": round(total_exposure, 3),
            "average_aqi": round(average_aqi, 2),
            "risk_level": self._risk_level(average_aqi),
        }

    def segment_cost(self, pm25: float, pm10: float, no2: float, distance_km: float) -> float:
        """Backward-compatible legacy segment scoring used by existing service code."""
        pollutant_weight = (pm25 * 0.5) + (pm10 * 0.3) + (no2 * 0.2)
        return round(pollutant_weight * max(distance_km, 0.1), 3)

    def _sample_route_points(
        self,
        geometry: Sequence[dict[str, float]],
        sample_distance_m: int,
    ) -> list[dict[str, float]]:
        sampled: list[dict[str, float]] = []
        if len(geometry) < 2:
            return sampled

        # Polyline sampling optimization: if polyline is too dense, decimate vertices first.
        optimized_geometry = self._optimize_polyline_for_sampling(geometry)

        for idx in range(len(optimized_geometry) - 1):
            start = optimized_geometry[idx]
            end = optimized_geometry[idx + 1]
            segment_distance_m = self.distance(start, end)
            if segment_distance_m <= 0:
                continue

            steps = max(1, int(ceil(segment_distance_m / sample_distance_m)))
            step_m = segment_distance_m / steps

            start_lat = float(start["lat"])
            start_lng = float(start["lng"])
            d_lat = float(end["lat"]) - start_lat
            d_lng = float(end["lng"]) - start_lng

            for step_idx in range(steps):
                midpoint_fraction = (step_idx + 0.5) / steps
                sampled.append(
                    {
                        "lat": start_lat + (d_lat * midpoint_fraction),
                        "lng": start_lng + (d_lng * midpoint_fraction),
                        "distance_km": step_m / 1000.0,
                    }
                )

        return sampled

    def _filter_grid_by_bbox(
        self,
        route_geometry: Sequence[dict[str, float]],
        pollution_grid: Sequence[dict[str, float | int]],
        margin_deg: float = 0.02,
    ) -> list[dict[str, float | int]]:
        lats = [float(point["lat"]) for point in route_geometry]
        lngs = [float(point["lng"]) for point in route_geometry]

        min_lat = min(lats) - margin_deg
        max_lat = max(lats) + margin_deg
        min_lng = min(lngs) - margin_deg
        max_lng = max(lngs) + margin_deg

        return [
            cell
            for cell in pollution_grid
            if min_lat <= float(cell["center_lat"]) <= max_lat and min_lng <= float(cell["center_lon"]) <= max_lng
        ]

    def _optimize_polyline_for_sampling(
        self,
        geometry: Sequence[dict[str, float]],
        max_vertices: int = 300,
    ) -> list[dict[str, float]]:
        if len(geometry) <= max_vertices:
            return list(geometry)

        step = max(1, len(geometry) // max_vertices)
        reduced = [geometry[index] for index in range(0, len(geometry), step)]
        if reduced[-1] != geometry[-1]:
            reduced.append(geometry[-1])
        return reduced

    def _nearest_grid_aqi(
        self,
        sampled_points: Sequence[dict[str, float]],
        pollution_grid: Sequence[dict[str, float | int]],
        chunk_size: int,
    ) -> np.ndarray:
        grid_lat = np.array([float(cell["center_lat"]) for cell in pollution_grid], dtype=np.float64)
        grid_lon = np.array([float(cell["center_lon"]) for cell in pollution_grid], dtype=np.float64)
        grid_aqi = np.array([float(cell["aqi"]) for cell in pollution_grid], dtype=np.float64)

        sample_lat = np.array([float(point["lat"]) for point in sampled_points], dtype=np.float64)
        sample_lon = np.array([float(point["lng"]) for point in sampled_points], dtype=np.float64)

        mean_lat_rad = radians(float(np.mean(sample_lat))) if sample_lat.size else 0.0
        lat_scale = 111_320.0
        lon_scale = 111_320.0 * max(cos(mean_lat_rad), 0.01)

        grid_x = grid_lon * lon_scale
        grid_y = grid_lat * lat_scale

        sample_x = sample_lon * lon_scale
        sample_y = sample_lat * lat_scale

        nearest = np.empty(sample_lat.shape[0], dtype=np.float64)

        for start in range(0, sample_lat.shape[0], chunk_size):
            end = min(start + chunk_size, sample_lat.shape[0])

            dx = sample_x[start:end, None] - grid_x[None, :]
            dy = sample_y[start:end, None] - grid_y[None, :]
            distance_sq = (dx * dx) + (dy * dy)
            nearest_idx = np.argmin(distance_sq, axis=1)
            nearest[start:end] = grid_aqi[nearest_idx]

        return nearest

    def _risk_level(self, average_aqi: float) -> str:
        if average_aqi <= 50:
            return "Low"
        if average_aqi <= 100:
            return "Moderate"
        if average_aqi <= 150:
            return "High"
        if average_aqi <= 200:
            return "Very High"
        return "Severe"
