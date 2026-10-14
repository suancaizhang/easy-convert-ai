"""Task admission and resource policies shared by the HTTP task endpoints."""
import os
import uuid
from typing import Literal

from fastapi import HTTPException
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy.orm import Session

from app.config import settings
from app.deps import require_owner
from app.models import Document, Task, User
from app.routers.quota import charge_quota, lock_quota_user

TaskType = Literal[
    "pdf_to_word", "word_to_pdf", "excel_to_pdf", "ppt_to_pdf", "pdf_to_image",
    "images_to_pdf", "ocr_to_word", "pdf_merge", "pdf_split", "pdf_compress",
    "pdf_rotate", "pdf_watermark",
]
OFFICE_TYPES = {"word_to_pdf", "excel_to_pdf", "ppt_to_pdf"}
PDF_TOOL_TYPES = {"pdf_merge", "pdf_split", "pdf_compress", "pdf_rotate", "pdf_watermark"}
IMAGE_TYPES = {"png", "jpg", "jpeg", "webp"}
INPUT_TYPES = {
    "pdf_to_word": {"pdf"}, "pdf_to_image": {"pdf"},
    "word_to_pdf": {"docx"}, "excel_to_pdf": {"xlsx"}, "ppt_to_pdf": {"pptx"},
    "images_to_pdf": IMAGE_TYPES, "ocr_to_word": IMAGE_TYPES | {"pdf"},
    "pdf_merge": IMAGE_TYPES | {"pdf"},
    **{kind: {"pdf"} for kind in PDF_TOOL_TYPES if kind != "pdf_merge"},
}


class Parameters(BaseModel):
    model_config = ConfigDict(extra="forbid", allow_inf_nan=False)


class OcrParameters(Parameters):
    output_format: Literal["docx", "txt", "searchable_pdf"] = "docx"


class SplitParameters(Parameters):
    pages: str = Field(min_length=1, max_length=1000, pattern=r"^\s*[1-9]\d*(\s*-\s*[1-9]\d*)?(\s*,\s*[1-9]\d*(\s*-\s*[1-9]\d*)?)*\s*$")


class RotateParameters(Parameters):
    angle: Literal[90, 180, 270] = 90
    pages: str = Field(default="all", min_length=1, max_length=1000,
                       pattern=r"^(all|\s*[1-9]\d*(\s*-\s*[1-9]\d*)?(\s*,\s*[1-9]\d*(\s*-\s*[1-9]\d*)?)*\s*)$")


class CompressParameters(Parameters):
    quality: Literal["low", "medium", "high"] = "medium"


class WatermarkParameters(Parameters):
    text: str = Field(min_length=1, max_length=500)
    opacity: float = Field(default=0.3, ge=0.05, le=1)
    position: Literal["center", "top-left", "top-right", "bottom-left", "bottom-right"] = "center"


PARAMETER_MODELS = {
    "ocr_to_word": OcrParameters, "pdf_split": SplitParameters,
    "pdf_rotate": RotateParameters, "pdf_compress": CompressParameters,
    "pdf_watermark": WatermarkParameters,
}


def has_unresolved_ocr_submission(task: Task) -> bool:
    if task.task_type != "ocr_to_word":
        return False
    if task.error_code == "ERR_OCR_UNCERTAIN" or task.ocr_job_state in {"submitting", "uncertain"}:
        return True
    if task.ocr_job_state == "submitted":
        return not task.ocr_job_id
    if task.ocr_job_state == "rejected":
        return task.ocr_job_id is not None
    return task.ocr_job_state is not None or task.ocr_job_id is not None


def create_task_record(db: Session, user: User | None, source_ids: list[uuid.UUID],
                       task_type: TaskType, params: dict | None, ocr_mode: str | None = None) -> Task:
    if task_type == "ocr_to_word" and user is None:
        raise HTTPException(status_code=401, detail="OCR 需要登录")
    from pydantic import ValidationError
    try:
        parameters = PARAMETER_MODELS.get(task_type, Parameters).model_validate(params or {}).model_dump()
    except ValidationError as error:
        raise HTTPException(status_code=422, detail="转换参数不合法") from error
    if not source_ids or len(source_ids) > 20 or len(set(source_ids)) != len(source_ids):
        raise HTTPException(status_code=400, detail="需要 1~20 个不同的源文档")
    if task_type == "pdf_merge" and len(source_ids) < 2:
        raise HTTPException(status_code=400, detail="合并需要至少 2 个文档")
    if len(source_ids) > 1 and task_type not in {"pdf_merge", "images_to_pdf"}:
        raise HTTPException(status_code=400, detail="此转换仅支持一个源文档")

    # Lock ordering: creator first, then source UUIDs. Deletion locks the same sources.
    charged_user = lock_quota_user(db, user.id) if user else None
    documents = (db.query(Document).filter(Document.id.in_(source_ids))
                 .order_by(Document.id).populate_existing().with_for_update().all())
    if len(documents) != len(source_ids):
        raise HTTPException(status_code=404, detail="源文档不存在")
    for document in documents:
        require_owner(document.user_id, user)
        if document.file_type not in INPUT_TYPES[task_type]:
            raise HTTPException(status_code=400, detail="源文档格式不支持此转换")
        if document.file_status != "active" or not document.oss_path or not os.path.isfile(document.oss_path):
            raise HTTPException(status_code=400, detail="源文件不可用")
    if charged_user:
        active = db.query(Task.id).filter(Task.user_id == charged_user.id,
                                        Task.status.in_(["waiting", "processing"])).first()
        if active:
            raise HTTPException(status_code=429, detail="当前有正在进行的任务，请等待完成")
    quota_date = charge_quota(charged_user) if charged_user and task_type not in PDF_TOOL_TYPES else None
    task = Task(id=uuid.uuid4(), document_id=source_ids[0], user_id=user.id if user else None,
                task_type=task_type, ocr_mode=ocr_mode, params=parameters, status="waiting",
                source_document_ids=[str(item) for item in source_ids] if len(source_ids) > 1 else None,
                quota_date=quota_date, quota_refunded=False, result_paths=[])
    db.add(task)
    db.commit()
    db.refresh(task)
    return task


def load_task(db: Session, task_id: uuid.UUID, user: User | None, *, lock: bool = False) -> tuple[Task, Document]:
    query = db.query(Task).filter(Task.id == task_id)
    if lock:
        query = query.populate_existing().with_for_update()
    task = query.first()
    if task is None:
        raise HTTPException(status_code=404, detail="任务不存在")
    if task.error_code == "ERR_ACCESS":
        raise HTTPException(status_code=403, detail="任务来源权限无法确认")
    require_owner(task.user_id, user)
    try:
        source_ids = {uuid.UUID(value) for value in (task.source_document_ids or [])}
    except (ValueError, TypeError):
        raise HTTPException(status_code=404, detail="源文档不存在")
    source_ids.add(task.document_id)
    documents = db.query(Document).filter(Document.id.in_(source_ids)).all()
    anchor = next((document for document in documents if document.id == task.document_id), None)
    if anchor is None:
        raise HTTPException(status_code=404, detail="源文档不存在")
    # Admission/migration establish ownership. Completed secondary sources may be
    # deleted without making the independently owned result inaccessible.
    for document in documents:
        require_owner(document.user_id, user)
    return task, anchor


def valid_result_path(file_path: str) -> bool:
    root = os.path.realpath(settings.result_dir)
    path = os.path.realpath(file_path)
    try:
        return path != root and os.path.commonpath([root, path]) == root
    except ValueError:
        return False
