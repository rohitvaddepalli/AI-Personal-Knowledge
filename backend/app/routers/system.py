from __future__ import annotations

import os
from collections import deque

import httpx
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field

from app.config import settings
from app.job_queue import list_jobs
from app.llm.router import provider_health
from app.runtime import get_runtime_settings, save_runtime_settings, update_runtime_settings

router = APIRouter(prefix="/api/system", tags=["system"])

_cpu_history: deque[float] = deque(maxlen=20)
_ram_history: deque[float] = deque(maxlen=20)

try:
    import psutil
except Exception:  # pragma: no cover
    psutil = None


class ProviderEntry(BaseModel):
    enabled: bool = False
    base_url: str = ""
    api_key: str = ""
    models: list[str] = Field(default_factory=list)


class FeatureRoute(BaseModel):
    provider: str
    model: str


class RuntimeSettingsUpdate(BaseModel):
    ollama_base_url: str | None = None
    low_resource_mode: bool | None = None
    model_ram_tier: str | None = None
    max_ai_concurrency: int | None = None
    ai_context_window: int | None = None
    battery_saver_mode: bool | None = None
    reduced_animations: bool | None = None
    resource_monitor_enabled: bool | None = None
    resource_monitor_corner: str | None = None
    auth_mode: str | None = None
    llm: dict | None = None


async def _ollama_reachable() -> bool:
    try:
        async with httpx.AsyncClient(timeout=3.0) as client:
            response = await client.get(f"{settings.ollama_base_url}/api/tags")
            return response.status_code == 200
    except Exception:
        return False


def _metrics() -> dict:
    cpu = 0.0
    ram = 0.0
    process_mb = 0.0
    if psutil:
        cpu = psutil.cpu_percent(interval=None)
        ram = psutil.virtual_memory().percent
        process_mb = psutil.Process(os.getpid()).memory_info().rss / (1024 * 1024)
    _cpu_history.append(cpu)
    _ram_history.append(ram)
    jobs = list_jobs(20)
    active = [job for job in jobs if job["status"] not in {"done", "failed"}]
    llm = get_runtime_settings().get("llm", {})
    return {
        "cpuPercent": round(cpu, 1),
        "ramPercent": round(ram, 1),
        "processMemoryMb": round(process_mb, 1),
        "cpuHistory": list(_cpu_history),
        "ramHistory": list(_ram_history),
        "queueDepth": len(active),
        "activeTasks": active[:5],
        "activeModel": llm.get("default_model", settings.llm_model),
        "activeProvider": llm.get("default_provider", settings.llm_provider),
        "warnings": {
            "cpu": "high" if cpu >= 85 else "warn" if cpu >= 70 else "ok",
            "ram": "high" if ram >= 85 else "warn" if ram >= 70 else "ok",
        },
        "memoryBudgetMb": settings.memory_budget_mb,
        "memoryBudgetStatus": "high" if process_mb >= settings.memory_budget_mb else "ok",
    }


@router.get("/status")
async def system_status(request: Request):
    runtime = get_runtime_settings()
    providers = runtime.get("llm", {}).get("providers", {})
    provider_status: dict[str, bool] = {}
    for name, config in providers.items():
        if isinstance(config, dict) and config.get("enabled"):
            try:
                provider_status[name] = await provider_health(name)
            except Exception:
                provider_status[name] = False
        else:
            provider_status[name] = False
    return {
        "appDataDir": str(settings.app_data_dir_path),
        "apiBaseUrl": f"http://{settings.api_host}:{settings.api_port}",
        "ollamaBaseUrl": settings.ollama_base_url,
        "ollamaReachable": await _ollama_reachable(),
        "sidecarMode": settings.sidecar_mode,
        "databaseMode": settings.database_mode,
        "databaseBackend": settings.database_backend,
        "runtime": runtime,
        "metrics": _metrics(),
        "providerHealth": provider_status,
        "startupProfile": getattr(request.app.state, "startup_profile", {"bootDurationMs": None}),
    }


@router.get("/metrics")
def system_metrics():
    return _metrics()


@router.patch("/settings")
async def update_system_settings(payload: RuntimeSettingsUpdate):
    patch = payload.model_dump(exclude_none=True)
    if "ollama_base_url" in patch:
        patch["llm"] = patch.get("llm", {})
        patch["llm"]["providers"] = patch["llm"].get("providers", {})
        patch["llm"]["providers"]["ollama"] = {"base_url": patch["ollama_base_url"], "enabled": True}
    updated = update_runtime_settings(patch)
    return {
        "ollamaBaseUrl": settings.ollama_base_url,
        "ollamaReachable": await _ollama_reachable(),
        "runtime": updated,
    }


@router.post("/shutdown")
async def shutdown_sidecar(request: Request):
    if not settings.sidecar_mode:
        raise HTTPException(status_code=400, detail="Shutdown is only available in sidecar mode")
    server = getattr(request.app.state, "uvicorn_server", None)
    if server is None:
        raise HTTPException(status_code=503, detail="Server controller unavailable")
    server.should_exit = True
    return {"status": "shutting-down"}


@router.get("/health")
async def system_health():
    return {"status": "ok", "metrics": _metrics()}
