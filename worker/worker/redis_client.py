import logging
import os

import redis

logger = logging.getLogger(__name__)

REDIS_URL = os.getenv("CELERY_BROKER_URL", "redis://redis:6379/0")

try:
    redis_client = redis.from_url(REDIS_URL, decode_responses=True,
                                  socket_connect_timeout=0.5, socket_timeout=0.5)
except Exception as e:
    logger.warning(f"Failed to create Redis client: {e}")
    redis_client = None
