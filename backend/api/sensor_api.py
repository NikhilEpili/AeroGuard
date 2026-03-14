from fastapi import APIRouter, status
from pydantic import BaseModel, Field

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
