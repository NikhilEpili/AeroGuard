import asyncio
import json
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.api.route_api import router as route_router
from backend.api.sensor_api import router as sensor_router
from backend.cache.redis_client import get_redis_client
from backend.core.logging import configure_logging, get_logger
from backend.services.pollution_grid_job import POLLUTION_GRID_REDIS_KEY
from backend.services.pollution_grid_job import run_pollution_grid_updater
from backend.modules.exposure.router import router as exposure_router
from backend.modules.health.router import router as health_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    configure_logging()
    logger = get_logger(__name__)
    logger.info("Starting AeroGuard backend")
    # updater_task = asyncio.create_task(run_pollution_grid_updater())
    yield
    # updater_task.cancel()
    try:
        await updater_task
    except asyncio.CancelledError:
        pass
    logger.info("Stopping AeroGuard backend")


app = FastAPI(
    title="AeroGuard Backend",
    version="0.1.0",
    description="Production-grade backend scaffold for safe route navigation.",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(route_router, prefix="/api/v1")
app.include_router(sensor_router, prefix="/api/v1")
app.include_router(exposure_router, prefix="/api/v1")
app.include_router(health_router, prefix="/api/v1")

redis_client = get_redis_client()


@app.get("/health", tags=["health"])
async def healthcheck() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/api/pollution-grid", tags=["pollution"])
async def get_pollution_grid() -> dict[str, int | str | list[dict[str, float | int]]]:
    payload = await redis_client.get(POLLUTION_GRID_REDIS_KEY)
    if payload:
        data = json.loads(payload)
        return {
            "source": "redis",
            "updated_at": str(data.get("updated_at", "")),
            "cell_count": int(data.get("cell_count", 0)),
            "grid": data.get("grid", []),
        }

    return {
        "source": "empty",
        "updated_at": "",
        "cell_count": 0,
        "grid": [],
    }
