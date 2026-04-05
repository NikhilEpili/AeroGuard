import json
from typing import Any
from typing import Literal

from fastapi import APIRouter, Depends, Query
from fastapi.concurrency import run_in_threadpool
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from backend.cache.redis_client import get_redis_client
from backend.api.route_controller import RouteController
from backend.core.config import get_settings
from backend.db.database import get_db
from backend.routing.graph_loader import GraphLoader
from backend.routing.safe_route_engine import SafeRouteEngine
from backend.services.directions_service import DirectionsService
from backend.services.pollution_grid_job import POLLUTION_GRID_REDIS_KEY
from backend.services.pollution_service import PollutionService
from backend.utils.geo_utils import to_geojson_linestring

router = APIRouter(prefix="/routes", tags=["routes"])
directions_service = DirectionsService()
pollution_service = PollutionService()
safe_route_engine = SafeRouteEngine()
route_controller = RouteController()
graph_loader = GraphLoader()
redis_client = get_redis_client()
settings = get_settings()
CACHE_TTL_SECONDS = 300
TRAFFIC_MULTIPLIERS = {
    "low": 1.0,
    "medium": 1.2,
    "high": 1.5,
}


class RouteRequest(BaseModel):
    origin_lat: float = Field(..., ge=-90, le=90)
    origin_lng: float = Field(..., ge=-180, le=180)
    destination_lat: float = Field(..., ge=-90, le=90)
    destination_lng: float = Field(..., ge=-180, le=180)
    travel_mode: Literal["walking", "cycling", "bike", "driving"] = "walking"


class RouteOption(BaseModel):
    route_id: str
    duration_minutes: float
    distance_km: float
    exposure_score: float
    strategy: str
    geometry: dict[str, Any]


class SafeRouteResponse(BaseModel):
    best_route: RouteOption
    alternatives: list[RouteOption]


class SafeRouteCachedResponse(BaseModel):
    route: dict
    routes: list[dict]
    exposure_score: float
    average_aqi: float
    risk_level: str
    route_type: Literal["fastest", "balanced", "cleanest", "safe", "safest"]
    uses_predicted_pollution: bool
    fastest: dict[str, Any]
    safe: dict[str, Any]
    balanced: dict[str, Any]
    fastest_route: dict
    safe_route: dict
    balanced_route: dict
    cleanest_route: dict
    safest_route: dict
    fastest_route_exposure: float
    safe_route_exposure: float
    reduction_percentage: float
    avoided_exposure: float
    pollution_saved_percent: float
    equivalent_cigarettes_avoided: float
    exposure_reduction_percent: float
    distance_increase_percent: float


class GraphPrecomputeResponse(BaseModel):
    status: str
    nodes: int
    segments: int
    travel_mode: str


class GraphRouteResponse(BaseModel):
    geometry: dict[str, Any]
    distance_km: float
    duration_minutes: float
    exposure_score: float
    average_aqi: float
    algorithm: str


class GraphRouteOptionResponse(BaseModel):
    route_type: Literal["fastest", "balanced", "safest"]
    weight_distance: float
    weight_pollution: float
    geometry: dict[str, Any]
    distance_km: float
    duration_minutes: float
    pollution_exposure: float
    average_aqi: float
    objective_score: float
    algorithm: str


class GraphMultiObjectiveResponse(BaseModel):
    routes: list[GraphRouteOptionResponse]
    fastest_route: GraphRouteOptionResponse
    balanced_route: GraphRouteOptionResponse
    safest_route: GraphRouteOptionResponse


def _as_geojson_linestring(geometry: Any) -> dict[str, Any]:
    if isinstance(geometry, dict) and geometry.get("type") == "LineString":
        coordinates = geometry.get("coordinates", [])
        if isinstance(coordinates, list):
            return to_geojson_linestring(coordinates)
        return {"type": "LineString", "coordinates": []}

    if isinstance(geometry, list):
        return to_geojson_linestring(geometry)

    return {"type": "LineString", "coordinates": []}


def _normalize_route_geojson(route: dict[str, Any]) -> dict[str, Any]:
    normalized = dict(route)
    geometry = normalized.get("geometry") or normalized.get("coordinates") or []
    geojson = _as_geojson_linestring(geometry)
    normalized["geometry"] = geojson
    normalized["coordinates"] = list(geojson.get("coordinates", []))
    return normalized


def _normalize_bundle_geojson(bundle: dict[str, Any]) -> dict[str, Any]:
    normalized = dict(bundle)

    if isinstance(normalized.get("routes"), list):
        normalized["routes"] = [
            _normalize_route_geojson(route)
            for route in normalized["routes"]
            if isinstance(route, dict)
        ]

    for key in ["route", "fastest_route", "balanced_route", "safe_route", "cleanest_route", "safest_route"]:
        value = normalized.get(key)
        if isinstance(value, dict):
            normalized[key] = _normalize_route_geojson(value)

    for key in ["fastest", "balanced", "safe"]:
        value = normalized.get(key)
        normalized[key] = _as_geojson_linestring(value)

    return normalized


@router.post("/safe", response_model=SafeRouteResponse)
async def get_safe_route(payload: RouteRequest) -> SafeRouteResponse:
    pollution_grid_payload = await redis_client.get(POLLUTION_GRID_REDIS_KEY)
    if pollution_grid_payload:
        pollution_grid = json.loads(pollution_grid_payload).get("grid", [])
    else:
        pollution_grid = await pollution_service.build_pollution_grid_snapshot(
            start_location=(payload.origin_lat, payload.origin_lng),
            destination=(payload.destination_lat, payload.destination_lng),
            use_forecast=False,
        )

    route_bundle = await run_in_threadpool(
        route_controller.build_route_bundle,
        start_lat=payload.origin_lat,
        start_lon=payload.origin_lng,
        end_lat=payload.destination_lat,
        end_lon=payload.destination_lng,
        travel_mode=payload.travel_mode,
        pollution_grid=pollution_grid,
        use_predicted_pollution=False,
    )

    selected = [
        route_bundle.get("safe_route", {}),
        route_bundle.get("balanced_route", {}),
        route_bundle.get("fastest_route", {}),
    ]

    options: list[RouteOption] = []
    seen: set[str] = set()
    for route in selected:
        normalized_route = _normalize_route_geojson(route)
        route_id = str(normalized_route.get("route_id", ""))
        if not route_id or route_id in seen:
            continue
        seen.add(route_id)
        options.append(
            RouteOption(
                route_id=route_id,
                duration_minutes=float(normalized_route.get("duration_minutes", 0.0)),
                distance_km=float(normalized_route.get("distance_km", 0.0)),
                exposure_score=float(normalized_route.get("exposure_score", 0.0)),
                strategy=str(normalized_route.get("route_type", normalized_route.get("strategy", "safe"))),
                geometry=normalized_route.get("geometry", {"type": "LineString", "coordinates": []}),
            )
        )

    if not options:
        raise ValueError("No candidate routes found")

    return SafeRouteResponse(best_route=options[0], alternatives=options[1:])


@router.get("/safe-route", response_model=SafeRouteCachedResponse)
async def get_safe_route_cached(
    start_lat: float = Query(..., ge=-90, le=90),
    start_lon: float = Query(..., ge=-180, le=180),
    end_lat: float = Query(..., ge=-90, le=90),
    end_lon: float = Query(..., ge=-180, le=180),
    travel_mode: Literal["walking", "cycling", "bike", "driving"] = Query("walking"),
    route_type: Literal["fastest", "balanced", "cleanest", "safest"] = Query("cleanest"),
    use_predicted_pollution: bool = Query(False),
) -> SafeRouteCachedResponse:
    route_bundle_cache_key = (
        "safe_route_bundle:"
        f"{start_lat:.5f}:{start_lon:.5f}:{end_lat:.5f}:{end_lon:.5f}:"
        f"{travel_mode}:{int(use_predicted_pollution)}"
    )

    def _select_route(bundle: dict, selected_route_type: str) -> dict:
        normalized_bundle = _normalize_bundle_geojson(bundle)
        normalized_route_type = "safe" if selected_route_type in {"safest", "cleanest"} else selected_route_type
        selected_route = {
            "fastest": normalized_bundle["fastest_route"],
            "balanced": normalized_bundle["balanced_route"],
            "safe": normalized_bundle["safe_route"],
        }[normalized_route_type]

        response = {
            **normalized_bundle,
            "route": selected_route,
            "route_type": normalized_route_type,
            "exposure_score": float(selected_route.get("exposure_score", 0.0)),
            "average_aqi": float(selected_route.get("average_aqi", 0.0)),
            "risk_level": str(selected_route.get("risk_level", "Low")),
        }
        return response

    cached = await redis_client.get(route_bundle_cache_key)
    if cached:
        bundle = json.loads(cached)
        return SafeRouteCachedResponse(**_select_route(bundle, route_type))

    pollution_grid_payload = await redis_client.get(POLLUTION_GRID_REDIS_KEY)
    if pollution_grid_payload:
        pollution_grid = json.loads(pollution_grid_payload).get("grid", [])
    else:
        # cold-start fallback until background updater seeds Redis
        pollution_grid = await pollution_service.build_pollution_grid_snapshot(
            start_location=(start_lat, start_lon),
            destination=(end_lat, end_lon),
            use_forecast=use_predicted_pollution,
        )

    route_bundle = await run_in_threadpool(
        route_controller.build_route_bundle,
        start_lat=start_lat,
        start_lon=start_lon,
        end_lat=end_lat,
        end_lon=end_lon,
        travel_mode=travel_mode,
        pollution_grid=pollution_grid,
        use_predicted_pollution=use_predicted_pollution,
    )

    await redis_client.setex(route_bundle_cache_key, CACHE_TTL_SECONDS, json.dumps(route_bundle))
    return SafeRouteCachedResponse(**_select_route(route_bundle, route_type))


@router.get("/predict-pollution")
async def predict_pollution(
    lat: float = Query(..., ge=-90, le=90),
    lon: float = Query(..., ge=-180, le=180),
) -> dict[str, float | str]:
    forecast = pollution_service.predict_aqi_next_30_minutes(lat, lon)
    future_aqi = float(forecast["future_aqi"])
    future_pm25 = pollution_service.aqi_to_pm25_approx(future_aqi)
    return {
        "lat": lat,
        "lon": lon,
        "pm25_next_30_min": round(future_pm25, 2),
        "aqi_next_30_min": round(future_aqi, 2),
        "current_aqi": round(float(forecast["current_aqi"]), 2),
        "previous_hour_aqi": round(float(forecast["previous_hour_aqi"]), 2),
        "weather_factor": round(float(forecast["weather_factor"]), 2),
        "risk_level": pollution_service.aqi_risk_level(future_aqi),
    }


@router.get("/pollution-heatmap")
async def get_pollution_heatmap(
    min_lat: float = Query(18.88, ge=-90, le=90),
    min_lon: float = Query(72.73, ge=-180, le=180),
    max_lat: float = Query(19.30, ge=-90, le=90),
    max_lon: float = Query(73.05, ge=-180, le=180),
    grid_size_m: int = Query(200, ge=100, le=2000),
    use_predicted_pollution: bool = Query(False),
) -> dict[str, int | list[dict[str, float | int | str]]]:
    points = await run_in_threadpool(
        pollution_service.get_pollution_heatmap,
        min_lat=min_lat,
        min_lon=min_lon,
        max_lat=max_lat,
        max_lon=max_lon,
        grid_size_m=grid_size_m,
        use_forecast=use_predicted_pollution,
    )
    return {
        "cell_count": len(points),
        "points": points,
    }


@router.post("/graph/precompute", response_model=GraphPrecomputeResponse)
async def precompute_graph_segments(
    min_lat: float = Query(18.88, ge=-90, le=90),
    min_lon: float = Query(72.73, ge=-180, le=180),
    max_lat: float = Query(19.30, ge=-90, le=90),
    max_lon: float = Query(73.05, ge=-180, le=180),
    grid_size_m: int = Query(200, ge=100, le=2000),
    travel_mode: Literal["walking", "cycling", "bike", "driving"] = Query("walking"),
    replace_existing: bool = Query(True),
    db: Session = Depends(get_db),
) -> GraphPrecomputeResponse:
    payload = await run_in_threadpool(
        graph_loader.precompute_road_segments,
        db,
        min_lat=min_lat,
        min_lon=min_lon,
        max_lat=max_lat,
        max_lon=max_lon,
        grid_size_m=grid_size_m,
        travel_mode=travel_mode,
        replace_existing=replace_existing,
    )
    return GraphPrecomputeResponse(**payload)


@router.get("/graph/safe-route", response_model=GraphRouteResponse)
async def graph_safe_route(
    start_lat: float = Query(..., ge=-90, le=90),
    start_lon: float = Query(..., ge=-180, le=180),
    end_lat: float = Query(..., ge=-90, le=90),
    end_lon: float = Query(..., ge=-180, le=180),
    travel_mode: Literal["walking", "cycling", "driving"] = Query("walking"),
    use_alt: bool = Query(False),
    db: Session = Depends(get_db),
) -> GraphRouteResponse:
    margin = 0.05
    min_lat = min(start_lat, end_lat) - margin
    max_lat = max(start_lat, end_lat) + margin
    min_lon = min(start_lon, end_lon) - margin
    max_lon = max(start_lon, end_lon) + margin

    adjacency, node_coords = await run_in_threadpool(
        graph_loader.load_graph,
        db,
        min_lat=min_lat,
        min_lon=min_lon,
        max_lat=max_lat,
        max_lon=max_lon,
        travel_mode=travel_mode,
    )
    if not node_coords:
        raise ValueError("No precomputed graph data found. Run /api/v1/routes/graph/precompute first.")

    start_node = await run_in_threadpool(graph_loader.find_nearest_node, node_coords, start_lat, start_lon)
    end_node = await run_in_threadpool(graph_loader.find_nearest_node, node_coords, end_lat, end_lon)
    route = await run_in_threadpool(
        graph_loader.route_astar,
        adjacency,
        node_coords,
        start_node=start_node,
        end_node=end_node,
        use_alt=use_alt,
        travel_mode=travel_mode,
    )
    route["algorithm"] = "ALT" if use_alt else "A*"
    route = _normalize_route_geojson(route)
    return GraphRouteResponse(**route)


@router.get("/graph/multi-objective-route", response_model=GraphMultiObjectiveResponse)
async def graph_multi_objective_route(
    start_lat: float = Query(..., ge=-90, le=90),
    start_lon: float = Query(..., ge=-180, le=180),
    end_lat: float = Query(..., ge=-90, le=90),
    end_lon: float = Query(..., ge=-180, le=180),
    travel_mode: Literal["walking", "cycling", "driving"] = Query("walking"),
    use_alt: bool = Query(False),
    db: Session = Depends(get_db),
) -> GraphMultiObjectiveResponse:
    margin = 0.05
    min_lat = min(start_lat, end_lat) - margin
    max_lat = max(start_lat, end_lat) + margin
    min_lon = min(start_lon, end_lon) - margin
    max_lon = max(start_lon, end_lon) + margin

    adjacency, node_coords = await run_in_threadpool(
        graph_loader.load_graph,
        db,
        min_lat=min_lat,
        min_lon=min_lon,
        max_lat=max_lat,
        max_lon=max_lon,
        travel_mode=travel_mode,
    )
    if not node_coords:
        raise ValueError("No precomputed graph data found. Run /api/v1/routes/graph/precompute first.")

    start_node = await run_in_threadpool(graph_loader.find_nearest_node, node_coords, start_lat, start_lon)
    end_node = await run_in_threadpool(graph_loader.find_nearest_node, node_coords, end_lat, end_lon)

    payload = await run_in_threadpool(
        graph_loader.route_multi_objective,
        adjacency,
        node_coords,
        start_node=start_node,
        end_node=end_node,
        use_alt=use_alt,
        travel_mode=travel_mode,
    )
    routes = [
        _normalize_route_geojson(route)
        for route in payload.get("routes", [])
        if isinstance(route, dict)
    ]
    by_type = {str(route.get("route_type", "")): route for route in routes}
    payload["routes"] = routes
    payload["fastest_route"] = by_type.get("fastest", payload.get("fastest_route", {}))
    payload["balanced_route"] = by_type.get("balanced", payload.get("balanced_route", {}))
    payload["safest_route"] = by_type.get("safest", payload.get("safest_route", {}))
    return GraphMultiObjectiveResponse(**payload)
