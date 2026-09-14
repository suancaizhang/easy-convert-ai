from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import func, desc
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_current_user
from app.models import User, Document, Task

router = APIRouter(prefix="/api/documents", tags=["documents"])


class HistoryItem(BaseModel):
    id: str
    filename: str
    file_type: str
    file_size: int
    status: str
    file_status: str
    created_at: str
    task_type: str | None = None
    task_status: str | None = None
    task_id: str | None = None


class HistoryResponse(BaseModel):
    items: list[HistoryItem]
    total: int
    page: int
    page_size: int


@router.get("/history", response_model=HistoryResponse)
def get_history(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    owned_task_documents = db.query(Task.document_id).filter(Task.user_id == current_user.id)
    query = db.query(Document).filter(
        (Document.user_id == current_user.id) | Document.id.in_(owned_task_documents)
    )
    total = query.count()
    docs = (
        query.order_by(Document.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )

    if not docs:
        return HistoryResponse(items=[], total=total, page=page, page_size=page_size)

    doc_ids = [doc.id for doc in docs]

    latest_tasks = (
        db.query(Task)
        .filter(Task.document_id.in_(doc_ids), Task.user_id == current_user.id)
        .distinct(Task.document_id)
        .order_by(Task.document_id, Task.created_at.desc(), Task.id.desc())
        .all()
    )

    task_map = {task.document_id: task for task in latest_tasks}

    items = []
    for doc in docs:
        task = task_map.get(doc.id)
        items.append(
            HistoryItem(
                id=str(doc.id),
                filename=doc.filename,
                file_type=doc.file_type,
                file_size=doc.file_size,
                status=doc.status,
                file_status=doc.file_status,
                created_at=doc.created_at.isoformat() if doc.created_at else "",
                task_type=task.task_type if task else None,
                task_status=task.status if task else None,
                task_id=str(task.id) if task else None,
            )
        )

    return HistoryResponse(items=items, total=total, page=page, page_size=page_size)
