from pydantic_settings import BaseSettings
from typing import Optional

class Settings(BaseSettings):
    project_name: str = "Second Brain AI"
    database_url: str = "sqlite:///./data/brain.db"
    chroma_persist_dir: str = "./data/chroma"
    upload_dir: str = "./data/uploads"
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

    class Config:
        env_file = ".env"

settings = Settings()
