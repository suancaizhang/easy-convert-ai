import redis

from app.config import settings

redis_client = redis.from_url(settings.redis_url, decode_responses=True,
                              socket_connect_timeout=0.5, socket_timeout=0.5)
