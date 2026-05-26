from typing import Any
import asyncpg
from .config import settings

_pool: asyncpg.Pool | None = None


async def create_pool() -> asyncpg.Pool:
    global _pool
    _pool = await asyncpg.create_pool(
        dsn=settings.DATABASE_URL,
        min_size=2,
        max_size=10,
        timeout=5,
    )
    return _pool


async def close_pool() -> None:
    global _pool
    if _pool:
        await _pool.close()
        _pool = None


async def fetch(sql: str, *args: Any) -> list[dict]:
    assert _pool is not None, "DB pool not initialized"
    async with _pool.acquire() as conn:
        rows = await conn.fetch(sql, *args)
        return [dict(r) for r in rows]


async def fetchrow(sql: str, *args: Any) -> dict | None:
    assert _pool is not None, "DB pool not initialized"
    async with _pool.acquire() as conn:
        row = await conn.fetchrow(sql, *args)
        return dict(row) if row else None


async def execute(sql: str, *args: Any) -> str:
    assert _pool is not None, "DB pool not initialized"
    async with _pool.acquire() as conn:
        return await conn.execute(sql, *args)
