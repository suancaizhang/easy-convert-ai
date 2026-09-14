"""Durably publish waiting tasks: run with ``python -m app.dispatcher``."""
import logging
import time
from datetime import datetime, timezone

from celery import Celery

from app.config import settings
from app.database import SessionLocal
from app.models import Task
from app.task_service import OFFICE_TYPES

logger = logging.getLogger(__name__)
celery_app = Celery(broker=settings.celery_broker_url)
celery_app.conf.broker_transport_options = {
    "socket_connect_timeout": 2, "socket_timeout": 2,
}


def dispatch_pending(batch_size: int = 100) -> int:
    published = 0
    for _ in range(batch_size):
        with SessionLocal() as db:
            task_id = None
            try:
                task = (db.query(Task).filter(Task.status == "waiting", Task.dispatched_at.is_(None))
                        .order_by(Task.created_at, Task.id).with_for_update(skip_locked=True).first())
                if task is None:
                    break
                task_id = str(task.id)
                office = task.task_type in OFFICE_TYPES
                celery_app.send_task(
                    "worker.tasks.convert_document_office" if office else "worker.tasks.convert_document",
                    args=[task_id], task_id=task_id, queue="office" if office else "default", retry=False,
                )
                # Publish first: a crash before commit duplicates delivery; it never loses intent.
                task.dispatched_at = datetime.now(timezone.utc)
                db.commit()
                published += 1
            except Exception as error:
                db.rollback()
                logger.warning("Task dispatch failed for %s (%s); retained for retry", task_id, type(error).__name__)
                break
    return published


def main() -> None:
    logging.basicConfig(level=logging.INFO)
    logger.info("Task dispatcher started")
    while True:
        dispatch_pending()
        time.sleep(1)


if __name__ == "__main__":
    main()
