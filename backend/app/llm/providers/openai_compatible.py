from __future__ import annotations

import json

import httpx

from app.llm.types import LLMRequest, LLMResponse, LLMStreamEvent


class OpenAICompatibleProvider:
    def __init__(self, name: str, base_url: str, api_key: str, default_model: str):
        self.name = name
        self.base_url = base_url.rstrip("/")
        self.api_key = api_key
        self.default_model = default_model

    def _headers(self) -> dict[str, str]:
        return {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }

    async def generate(self, request: LLMRequest) -> LLMResponse:
        async with httpx.AsyncClient(timeout=120.0) as client:
            response = await client.post(
                f"{self.base_url}/chat/completions",
                headers=self._headers(),
                json={
                    "model": request.model or self.default_model,
                    "messages": _messages(request),
                    "temperature": request.temperature,
                    "max_tokens": request.max_tokens,
                    "stream": False,
                },
            )
            response.raise_for_status()
            payload = response.json()
        choice = (payload.get("choices") or [{}])[0]
        message = choice.get("message") or {}
        return LLMResponse(
            provider=self.name,
            model=request.model or self.default_model,
            content=(message.get("content") or "").strip(),
            finish_reason=choice.get("finish_reason"),
            usage=payload.get("usage") or {},
            raw=payload,
        )

    async def stream(self, request: LLMRequest):
        async with httpx.AsyncClient(timeout=180.0) as client:
            async with client.stream(
                "POST",
                f"{self.base_url}/chat/completions",
                headers=self._headers(),
                json={
                    "model": request.model or self.default_model,
                    "messages": _messages(request),
                    "temperature": request.temperature,
                    "max_tokens": request.max_tokens,
                    "stream": True,
                },
            ) as response:
                response.raise_for_status()
                async for line in response.aiter_lines():
                    if not line or not line.startswith("data:"):
                        continue
                    data = line[5:].strip()
                    if data == "[DONE]":
                        yield LLMStreamEvent(type="done", provider=self.name, model=request.model or self.default_model, finish_reason="stop")
                        continue
                    payload = json.loads(data)
                    delta = ((payload.get("choices") or [{}])[0].get("delta") or {}).get("content", "")
                    if delta:
                        yield LLMStreamEvent(type="token", provider=self.name, model=request.model or self.default_model, content=delta)

    async def list_models(self) -> list[str]:
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.get(f"{self.base_url}/models", headers=self._headers())
                response.raise_for_status()
                payload = response.json()
            return [item.get("id") for item in payload.get("data", []) if item.get("id")]
        except Exception:
            return [self.default_model]

    async def healthcheck(self) -> bool:
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.get(f"{self.base_url}/models", headers=self._headers())
            return response.status_code == 200
        except Exception:
            return False


def _messages(request: LLMRequest) -> list[dict[str, str]]:
    messages: list[dict[str, str]] = []
    if request.system:
        messages.append({"role": "system", "content": request.system})
    messages.append({"role": "user", "content": request.prompt})
    return messages
