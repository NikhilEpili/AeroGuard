from functools import lru_cache

from redis import Redis as SyncRedis
from redis.asyncio import Redis

from backend.core.config import get_settings


@lru_cache
def get_redis_client() -> Redis:
    settings = get_settings()
    return Redis.from_url(settings.redis_url, decode_responses=True)


@lru_cache
def get_sync_redis_client() -> SyncRedis:
    settings = get_settings()
    return SyncRedis.from_url(settings.redis_url, decode_responses=True)
