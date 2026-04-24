import base64
import json
from copy import deepcopy
from pathlib import Path
from typing import Any

from .config import settings


DEFAULT_RUNTIME_SETTINGS: dict[str, Any] = {
    "ollama_base_url": settings.ollama_base_url,
    "low_resource_mode": settings.low_resource_mode,
    "model_ram_tier": settings.model_ram_tier,
    "max_ai_concurrency": settings.max_ai_concurrency,
    "ai_context_window": settings.ai_context_window,
    "cpu_throttle_percent": settings.cpu_throttle_percent,
    "battery_saver_mode": settings.battery_saver_mode,
    "reduced_animations": settings.reduced_animations,
    "resource_monitor_enabled": settings.resource_monitor_enabled,
    "resource_monitor_corner": settings.resource_monitor_corner,
    "auth_mode": settings.auth_mode,
    "llm": {
        "default_provider": settings.llm_provider,
        "default_model": settings.llm_model,
        "feature_routing": {
            "chat": {"provider": settings.llm_provider, "model": settings.llm_model},
            "summarize": {"provider": settings.llm_provider, "model": settings.llm_model},
            "embeddings": {"provider": "ollama", "model": settings.embedding_model},
            "edit": {"provider": settings.llm_provider, "model": settings.llm_model},
            "transcription": {"provider": "ollama", "model": settings.transcription_model},
        },
        "fallback_chain": [provider.strip() for provider in settings.provider_fallbacks.split(",") if provider.strip()],
        "cloud_opt_in": False,
        "cost_guardrails": {
            "max_tokens_per_request": 4096,
            "max_requests_per_hour": 200,
            "warn_after_requests_per_hour": 120,
        },
        "providers": {
            "ollama": {"enabled": True, "base_url": settings.ollama_base_url, "models": [settings.llm_model]},
            "openai": {"enabled": bool(settings.openai_api_key), "base_url": settings.openai_base_url, "api_key": settings.openai_api_key or ""},
            "anthropic": {"enabled": bool(settings.anthropic_api_key), "base_url": settings.anthropic_base_url, "api_key": settings.anthropic_api_key or ""},
            "google": {"enabled": bool(settings.google_api_key), "base_url": settings.google_base_url, "api_key": settings.google_api_key or ""},
            "openrouter": {"enabled": bool(settings.openrouter_api_key), "base_url": settings.openrouter_base_url, "api_key": settings.openrouter_api_key or ""},
            "groq": {"enabled": bool(settings.groq_api_key), "base_url": settings.groq_base_url, "api_key": settings.groq_api_key or ""},
            "custom": {"enabled": bool(settings.custom_provider_base_url), "base_url": settings.custom_provider_base_url or "", "api_key": settings.custom_provider_api_key or ""},
        },
    },
}

_runtime_cache: dict[str, Any] | None = None


def ensure_app_directories() -> None:
    settings.app_data_dir_path.mkdir(parents=True, exist_ok=True)
    settings.chroma_persist_path.mkdir(parents=True, exist_ok=True)
    settings.upload_path.mkdir(parents=True, exist_ok=True)
    settings.runtime_settings_path.parent.mkdir(parents=True, exist_ok=True)
    if settings.is_sqlite:
        settings.database_path.parent.mkdir(parents=True, exist_ok=True)


def _encryption_key() -> bytes:
    raw = settings.auth_secret_key.encode("utf-8")
    return raw.ljust(32, b"0")[:32]


def _xor_bytes(payload: bytes, key: bytes) -> bytes:
    return bytes(b ^ key[idx % len(key)] for idx, b in enumerate(payload))


def _encrypt_secret(value: str) -> str:
    if not value:
        return ""
    encrypted = _xor_bytes(value.encode("utf-8"), _encryption_key())
    return "enc:" + base64.urlsafe_b64encode(encrypted).decode("ascii")


def _decrypt_secret(value: str) -> str:
    if not value:
        return ""
    if not value.startswith("enc:"):
        return value
    try:
        decoded = base64.urlsafe_b64decode(value[4:].encode("ascii"))
        return _xor_bytes(decoded, _encryption_key()).decode("utf-8")
    except Exception:
        return ""


def _prepare_runtime_payload(payload: dict[str, Any]) -> dict[str, Any]:
    data = deepcopy(payload)
    llm_settings = data.get("llm", {})
    providers = llm_settings.get("providers", {})
    for provider in providers.values():
        if isinstance(provider, dict) and isinstance(provider.get("api_key"), str):
            provider["api_key"] = _encrypt_secret(provider["api_key"])
    return data


def _hydrate_runtime_payload(payload: dict[str, Any]) -> dict[str, Any]:
    data = deepcopy(payload)
    llm_settings = data.get("llm", {})
    providers = llm_settings.get("providers", {})
    for provider in providers.values():
        if isinstance(provider, dict) and isinstance(provider.get("api_key"), str):
            provider["api_key"] = _decrypt_secret(provider["api_key"])
    return data


def _deep_merge(base: dict[str, Any], updates: dict[str, Any]) -> dict[str, Any]:
    merged = deepcopy(base)
    for key, value in updates.items():
        if isinstance(value, dict) and isinstance(merged.get(key), dict):
            merged[key] = _deep_merge(merged[key], value)
        else:
            merged[key] = value
    return merged


def get_runtime_settings() -> dict[str, Any]:
    global _runtime_cache
    if _runtime_cache is None:
        load_runtime_settings()
    return deepcopy(_runtime_cache or DEFAULT_RUNTIME_SETTINGS)


def load_runtime_settings() -> dict[str, Any]:
    global _runtime_cache
    ensure_app_directories()

    data = deepcopy(DEFAULT_RUNTIME_SETTINGS)
    if settings.runtime_settings_path.exists():
        try:
            stored = json.loads(settings.runtime_settings_path.read_text(encoding="utf-8"))
            if isinstance(stored, dict):
                data = _deep_merge(data, _hydrate_runtime_payload(stored))
        except Exception:
            pass

    _runtime_cache = data
    _apply_runtime_settings(data)
    return deepcopy(data)


def update_runtime_settings(patch: dict[str, Any]) -> dict[str, Any]:
    current = get_runtime_settings()
    merged = _deep_merge(current, patch)
    save_runtime_settings(merged)
    return merged


def save_runtime_settings(payload: dict[str, Any] | None = None) -> None:
    global _runtime_cache
    ensure_app_directories()
    effective = deepcopy(payload or _runtime_cache or DEFAULT_RUNTIME_SETTINGS)
    _runtime_cache = effective
    _apply_runtime_settings(effective)
    settings.runtime_settings_path.write_text(
        json.dumps(_prepare_runtime_payload(effective), indent=2),
        encoding="utf-8",
    )


def _apply_runtime_settings(data: dict[str, Any]) -> None:
    settings.ollama_base_url = str(data.get("ollama_base_url") or settings.ollama_base_url).strip()
    settings.low_resource_mode = bool(data.get("low_resource_mode", settings.low_resource_mode))
    settings.model_ram_tier = str(data.get("model_ram_tier", settings.model_ram_tier))
    settings.max_ai_concurrency = int(data.get("max_ai_concurrency", settings.max_ai_concurrency))
    settings.ai_context_window = int(data.get("ai_context_window", settings.ai_context_window))
    settings.cpu_throttle_percent = int(data.get("cpu_throttle_percent", settings.cpu_throttle_percent))
    settings.battery_saver_mode = bool(data.get("battery_saver_mode", settings.battery_saver_mode))
    settings.reduced_animations = bool(data.get("reduced_animations", settings.reduced_animations))
    settings.resource_monitor_enabled = bool(data.get("resource_monitor_enabled", settings.resource_monitor_enabled))
    settings.resource_monitor_corner = str(data.get("resource_monitor_corner", settings.resource_monitor_corner))
    settings.auth_mode = str(data.get("auth_mode", settings.auth_mode))

    llm_settings = data.get("llm", {})
    settings.llm_provider = str(llm_settings.get("default_provider", settings.llm_provider))
    settings.llm_model = str(llm_settings.get("default_model", settings.llm_model))

    providers = llm_settings.get("providers", {})
    ollama = providers.get("ollama", {})
    if isinstance(ollama, dict) and ollama.get("base_url"):
        settings.ollama_base_url = str(ollama["base_url"]).strip()

    openai = providers.get("openai", {})
    anthropic = providers.get("anthropic", {})
    google = providers.get("google", {})
    openrouter = providers.get("openrouter", {})
    groq = providers.get("groq", {})
    custom = providers.get("custom", {})

    settings.openai_api_key = _provider_value(openai, "api_key", settings.openai_api_key)
    settings.anthropic_api_key = _provider_value(anthropic, "api_key", settings.anthropic_api_key)
    settings.google_api_key = _provider_value(google, "api_key", settings.google_api_key)
    settings.openrouter_api_key = _provider_value(openrouter, "api_key", settings.openrouter_api_key)
    settings.groq_api_key = _provider_value(groq, "api_key", settings.groq_api_key)
    settings.custom_provider_api_key = _provider_value(custom, "api_key", settings.custom_provider_api_key)

    settings.openai_base_url = _provider_value(openai, "base_url", settings.openai_base_url)
    settings.anthropic_base_url = _provider_value(anthropic, "base_url", settings.anthropic_base_url)
    settings.google_base_url = _provider_value(google, "base_url", settings.google_base_url)
    settings.openrouter_base_url = _provider_value(openrouter, "base_url", settings.openrouter_base_url)
    settings.groq_base_url = _provider_value(groq, "base_url", settings.groq_base_url)
    settings.custom_provider_base_url = _provider_value(custom, "base_url", settings.custom_provider_base_url)


def _provider_value(provider: Any, key: str, default: Any) -> Any:
    if isinstance(provider, dict) and provider.get(key) is not None:
        return provider.get(key)
    return default
