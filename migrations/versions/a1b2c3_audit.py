
from alembic import op
import sqlalchemy as sa


revision = "a1b2c3_audit"
down_revision = "20260519_add_users_auth"
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table("historico_lead") as batch_op:
        batch_op.add_column(sa.Column("user_id", sa.Integer(), nullable=True))
        batch_op.add_column(sa.Column("tipo_acao", sa.String(length=80), nullable=True))
        batch_op.add_column(sa.Column("resultado", sa.String(length=120), nullable=True))
        batch_op.create_index(op.f("ix_historico_lead_user_id"), ["user_id"], unique=False)
        batch_op.create_index(op.f("ix_historico_lead_tipo_acao"), ["tipo_acao"], unique=False)
        batch_op.create_foreign_key(
            "fk_historico_lead_user_id_users",
            "users",
            ["user_id"],
            ["id"],
        )


def downgrade():
    with op.batch_alter_table("historico_lead") as batch_op:
        batch_op.drop_constraint("fk_historico_lead_user_id_users", type_="foreignkey")
        batch_op.drop_index(op.f("ix_historico_lead_tipo_acao"))
        batch_op.drop_index(op.f("ix_historico_lead_user_id"))
        batch_op.drop_column("resultado")
        batch_op.drop_column("tipo_acao")
        batch_op.drop_column("user_id")
