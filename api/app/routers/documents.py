import os
import uuid
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Response, UploadFile, File
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_optional_user, require_owner
from app.task_service import valid_result_path
from app.models import User, Document, Task

router = APIRouter(prefix="/api/documents", tags=["documents"])

ALLOWED_TYPES = {
    "application/pdf": "pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation": "pptx",
    "image/png": "png",
    "image/jpeg": "jpg",
    "image/webp": "webp",
}

MAX_FILE_SIZE = 20 * 1024 * 1024  # 20MB
UPLOAD_DIR = "/tmp/uploads"
GUEST_UPLOAD_DIR = "/tmp/guest"


class DocumentResponse(BaseModel):
    id: str
    filename: str
    file_type: str
    file_size: int
    status: str

    class Config:
        from_attributes = True


@router.post("/upload", response_model=DocumentResponse)
async def upload_file(
    file: UploadFile = File(...),
    current_user: User | None = Depends(get_optional_user),
    db: Session = Depends(get_db),
):
    if file.content_type not in ALLOWED_TYPES:
        raise HTTPException(status_code=400, detail="不支持的文件格式")

    content = await file.read()
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(status_code=400, detail="文件大小超过 20MB 限制")

    file_ext = ALLOWED_TYPES[file.content_type]
    file_id = uuid.uuid4()
    filename = file.filename or f"upload.{file_ext}"

    if current_user:
        upload_dir = os.path.join(UPLOAD_DIR, str(current_user.id))
    else:
        upload_dir = GUEST_UPLOAD_DIR

    os.makedirs(upload_dir, exist_ok=True)
    stored_name = f"{file_id}.{file_ext}"
    file_path = os.path.join(upload_dir, stored_name)

    with open(file_path, "wb") as f:
        f.write(content)

    oss_path = file_path if current_user else None

    doc = Document(
        id=file_id,
        user_id=current_user.id if current_user else None,
        filename=filename,
        file_type=file_ext,
        file_size=len(content),
        oss_path=oss_path or file_path,
        status="uploaded",
        file_status="active",
        expires_at=datetime.now(timezone.utc) + timedelta(days=1),
    )
    db.add(doc)
    db.commit()
    db.refresh(doc)

    return DocumentResponse(
        id=str(doc.id),
        filename=doc.filename,
        file_type=doc.file_type,
        file_size=doc.file_size,
        status=doc.status,
    )


@router.delete("/{document_id}", status_code=204)
def delete_document(
    document_id: uuid.UUID,
    current_user: User | None = Depends(get_optional_user),
    db: Session = Depends(get_db),
):
    """删除文档及其关联的任务记录和物理文件"""
    doc = (db.query(Document).filter(Document.id == document_id)
           .populate_existing().with_for_update().first())
    if not doc:
        raise HTTPException(status_code=404, detail="文档不存在")
    require_owner(doc.user_id, current_user)
    referenced_tasks = db.query(Task).filter(
        (Task.document_id == document_id) | Task.source_document_ids.contains([str(document_id)])
    ).all()
    for task in referenced_tasks:
        if task.error_code == "ERR_ACCESS":
            raise HTTPException(status_code=403, detail="任务来源权限无法确认")
        require_owner(task.user_id, current_user)
        if task.status in {"waiting", "processing"}:
            raise HTTPException(status_code=409, detail="文档仍被活动任务引用，请先取消任务")

    files_to_remove = {doc.oss_path} if doc.oss_path else set()
    for task in referenced_tasks:
        if task.document_id == document_id:
            files_to_remove.update(path for path in task.result_paths if valid_result_path(path))

    db.query(Task).filter(Task.document_id == document_id).delete(synchronize_session=False)
    db.delete(doc)
    db.commit()

    # 清理物理文件（不阻塞接口，失败不回滚）
    for path in files_to_remove:
        try:
            if os.path.exists(path):
                os.remove(path)
        except OSError:
            pass

    return Response(status_code=204)
