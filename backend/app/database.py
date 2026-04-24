import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
from sqlalchemy.pool import StaticPool
from .config import settings
from .runtime import ensure_app_directories

ensure_app_directories()


def _engine_kwargs() -> dict:
    if settings.is_sqlite:
        kwargs = {"connect_args": {"check_same_thread": False}}
        if settings.database_url.endswith(":memory:"):
            kwargs["poolclass"] = StaticPool
        return kwargs

    if settings.is_postgres:
        return {
            "pool_pre_ping": True,
        }

    return {}


if settings.is_sqlite:
    database_dir = os.path.dirname(str(settings.database_path))
    if database_dir:
        os.makedirs(database_dir, exist_ok=True)

engine = create_engine(
    settings.database_url,
    **_engine_kwargs(),
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
