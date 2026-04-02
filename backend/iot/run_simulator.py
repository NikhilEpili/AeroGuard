"""Docker / CLI entry-point for the standalone sensor-simulator service.

Environment variables (all optional):
  BACKEND_BASE_URL          – base URL of the FastAPI backend
                              (default: http://api:8000)
  SIMULATOR_INTERVAL        – seconds between push cycles (default: 30)
  SIMULATOR_SENSOR_COUNT    – number of virtual sensors  (default: 25)
"""
from __future__ import annotations

import asyncio
import os

from backend.iot.sensor_simulator import start_sensor_simulation


def main() -> None:
    backend_base_url: str = os.getenv("BACKEND_BASE_URL", "http://api:8000")
    interval_seconds: int = int(os.getenv("SIMULATOR_INTERVAL", "30"))
    sensor_count: int = int(os.getenv("SIMULATOR_SENSOR_COUNT", "25"))

    print(
        f"[simulator] Starting {sensor_count} sensors → {backend_base_url} "
        f"(interval={interval_seconds}s)",
        flush=True,
    )

    loop = asyncio.new_event_loop()
    try:
        asyncio.set_event_loop(loop)
        loop.run_until_complete(
            start_sensor_simulation(
                backend_base_url=backend_base_url,
                interval_seconds=interval_seconds,
                sensor_count=sensor_count,
            )
        )
    finally:
        loop.close()


if __name__ == "__main__":
    main()
