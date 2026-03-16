from __future__ import annotations

from collections.abc import Sequence
from math import atan2, ceil, cos, radians, sin, sqrt

import numpy as np


class PollutionCostCalculator:
    """Route exposure scoring based on AQI along sampled route points."""

    EARTH_RADIUS_M = 6_371_000.0
    SPEED_KMPH_BY_MODE = {
        "walking": 5.0,
        "cycling": 15.0,
        "bike": 15.0,
        "driving": 30.0,
    }
    ACTIVITY_FACTOR_BY_MODE = {
        "walking": 1.6,
        "cycling": 2.0,
        "bike": 2.0,
        "driving": 1.0,
    }
    EMISSION_FACTOR_BY_MODE = {
        "walking": 0.0,
        "cycling": 0.0,
        "bike": 0.0,
        "driving": 0.5,
    }

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
        duration_minutes: float | None = None,
        travel_mode: str = "walking",
        strategy: str = "",
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
        total_distance_km = float(np.sum(distances_km))

        # Segment exposure simulation:
        # segment_time = distance / average_speed
        # breathing_rate = activity_factor
        # segment_exposure = pm25 * segment_time * breathing_rate
        speed_kmph = self.SPEED_KMPH_BY_MODE.get(str(travel_mode).lower(), 5.0)
        breathing_rate = self.ACTIVITY_FACTOR_BY_MODE.get(str(travel_mode).lower(), 1.0)

        segment_time_hours = np.clip(distances_km / max(float(speed_kmph), 0.1), a_min=0.0, a_max=None)

        if duration_minutes is not None and duration_minutes > 0 and total_distance_km > 0:
            # Keep provider ETA consistent by scaling segment times to requested duration.
            expected_total_hours = float(duration_minutes) / 60.0
            base_total_hours = float(np.sum(segment_time_hours))
            if base_total_hours > 0:
                segment_time_hours = segment_time_hours * (expected_total_hours / base_total_hours)

        exposure_values = nearest_aqi * segment_time_hours * float(breathing_rate)
        total_time_hours = float(np.sum(segment_time_hours))
        average_aqi = float(np.sum(nearest_aqi * segment_time_hours) / total_time_hours) if total_time_hours > 0 else 0.0

        traffic_factor, road_factor = self._contextual_factors(travel_mode=travel_mode, strategy=strategy)
        total_exposure = float(np.sum(exposure_values)) * traffic_factor * road_factor

        # Add emission penalty for polluting transport modes
        emission_factor = self.EMISSION_FACTOR_BY_MODE.get(str(travel_mode).lower(), 0.0)
        emission_penalty = float(np.sum(nearest_aqi * distances_km)) * emission_factor
        total_exposure += emission_penalty

        return {
            "total_exposure": round(total_exposure, 3),
            "average_aqi": round(average_aqi, 2),
            "traffic_factor": round(traffic_factor, 2),
            "road_factor": round(road_factor, 2),
            "breathing_rate": round(float(breathing_rate), 2),
            "total_time_hours": round(total_time_hours, 3),
            "risk_level": self._risk_level(average_aqi),
        }

    def segment_cost(
        self,
        *,
        distance_km: float,
        average_speed_kmph: float,
        pm25: float,
        traffic_density: float = 0.0,
        high_aqi_penalty: float = 0.0,
        pm10: float | None = None,
        no2: float | None = None,
    ) -> float:
        """Compute segment cost with distance, exposure, traffic, and AQI penalty.

        Formula:
          segment_time = distance / average_speed
          pollution_exposure = pm25 * segment_time
          segment_cost =
              0.3 * distance +
              0.4 * pollution_exposure +
              0.2 * traffic_density +
              0.1 * high_aqi_penalty

        `pm10` and `no2` are accepted for backward compatibility.
        """
        distance = max(float(distance_km), 0.0)
        speed = max(float(average_speed_kmph), 0.1)
        pm25_val = max(float(pm25), 0.0)

        segment_time = distance / speed
        pollution_exposure = pm25_val * segment_time

        traffic_component = max(float(traffic_density), 0.0)
        penalty_component = max(float(high_aqi_penalty), 0.0)

        cost = (
            (0.3 * distance)
            + (0.4 * pollution_exposure)
            + (0.2 * traffic_component)
            + (0.1 * penalty_component)
        )
        return round(cost, 3)

    def cumulative_route_score(self, segments: Sequence[dict[str, float]]) -> float:
        """Return cumulative route score from per-segment inputs."""
        total = 0.0
        for segment in segments:
            total += self.segment_cost(
                distance_km=float(segment.get("distance_km", 0.0)),
                average_speed_kmph=float(segment.get("average_speed_kmph", 0.0)),
                pm25=float(segment.get("pm25", 0.0)),
                traffic_density=float(segment.get("traffic_density", 0.0)),
                high_aqi_penalty=float(segment.get("high_aqi_penalty", 0.0)),
            )
        return round(total, 3)

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
        grid_aqi = np.array(
            [float(cell.get("pollution_score", cell.get("pm25", cell.get("aqi", 0.0)))) for cell in pollution_grid],
            dtype=np.float64,
        )

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

    def _contextual_factors(self, travel_mode: str, strategy: str) -> tuple[float, float]:
        traffic_factor_map = {
            "driving": 1.30,
            "cycling": 1.10,
            "walking": 0.90,
        }
        traffic_factor = traffic_factor_map.get(str(travel_mode).lower(), 1.0)

        strategy_name = str(strategy).lower()
        road_factor = 1.0
        if "highway" in strategy_name or "fastest" in strategy_name:
            road_factor = 1.15
        elif "park" in strategy_name or "green" in strategy_name:
            road_factor = 0.80
        elif "balanced" in strategy_name:
            road_factor = 0.95

        return traffic_factor, road_factor
