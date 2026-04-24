from __future__ import annotations

import httpx

from app.llm.types import LLMRequest, LLMResponse, LLMStreamEvent


class GoogleProvider:
    name = "google"

    def __init__(self, base_url: str, api_key: str, default_model: str):
        self.base_url = base_url.rstrip("/")
        self.api_key = api_key
        self.default_model = default_model

    async def generate(self, request: LLMRequest) -> LLMResponse:
        model = request.model or self.default_model
        async with httpx.AsyncClient(timeout=120.0) as client:
            response = await client.post(
                f"{self.base_url}/models/{model}:generateContent?key={self.api_key}",
                json={
                    "systemInstruction": {"parts": [{"text": request.system or ""}]},
                    "contents": [{"role": "user", "parts": [{"text": request.prompt}]}],
                    "generationConfig": {"temperature": request.temperature, "maxOutputTokens": request.max_tokens or 1024},
                },
            )
            response.raise_for_status()
            payload = response.json()
        parts = (((payload.get("candidates") or [{}])[0].get("content") or {}).get("parts") or [])
        text = "".join(part.get("text", "") for part in parts)
        return LLMResponse(provider=self.name, model=model, content=text.strip(), raw=payload)

    async def stream(self, request: LLMRequest):
        response = await self.generate(request)
        yield LLMStreamEvent(type="token", provider=self.name, model=response.model, content=response.content)
        yield LLMStreamEvent(type="done", provider=self.name, model=response.model, finish_reason="stop")

    async def list_models(self) -> list[str]:
        return [self.default_model]

    async def healthcheck(self) -> bool:
        try:
            await self.generate(LLMRequest(prompt="ping", model=self.default_model))
            return True
        except Exception:
            return False
