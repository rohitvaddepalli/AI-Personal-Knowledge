import json
from pathlib import Path
from typing import Any

from .config import settings


def ensure_app_directories() -> None:
    settings.app_data_dir_path.mkdir(parents=True, exist_ok=True)
    settings.chroma_persist_path.mkdir(parents=True, exist_ok=True)
    settings.upload_path.mkdir(parents=True, exist_ok=True)
    settings.database_path.parent.mkdir(parents=True, exist_ok=True)


def load_runtime_settings() -> None:
    ensure_app_directories()

    if not settings.runtime_settings_path.exists():
        return

    try:
        data = json.loads(settings.runtime_settings_path.read_text(encoding="utf-8"))
    except Exception:
        return

    ollama_base_url = data.get("ollama_base_url")
    if isinstance(ollama_base_url, str) and ollama_base_url.strip():
        settings.ollama_base_url = ollama_base_url.strip()


def save_runtime_settings() -> None:
    ensure_app_directories()
    payload: dict[str, Any] = {
        "ollama_base_url": settings.ollama_base_url,
    }
    settings.runtime_settings_path.write_text(
        json.dumps(payload, indent=2),
        encoding="utf-8",
    )
