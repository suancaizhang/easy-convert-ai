"""Explicit task ownership, charge records, durable delivery and artifact lists."""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB, UUID

revision = "004"
down_revision = "003"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("tasks", sa.Column("user_id", UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=True))
    op.add_column("tasks", sa.Column("quota_date", sa.Date(), nullable=True))
    op.add_column("tasks", sa.Column("quota_refunded", sa.Boolean(), nullable=False, server_default=sa.false()))
    op.add_column("tasks", sa.Column("dispatched_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("tasks", sa.Column("result_paths", JSONB(), nullable=False, server_default=sa.text("'[]'::jsonb")))
    op.execute("""
        WITH sources AS (
            SELECT id AS task_id, document_id::text AS source_id FROM tasks
            UNION
            SELECT id, jsonb_array_elements_text(
                CASE WHEN jsonb_typeof(source_document_ids) = 'array'
                     THEN source_document_ids ELSE '[]'::jsonb END
            ) FROM tasks
            UNION
            -- SQL/JSON null are ordinary single-source tasks. Other nonarrays
            -- have unknown provenance: a missing source quarantines the task.
            SELECT id, NULL::text FROM tasks
            WHERE jsonb_typeof(source_document_ids) NOT IN ('array', 'null')
        ), ownership AS (
            SELECT sources.task_id, count(*) AS referenced, count(documents.id) AS found,
                   count(DISTINCT documents.user_id) AS owners,
                   (array_agg(documents.user_id) FILTER (WHERE documents.user_id IS NOT NULL))[1] AS owner_id
            FROM sources LEFT JOIN documents ON documents.id::text = sources.source_id
            GROUP BY sources.task_id
        )
        UPDATE tasks SET user_id = CASE WHEN ownership.owners = 1 THEN ownership.owner_id END,
            status = CASE WHEN ownership.owners > 1 OR ownership.referenced <> ownership.found
                          THEN 'failed' ELSE tasks.status END,
            error_code = CASE WHEN ownership.owners > 1 OR ownership.referenced <> ownership.found
                              THEN 'ERR_ACCESS' ELSE tasks.error_code END,
            error_message = CASE WHEN ownership.owners > 1 OR ownership.referenced <> ownership.found
                                 THEN '历史任务来源权限无法安全确认' ELSE tasks.error_message END
        FROM ownership WHERE tasks.id = ownership.task_id
    """)
    op.execute("""
        UPDATE tasks SET result_paths = COALESCE(
            (SELECT jsonb_agg(btrim(path)) FROM unnest(string_to_array(result_path, ',')) AS path
             WHERE btrim(path) <> ''), '[]'::jsonb)
    """)
    # Historical charge facts are unknown. Only a new, actual deduction sets quota_date.
    op.drop_column("tasks", "result_path")
    op.create_index("ix_tasks_user_id", "tasks", ["user_id"])
    op.create_index("ix_tasks_pending_dispatch", "tasks", ["created_at"],
                    postgresql_where=sa.text("status = 'waiting' AND dispatched_at IS NULL"))


def downgrade() -> None:
    # Refuse data loss instead of truncating a new multi-page result to the old capacity.
    op.execute("""
        DO $$ BEGIN
            IF EXISTS (SELECT 1 FROM tasks WHERE
                length((SELECT string_agg(path, ',') FROM jsonb_array_elements_text(result_paths) AS path)) > 512)
            THEN RAISE EXCEPTION 'Cannot downgrade: artifact list exceeds legacy 512-character capacity';
            END IF;
        END $$
    """)
    op.add_column("tasks", sa.Column("result_path", sa.String(512), nullable=True))
    op.execute("""
        UPDATE tasks SET result_path =
            (SELECT string_agg(path, ',' ORDER BY ordinal) FROM jsonb_array_elements_text(result_paths)
             WITH ORDINALITY AS item(path, ordinal))
    """)
    op.drop_index("ix_tasks_pending_dispatch", table_name="tasks")
    op.drop_index("ix_tasks_user_id", table_name="tasks")
    for column in ("result_paths", "dispatched_at", "quota_refunded", "quota_date", "user_id"):
        op.drop_column("tasks", column)
