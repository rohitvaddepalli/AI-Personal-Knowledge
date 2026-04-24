from __future__ import annotations

import json

import httpx

from app.config import settings
from app.llm.types import LLMRequest, LLMResponse, LLMStreamEvent


class OllamaProvider:
    name = "ollama"

    async def generate(self, request: LLMRequest) -> LLMResponse:
        async with httpx.AsyncClient(timeout=120.0) as client:
            response = await client.post(
                f"{settings.ollama_base_url}/api/generate",
                json={
                    "model": request.model or settings.llm_model,
                    "system": request.system or "",
                    "prompt": request.prompt,
                    "stream": False,
                    "options": {
                        "temperature": request.temperature,
                        "num_ctx": settings.ai_context_window,
                        **({"num_predict": request.max_tokens} if request.max_tokens else {}),
                    },
                },
            )
            response.raise_for_status()
            payload = response.json()
        return LLMResponse(
            provider=self.name,
            model=request.model or settings.llm_model,
            content=payload.get("response", "").strip(),
            finish_reason="stop" if payload.get("done") else None,
            raw=payload,
        )

    async def stream(self, request: LLMRequest):
        async with httpx.AsyncClient(timeout=180.0) as client:
            async with client.stream(
                "POST",
                f"{settings.ollama_base_url}/api/generate",
                json={
                    "model": request.model or settings.llm_model,
                    "system": request.system or "",
                    "prompt": request.prompt,
                    "stream": True,
                    "options": {
                        "temperature": request.temperature,
                        "num_ctx": settings.ai_context_window,
                        **({"num_predict": request.max_tokens} if request.max_tokens else {}),
                    },
                },
            ) as response:
                response.raise_for_status()
                async for line in response.aiter_lines():
                    if not line:
                        continue
                    payload = json.loads(line)
                    if payload.get("response"):
                        yield LLMStreamEvent(
                            type="token",
                            provider=self.name,
                            model=request.model or settings.llm_model,
                            content=payload.get("response", ""),
                        )
                    if payload.get("done"):
                        yield LLMStreamEvent(
                            type="done",
                            provider=self.name,
                            model=request.model or settings.llm_model,
                            finish_reason="stop",
                        )

    async def list_models(self) -> list[str]:
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.get(f"{settings.ollama_base_url}/api/tags")
                response.raise_for_status()
                models = response.json().get("models", [])
            return [model.get("name") for model in models if model.get("name")]
        except Exception:
            return [settings.llm_model]

    async def healthcheck(self) -> bool:
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                response = await client.get(f"{settings.ollama_base_url}/api/tags")
            return response.status_code == 200
        except Exception:
            return False
