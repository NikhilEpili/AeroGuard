from __future__ import annotations

import asyncio
import json
from datetime import UTC, datetime

from backend.cache.redis_client import get_redis_client
from backend.core.config import get_settings
from backend.core.logging import get_logger
from backend.services.pollution_service import PollutionService

POLLUTION_GRID_REDIS_KEY = "pollution_grid:latest"


logger = get_logger(__name__)
settings = get_settings()
redis_client = get_redis_client()
pollution_service = PollutionService()


async def update_pollution_grid_once() -> int:
    """Build 100m pollution grid snapshot and store it in Redis."""
    # Refresh source points for the city area first (OpenAQ/simulated fallback).
    await pollution_service._source_points_for_route(  # noqa: SLF001 - controlled internal refresh call
        (settings.city_min_lat, settings.city_min_lon),
        (settings.city_max_lat, settings.city_max_lon),
    )

    points = await asyncio.to_thread(
        pollution_service.get_pollution_heatmap,
        min_lat=settings.city_min_lat,
        min_lon=settings.city_min_lon,
        max_lat=settings.city_max_lat,
        max_lon=settings.city_max_lon,
        grid_size_m=settings.pollution_grid_cell_size_m,
        use_forecast=False,
    )

    grid_rows = [
        {
            "grid_id": idx,
            "center_lat": float(point.get("lat", 0.0)),
            "center_lon": float(point.get("lon", 0.0)),
            "pm25": float(point.get("pm25", 0.0)),
            "aqi": int(point.get("aqi", 0)),
        }
        for idx, point in enumerate(points, start=1)
    ]

    payload = {
        "updated_at": datetime.now(UTC).isoformat(),
        "grid_size_m": settings.pollution_grid_cell_size_m,
        "cell_count": len(grid_rows),
        "grid": grid_rows,
    }
    await redis_client.set(POLLUTION_GRID_REDIS_KEY, json.dumps(payload))
    return len(grid_rows)


async def run_pollution_grid_updater() -> None:
    """Continuously refresh pollution grid in Redis."""
    interval = max(settings.pollution_grid_refresh_seconds, 60)
    while True:
        try:
            count = await update_pollution_grid_once()
            logger.info("Pollution grid updated in Redis: %s cells", count)
        except Exception as exc:  # pragma: no cover
            logger.exception("Pollution grid background update failed: %s", exc)

        await asyncio.sleep(interval)
