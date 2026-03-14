from contextlib import asynccontextmanager

from fastapi import FastAPI

from backend.api.route_api import router as route_router
from backend.api.sensor_api import router as sensor_router
from backend.core.logging import configure_logging, get_logger


@asynccontextmanager
async def lifespan(app: FastAPI):
    configure_logging()
    logger = get_logger(__name__)
    logger.info("Starting AeroGuard backend")
    yield
    logger.info("Stopping AeroGuard backend")


app = FastAPI(
    title="AeroGuard Backend",
    version="0.1.0",
    description="Production-grade backend scaffold for safe route navigation.",
    lifespan=lifespan,
)

app.include_router(route_router, prefix="/api/v1")
app.include_router(sensor_router, prefix="/api/v1")


@app.get("/health", tags=["health"])
async def healthcheck() -> dict[str, str]:
    return {"status": "ok"}
