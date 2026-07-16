import logging
import os
import shutil
import tempfile
from uuid import UUID

from sqlalchemy import text

from worker.celery_app import app
from worker.database import SessionLocal
from worker.models import Task, Document, User
from worker.converters.pdf_to_word import PdfToWordConverter
from worker.converters.word_to_pdf import WordToPdfConverter
from worker.converters.excel_to_pdf import ExcelToPdfConverter
from worker.converters.ppt_to_pdf import PptToPdfConverter
from worker.converters.pdf_to_image import PdfToImageConverter
from worker.converters.images_to_pdf import ImagesToPdfConverter
from worker.converters.ocr_to_word import OcrToWordConverter

logger = logging.getLogger(__name__)

CONVERTER_MAP = {
    "pdf_to_word": PdfToWordConverter,
    "word_to_pdf": WordToPdfConverter,
    "excel_to_pdf": ExcelToPdfConverter,
    "ppt_to_pdf": PptToPdfConverter,
    "pdf_to_image": PdfToImageConverter,
    "images_to_pdf": ImagesToPdfConverter,
    "ocr_to_word": OcrToWordConverter,
}

ERROR_CODES = {
    "unsupported_format": "ERR_001",
    "corrupted_file": "ERR_002",
    "file_too_large": "ERR_003",
    "ocr_failed": "ERR_004",
    "service_busy": "ERR_005",
}


def _run_conversion(self, task_id: str):
    db = SessionLocal()
    output_dir = None
    try:
        task = db.query(Task).filter(Task.id == UUID(task_id)).first()
        if not task:
            logger.error(f"Task {task_id} not found")
            return

        task.status = "processing"
        db.commit()

        document = db.query(Document).filter(Document.id == task.document_id).first()
        if not document:
            _fail_task(db, task, "文档记录不存在", "ERR_002")
            return

        converter_cls = CONVERTER_MAP.get(task.task_type)
        if not converter_cls:
            _fail_task(db, task, f"不支持的转换类型: {task.task_type}", "ERR_001")
            return

        if task.source_document_ids:
            docs = (
                db.query(Document)
                .filter(Document.id.in_([UUID(d) for d in task.source_document_ids]))
                .all()
            )
            doc_map = {str(d.id): d for d in docs}
            paths = []
            for doc_id in task.source_document_ids:
                d = doc_map.get(doc_id)
                if not d or not d.oss_path or not os.path.exists(d.oss_path):
                    _fail_task(db, task, f"源文件不存在: {doc_id}", "ERR_002")
                    return
                paths.append(d.oss_path)
            input_path = ",".join(paths)
        else:
            input_path = document.oss_path
            if not input_path or not os.path.exists(input_path):
                _fail_task(db, task, "源文件不存在", "ERR_002")
                return

        output_dir = tempfile.mkdtemp(prefix="convert_")
        converter = converter_cls()

        try:
            result = converter.convert(input_path, output_dir)
        except ValueError as e:
            _fail_task(db, task, str(e), "ERR_003")
            return
        except Exception as e:
            task.retry_count += 1
            db.commit()
            raise self.retry(
                exc=e,
                countdown=[5, 15, 30][min(self.request.retries, 2)],
            )

        if result.metadata and "engine" in result.metadata:
            task.actual_engine = result.metadata["engine"]

        if result.output_paths:
            task.result_path = ",".join(result.output_paths)
        else:
            task.result_path = result.output_path

        task.status = "success"
        db.commit()
        output_dir = None

    except self.MaxRetriesExceededError:
        task = db.query(Task).filter(Task.id == UUID(task_id)).first()
        if task:
            _fail_task(db, task, "转换失败，已达最大重试次数", "ERR_005")
            _refund_quota(db, task)
    except Exception as e:
        logger.exception(f"Unexpected error processing task {task_id}")
        task = db.query(Task).filter(Task.id == UUID(task_id)).first()
        if task:
            _fail_task(db, task, str(e), "ERR_005")
            _refund_quota(db, task)
    finally:
        db.close()
        if output_dir and os.path.exists(output_dir):
            shutil.rmtree(output_dir, ignore_errors=True)


@app.task(
    name="worker.tasks.convert_document",
    bind=True,
    max_retries=3,
    acks_late=True,
)
def convert_document(self, task_id: str):
    _run_conversion(self, task_id)


@app.task(
    name="worker.tasks.convert_document_office",
    bind=True,
    max_retries=3,
    acks_late=True,
)
def convert_document_office(self, task_id: str):
    _run_conversion(self, task_id)


def _fail_task(db, task: Task, message: str, error_code: str):
    task.status = "failed"
    task.error_message = message
    task.error_code = error_code
    db.commit()


def _refund_quota(db, task: Task):
    document = db.query(Document).filter(Document.id == task.document_id).first()
    if document and document.user_id:
        db.execute(
            text(
                "UPDATE users SET daily_quota_used = GREATEST(daily_quota_used - 1, 0) "
                "WHERE id = :uid"
            ),
            {"uid": document.user_id},
        )
        db.commit()
