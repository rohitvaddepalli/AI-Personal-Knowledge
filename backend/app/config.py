from pydantic_settings import BaseSettings
from typing import Optional

class Settings(BaseSettings):
    project_name: str = "Second Brain AI"
    database_url: str = "sqlite:///./data/brain.db"
    chroma_persist_dir: str = "./data/chroma"
    llm_provider: str = "ollama"  # ollama, openrouter, groq
    ollama_base_url: str = "http://localhost:11434"
    openrouter_api_key: Optional[str] = None
    groq_api_key: Optional[str] = None

    class Config:
        env_file = ".env"

settings = Settings()
