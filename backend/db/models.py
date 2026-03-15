from datetime import datetime
from decimal import Decimal

from geoalchemy2 import Geometry
from sqlalchemy import DateTime, ForeignKey, Integer, Numeric, String, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from backend.db.database import Base


class Sensor(Base):
    __tablename__ = "sensors"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    latitude: Mapped[Decimal] = mapped_column(Numeric(9, 6), nullable=False)
    longitude: Mapped[Decimal] = mapped_column(Numeric(9, 6), nullable=False)
    location_name: Mapped[str] = mapped_column(String(255), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    geom: Mapped[object] = mapped_column(Geometry(geometry_type="POINT", srid=4326, spatial_index=True), nullable=False)

    pollution_readings: Mapped[list["PollutionReading"]] = relationship(
        back_populates="sensor",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )


class PollutionReading(Base):
    __tablename__ = "pollution_readings"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    sensor_id: Mapped[int] = mapped_column(ForeignKey("sensors.id", ondelete="CASCADE"), index=True, nullable=False)
    pm25: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    pm10: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    no2: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    timestamp: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False, index=True)

    sensor: Mapped["Sensor"] = relationship(back_populates="pollution_readings")


class PollutionGrid(Base):
    __tablename__ = "pollution_grid"

    grid_id: Mapped[int] = mapped_column(Integer, primary_key=True)
    center_lat: Mapped[Decimal] = mapped_column(Numeric(9, 6), nullable=False)
    center_lon: Mapped[Decimal] = mapped_column(Numeric(9, 6), nullable=False)
    pm25: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    aqi: Mapped[int] = mapped_column(Integer, nullable=False)
    last_updated: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    center_geom: Mapped[object] = mapped_column(Geometry(geometry_type="POINT", srid=4326, spatial_index=True), nullable=False)


class RouteCache(Base):
    __tablename__ = "route_cache"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    start_lat: Mapped[Decimal] = mapped_column(Numeric(9, 6), nullable=False)
    start_lon: Mapped[Decimal] = mapped_column(Numeric(9, 6), nullable=False)
    end_lat: Mapped[Decimal] = mapped_column(Numeric(9, 6), nullable=False)
    end_lon: Mapped[Decimal] = mapped_column(Numeric(9, 6), nullable=False)
    exposure_score: Mapped[Decimal] = mapped_column(Numeric(10, 3), nullable=False)
    route_geometry: Mapped[object] = mapped_column(Geometry(geometry_type="LINESTRING", srid=4326, spatial_index=True), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class RoadSegment(Base):
    __tablename__ = "road_segments"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    start_node_id: Mapped[str] = mapped_column(String(64), index=True, nullable=False)
    end_node_id: Mapped[str] = mapped_column(String(64), index=True, nullable=False)

    start_lat: Mapped[Decimal] = mapped_column(Numeric(9, 6), nullable=False)
    start_lon: Mapped[Decimal] = mapped_column(Numeric(9, 6), nullable=False)
    end_lat: Mapped[Decimal] = mapped_column(Numeric(9, 6), nullable=False)
    end_lon: Mapped[Decimal] = mapped_column(Numeric(9, 6), nullable=False)

    travel_mode: Mapped[str] = mapped_column(String(16), index=True, nullable=False)
    zone_id: Mapped[str] = mapped_column(String(32), index=True, nullable=False)

    distance_km: Mapped[Decimal] = mapped_column(Numeric(10, 4), nullable=False)
    travel_time_minutes: Mapped[Decimal] = mapped_column(Numeric(10, 4), nullable=False)
    pm25: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    traffic_factor: Mapped[Decimal] = mapped_column(Numeric(6, 3), nullable=False)
    road_factor: Mapped[Decimal] = mapped_column(Numeric(6, 3), nullable=False)
    exposure_cost: Mapped[Decimal] = mapped_column(Numeric(12, 4), index=True, nullable=False)

    landmark_distances: Mapped[dict[str, float] | None] = mapped_column(JSONB, nullable=True)
    segment_geom: Mapped[object] = mapped_column(Geometry(geometry_type="LINESTRING", srid=4326, spatial_index=True), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
