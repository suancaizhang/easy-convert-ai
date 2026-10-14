import mimetypes
import os
import uuid

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_optional_user
from app.models import User
from app.redis_client import redis_client
from app.routers.quota import refund_task_quota
from app.task_service import (
    TaskType,
    create_task_record,
    has_unresolved_ocr_submission,
    load_task,
    valid_result_path,
)

router = APIRouter(prefix="/api/tasks", tags=["tasks"])


class CreateTaskRequest(BaseModel):
    document_id: uuid.UUID
    task_type: TaskType
    ocr_mode: str | None = Field(default=None, max_length=20)
    params: dict | None = None
    source_document_ids: list[uuid.UUID] | None = Field(default=None, max_length=20)


class CreateMergeRequest(BaseModel):
    document_ids: list[uuid.UUID] = Field(min_length=2, max_length=20)
    task_type: str = "images_to_pdf"


class TaskResponse(BaseModel):
    id: str
    task_type: str
    status: str
    error_message: str | None = None
    error_code: str | None = None


class TaskStatusResponse(TaskResponse):
    progress: int | None = None
    progress_current: int | None = None
    progress_total: int | None = None


def task_response(task) -> TaskResponse:
    return TaskResponse(id=str(task.id), task_type=task.task_type, status=task.status,
                        error_message=task.error_message, error_code=task.error_code)


@router.post("/create", response_model=TaskResponse, status_code=201)
def create_task(body: CreateTaskRequest, current_user: User | None = Depends(get_optional_user),
                db: Session = Depends(get_db)):
    source_ids = body.source_document_ids if body.source_document_ids is not None else [body.document_id]
    task = create_task_record(db, current_user, source_ids, body.task_type, body.params, body.ocr_mode)
    return task_response(task)


@router.post("/create-merge", response_model=TaskResponse, status_code=201)
def create_merge_task(body: CreateMergeRequest, current_user: User | None = Depends(get_optional_user),
                      db: Session = Depends(get_db)):
    if body.task_type != "images_to_pdf":
        raise HTTPException(status_code=400, detail="task_type 仅支持 images_to_pdf")
    if len(set(body.document_ids)) < 2:
        raise HTTPException(status_code=400, detail="合并需要至少 2 个不同的图片")
    task = create_task_record(db, current_user, body.document_ids, "images_to_pdf", None)
    return task_response(task)


@router.get("/{task_id}/status", response_model=TaskStatusResponse)
def get_task_status(task_id: uuid.UUID, current_user: User | None = Depends(get_optional_user),
                    db: Session = Depends(get_db)):
    task, _ = load_task(db, task_id, current_user)
    response = TaskStatusResponse(**task_response(task).model_dump())
    if task.status == "processing":
        try:
            data = redis_client.hgetall(f"task_progress:{task_id}")
            if data:
                response.progress = max(0, min(100, int(data["progress"])))
                response.progress_current = int(data["current"])
                response.progress_total = int(data["total"])
        except Exception:
            # Optional progress cannot override the authoritative database state.
            pass
    return response


@router.post("/{task_id}/cancel")
def cancel_task(task_id: uuid.UUID, current_user: User | None = Depends(get_optional_user),
                db: Session = Depends(get_db)):
    task, _ = load_task(db, task_id, current_user, lock=True)
    if task.status != "waiting" or has_unresolved_ocr_submission(task):
        raise HTTPException(status_code=409, detail="任务已开始处理或结束，无法取消")
    task.status = "failed"
    task.error_code = "ERR_CANCELLED"
    task.error_message = "用户取消"
    refund_task_quota(db, task)
    db.commit()
    # DB state arbitrates cancellation even if delivery raced or already happened.
    return {"detail": "任务已取消"}


def ready_result(db, task_id, user):
    task, document = load_task(db, task_id, user)
    if task.status != "success":
        raise HTTPException(status_code=400, detail="任务尚未完成")
    if not task.result_paths:
        raise HTTPException(status_code=404, detail="结果文件不存在")
    return task, document


def result_response(task, document, index: int, preview: bool, *, per_page: bool = False):
    if index < 0 or index >= len(task.result_paths):
        raise HTTPException(status_code=400, detail="页码超出范围")
    path = task.result_paths[index]
    if not valid_result_path(path):
        raise HTTPException(status_code=403, detail="非法文件路径")
    if not os.path.isfile(path):
        raise HTTPException(status_code=404, detail="结果文件已过期或不存在")
    if preview:
        media_type = mimetypes.guess_type(path)[0] or "application/octet-stream"
        return FileResponse(path, media_type=media_type, headers={"Content-Disposition": "inline"})
    base = document.filename.rsplit(".", 1)[0]
    extension = os.path.splitext(path)[1]
    suffix = f"page{index + 1}" if per_page else "converted"
    return FileResponse(path, filename=f"{base}_{suffix}{extension}")


@router.get("/{task_id}/download")
def download_result(task_id: uuid.UUID, preview: bool = Query(False),
                    current_user: User | None = Depends(get_optional_user), db: Session = Depends(get_db)):
    task, document = ready_result(db, task_id, current_user)
    return result_response(task, document, 0, preview)


@router.get("/{task_id}/pages")
def get_task_pages(task_id: uuid.UUID, current_user: User | None = Depends(get_optional_user),
                   db: Session = Depends(get_db)):
    task, _ = ready_result(db, task_id, current_user)
    return {"total": len(task.result_paths), "ext": os.path.splitext(task.result_paths[0])[1].lstrip(".").lower()}


@router.get("/{task_id}/download/{page_index}")
def download_page(task_id: uuid.UUID, page_index: int, preview: bool = Query(False),
                  current_user: User | None = Depends(get_optional_user), db: Session = Depends(get_db)):
    task, document = ready_result(db, task_id, current_user)
    return result_response(task, document, page_index, preview, per_page=True)
