import os
import time
import pickle
import hashlib
import functools
import threading
from typing import Any, Optional, Union, Callable
from diskcache import Cache

class CacheEngine:
    """
    Unified Cache Engine supporting:
    1. Local In-Memory (for single worker speed)
    2. Shared DiskCache (SQLite backed, perfect for multi-worker local distribution)
    3. Redis (for true horizontally scaled load distribution)
    """
    _instance = None
    _lock = threading.Lock()

    def __new__(cls):
        with cls._lock:
            if cls._instance is None:
                cls._instance = super(CacheEngine, cls).__new__(cls)
                cls._instance._init_cache()
            return cls._instance

    def _init_cache(self):
        """Initializes the backend based on environment variables."""
        self.redis_url = os.getenv("REDIS_URL")
        self.cache_dir = os.getenv("CACHE_DIR", "/tmp/obd_cache")
        self.default_ttl = int(os.getenv("CACHE_TTL", 3600)) # 1 hour default
        
        self.use_redis = False
        self.redis_client = None
        
        # Try Redis if available
        if self.redis_url:
            try:
                import redis
                self.redis_client = redis.from_url(self.redis_url)
                self.redis_client.ping()
                self.use_redis = True
                print(f"DEBUG: CacheEngine initialized with REDIS at {self.redis_url}")
            except Exception as e:
                print(f"WARNING: Redis connection failed, falling back to DiskCache: {e}")

        # Fallback to DiskCache (multi-process safe)
        if not self.use_redis:
            if not os.path.exists(self.cache_dir):
                os.makedirs(self.cache_dir, exist_ok=True)
            self.disk_cache = Cache(self.cache_dir)
            print(f"DEBUG: CacheEngine initialized with DISKCACHE at {self.cache_dir}")

    def get(self, key: str) -> Any:
        """Retrieves an item from cache."""
        try:
            if self.use_redis:
                val = self.redis_client.get(key)
                return pickle.loads(val) if val else None
            else:
                return self.disk_cache.get(key)
        except Exception as e:
            print(f"CACHE ERROR (get): {e}")
            return None

    def set(self, key: str, value: Any, expire: Optional[int] = None):
        """Stores an item in cache with optional expiration (seconds)."""
        ttl = expire if expire is not None else self.default_ttl
        try:
            if self.use_redis:
                self.redis_client.setex(key, ttl, pickle.dumps(value))
            else:
                self.disk_cache.set(key, value, expire=ttl)
        except Exception as e:
            print(f"CACHE ERROR (set): {e}")

    def delete(self, key: str):
        """Removes an item from cache."""
        try:
            if self.use_redis:
                self.redis_client.delete(key)
            else:
                self.disk_cache.delete(key)
        except Exception as e:
            print(f"CACHE ERROR (delete): {e}")

    def clear(self):
        """Clears all cached data."""
        try:
            if self.use_redis:
                self.redis_client.flushdb()
            else:
                self.disk_cache.clear()
        except Exception as e:
            print(f"CACHE ERROR (clear): {e}")

    def generate_key(self, prefix: str, *args, **kwargs) -> str:
        """Generates a stable MD5 hash key for any input data."""
        data = f"{prefix}:{args}:{kwargs}"
        return hashlib.md5(data.encode()).hexdigest()

def cached(prefix: str, ttl: int = 3600):
    """Decorator for caching function results."""
    def decorator(func: Callable):
        @functools.wraps(func)
        def wrapper(*args, **kwargs):
            cache = CacheEngine()
            # Generate a key based on function name and arguments
            key = f"{prefix}:{func.__name__}:{cache.generate_key('', *args, **kwargs)}"
            
            result = cache.get(key)
            if result is not None:
                return result
            
            result = func(*args, **kwargs)
            cache.set(key, result, expire=ttl)
            return result
        return wrapper
    return decorator

# Shared instance for easy access
cache_engine = CacheEngine()

