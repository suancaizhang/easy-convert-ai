import os
import uuid

from celery import Celery
from fastapi import APIRouter, Depends, HTTPException, Query, Request
from fastapi.responses import FileResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.deps import get_optional_user
from app.models import User, Document, Task
from app.routers.quota import consume_quota

router = APIRouter(prefix="/api/tasks", tags=["tasks"])

celery_app = Celery(broker=settings.celery_broker_url)

OFFICE_TYPES = {"excel_to_pdf", "ppt_to_pdf", "word_to_pdf"}

PDF_TOOL_TYPES = {"pdf_merge", "pdf_split", "pdf_compress", "pdf_rotate", "pdf_watermark"}

ALLOWED_OUTPUT_PREFIXES = ["/tmp/convert_", "/tmp/uploads", "/tmp/guest"]


ALLOWED_IMAGE_TYPES = {"png", "jpg", "jpeg", "webp"}


class CreateTaskRequest(BaseModel):
    document_id: str
    task_type: str
    ocr_mode: str | None = None
    params: dict | None = None
    source_document_ids: list[str] | None = None


class CreateMergeRequest(BaseModel):
    document_ids: list[str]
    task_type: str = "images_to_pdf"


class TaskResponse(BaseModel):
    id: str
    task_type: str
    status: str
    error_message: str | None = None
    error_code: str | None = None


class TaskStatusResponse(BaseModel):
    id: str
    status: str
    task_type: str
    error_message: str | None = None
    error_code: str | None = None
    result_path: str | None = None


@router.post("/create", response_model=TaskResponse, status_code=201)
def create_task(
    body: CreateTaskRequest,
    request: Request,
    current_user: User | None = Depends(get_optional_user),
    db: Session = Depends(get_db),
):
    source_doc_ids: list[str] | None = None

    if body.task_type == "pdf_merge":
        if not body.source_document_ids or len(body.source_document_ids) < 2:
            raise HTTPException(status_code=400, detail="合并需要至少 2 个文档")

        try:
            doc_uuids = [uuid.UUID(d) for d in body.source_document_ids]
        except ValueError:
            raise HTTPException(status_code=400, detail="document_id 格式不合法")

        documents = db.query(Document).filter(Document.id.in_(doc_uuids)).all()
        found_ids = {str(d.id) for d in documents}
        missing = [d for d in body.source_document_ids if d not in found_ids]
        if missing:
            raise HTTPException(status_code=400, detail=f"文档不存在: {', '.join(missing)}")

        for doc in documents:
            if current_user and doc.user_id and doc.user_id != current_user.id:
                raise HTTPException(status_code=403, detail="无权操作此文档")

        source_doc_ids = body.source_document_ids
        doc_map = {str(d.id): d for d in documents}
        document = doc_map[source_doc_ids[0]]
    else:
        document = db.query(Document).filter(
            Document.id == uuid.UUID(body.document_id)
        ).first()
        if not document:
            raise HTTPException(status_code=404, detail="文档不存在")

        if current_user and document.user_id and document.user_id != current_user.id:
            raise HTTPException(status_code=403, detail="无权操作此文档")

    if current_user:
        active = db.query(Task).join(Document).filter(
            Document.user_id == current_user.id,
            Task.status.in_(["waiting", "processing"]),
        ).first()
        if active:
            raise HTTPException(status_code=429, detail="当前有正在进行的任务，请等待完成")

    if body.task_type not in PDF_TOOL_TYPES:
        consume_quota(db, current_user, request)

    task = Task(
        id=uuid.uuid4(),
        document_id=document.id,
        task_type=body.task_type,
        ocr_mode=body.ocr_mode,
        params=body.params,
        status="waiting",
        source_document_ids=source_doc_ids,
    )
    db.add(task)
    db.commit()
    db.refresh(task)

    if body.task_type in OFFICE_TYPES:
        celery_app.send_task(
            "worker.tasks.convert_document_office",
            args=[str(task.id)],
            queue="office",
        )
    else:
        celery_app.send_task(
            "worker.tasks.convert_document",
            args=[str(task.id)],
            queue="default",
        )

    return TaskResponse(
        id=str(task.id),
        task_type=task.task_type,
        status=task.status,
    )


@router.get("/{task_id}/status", response_model=TaskStatusResponse)
def get_task_status(
    task_id: str,
    current_user: User | None = Depends(get_optional_user),
    db: Session = Depends(get_db),
):
    task = db.query(Task).filter(Task.id == uuid.UUID(task_id)).first()
    if not task:
        raise HTTPException(status_code=404, detail="任务不存在")

    document = db.query(Document).filter(Document.id == task.document_id).first()
    if document and document.user_id and current_user:
        if document.user_id != current_user.id:
            raise HTTPException(status_code=403, detail="无权查看此任务")

    return TaskStatusResponse(
        id=str(task.id),
        status=task.status,
        task_type=task.task_type,
        error_message=task.error_message,
        error_code=task.error_code,
        result_path=None,
    )


@router.post("/create-merge", response_model=TaskResponse, status_code=201)
def create_merge_task(
    body: CreateMergeRequest,
    request: Request,
    current_user: User | None = Depends(get_optional_user),
    db: Session = Depends(get_db),
):
    if body.task_type != "images_to_pdf":
        raise HTTPException(status_code=400, detail="task_type 仅支持 images_to_pdf")

    if not (2 <= len(body.document_ids) <= 20):
        raise HTTPException(status_code=400, detail="图片数量必须在 2~20 张之间")

    # deduplicate while preserving order
    seen: set[str] = set()
    unique_ids: list[str] = []
    for doc_id in body.document_ids:
        if doc_id not in seen:
            seen.add(doc_id)
            unique_ids.append(doc_id)

    try:
        doc_uuids = [uuid.UUID(d) for d in unique_ids]
    except ValueError:
        raise HTTPException(status_code=400, detail="document_id 格式不合法")

    documents = db.query(Document).filter(Document.id.in_(doc_uuids)).all()
    found_ids = {str(d.id) for d in documents}
    missing = [d for d in unique_ids if d not in found_ids]
    if missing:
        raise HTTPException(status_code=400, detail=f"文档不存在: {', '.join(missing)}")

    for doc in documents:
        if current_user and doc.user_id and doc.user_id != current_user.id:
            raise HTTPException(status_code=403, detail="无权操作此文档")
        if doc.file_type.lower() not in ALLOWED_IMAGE_TYPES:
            raise HTTPException(
                status_code=400,
                detail=f"文档 {doc.filename} 格式不支持，仅允许 PNG/JPG/WebP",
            )

    consume_quota(db, current_user, request)

    # use first document as primary document_id for compatibility
    doc_map = {str(d.id): d for d in documents}
    primary_doc = doc_map[unique_ids[0]]

    task = Task(
        id=uuid.uuid4(),
        document_id=primary_doc.id,
        task_type="images_to_pdf",
        status="waiting",
        source_document_ids=unique_ids,
    )
    db.add(task)
    db.commit()
    db.refresh(task)

    celery_app.send_task(
        "worker.tasks.convert_document",
        args=[str(task.id)],
        queue="default",
    )

    return TaskResponse(
        id=str(task.id),
        task_type=task.task_type,
        status=task.status,
    )


def _validate_result_path(file_path: str) -> bool:
    real_path = os.path.realpath(file_path)
    return any(real_path.startswith(prefix) for prefix in ALLOWED_OUTPUT_PREFIXES)


@router.get("/{task_id}/download")
def download_result(
    task_id: str,
    preview: bool = Query(False),
    current_user: User | None = Depends(get_optional_user),
    db: Session = Depends(get_db),
):
    task = db.query(Task).filter(Task.id == uuid.UUID(task_id)).first()
    if not task:
        raise HTTPException(status_code=404, detail="任务不存在")

    document = db.query(Document).filter(Document.id == task.document_id).first()
    if document and document.user_id and current_user:
        if document.user_id != current_user.id:
            raise HTTPException(status_code=403, detail="无权下载此文件")

    if task.status != "success":
        raise HTTPException(status_code=400, detail="任务尚未完成")
    if not task.result_path:
        raise HTTPException(status_code=404, detail="结果文件不存在")

    file_path = task.result_path.split(",")[0]

    if not _validate_result_path(file_path):
        raise HTTPException(status_code=403, detail="非法文件路径")

    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="结果文件已过期或不存在")

    ext = file_path.rsplit(".", 1)[-1].lower()

    if preview:
        media_type_map = {
            "pdf": "application/pdf",
            "png": "image/png",
            "jpg": "image/jpeg",
            "jpeg": "image/jpeg",
            "webp": "image/webp",
        }
        media_type = media_type_map.get(ext, "application/octet-stream")
        return FileResponse(file_path, media_type=media_type, headers={"Content-Disposition": "inline"})

    base_name = document.filename.rsplit(".", 1)[0] if document else "result"
    download_name = f"{base_name}_converted.{ext}"

    return FileResponse(file_path, filename=download_name)
