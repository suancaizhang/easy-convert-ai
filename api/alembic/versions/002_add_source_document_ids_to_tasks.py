"""add source_document_ids to tasks

Revision ID: 002
Revises: 001
Create Date: 2026-07-14 00:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB

revision: str = "002"
down_revision: Union[str, None] = "001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("tasks", sa.Column("source_document_ids", JSONB, nullable=True))


def downgrade() -> None:
    op.drop_column("tasks", "source_document_ids")
