from __future__ import annotations

from dataclasses import dataclass
from decimal import Decimal
from math import cos, radians

import numpy as np
from geoalchemy2.elements import WKTElement
from sqlalchemy.orm import Session

from backend.db.models import PollutionGrid


@dataclass(slots=True)
class CityBoundingBox:
    min_lat: float
    min_lon: float
    max_lat: float
    max_lon: float


def generate_city_grid(
    city_bbox: CityBoundingBox,
    grid_size_m: int = 500,
) -> list[dict[str, float | int]]:
    """Generate grid cells for a city bounding box using NumPy.

    Returns rows containing `grid_id`, `center_lat`, and `center_lon`.
    """
    if grid_size_m <= 0:
        raise ValueError("grid_size_m must be greater than 0")

    if city_bbox.min_lat >= city_bbox.max_lat or city_bbox.min_lon >= city_bbox.max_lon:
        raise ValueError("Invalid city_bbox: min values must be less than max values")

    lat_step_deg = grid_size_m / 111_320.0
    mid_lat_rad = radians((city_bbox.min_lat + city_bbox.max_lat) / 2.0)
    lon_scale = max(cos(mid_lat_rad), 0.01)
    lon_step_deg = grid_size_m / (111_320.0 * lon_scale)

    lat_centers = np.arange(city_bbox.min_lat + (lat_step_deg / 2.0), city_bbox.max_lat, lat_step_deg)
    lon_centers = np.arange(city_bbox.min_lon + (lon_step_deg / 2.0), city_bbox.max_lon, lon_step_deg)

    if lat_centers.size == 0 or lon_centers.size == 0:
        return []

    lon_mesh, lat_mesh = np.meshgrid(lon_centers, lat_centers)
    centers = np.column_stack((lat_mesh.ravel(), lon_mesh.ravel()))

    grid_cells: list[dict[str, float | int]] = []
    for idx, (center_lat, center_lon) in enumerate(centers, start=1):
        grid_cells.append(
            {
                "grid_id": idx,
                "center_lat": float(np.round(center_lat, 6)),
                "center_lon": float(np.round(center_lon, 6)),
            }
        )

    return grid_cells


def store_grid_to_database(
    db: Session,
    grid_cells: list[dict[str, float | int]],
    *,
    replace_existing: bool = False,
) -> int:
    """Persist generated grid cells into `pollution_grid`.

    The `pollution_grid` table also contains `pm25`, `aqi`, and `last_updated`.
    New cells are initialized with `pm25=0.00` and `aqi=0`.
    """
    if not grid_cells:
        return 0

    if replace_existing:
        db.query(PollutionGrid).delete()

    rows: list[PollutionGrid] = []
    for cell in grid_cells:
        center_lat = float(cell["center_lat"])
        center_lon = float(cell["center_lon"])
        rows.append(
            PollutionGrid(
                grid_id=int(cell["grid_id"]),
                center_lat=Decimal(f"{center_lat:.6f}"),
                center_lon=Decimal(f"{center_lon:.6f}"),
                pm25=Decimal("0.00"),
                aqi=0,
                center_geom=WKTElement(f"POINT({center_lon} {center_lat})", srid=4326),
            )
        )

    db.add_all(rows)
    db.commit()
    return len(rows)


class PollutionGridGenerator:
    """Class wrapper for grid generation and persistence."""

    def generate_city_grid(self, city_bbox: CityBoundingBox, grid_size_m: int = 500) -> list[dict[str, float | int]]:
        return generate_city_grid(city_bbox=city_bbox, grid_size_m=grid_size_m)

    def store_grid_to_database(self, db: Session, grid_cells: list[dict[str, float | int]], *, replace_existing: bool = False) -> int:
        return store_grid_to_database(db=db, grid_cells=grid_cells, replace_existing=replace_existing)
