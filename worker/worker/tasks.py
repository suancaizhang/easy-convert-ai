import logging
import os
import shutil
import tempfile
from uuid import UUID

from celery.exceptions import Reject, Retry
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError

from worker.celery_app import app
from worker.database import SessionLocal, engine
from worker.models import Task, Document
from worker.progress import report_progress
from worker.converters.pdf_to_word import PdfToWordConverter
from worker.converters.word_to_pdf import WordToPdfConverter
from worker.converters.excel_to_pdf import ExcelToPdfConverter
from worker.converters.ppt_to_pdf import PptToPdfConverter
from worker.converters.pdf_to_image import PdfToImageConverter
from worker.converters.images_to_pdf import ImagesToPdfConverter
from worker.converters.ocr_to_word import OcrToWordConverter
from worker.converters.pdf_merge import PdfMergeConverter
from worker.converters.pdf_split import PdfSplitConverter
from worker.converters.pdf_compress import PdfCompressConverter
from worker.converters.pdf_rotate import PdfRotateConverter
from worker.converters.pdf_watermark import PdfWatermarkConverter

logger = logging.getLogger(__name__)
CONVERTER_MAP = {
    "pdf_to_word": PdfToWordConverter, "word_to_pdf": WordToPdfConverter,
    "excel_to_pdf": ExcelToPdfConverter, "ppt_to_pdf": PptToPdfConverter,
    "pdf_to_image": PdfToImageConverter, "images_to_pdf": ImagesToPdfConverter,
    "ocr_to_word": OcrToWordConverter, "pdf_merge": PdfMergeConverter,
    "pdf_split": PdfSplitConverter, "pdf_compress": PdfCompressConverter,
    "pdf_rotate": PdfRotateConverter, "pdf_watermark": PdfWatermarkConverter,
}
PROGRESS_CONVERTERS = {"pdf_to_word", "pdf_to_image", "images_to_pdf"}


def _refund_quota(db, task: Task) -> None:
    # Keep the same charge-date settlement contract as the API cancellation path.
    if task.quota_date is None or task.quota_refunded:
        return
    if task.user_id is not None:
        db.execute(text(
            "UPDATE users SET daily_quota_used = GREATEST(daily_quota_used - 1, 0) "
            "WHERE id = :uid AND (quota_reset_at AT TIME ZONE 'UTC')::date = :quota_date"
        ), {"uid": task.user_id, "quota_date": task.quota_date})
    task.quota_refunded = True


def _input_path(db, task: Task) -> str:
    ids = [UUID(item) for item in task.source_document_ids] if task.source_document_ids else [task.document_id]
    documents = db.query(Document).filter(Document.id.in_(ids)).all()
    by_id = {document.id: document for document in documents}
    paths = []
    for document_id in ids:
        document = by_id.get(document_id)
        if document is None or not document.oss_path or not os.path.isfile(document.oss_path):
            raise ValueError("源文件不存在")
        paths.append(document.oss_path)
    return ",".join(paths)


def _execute_conversion(db, execution, task_id: UUID) -> None:
    output_dir = None
    task = db.query(Task).filter(Task.id == task_id).with_for_update().first()
    if task is None or task.status not in {"waiting", "processing"}:
        return
    try:
        # A processing redelivery is recoverable only after the previous execution lock is gone.
        task.status = "processing"
        task.error_message = None
        task.error_code = None
        db.commit()
        converter_cls = CONVERTER_MAP.get(task.task_type)
        if converter_cls is None:
            raise ValueError("不支持的转换类型")
        input_path = _input_path(db, task)
        result_root = os.path.abspath(os.environ.get("RESULT_DIR", "/tmp/results"))
        os.makedirs(result_root, exist_ok=True)
        output_dir = tempfile.mkdtemp(prefix=f"{task_id}_", dir=result_root)
        converter = converter_cls()
        if task.task_type in PROGRESS_CONVERTERS:
            result = converter.convert(input_path, output_dir, task.params,
                                       progress_callback=lambda current, total: report_progress(str(task_id), current, total))
        else:
            result = converter.convert(input_path, output_dir, task.params)
        paths = result.output_paths or [result.output_path]
        if not paths or any(not path or not os.path.isfile(path) or
                            os.path.commonpath([os.path.realpath(output_dir), os.path.realpath(path)]) != os.path.realpath(output_dir)
                            for path in paths):
            raise ValueError("转换未生成有效结果文件")
        task.result_paths = paths
        if result.metadata and "engine" in result.metadata:
            task.actual_engine = result.metadata["engine"]
        task.status = "success"
        db.commit()
        output_dir = None
    except SQLAlchemyError:
        # The commit may have succeeded. Never delete possibly published artifacts,
        # or reconnect and mutate state after losing the session's execution lock.
        output_dir = None
        raise
    except Exception as error:
        db.rollback()
        task = db.query(Task).filter(Task.id == task_id).populate_existing().with_for_update().first()
        if task is None or task.status in {"success", "failed"}:
            return
        if isinstance(error, ValueError) or task.retry_count >= execution.max_retries:
            task.status = "failed"
            task.error_code = "ERR_003" if isinstance(error, ValueError) else "ERR_005"
            task.error_message = str(error) if isinstance(error, ValueError) else "转换失败，已达最大重试次数"
            _refund_quota(db, task)
            db.commit()
            logger.warning("Conversion failed for %s (%s)", task_id, type(error).__name__)
            return
        countdown = [5, 15, 30][min(task.retry_count, 2)]
        task.retry_count += 1
        task.status = "waiting"
        db.commit()
        try:
            raise execution.retry(exc=error, countdown=countdown)
        except Retry:
            # Celery publishes before raising Retry. It must reach Celery, not the failure/refund path.
            raise
        except Exception:
            # A failed retry publication returns the durable intent to the dispatcher.
            db.rollback()
            task = db.query(Task).filter(Task.id == task_id).populate_existing().with_for_update().one()
            if task.status == "waiting":
                task.dispatched_at = None
                db.commit()
            raise
    finally:
        if output_dir:
            shutil.rmtree(output_dir, ignore_errors=True)


def _run_conversion(execution, task_id: str) -> None:
    identifier = UUID(task_id)
    key = identifier.int % (1 << 63)
    # Pin the session-level advisory lock to this execution's actual DB connection.
    # Closing a pooled Session alone would return a still-locked connection to the pool.
    try:
        with engine.connect() as connection:
            try:
                acquired = connection.scalar(text("SELECT pg_try_advisory_lock(:key)"), {"key": key})
                connection.commit()
                if not acquired:
                    return
                try:
                    with SessionLocal(bind=connection) as db:
                        _execute_conversion(db, execution, identifier)
                finally:
                    if not connection.invalidated:
                        connection.rollback()
                        connection.execute(text("SELECT pg_advisory_unlock(:key)"), {"key": key})
                        connection.commit()
            except SQLAlchemyError:
                # Includes an acquisition whose server response was lost.
                # Never return a possibly locked session to the pool.
                connection.invalidate()
                raise
    except SQLAlchemyError as error:
        logger.warning("Database execution interrupted for %s (%s)", task_id, type(error).__name__)
        raise Reject("Database unavailable; reacquire execution lock on redelivery", requeue=True) from error


@app.task(name="worker.tasks.convert_document", bind=True, max_retries=3, acks_late=True)
def convert_document(self, task_id: str):
    _run_conversion(self, task_id)


@app.task(name="worker.tasks.convert_document_office", bind=True, max_retries=3, acks_late=True)
def convert_document_office(self, task_id: str):
    _run_conversion(self, task_id)
