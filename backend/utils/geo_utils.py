from math import asin, cos, radians, sin, sqrt


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
