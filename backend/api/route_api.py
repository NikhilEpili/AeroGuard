import json
from typing import Literal

from fastapi import APIRouter, Query
from pydantic import BaseModel, Field

from backend.cache.redis_client import get_redis_client
from backend.routing.safe_route_engine import SafeRouteEngine
from backend.services.directions_service import DirectionsService
from backend.services.pollution_service import PollutionService

router = APIRouter(prefix="/routes", tags=["routes"])
directions_service = DirectionsService()
pollution_service = PollutionService()
safe_route_engine = SafeRouteEngine()
redis_client = get_redis_client()
CACHE_TTL_SECONDS = 300


class RouteRequest(BaseModel):
    origin_lat: float = Field(..., ge=-90, le=90)
    origin_lng: float = Field(..., ge=-180, le=180)
    destination_lat: float = Field(..., ge=-90, le=90)
    destination_lng: float = Field(..., ge=-180, le=180)
    travel_mode: Literal["walking", "cycling", "driving"] = "walking"


class RouteOption(BaseModel):
    route_id: str
    duration_minutes: float
    distance_km: float
    exposure_score: float
    strategy: str
    geometry: list[dict[str, float]]


class SafeRouteResponse(BaseModel):
    best_route: RouteOption
    alternatives: list[RouteOption]


class SafeRouteCachedResponse(BaseModel):
    route: list[dict[str, float]]
    exposure_score: float
    average_aqi: float
    risk_level: str


def _pm25_to_aqi(pm25: float) -> int:
    if pm25 <= 12.0:
        return int((50 / 12.0) * pm25)
    if pm25 <= 35.4:
        return int(((100 - 51) / (35.4 - 12.1)) * (pm25 - 12.1) + 51)
    if pm25 <= 55.4:
        return int(((150 - 101) / (55.4 - 35.5)) * (pm25 - 35.5) + 101)
    if pm25 <= 150.4:
        return int(((200 - 151) / (150.4 - 55.5)) * (pm25 - 55.5) + 151)
    return int(min(500, ((300 - 201) / (250.4 - 150.5)) * (pm25 - 150.5) + 201))


def _build_pollution_grid_snapshot() -> list[dict[str, float | int]]:
    grid: list[dict[str, float | int]] = []
    for idx, point in enumerate(pollution_service._sample_points, start=1):
        pm25 = float(point["pm25"])
        grid.append(
            {
                "grid_id": idx,
                "center_lat": float(point["latitude"]),
                "center_lon": float(point["longitude"]),
                "aqi": _pm25_to_aqi(pm25),
            }
        )
    return grid


@router.post("/safe", response_model=SafeRouteResponse)
async def get_safe_route(payload: RouteRequest) -> SafeRouteResponse:
    candidates = directions_service.get_candidate_routes(
        start_location=(payload.origin_lat, payload.origin_lng),
        destination=(payload.destination_lat, payload.destination_lng),
        travel_mode=payload.travel_mode,
    )
    scored_routes = await pollution_service.score_candidates(candidates)
    best_route, alternatives = safe_route_engine.select_best_route(scored_routes)
    return SafeRouteResponse(best_route=RouteOption(**best_route), alternatives=[RouteOption(**route) for route in alternatives])


@router.get("/safe-route", response_model=SafeRouteCachedResponse)
async def get_safe_route_cached(
    start_lat: float = Query(..., ge=-90, le=90),
    start_lon: float = Query(..., ge=-180, le=180),
    end_lat: float = Query(..., ge=-90, le=90),
    end_lon: float = Query(..., ge=-180, le=180),
) -> SafeRouteCachedResponse:
    cache_key = (
        "safe_route:"
        f"{start_lat:.6f}:{start_lon:.6f}:{end_lat:.6f}:{end_lon:.6f}"
    )

    cached = await redis_client.get(cache_key)
    if cached:
        payload = json.loads(cached)
        return SafeRouteCachedResponse(**payload)

    pollution_grid = _build_pollution_grid_snapshot()
    safest = safe_route_engine.find_safest_route(
        start_location=(start_lat, start_lon),
        destination=(end_lat, end_lon),
        pollution_grid=pollution_grid,
    )

    response = {
        "route": safest.get("route_geometry", []),
        "exposure_score": float(safest.get("exposure_score", 0.0)),
        "average_aqi": float(safest.get("average_aqi", 0.0)),
        "risk_level": str(safest.get("risk_level", "Low")),
    }

    await redis_client.setex(cache_key, CACHE_TTL_SECONDS, json.dumps(response))
    return SafeRouteCachedResponse(**response)
