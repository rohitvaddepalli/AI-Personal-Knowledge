from __future__ import annotations

import asyncio
import time
import uuid
from concurrent.futures import ThreadPoolExecutor
from typing import Any, Callable

from app.config import settings

try:
    from celery import Celery
except Exception:  # pragma: no cover - optional dependency fallback
    Celery = None


_jobs: dict[str, dict[str, Any]] = {}
_executor = ThreadPoolExecutor(max_workers=settings.max_background_job_concurrency)
celery_app = Celery(
    "second_brain",
    broker=settings.celery_broker_url,
    backend=settings.celery_result_backend,
) if Celery else None


def create_job(job_type: str, payload: dict[str, Any] | None = None) -> dict[str, Any]:
    job_id = str(uuid.uuid4())
    _jobs[job_id] = {
        "id": job_id,
        "job_type": job_type,
        "status": "queued",
        "progress": 0,
        "payload": payload or {},
        "result": None,
        "error": None,
        "queue": "celery" if celery_app else "local",
        "created_at": time.time(),
        "updated_at": time.time(),
    }
    return _jobs[job_id]


def update_job(job_id: str, **updates: Any) -> None:
    job = _jobs.get(job_id)
    if not job:
        return
    job.update(updates)
    job["updated_at"] = time.time()


def get_job(job_id: str) -> dict[str, Any] | None:
    return _jobs.get(job_id)


def list_jobs(limit: int = 50) -> list[dict[str, Any]]:
    return sorted(_jobs.values(), key=lambda item: item["created_at"], reverse=True)[:limit]


def submit_local_job(job_id: str, fn: Callable[..., Any], *args: Any, **kwargs: Any) -> None:
    def runner() -> None:
        try:
            update_job(job_id, status="running", progress=10)
            result = fn(*args, **kwargs)
            update_job(job_id, status="done", progress=100, result=result)
        except Exception as exc:
            update_job(job_id, status="failed", error=str(exc))

    _executor.submit(runner)


async def submit_async_job(job_id: str, fn: Callable[..., Any], *args: Any, **kwargs: Any) -> None:
    loop = asyncio.get_running_loop()
    await loop.run_in_executor(_executor, lambda: submit_local_job(job_id, fn, *args, **kwargs))
