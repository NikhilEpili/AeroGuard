from __future__ import annotations

import os
from datetime import UTC, datetime
from math import asin, cos, radians, sin, sqrt

import requests

from backend.core.config import get_settings
from backend.core.logging import get_logger


logger = get_logger(__name__)


def _distance_m(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Haversine distance in meters."""
    earth_radius_m = 6_371_000.0
    d_lat = radians(lat2 - lat1)
    d_lon = radians(lon2 - lon1)
    a = (
        sin(d_lat / 2) ** 2
        + cos(radians(lat1)) * cos(radians(lat2)) * sin(d_lon / 2) ** 2
    )
    c = 2 * asin(sqrt(a))
    return earth_radius_m * c


def fetch_openaq_data(city: str) -> list[dict[str, float | str]]:
    """Fetch latest OpenAQ measurements for a city.

    Returns standardized rows containing:
    latitude, longitude, pm25, pm10, no2, co, timestamp

    If the API fails or returns unexpected data, returns an empty list.
    """
    settings = get_settings()
    base_url = settings.openaq_base_url.rstrip("/")
    url = f"{base_url}/locations"

    params = {
        "city": city,
        "limit": settings.openaq_location_limit,
        "order_by": "datetime",
        "sort": "desc",
    }

    try:
        response = requests.get(url, params=params, timeout=10)
        response.raise_for_status()
        payload = response.json()
    except requests.RequestException as exc:
        logger.warning("OpenAQ request failed for city '%s': %s", city, exc)
        return []
    except ValueError as exc:
        logger.warning("OpenAQ returned invalid JSON for city '%s': %s", city, exc)
        return []

    items = payload.get("results") or payload.get("data") or []
    if not isinstance(items, list):
        return []

    standardized: list[dict[str, float | str]] = []

    for item in items:
        coordinates = item.get("coordinates") or item.get("location", {}).get("coordinates") or {}

        lat = coordinates.get("latitude")
        lon = coordinates.get("longitude")
        if (lat is None or lon is None) and isinstance(coordinates, (list, tuple)) and len(coordinates) >= 2:
            lon, lat = coordinates[0], coordinates[1]

        if lat is None or lon is None:
            continue

        pm25 = pm10 = no2 = co = 0.0
        timestamp: str | None = None

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

            if parameter == "pm25":
                pm25 = float(value)
            elif parameter == "pm10":
                pm10 = float(value)
            elif parameter == "no2":
                no2 = float(value)
            elif parameter == "co":
                co = float(value)

            date_info = measurement.get("lastUpdated") or measurement.get("datetime") or measurement.get("date")
            if isinstance(date_info, str):
                timestamp = date_info
            elif isinstance(date_info, dict):
                timestamp = date_info.get("utc") or date_info.get("local")

        standardized.append(
            {
                "latitude": float(lat),
                "longitude": float(lon),
                "pm25": pm25,
                "pm10": pm10,
                "no2": no2,
                "co": co,
                "timestamp": timestamp or datetime.now(UTC).isoformat(),
            }
        )

    return standardized


def fetch_waqi_data(city: str) -> list[dict[str, float | str]]:
    """Fetch latest WAQI measurements for a city.

    Returns standardized rows containing:
    latitude, longitude, pm25, pm10, no2, co, timestamp

    If token is missing, API fails, or payload is invalid, returns an empty list.
    """
    token = os.getenv("WAQI_API_TOKEN", "").strip()
    if not token:
        logger.warning("WAQI_API_TOKEN is not configured")
        return []

    url = f"https://api.waqi.info/feed/{city}/"
    params = {"token": token}

    try:
        response = requests.get(url, params=params, timeout=10)
        response.raise_for_status()
        payload = response.json()
    except requests.RequestException as exc:
        logger.warning("WAQI request failed for city '%s': %s", city, exc)
        return []
    except ValueError as exc:
        logger.warning("WAQI returned invalid JSON for city '%s': %s", city, exc)
        return []

    if payload.get("status") != "ok":
        logger.warning("WAQI returned non-ok status for city '%s': %s", city, payload.get("status"))
        return []

    data = payload.get("data") or {}
    iaqi = data.get("iaqi") or {}

    geo = (data.get("city") or {}).get("geo") or []
    lat = float(geo[0]) if isinstance(geo, (list, tuple)) and len(geo) >= 2 else 0.0
    lon = float(geo[1]) if isinstance(geo, (list, tuple)) and len(geo) >= 2 else 0.0

    def _metric(name: str) -> float:
        metric = iaqi.get(name) or {}
        value = metric.get("v")
        if value is None:
            return 0.0
        try:
            return float(value)
        except (TypeError, ValueError):
            return 0.0

    timestamp = (data.get("time") or {}).get("iso") or datetime.now(UTC).isoformat()

    return [
        {
            "latitude": lat,
            "longitude": lon,
            "pm25": _metric("pm25"),
            "pm10": _metric("pm10"),
            "no2": _metric("no2"),
            "co": _metric("co"),
            "timestamp": timestamp,
        }
    ]


def get_combined_aqi_data(city: str) -> list[dict[str, float | str]]:
    """Fetch OpenAQ + WAQI data, merge, and drop nearby duplicates (<200m)."""
    openaq_rows = fetch_openaq_data(city)
    waqi_rows = fetch_waqi_data(city)

    combined = [*openaq_rows, *waqi_rows]
    deduplicated: list[dict[str, float | str]] = []

    for row in combined:
        lat = float(row.get("latitude", 0.0))
        lon = float(row.get("longitude", 0.0))
        if lat == 0.0 and lon == 0.0:
            continue

        is_duplicate = any(
            _distance_m(
                lat,
                lon,
                float(existing.get("latitude", 0.0)),
                float(existing.get("longitude", 0.0)),
            ) < 200.0
            for existing in deduplicated
        )
        if not is_duplicate:
            deduplicated.append(row)

    return deduplicated


def calculate_pollution_score(sensor: dict[str, float | str]) -> float:
    """Calculate weighted pollution score for a sensor reading."""

    def _num(key: str) -> float:
        value = sensor.get(key, 0.0)
        if value is None:
            return 0.0
        try:
            return float(value)
        except (TypeError, ValueError):
            return 0.0

    pm25 = _num("pm25")
    pm10 = _num("pm10")
    no2 = _num("no2")
    co = _num("co")

    return (0.6 * pm25) + (0.2 * pm10) + (0.1 * no2) + (0.1 * co)


def generate_city_grid(city_center_lat: float, city_center_lon: float) -> list[dict[str, float]]:
    """Generate 1km x 1km city grid cells with lat/lon/pollution_score.

    Current implementation builds a 10km x 10km area (100 cells) around city center.
    """
    km_per_deg_lat = 111.32
    km_per_deg_lon = max(111.32 * cos(radians(city_center_lat)), 0.01)

    cell_size_km = 1.0
    cells_per_axis = 10
    half_cells = cells_per_axis / 2.0

    grid_cells: list[dict[str, float]] = []

    for row in range(cells_per_axis):
        for col in range(cells_per_axis):
            d_lat_km = (row - half_cells + 0.5) * cell_size_km
            d_lon_km = (col - half_cells + 0.5) * cell_size_km

            lat = city_center_lat + (d_lat_km / km_per_deg_lat)
            lon = city_center_lon + (d_lon_km / km_per_deg_lon)

            # Deterministic baseline score for demo grids.
            radial = sqrt((d_lat_km * d_lat_km) + (d_lon_km * d_lon_km))
            spatial_variation = (8.0 * sin(lat * 20.0)) + (6.0 * cos(lon * 20.0))
            pollution_score = max(0.0, min(500.0, 55.0 + (0.8 * radial) + spatial_variation))

            grid_cells.append(
                {
                    "lat": round(lat, 6),
                    "lon": round(lon, 6),
                    "pollution_score": round(pollution_score, 2),
                }
            )

    return grid_cells


def interpolate_pollution(
    grid_cells: list[dict[str, float]],
    sensors: list[dict[str, float | str]],
) -> list[dict[str, float]]:
    """Apply inverse distance weighting interpolation over grid cells.

    Formula:
      weight = 1 / distance
      score = Σ(weight * sensor_score) / Σ(weight)
    """
    if not grid_cells:
        return []

    if not sensors:
        return [
            {
                "lat": float(cell.get("lat", 0.0)),
                "lon": float(cell.get("lon", 0.0)),
                "pollution_score": float(cell.get("pollution_score", 0.0)),
            }
            for cell in grid_cells
        ]

    sensor_points: list[tuple[float, float, float]] = []
    for sensor in sensors:
        try:
            s_lat = float(sensor.get("latitude", sensor.get("lat", 0.0)))
            s_lon = float(sensor.get("longitude", sensor.get("lon", 0.0)))
        except (TypeError, ValueError):
            continue

        if s_lat == 0.0 and s_lon == 0.0:
            continue

        raw_score = sensor.get("pollution_score")
        if raw_score is None:
            score = calculate_pollution_score(sensor)
        else:
            try:
                score = float(raw_score)
            except (TypeError, ValueError):
                score = calculate_pollution_score(sensor)

        sensor_points.append((s_lat, s_lon, score))

    if not sensor_points:
        return [
            {
                "lat": float(cell.get("lat", 0.0)),
                "lon": float(cell.get("lon", 0.0)),
                "pollution_score": float(cell.get("pollution_score", 0.0)),
            }
            for cell in grid_cells
        ]

    updated_cells: list[dict[str, float]] = []
    for cell in grid_cells:
        c_lat = float(cell.get("lat", 0.0))
        c_lon = float(cell.get("lon", 0.0))

        weighted_sum = 0.0
        weight_total = 0.0
        exact_score: float | None = None

        for s_lat, s_lon, s_score in sensor_points:
            distance_m = _distance_m(c_lat, c_lon, s_lat, s_lon)
            if distance_m < 1e-6:
                exact_score = s_score
                break

            weight = 1.0 / distance_m
            weighted_sum += weight * s_score
            weight_total += weight

        if exact_score is not None:
            interpolated_score = exact_score
        elif weight_total > 0:
            interpolated_score = weighted_sum / weight_total
        else:
            interpolated_score = float(cell.get("pollution_score", 0.0))

        updated_cells.append(
            {
                "lat": round(c_lat, 6),
                "lon": round(c_lon, 6),
                "pollution_score": round(interpolated_score, 2),
            }
        )

    return updated_cells


def fetch_weather_data(city: str) -> dict[str, float]:
    """Fetch weather data from OpenWeatherMap for a city.

    Returns:
      wind_speed (km/h), humidity (%), temperature (°C)

    Returns empty dict on failure.
    """
    api_key = os.getenv("OPENWEATHER_API_KEY", "").strip()
    if not api_key:
        logger.warning("OPENWEATHER_API_KEY is not configured")
        return {}

    url = "https://api.openweathermap.org/data/2.5/weather"
    params = {
        "q": city,
        "appid": api_key,
        "units": "metric",
    }

    try:
        response = requests.get(url, params=params, timeout=10)
        response.raise_for_status()
        payload = response.json()
    except requests.RequestException as exc:
        logger.warning("OpenWeather request failed for city '%s': %s", city, exc)
        return {}
    except ValueError as exc:
        logger.warning("OpenWeather returned invalid JSON for city '%s': %s", city, exc)
        return {}

    wind_mps = float((payload.get("wind") or {}).get("speed", 0.0) or 0.0)
    humidity = float((payload.get("main") or {}).get("humidity", 0.0) or 0.0)
    temperature = float((payload.get("main") or {}).get("temp", 0.0) or 0.0)

    return {
        "wind_speed": round(wind_mps * 3.6, 2),  # m/s -> km/h
        "humidity": round(humidity, 2),
        "temperature": round(temperature, 2),
    }


def adjust_pollution_with_weather(
    grid_cells: list[dict[str, float]],
    weather: dict[str, float],
) -> list[dict[str, float]]:
    """Adjust grid pollution scores using weather rules.

    Rules:
    - If wind_speed > 8 km/h, reduce pollution by 10%
    - If humidity > 80%, increase pollution by 5%
    """
    if not grid_cells:
        return []

    wind_speed = float(weather.get("wind_speed", 0.0) or 0.0)
    humidity = float(weather.get("humidity", 0.0) or 0.0)

    factor = 1.0
    if wind_speed > 8.0:
        factor *= 0.90
    if humidity > 80.0:
        factor *= 1.05

    updated: list[dict[str, float]] = []
    for cell in grid_cells:
        score = float(cell.get("pollution_score", 0.0) or 0.0)
        updated.append(
            {
                "lat": float(cell.get("lat", 0.0)),
                "lon": float(cell.get("lon", 0.0)),
                "pollution_score": round(max(0.0, score * factor), 2),
            }
        )

    return updated
