from __future__ import annotations

import json

import httpx

from app.llm.types import LLMRequest, LLMResponse, LLMStreamEvent


class AnthropicProvider:
    name = "anthropic"

    def __init__(self, base_url: str, api_key: str, default_model: str):
        self.base_url = base_url.rstrip("/")
        self.api_key = api_key
        self.default_model = default_model

    def _headers(self) -> dict[str, str]:
        return {
            "x-api-key": self.api_key,
            "anthropic-version": "2023-06-01",
            "content-type": "application/json",
        }

    async def generate(self, request: LLMRequest) -> LLMResponse:
        async with httpx.AsyncClient(timeout=120.0) as client:
            response = await client.post(
                f"{self.base_url}/messages",
                headers=self._headers(),
                json={
                    "model": request.model or self.default_model,
                    "system": request.system or "",
                    "messages": [{"role": "user", "content": request.prompt}],
                    "max_tokens": request.max_tokens or 1024,
                    "temperature": request.temperature,
                },
            )
            response.raise_for_status()
            payload = response.json()
        text = "".join(block.get("text", "") for block in payload.get("content", []) if block.get("type") == "text")
        return LLMResponse(
            provider=self.name,
            model=request.model or self.default_model,
            content=text.strip(),
            finish_reason=payload.get("stop_reason"),
            usage=payload.get("usage") or {},
            raw=payload,
        )

    async def stream(self, request: LLMRequest):
        async with httpx.AsyncClient(timeout=180.0) as client:
            async with client.stream(
                "POST",
                f"{self.base_url}/messages",
                headers={**self._headers(), "accept": "text/event-stream"},
                json={
                    "model": request.model or self.default_model,
                    "system": request.system or "",
                    "messages": [{"role": "user", "content": request.prompt}],
                    "max_tokens": request.max_tokens or 1024,
                    "temperature": request.temperature,
                    "stream": True,
                },
            ) as response:
                response.raise_for_status()
                async for line in response.aiter_lines():
                    if not line or not line.startswith("data:"):
                        continue
                    payload = json.loads(line[5:].strip())
                    if payload.get("type") == "content_block_delta":
                        text = (payload.get("delta") or {}).get("text", "")
                        if text:
                            yield LLMStreamEvent(type="token", provider=self.name, model=request.model or self.default_model, content=text)
                    if payload.get("type") == "message_stop":
                        yield LLMStreamEvent(type="done", provider=self.name, model=request.model or self.default_model, finish_reason="stop")

    async def list_models(self) -> list[str]:
        return [self.default_model]

    async def healthcheck(self) -> bool:
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.post(
                    f"{self.base_url}/messages",
                    headers=self._headers(),
                    json={"model": self.default_model, "messages": [{"role": "user", "content": "ping"}], "max_tokens": 1},
                )
            return response.status_code < 500
        except Exception:
            return False
