import os
import uuid
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Response, UploadFile, File
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_current_user, get_optional_user
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

    oss_path = f"original/{current_user.id}/{stored_name}" if current_user else None

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
    doc = db.query(Document).filter(Document.id == document_id).first()

    if not doc:
        raise HTTPException(status_code=404, detail="文档不存在")

    # 鉴权：登录用户只能删除自己的文档；游客上传的文档(user_id=None)仅允许游客删除
    if doc.user_id is not None:
        if current_user is None or current_user.id != doc.user_id:
            raise HTTPException(status_code=404, detail="文档不存在")
    else:
        # 游客文档：已登录用户不能删除游客文档
        if current_user is not None:
            raise HTTPException(status_code=404, detail="文档不存在")

    # 收集需要清理的物理文件路径
    files_to_remove: list[str] = []
    if doc.oss_path:
        files_to_remove.append(doc.oss_path)

    tasks = db.query(Task).filter(Task.document_id == document_id).all()
    for task in tasks:
        if task.result_path:
            files_to_remove.append(task.result_path)

    # 级联删除关联任务，再删除文档
    db.query(Task).filter(Task.document_id == document_id).delete()
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
