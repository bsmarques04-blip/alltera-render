"""add map viewport indexes

Revision ID: 20260519_add_map_viewport_indexes
Revises: 20260519_add_lead_assignment
Create Date: 2026-05-19 00:00:00.000000
"""

from alembic import op


revision = "20260519_add_map_viewport_indexes"
down_revision = "20260519_add_lead_assignment"
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table("lead") as batch_op:
        batch_op.create_index("ix_lead_latitude_longitude", ["latitude", "longitude"], unique=False)
        batch_op.create_index("ix_lead_estado_latitude_longitude", ["estado", "latitude", "longitude"], unique=False)


def downgrade():
    with op.batch_alter_table("lead") as batch_op:
        batch_op.drop_index("ix_lead_estado_latitude_longitude")
        batch_op.drop_index("ix_lead_latitude_longitude")
