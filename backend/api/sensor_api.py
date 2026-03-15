from fastapi import APIRouter, Depends, Query, status
from pydantic import BaseModel, Field
from sqlalchemy import text
from sqlalchemy.orm import Session

from backend.db.database import get_db
from backend.iot.sensor_simulator import SensorSimulator
from backend.services.pollution_service import PollutionService

router = APIRouter(prefix="/sensors", tags=["sensors"])
sensor_simulator = SensorSimulator()
pollution_service = PollutionService()


class SensorIngestRequest(BaseModel):
    sensor_id: str = Field(..., min_length=3)
    latitude: float = Field(..., ge=-90, le=90)
    longitude: float = Field(..., ge=-180, le=180)
    pm25: float = Field(..., ge=0)
    pm10: float = Field(..., ge=0)
    no2: float = Field(..., ge=0)


@router.post("/ingest", status_code=status.HTTP_202_ACCEPTED)
async def ingest_sensor_reading(payload: SensorIngestRequest) -> dict[str, str]:
    await pollution_service.ingest_sensor_reading(payload.model_dump())
    return {"status": "accepted", "sensor_id": payload.sensor_id}


@router.get("/simulate")
async def simulate_sensor_reading() -> dict[str, float | str]:
    reading = sensor_simulator.generate_reading()
    return reading


@router.get("/simulate/batch")
async def simulate_sensor_batch() -> list[dict[str, float | str]]:
    return [sensor_simulator.generate_reading(sensor) for sensor in sensor_simulator.sensors]


@router.get("/nearby")
async def get_nearby_sensors(
    lat: float = Query(..., ge=-90, le=90),
    lon: float = Query(..., ge=-180, le=180),
    radius_m: int = Query(2000, ge=1, le=50000),
    limit: int = Query(50, ge=1, le=500),
    db: Session = Depends(get_db),
) -> list[dict[str, float | int | str]]:
    """Find sensors within radius using PostGIS ST_DWithin (meters)."""
    query = text(
        """
        SELECT
            s.id,
            s.location_name,
            s.latitude,
            s.longitude,
            ST_Distance(
                s.geom::geography,
                ST_SetSRID(ST_MakePoint(:lon, :lat), 4326)::geography
            ) AS distance_m
        FROM sensors s
        WHERE ST_DWithin(
            s.geom::geography,
            ST_SetSRID(ST_MakePoint(:lon, :lat), 4326)::geography,
            :radius_m
        )
        ORDER BY distance_m ASC
        LIMIT :limit
        """
    )

    rows = db.execute(
        query,
        {
            "lat": lat,
            "lon": lon,
            "radius_m": radius_m,
            "limit": limit,
        },
    ).mappings()

    return [
        {
            "id": int(row["id"]),
            "location_name": str(row["location_name"]),
            "latitude": float(row["latitude"]),
            "longitude": float(row["longitude"]),
            "distance_m": round(float(row["distance_m"]), 2),
        }
        for row in rows
    ]
