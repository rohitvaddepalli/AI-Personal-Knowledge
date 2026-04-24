from __future__ import annotations

from typing import Protocol

from app.llm.types import LLMRequest, LLMResponse, ProviderStream


class LLMProvider(Protocol):
    name: str

    async def generate(self, request: LLMRequest) -> LLMResponse:
        ...

    async def stream(self, request: LLMRequest) -> ProviderStream:
        ...

    async def list_models(self) -> list[str]:
        ...

    async def healthcheck(self) -> bool:
        ...
