"""
Redis Cache Management
"""

import redis.asyncio as redis
import json
import pickle
from typing import Any, Optional, List
import logging

logger = logging.getLogger(__name__)


class RedisCache:
    """Manages Redis cache operations"""

    def __init__(self, host: str = "localhost", port: int = 6379, db: int = 0):
        """Initialize Redis connection"""
        self.redis_client = None
        self.host = host
        self.port = port
        self.db = db

    async def connect(self):
        """Connect to Redis"""
        try:
            self.redis_client = await redis.Redis(
                host=self.host,
                port=self.port,
                db=self.db,
                decode_responses=True
            )
            await self.redis_client.ping()
            logger.info("Connected to Redis")
        except Exception as e:
            logger.error(f"Failed to connect to Redis: {e}")
            raise

    def close(self):
        """Close Redis connection"""
        if self.redis_client:
            self.redis_client.close()

    async def get(self, key: str) -> Optional[Any]:
        """Get value from cache"""
        if not self.redis_client:
            await self.connect()

        try:
            value = await self.redis_client.get(key)
            return value
        except Exception as e:
            logger.warning(f"Cache get error: {e}")
            return None

    async def set(self, key: str, value: Any, expire: int = 3600):
        """Set value in cache with expiration"""
        if not self.redis_client:
            await self.connect()

        try:
            if isinstance(value, (dict, list)):
                value = json.dumps(value)
            await self.redis_client.setex(key, expire, value)
            return True
        except Exception as e:
            logger.warning(f"Cache set error: {e}")
            return False

    async def delete(self, key: str):
        """Delete key from cache"""
        if not self.redis_client:
            await self.connect()

        try:
            await self.redis_client.delete(key)
        except Exception as e:
            logger.warning(f"Cache delete error: {e}")

    async def delete_pattern(self, pattern: str):
        """Delete all keys matching pattern"""
        if not self.redis_client:
            await self.connect()

        try:
            cursor = 0
            while True:
                cursor, keys = await self.redis_client.scan(
                    cursor, match=pattern, count=100
                )
                if keys:
                    await self.redis_client.delete(*keys)
                if cursor == 0:
                    break
        except Exception as e:
            logger.warning(f"Cache delete pattern error: {e}")

    async def exists(self, key: str) -> bool:
        """Check if key exists"""
        if not self.redis_client:
            await self.connect()

        try:
            return await self.redis_client.exists(key) > 0
        except Exception as e:
            logger.warning(f"Cache exists error: {e}")
            return False

    async def get_many(self, keys: List[str]) -> dict:
        """Get multiple values"""
        if not self.redis_client:
            await self.connect()

        try:
            values = await self.redis_client.mget(keys)
            return {k: v for k, v in zip(keys, values) if v is not None}
        except Exception as e:
            logger.warning(f"Cache get_many error: {e}")
            return {}

    async def set_many(self, mapping: dict, expire: int = 3600):
        """Set multiple values"""
        if not self.redis_client:
            await self.connect()

        try:
            # Convert values to strings
            str_mapping = {}
            for k, v in mapping.items():
                if isinstance(v, (dict, list)):
                    str_mapping[k] = json.dumps(v)
                else:
                    str_mapping[k] = str(v)

            # Use pipeline for atomic operations
            pipe = self.redis_client.pipeline()
            for k, v in str_mapping.items():
                pipe.setex(k, expire, v)
            await pipe.execute()
            return True
        except Exception as e:
            logger.warning(f"Cache set_many error: {e}")
            return False

    async def increment(self, key: str, amount: int = 1) -> int:
        """Increment a counter"""
        if not self.redis_client:
            await self.connect()

        try:
            return await self.redis_client.incrby(key, amount)
        except Exception as e:
            logger.warning(f"Cache increment error: {e}")
            return 0

    async def get_ttl(self, key: str) -> int:
        """Get TTL for a key"""
        if not self.redis_client:
            await self.connect()

        try:
            return await self.redis_client.ttl(key)
        except Exception as e:
            logger.warning(f"Cache get_ttl error: {e}")
            return -1