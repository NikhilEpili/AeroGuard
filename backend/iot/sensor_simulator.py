from __future__ import annotations

import asyncio
import math
from dataclasses import dataclass
from datetime import UTC, datetime
from random import Random

import httpx


@dataclass(slots=True)
class SimulatedSensor:
    sensor_id: str
    lat: float
    lon: float
    zone_factor: float


class SensorSimulator:
    def __init__(
        self,
        *,
        sensor_count: int = 25,
        city_bbox: tuple[float, float, float, float] = (12.90, 77.50, 13.10, 77.70),
        seed: int = 42,
    ) -> None:
        self.sensor_count = sensor_count
        self.min_lat, self.min_lon, self.max_lat, self.max_lon = city_bbox
        self.rng = Random(seed)
        self.sensors = self._build_sensors(sensor_count)

    def _build_sensors(self, sensor_count: int) -> list[SimulatedSensor]:
        sensors: list[SimulatedSensor] = []
        for index in range(sensor_count):
            lat = self.rng.uniform(self.min_lat, self.max_lat)
            lon = self.rng.uniform(self.min_lon, self.max_lon)
            zone_factor = self.rng.uniform(0.8, 1.3)
            sensors.append(
                SimulatedSensor(
                    sensor_id=f"sim-{index + 1:03d}",
                    lat=round(lat, 6),
                    lon=round(lon, 6),
                    zone_factor=zone_factor,
                )
            )
        return sensors

    def generate_reading(self, sensor: SimulatedSensor | None = None) -> dict[str, float | str]:
        now = datetime.now(UTC)
        hour = now.hour + (now.minute / 60.0)
        daily_cycle = (math.sin((2 * math.pi / 24.0) * (hour - 7)) + 1.0) / 2.0
        traffic_cycle = (math.sin((2 * math.pi / 24.0) * (hour - 18)) + 1.0) / 2.0

        source_sensor = sensor or self.rng.choice(self.sensors)

        pm25_base = 15 + (35 * daily_cycle) + (20 * traffic_cycle)
        pm10_base = 30 + (45 * daily_cycle) + (25 * traffic_cycle)
        no2_base = 8 + (18 * daily_cycle) + (20 * traffic_cycle)

        weather_dampening = self.rng.uniform(0.9, 1.1)
        noise_pm25 = self.rng.uniform(-4.0, 4.0)
        noise_pm10 = self.rng.uniform(-6.0, 6.0)
        noise_no2 = self.rng.uniform(-3.0, 3.0)

        pm25 = max(5.0, (pm25_base * source_sensor.zone_factor * weather_dampening) + noise_pm25)
        pm10 = max(10.0, (pm10_base * source_sensor.zone_factor * weather_dampening) + noise_pm10)
        no2 = max(3.0, (no2_base * source_sensor.zone_factor * weather_dampening) + noise_no2)

        return {
            "sensor_id": source_sensor.sensor_id,
            "timestamp": now.isoformat(),
            "lat": source_sensor.lat,
            "lon": source_sensor.lon,
            "latitude": source_sensor.lat,
            "longitude": source_sensor.lon,
            "pm25": round(pm25, 2),
            "pm10": round(pm10, 2),
            "no2": round(no2, 2),
        }

    async def _send_reading(self, client: httpx.AsyncClient, backend_ingest_url: str, reading: dict[str, float | str]) -> None:
        response = await client.post(backend_ingest_url, json=reading)
        response.raise_for_status()

    async def _run_simulation(
        self,
        *,
        backend_ingest_url: str,
        interval_seconds: int,
        max_cycles: int | None,
    ) -> None:
        cycle = 0
        timeout = httpx.Timeout(10.0, connect=5.0)
        async with httpx.AsyncClient(timeout=timeout) as client:
            while True:
                tasks = []
                for sensor in self.sensors:
                    reading = self.generate_reading(sensor=sensor)
                    tasks.append(self._send_reading(client, backend_ingest_url, reading))

                await asyncio.gather(*tasks)

                cycle += 1
                if max_cycles is not None and cycle >= max_cycles:
                    break

                await asyncio.sleep(interval_seconds)

    def start_sensor_simulation(
        self,
        *,
        backend_base_url: str = "http://localhost:8000",
        interval_seconds: int = 30,
        max_cycles: int | None = None,
    ) -> None:
        """Start multi-sensor simulation loop and push data to backend HTTP API.

        - Emits readings for all simulated sensors every `interval_seconds` (default 30s)
        - Sends data to `/api/v1/sensors/ingest`
        - `max_cycles=None` runs indefinitely
        """
        ingest_url = backend_base_url.rstrip("/") + "/api/v1/sensors/ingest"
        asyncio.run(
            self._run_simulation(
                backend_ingest_url=ingest_url,
                interval_seconds=interval_seconds,
                max_cycles=max_cycles,
            )
        )


def start_sensor_simulation(
    *,
    backend_base_url: str = "http://localhost:8000",
    interval_seconds: int = 30,
    sensor_count: int = 25,
    city_bbox: tuple[float, float, float, float] = (12.90, 77.50, 13.10, 77.70),
    max_cycles: int | None = None,
) -> None:
    simulator = SensorSimulator(sensor_count=sensor_count, city_bbox=city_bbox)
    simulator.start_sensor_simulation(
        backend_base_url=backend_base_url,
        interval_seconds=interval_seconds,
        max_cycles=max_cycles,
    )
