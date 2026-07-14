"""create users documents tasks tables

Revision ID: 001
Revises:
Create Date: 2024-01-01 00:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision: str = "001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "users",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("email", sa.String(255), unique=True, index=True),
        sa.Column("password_hash", sa.String(255)),
        sa.Column("wechat_openid", sa.String(128), unique=True, index=True),
        sa.Column("avatar", sa.String(512)),
        sa.Column("role", sa.String(20), server_default="free", nullable=False),
        sa.Column("daily_quota_used", sa.Integer(), server_default="0", nullable=False),
        sa.Column(
            "quota_reset_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
    )

    op.create_table(
        "documents",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", UUID(as_uuid=True), sa.ForeignKey("users.id"), index=True),
        sa.Column("filename", sa.String(255), nullable=False),
        sa.Column("file_type", sa.String(20), nullable=False),
        sa.Column("file_size", sa.BigInteger(), nullable=False),
        sa.Column("oss_path", sa.String(512)),
        sa.Column("status", sa.String(20), server_default="uploaded", nullable=False),
        sa.Column(
            "file_status", sa.String(20), server_default="active", nullable=False
        ),
        sa.Column("expires_at", sa.DateTime(timezone=True)),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
    )

    op.create_table(
        "tasks",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "document_id",
            UUID(as_uuid=True),
            sa.ForeignKey("documents.id"),
            nullable=False,
            index=True,
        ),
        sa.Column("task_type", sa.String(30), nullable=False),
        sa.Column("ocr_mode", sa.String(20)),
        sa.Column("actual_engine", sa.String(30)),
        sa.Column("status", sa.String(20), server_default="waiting", nullable=False),
        sa.Column("retry_count", sa.Integer(), server_default="0", nullable=False),
        sa.Column("result_path", sa.String(512)),
        sa.Column("error_message", sa.Text()),
        sa.Column("error_code", sa.String(20)),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
    )


def downgrade() -> None:
    op.drop_table("tasks")
    op.drop_table("documents")
    op.drop_table("users")
