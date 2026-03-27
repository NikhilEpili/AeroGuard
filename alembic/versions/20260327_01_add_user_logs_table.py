"""add user_logs table for exposure tracking

Revision ID: 20260327_01
Revises: 79465b58a45b
Create Date: 2026-03-27 00:00:00
"""

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "20260327_01"
down_revision = "79465b58a45b"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "user_logs",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("latitude", sa.Numeric(9, 6), nullable=False),
        sa.Column("longitude", sa.Numeric(9, 6), nullable=False),
        sa.Column("pm25", sa.Numeric(10, 2), nullable=False),
        sa.Column("aqi", sa.Integer(), nullable=False),
        sa.Column("timestamp", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_user_logs_user_id", "user_logs", ["user_id"], unique=False)
    op.create_index("ix_user_logs_timestamp", "user_logs", ["timestamp"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_user_logs_timestamp", table_name="user_logs")
    op.drop_index("ix_user_logs_user_id", table_name="user_logs")
    op.drop_table("user_logs")
