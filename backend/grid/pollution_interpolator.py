from __future__ import annotations

from collections.abc import Sequence
from math import radians

import numpy as np


EARTH_RADIUS_M = 6_371_000.0


def distance(
    sensor_coords: np.ndarray,
    grid_coords: np.ndarray,
) -> np.ndarray:
    """Compute pairwise Haversine distances (meters) between sensors and grid cells.

    Parameters:
    - sensor_coords: shape (S, 2) as [lat, lon]
    - grid_coords: shape (G, 2) as [lat, lon]
    """
    sensors = np.asarray(sensor_coords, dtype=np.float64)
    grids = np.asarray(grid_coords, dtype=np.float64)

    sensors_lat = np.radians(sensors[:, 0])[:, None]
    sensors_lon = np.radians(sensors[:, 1])[:, None]
    grid_lat = np.radians(grids[:, 0])[None, :]
    grid_lon = np.radians(grids[:, 1])[None, :]

    d_lat = grid_lat - sensors_lat
    d_lon = grid_lon - sensors_lon

    a = (
        np.sin(d_lat / 2.0) ** 2
        + np.cos(sensors_lat) * np.cos(grid_lat) * (np.sin(d_lon / 2.0) ** 2)
    )
    c = 2.0 * np.arctan2(np.sqrt(a), np.sqrt(1.0 - a))
    return EARTH_RADIUS_M * c


def calculate_weight(
    distances_m: np.ndarray,
    power: float = 2.0,
    epsilon: float = 1.0,
) -> np.ndarray:
    """Calculate IDW weights from distance matrix.

    Uses `1 / (d + epsilon)^power` to avoid division by zero.
    """
    dist = np.asarray(distances_m, dtype=np.float64)
    return 1.0 / np.power(dist + epsilon, power)


def compute_grid_pollution(
    sensor_readings: Sequence[dict[str, float]],
    grid_cell_coordinates: Sequence[dict[str, float] | tuple[float, float]],
    pollutant_key: str = "pm25",
    power: float = 2.0,
    batch_size: int = 4096,
) -> np.ndarray:
    """Compute IDW pollution values for each grid cell.

    Returns NumPy array of shape (G,) where G is grid count.
    Optimized for large grids by processing grid cells in batches.
    """
    if not sensor_readings:
        return np.zeros(len(grid_cell_coordinates), dtype=np.float64)

    if batch_size <= 0:
        raise ValueError("batch_size must be greater than 0")

    sensor_coords = np.array(
        [[float(s["latitude"]), float(s["longitude"])] for s in sensor_readings],
        dtype=np.float64,
    )
    sensor_values = np.array([float(s[pollutant_key]) for s in sensor_readings], dtype=np.float64)

    def _grid_point(g: dict[str, float] | tuple[float, float]) -> tuple[float, float]:
        if isinstance(g, dict):
            if "center_lat" in g and "center_lon" in g:
                return float(g["center_lat"]), float(g["center_lon"])
            return float(g["latitude"]), float(g["longitude"])
        return float(g[0]), float(g[1])

    grid_coords = np.array([_grid_point(g) for g in grid_cell_coordinates], dtype=np.float64)
    grid_count = grid_coords.shape[0]
    results = np.empty(grid_count, dtype=np.float64)

    for start in range(0, grid_count, batch_size):
        end = min(start + batch_size, grid_count)
        grid_batch = grid_coords[start:end]

        dist_matrix = distance(sensor_coords, grid_batch)
        weight_matrix = calculate_weight(dist_matrix, power=power)

        weighted_sum = np.sum(weight_matrix * sensor_values[:, None], axis=0)
        weight_total = np.sum(weight_matrix, axis=0)
        results[start:end] = weighted_sum / np.maximum(weight_total, 1e-12)

    return results


class PollutionInterpolator:
    def interpolate(self, latitude: float, longitude: float, source_points: list[dict[str, float]]) -> dict[str, float]:
        if not source_points:
            return {"pm25": 0.0, "pm10": 0.0, "no2": 0.0, "confidence": 0.0}

        target = [{"center_lat": latitude, "center_lon": longitude}]
        pm25_val = compute_grid_pollution(source_points, target, pollutant_key="pm25")[0]
        pm10_val = compute_grid_pollution(source_points, target, pollutant_key="pm10")[0]
        no2_val = compute_grid_pollution(source_points, target, pollutant_key="no2")[0]

        return {
            "pm25": float(pm25_val),
            "pm10": float(pm10_val),
            "no2": float(no2_val),
            "confidence": min(1.0, len(source_points) / 10),
        }
