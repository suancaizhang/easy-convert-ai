"""Persist paid OCR submission intent and recoverable provider job IDs."""
from alembic import op
import sqlalchemy as sa

revision = "005"
down_revision = "004"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("tasks", sa.Column("ocr_job_state", sa.String(20), nullable=True))
    op.add_column("tasks", sa.Column("ocr_job_id", sa.String(255), nullable=True))
    # Stop old workers before migration. Previously attempted active OCR tasks
    # have no durable provider ID: treating them as unsubmitted could charge twice.
    op.execute(sa.text("""
        UPDATE tasks SET ocr_job_state = 'uncertain', status = 'failed',
            error_code = 'ERR_OCR_UNCERTAIN',
            error_message = 'OCR提交结果不确定，已停止自动重试；配额暂不退还，请联系管理员核对服务商任务及计费记录'
        WHERE task_type = 'ocr_to_word'
          AND status IN ('waiting', 'processing')
          AND (status = 'processing' OR retry_count > 0)
    """))


def downgrade() -> None:
    # Dropping recovery evidence would let old code re-submit a paid job.
    if op.get_bind().scalar(sa.text("SELECT EXISTS (SELECT 1 FROM tasks WHERE ocr_job_state IS NOT NULL OR ocr_job_id IS NOT NULL)")):
        raise RuntimeError("Reconcile and archive OCR job records before downgrading 005")
    op.drop_column("tasks", "ocr_job_id")
    op.drop_column("tasks", "ocr_job_state")
