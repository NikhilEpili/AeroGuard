"""Add precomputed road_segments table for graph routing

Revision ID: 20260314_01
Revises: 20260313_01
Create Date: 2026-03-14 00:00:00
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql
from sqlalchemy.types import UserDefinedType


class GeometryLineString4326(UserDefinedType):
    def get_col_spec(self, **kw):
        return "geometry(LINESTRING,4326)"

# revision identifiers, used by Alembic.
revision = "20260314_01"
down_revision = "20260313_01"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "road_segments",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("start_node_id", sa.String(length=64), nullable=False),
        sa.Column("end_node_id", sa.String(length=64), nullable=False),
        sa.Column("start_lat", sa.Numeric(9, 6), nullable=False),
        sa.Column("start_lon", sa.Numeric(9, 6), nullable=False),
        sa.Column("end_lat", sa.Numeric(9, 6), nullable=False),
        sa.Column("end_lon", sa.Numeric(9, 6), nullable=False),
        sa.Column("travel_mode", sa.String(length=16), nullable=False),
        sa.Column("zone_id", sa.String(length=32), nullable=False),
        sa.Column("distance_km", sa.Numeric(10, 4), nullable=False),
        sa.Column("travel_time_minutes", sa.Numeric(10, 4), nullable=False),
        sa.Column("pm25", sa.Numeric(10, 2), nullable=False),
        sa.Column("traffic_factor", sa.Numeric(6, 3), nullable=False),
        sa.Column("road_factor", sa.Numeric(6, 3), nullable=False),
        sa.Column("exposure_cost", sa.Numeric(12, 4), nullable=False),
        sa.Column("landmark_distances", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("segment_geom", GeometryLineString4326(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
    )

    op.create_index("ix_road_segments_start_node_id", "road_segments", ["start_node_id"], unique=False)
    op.create_index("ix_road_segments_end_node_id", "road_segments", ["end_node_id"], unique=False)
    op.create_index("ix_road_segments_travel_mode", "road_segments", ["travel_mode"], unique=False)
    op.create_index("ix_road_segments_zone_id", "road_segments", ["zone_id"], unique=False)
    op.create_index("ix_road_segments_exposure_cost", "road_segments", ["exposure_cost"], unique=False)
    op.create_index("ix_road_segments_segment_geom", "road_segments", ["segment_geom"], unique=False, postgresql_using="gist")


def downgrade() -> None:
    op.drop_index("ix_road_segments_segment_geom", table_name="road_segments")
    op.drop_index("ix_road_segments_exposure_cost", table_name="road_segments")
    op.drop_index("ix_road_segments_zone_id", table_name="road_segments")
    op.drop_index("ix_road_segments_travel_mode", table_name="road_segments")
    op.drop_index("ix_road_segments_end_node_id", table_name="road_segments")
    op.drop_index("ix_road_segments_start_node_id", table_name="road_segments")
    op.drop_table("road_segments")
