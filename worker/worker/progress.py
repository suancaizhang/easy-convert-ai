import logging

from worker.redis_client import redis_client

logger = logging.getLogger(__name__)

PROGRESS_TTL = 300  # seconds


def report_progress(
    task_id: str,
    current: int,
    total: int,
    phase: str = "converting",
) -> None:
    """Report task progress to Redis. Silently ignores failures."""
    if not redis_client:
        return

    try:
        key = f"task_progress:{task_id}"
        progress = int((current / total) * 100) if total > 0 else 0
        redis_client.hset(key, mapping={
            "progress": str(progress),
            "current": str(current),
            "total": str(total),
            "phase": phase,
        })
        redis_client.expire(key, PROGRESS_TTL)
    except Exception as e:
        logger.warning(f"Failed to report progress for task {task_id}: {e}")
