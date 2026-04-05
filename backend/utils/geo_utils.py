from math import asin, cos, radians, sin, sqrt
from typing import Any


def compute_distance_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    earth_radius_km = 6371.0
    delta_lat = radians(lat2 - lat1)
    delta_lon = radians(lon2 - lon1)
    a = (
        sin(delta_lat / 2) ** 2
        + cos(radians(lat1)) * cos(radians(lat2)) * sin(delta_lon / 2) ** 2
    )
    c = 2 * asin(sqrt(a))
    return earth_radius_km * c


def midpoint(lat1: float, lon1: float, lat2: float, lon2: float) -> tuple[float, float]:
    return (lat1 + lat2) / 2, (lon1 + lon2) / 2


def to_geojson(lat: float, lng: float) -> dict[str, Any]:
    return {
        "type": "Point",
        "coordinates": [float(lng), float(lat)],
    }


def to_geojson_linestring(points: list[dict[str, float]] | list[list[float]] | list[tuple[float, float]]) -> dict[str, Any]:
    coordinates: list[list[float]] = []
    for point in points:
        if isinstance(point, dict):
            lat = point.get("lat", point.get("latitude"))
            lng = point.get("lng", point.get("lon", point.get("longitude")))
            if lat is None or lng is None:
                continue
            coordinates.append([float(lng), float(lat)])
            continue

        if isinstance(point, (list, tuple)) and len(point) >= 2:
            first = float(point[0])
            second = float(point[1])
            if abs(first) <= 180 and abs(second) <= 90:
                coordinates.append([first, second])
            elif abs(first) <= 90 and abs(second) <= 180:
                coordinates.append([second, first])

    return {
        "type": "LineString",
        "coordinates": coordinates,
    }
