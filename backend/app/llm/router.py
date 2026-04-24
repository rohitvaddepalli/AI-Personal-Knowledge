from __future__ import annotations

import time
from typing import Any

from fastapi import HTTPException

from app.config import settings
from app.llm.providers.anthropic import AnthropicProvider
from app.llm.providers.custom import CustomProvider
from app.llm.providers.google import GoogleProvider
from app.llm.providers.ollama import OllamaProvider
from app.llm.providers.openai_compatible import OpenAICompatibleProvider
from app.llm.types import LLMRequest, LLMResponse
from app.runtime import get_runtime_settings

_provider_usage: dict[str, list[float]] = {}


def _provider_configs() -> dict[str, dict[str, Any]]:
    llm = get_runtime_settings().get("llm", {})
    providers = llm.get("providers", {})
    return providers if isinstance(providers, dict) else {}


def _feature_route(feature: str) -> dict[str, Any]:
    llm = get_runtime_settings().get("llm", {})
    feature_routing = llm.get("feature_routing", {})
    route = feature_routing.get(feature, {})
    return route if isinstance(route, dict) else {}


def _fallback_chain() -> list[str]:
    llm = get_runtime_settings().get("llm", {})
    chain = llm.get("fallback_chain", [])
    if isinstance(chain, list) and chain:
        return [str(item) for item in chain]
    return [provider.strip() for provider in settings.provider_fallbacks.split(",") if provider.strip()]


def _cloud_allowed() -> bool:
    llm = get_runtime_settings().get("llm", {})
    return bool(llm.get("cloud_opt_in"))


def _build_provider(name: str):
    providers = _provider_configs()
    config = providers.get(name, {})

    if name == "ollama":
        return OllamaProvider()

    if not _cloud_allowed() and name != "ollama":
        raise HTTPException(status_code=400, detail="Cloud providers are disabled. Enable cloud opt-in in settings first.")

    if name in {"openai", "openrouter", "groq"}:
        api_key = str(config.get("api_key") or "")
        base_url = str(config.get("base_url") or "")
        if not api_key or not base_url:
            raise HTTPException(status_code=400, detail=f"{name} is not configured")
        return OpenAICompatibleProvider(name=name, base_url=base_url, api_key=api_key, default_model=_default_model(name))

    if name == "anthropic":
        api_key = str(config.get("api_key") or "")
        base_url = str(config.get("base_url") or "")
        if not api_key or not base_url:
            raise HTTPException(status_code=400, detail="anthropic is not configured")
        return AnthropicProvider(base_url=base_url, api_key=api_key, default_model=_default_model(name))

    if name == "google":
        api_key = str(config.get("api_key") or "")
        base_url = str(config.get("base_url") or "")
        if not api_key or not base_url:
            raise HTTPException(status_code=400, detail="google is not configured")
        return GoogleProvider(base_url=base_url, api_key=api_key, default_model=_default_model(name))

    if name == "custom":
        api_key = str(config.get("api_key") or "")
        base_url = str(config.get("base_url") or "")
        if not base_url:
            raise HTTPException(status_code=400, detail="custom provider is not configured")
        return CustomProvider(name=name, base_url=base_url, api_key=api_key, default_model=_default_model(name))

    raise HTTPException(status_code=400, detail=f"Unknown provider: {name}")


def _default_model(provider_name: str) -> str:
    route = _feature_route("chat")
    if route.get("provider") == provider_name and route.get("model"):
        return str(route["model"])
    runtime = get_runtime_settings().get("llm", {})
    return str(runtime.get("default_model") or settings.llm_model)


def resolve_request(request: LLMRequest) -> LLMRequest:
    route = _feature_route(request.feature)
    provider = request.provider or route.get("provider") or settings.llm_provider
    model = request.model or route.get("model") or settings.llm_model
    max_tokens = request.max_tokens
    if settings.low_resource_mode:
        max_tokens = min(max_tokens or 512, 512)
    return request.model_copy(update={"provider": provider, "model": model, "max_tokens": max_tokens})


def _enforce_guardrails(request: LLMRequest) -> None:
    llm = get_runtime_settings().get("llm", {})
    guardrails = llm.get("cost_guardrails", {})
    max_tokens = int(guardrails.get("max_tokens_per_request", 4096))
    if (request.max_tokens or 0) > max_tokens:
        raise HTTPException(status_code=400, detail=f"Request exceeds token cap of {max_tokens}")

    limit = int(guardrails.get("max_requests_per_hour", 200))
    provider_name = str(request.provider or settings.llm_provider)
    now = time.time()
    history = _provider_usage.setdefault(provider_name, [])
    history[:] = [entry for entry in history if now - entry < 3600]
    if len(history) >= limit:
        raise HTTPException(status_code=429, detail=f"Hourly usage limit reached for provider {provider_name}")
    history.append(now)


async def generate_text(request: LLMRequest) -> LLMResponse:
    resolved = resolve_request(request)
    _enforce_guardrails(resolved)
    providers = [resolved.provider] if resolved.provider else []
    providers.extend(name for name in _fallback_chain() if name not in providers)

    last_error: Exception | None = None
    for provider_name in providers:
        try:
            provider = _build_provider(provider_name)
            return await provider.generate(resolved.model_copy(update={"provider": provider_name}))
        except Exception as exc:
            last_error = exc
            continue
    raise HTTPException(status_code=502, detail=str(last_error or "No LLM provider available"))


async def stream_text(request: LLMRequest):
    resolved = resolve_request(request)
    _enforce_guardrails(resolved)
    provider = _build_provider(resolved.provider or settings.llm_provider)
    async for event in provider.stream(resolved):
        yield event


async def list_models(provider_name: str | None = None) -> list[str]:
    provider = _build_provider(provider_name or settings.llm_provider)
    return await provider.list_models()


async def provider_health(provider_name: str) -> bool:
    provider = _build_provider(provider_name)
    return await provider.healthcheck()
