from pathlib import Path
from typing import Optional

from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


def _default_data_dir() -> Path:
    return Path(__file__).resolve().parents[1] / "data"


def _sqlite_url(path: Path) -> str:
    return f"sqlite:///{path.resolve().as_posix()}"


class Settings(BaseSettings):
    project_name: str = "Second Brain AI"
    app_data_dir: Optional[str] = None
    database_url: Optional[str] = None
    chroma_persist_dir: Optional[str] = None
    upload_dir: Optional[str] = None
    api_host: str = "127.0.0.1"
    api_port: int = 8000
    sidecar_mode: bool = False
    llm_provider: str = "ollama"  # ollama, openrouter, groq
    ollama_base_url: str = "http://localhost:11434"
    openrouter_api_key: Optional[str] = None
    groq_api_key: Optional[str] = None

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
            self.database_url = _sqlite_url(data_dir / "brain.db")
        if not self.chroma_persist_dir:
            self.chroma_persist_dir = str((data_dir / "chroma").resolve())
        if not self.upload_dir:
            self.upload_dir = str((data_dir / "uploads").resolve())

        return self

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
