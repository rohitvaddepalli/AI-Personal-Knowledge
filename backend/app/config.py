from pathlib import Path
from typing import Literal, Optional

from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict
from sqlalchemy.engine import make_url


def _default_data_dir() -> Path:
    return Path(__file__).resolve().parents[1] / "data"


def _sqlite_url(path: Path) -> str:
    return f"sqlite:///{path.resolve().as_posix()}"


class Settings(BaseSettings):
    project_name: str = "Second Brain AI"
    app_data_dir: Optional[str] = None
    database_url: Optional[str] = None
    database_mode: Literal["local", "postgres"] = "local"
    postgres_host: str = "127.0.0.1"
    postgres_port: int = 5432
    postgres_db: str = "second_brain"
    postgres_user: str = "second_brain"
    postgres_password: str = "second_brain"
    chroma_persist_dir: Optional[str] = None
    upload_dir: Optional[str] = None
    api_host: str = "127.0.0.1"
    api_port: int = 8000
    sidecar_mode: bool = False
    llm_provider: str = "ollama"
    llm_model: str = "qwen2.5:0.5b"
    embedding_model: str = "nomic-embed-text"
    transcription_model: str = "whisper"
    ollama_base_url: str = "http://localhost:11434"
    openai_api_key: Optional[str] = None
    openai_base_url: str = "https://api.openai.com/v1"
    anthropic_api_key: Optional[str] = None
    anthropic_base_url: str = "https://api.anthropic.com/v1"
    google_api_key: Optional[str] = None
    google_base_url: str = "https://generativelanguage.googleapis.com/v1beta"
    openrouter_api_key: Optional[str] = None
    openrouter_base_url: str = "https://openrouter.ai/api/v1"
    groq_api_key: Optional[str] = None
    groq_base_url: str = "https://api.groq.com/openai/v1"
    custom_provider_base_url: Optional[str] = None
    custom_provider_api_key: Optional[str] = None
    provider_fallbacks: str = "openai,anthropic,google,openrouter,ollama"
    low_resource_mode: bool = False
    model_ram_tier: str = "8gb"
    max_ai_concurrency: int = 2
    ai_context_window: int = 4096
    max_background_job_concurrency: int = 2
    cpu_throttle_percent: int = 80
    memory_budget_mb: int = 1536
    battery_saver_mode: bool = False
    reduced_animations: bool = False
    resource_monitor_enabled: bool = True
    resource_monitor_corner: Literal["top-left", "top-right", "bottom-left", "bottom-right"] = "bottom-right"
    redis_url: str = "redis://127.0.0.1:6379/0"
    celery_broker_url: Optional[str] = None
    celery_result_backend: Optional[str] = None
    background_jobs_enabled: bool = True
    auth_mode: Literal["localhost", "multi_user"] = "localhost"
    auth_secret_key: str = "change-me-in-production"
    auth_access_token_minutes: int = 30
    auth_refresh_token_days: int = 7
    auth_cookie_secure: bool = False
    csrf_cookie_name: str = "sb_csrf"
    rate_limit_ai_per_minute: int = 30
    rate_limit_ingest_per_minute: int = 20
    rate_limit_auth_per_minute: int = 20

    # Security controls (default-safe, opt-in to remote access/auth).
    #
    # If `api_key` is set, all `/api/*` routes require `X-API-Key: <api_key>`.
    # If `api_key` is not set, remote clients are blocked unless `allow_remote_clients=True`.
    api_key: Optional[str] = None
    allow_remote_clients: bool = False

    # Attachment upload hardening.
    # Kept conservative to avoid breaking usage; adjust via env var if needed.
    max_upload_size_mb: int = 25

    model_config = SettingsConfigDict(env_file=".env", env_prefix="SECOND_BRAIN_", extra="ignore")

    @model_validator(mode="after")
    def apply_desktop_defaults(self):
        data_dir = Path(self.app_data_dir).expanduser() if self.app_data_dir else _default_data_dir()
        data_dir = data_dir.resolve()
        self.app_data_dir = str(data_dir)

        if not self.database_url:
            if self.database_mode == "postgres":
                self.database_url = self.postgres_database_url
            else:
                self.database_url = _sqlite_url(data_dir / "brain.db")
        if not self.chroma_persist_dir:
            self.chroma_persist_dir = str((data_dir / "chroma").resolve())
        if not self.upload_dir:
            self.upload_dir = str((data_dir / "uploads").resolve())
        if not self.celery_broker_url:
            self.celery_broker_url = self.redis_url
        if not self.celery_result_backend:
            self.celery_result_backend = self.redis_url

        return self

    @property
    def postgres_database_url(self) -> str:
        return (
            "postgresql+psycopg://"
            f"{self.postgres_user}:{self.postgres_password}"
            f"@{self.postgres_host}:{self.postgres_port}/{self.postgres_db}"
        )

    @property
    def database_backend(self) -> str:
        url = make_url(self.database_url or _sqlite_url(self.app_data_dir_path / "brain.db"))
        backend = url.get_backend_name()
        if backend.startswith("postgresql"):
            return "postgresql"
        return backend

    @property
    def is_sqlite(self) -> bool:
        return self.database_backend == "sqlite"

    @property
    def is_postgres(self) -> bool:
        return self.database_backend == "postgresql"

    @property
    def app_data_dir_path(self) -> Path:
        return Path(self.app_data_dir or _default_data_dir()).resolve()

    @property
    def database_path(self) -> Path:
        if self.database_url and self.database_url.startswith("sqlite:///"):
            return Path(self.database_url.replace("sqlite:///", "", 1)).resolve()
        return (self.app_data_dir_path / "brain.db").resolve()

    @property
    def chroma_persist_path(self) -> Path:
        return Path(self.chroma_persist_dir or (self.app_data_dir_path / "chroma")).resolve()

    @property
    def upload_path(self) -> Path:
        return Path(self.upload_dir or (self.app_data_dir_path / "uploads")).resolve()

    @property
    def runtime_settings_path(self) -> Path:
        return self.app_data_dir_path / "settings.json"

settings = Settings()
