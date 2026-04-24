from __future__ import annotations

from typing import Any, AsyncIterator, Literal, TypedDict

from pydantic import BaseModel, Field


FeatureName = Literal["chat", "summarize", "embeddings", "edit", "transcription"]


class ProviderConfig(TypedDict, total=False):
    enabled: bool
    base_url: str
    api_key: str
    models: list[str]


class LLMRequest(BaseModel):
    feature: FeatureName = "chat"
    prompt: str
    system: str | None = None
    model: str | None = None
    provider: str | None = None
    temperature: float = 0.3
    max_tokens: int | None = None
    stream: bool = False
    metadata: dict[str, Any] = Field(default_factory=dict)


class LLMResponse(BaseModel):
    provider: str
    model: str
    content: str
    finish_reason: str | None = None
    usage: dict[str, Any] = Field(default_factory=dict)
    raw: dict[str, Any] = Field(default_factory=dict)


class LLMStreamEvent(BaseModel):
    type: Literal["token", "done", "error", "meta"] = "token"
    provider: str | None = None
    model: str | None = None
    content: str = ""
    finish_reason: str | None = None
    metadata: dict[str, Any] = Field(default_factory=dict)


ProviderStream = AsyncIterator[LLMStreamEvent]
