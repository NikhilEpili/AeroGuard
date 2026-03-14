"""Initial AeroGuard PostGIS schema

Revision ID: 20260313_01
Revises:
Create Date: 2026-03-13 00:00:00
"""

from alembic import op
import sqlalchemy as sa
from geoalchemy2 import Geometry

# revision identifiers, used by Alembic.
revision = "20260313_01"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("CREATE EXTENSION IF NOT EXISTS postgis")

    op.create_table(
        "sensors",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("latitude", sa.Numeric(9, 6), nullable=False),
        sa.Column("longitude", sa.Numeric(9, 6), nullable=False),
        sa.Column("location_name", sa.String(length=255), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
        sa.Column("geom", Geometry(geometry_type="POINT", srid=4326), nullable=False),
    )
    op.create_index("ix_sensors_geom", "sensors", ["geom"], unique=False, postgresql_using="gist")

    op.create_table(
        "pollution_readings",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("sensor_id", sa.Integer(), sa.ForeignKey("sensors.id", ondelete="CASCADE"), nullable=False),
        sa.Column("pm25", sa.Numeric(10, 2), nullable=False),
        sa.Column("pm10", sa.Numeric(10, 2), nullable=False),
        sa.Column("no2", sa.Numeric(10, 2), nullable=False),
        sa.Column("timestamp", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
    )
    op.create_index("ix_pollution_readings_sensor_id", "pollution_readings", ["sensor_id"], unique=False)
    op.create_index("ix_pollution_readings_timestamp", "pollution_readings", ["timestamp"], unique=False)

    op.create_table(
        "pollution_grid",
        sa.Column("grid_id", sa.Integer(), primary_key=True),
        sa.Column("center_lat", sa.Numeric(9, 6), nullable=False),
        sa.Column("center_lon", sa.Numeric(9, 6), nullable=False),
        sa.Column("pm25", sa.Numeric(10, 2), nullable=False),
        sa.Column("aqi", sa.Integer(), nullable=False),
        sa.Column("last_updated", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
        sa.Column("center_geom", Geometry(geometry_type="POINT", srid=4326), nullable=False),
    )
    op.create_index("ix_pollution_grid_center_geom", "pollution_grid", ["center_geom"], unique=False, postgresql_using="gist")

    op.create_table(
        "route_cache",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("start_lat", sa.Numeric(9, 6), nullable=False),
        sa.Column("start_lon", sa.Numeric(9, 6), nullable=False),
        sa.Column("end_lat", sa.Numeric(9, 6), nullable=False),
        sa.Column("end_lon", sa.Numeric(9, 6), nullable=False),
        sa.Column("exposure_score", sa.Numeric(10, 3), nullable=False),
        sa.Column("route_geometry", Geometry(geometry_type="LINESTRING", srid=4326), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
    )
    op.create_index("ix_route_cache_route_geometry", "route_cache", ["route_geometry"], unique=False, postgresql_using="gist")


def downgrade() -> None:
    op.drop_index("ix_route_cache_route_geometry", table_name="route_cache")
    op.drop_table("route_cache")

    op.drop_index("ix_pollution_grid_center_geom", table_name="pollution_grid")
    op.drop_table("pollution_grid")

    op.drop_index("ix_pollution_readings_timestamp", table_name="pollution_readings")
    op.drop_index("ix_pollution_readings_sensor_id", table_name="pollution_readings")
    op.drop_table("pollution_readings")

    op.drop_index("ix_sensors_geom", table_name="sensors")
    op.drop_table("sensors")
