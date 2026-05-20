"""add lead assignment

Revision ID: 20260519_add_lead_assignment
Revises: a1b2c3_audit
Create Date: 2026-05-19 00:00:00.000000
"""

from alembic import op
import sqlalchemy as sa


revision = "20260519_add_lead_assignment"
down_revision = "a1b2c3_audit"
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table("lead") as batch_op:
        batch_op.add_column(sa.Column("assigned_to_id", sa.Integer(), nullable=True))
        batch_op.create_index(op.f("ix_lead_assigned_to_id"), ["assigned_to_id"], unique=False)
        batch_op.create_foreign_key(
            "fk_lead_assigned_to_id_users",
            "users",
            ["assigned_to_id"],
            ["id"],
        )


def downgrade():
    with op.batch_alter_table("lead") as batch_op:
        batch_op.drop_constraint("fk_lead_assigned_to_id_users", type_="foreignkey")
        batch_op.drop_index(op.f("ix_lead_assigned_to_id"))
        batch_op.drop_column("assigned_to_id")
