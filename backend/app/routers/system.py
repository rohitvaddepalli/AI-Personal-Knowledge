from typing import Optional

import httpx
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel

from app.config import settings
from app.runtime import save_runtime_settings

router = APIRouter(prefix="/api/system", tags=["system"])


class SystemSettingsUpdate(BaseModel):
    ollama_base_url: str


async def _ollama_reachable() -> bool:
    try:
        async with httpx.AsyncClient(timeout=3.0) as client:
            response = await client.get(f"{settings.ollama_base_url}/api/tags")
            return response.status_code == 200
    except Exception:
        return False


@router.get("/status")
async def system_status():
    return {
        "appDataDir": str(settings.app_data_dir_path),
        "apiBaseUrl": f"http://{settings.api_host}:{settings.api_port}",
        "ollamaBaseUrl": settings.ollama_base_url,
        "ollamaReachable": await _ollama_reachable(),
        "sidecarMode": settings.sidecar_mode,
    }


@router.patch("/settings")
async def update_system_settings(payload: SystemSettingsUpdate):
    ollama_base_url = payload.ollama_base_url.strip()
    if not ollama_base_url:
        raise HTTPException(status_code=400, detail="Ollama host is required")

    settings.ollama_base_url = ollama_base_url
    save_runtime_settings()

    return {
        "ollamaBaseUrl": settings.ollama_base_url,
        "ollamaReachable": await _ollama_reachable(),
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
    return {"status": "ok"}
