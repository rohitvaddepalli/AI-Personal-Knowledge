import pytest
from pydantic import ValidationError

from app.config import Settings


def test_settings_default_to_local_sqlite(tmp_path):
    settings = Settings(
        app_data_dir=str(tmp_path),
        database_url=None,
        database_mode="local",
    )

    assert settings.is_sqlite is True
    assert settings.is_postgres is False
    assert settings.database_url == f"sqlite:///{tmp_path.resolve().as_posix()}/brain.db"


def test_settings_build_postgres_url_when_mode_is_postgres(tmp_path):
    settings = Settings(
        app_data_dir=str(tmp_path),
        database_url=None,
        database_mode="postgres",
        postgres_host="db.internal",
        postgres_port=5433,
        postgres_db="brain_prod",
        postgres_user="brain_user",
        postgres_password="brain_pass",
    )

    assert settings.is_postgres is True
    assert settings.is_sqlite is False
    assert settings.database_url == "postgresql+psycopg://brain_user:brain_pass@db.internal:5433/brain_prod"


def test_settings_dual_mode_defaults():
    settings = Settings()
    assert settings.app_mode == "desktop"
    assert settings.environment == "development"
    assert settings.cors_origins == ""


def test_production_secret_validation_fails_in_web_mode():
    with pytest.raises(ValidationError) as exc_info:
        Settings(
            environment="production",
            app_mode="web",
            auth_secret_key="change-me-in-production",
        )
    assert "auth_secret_key" in str(exc_info.value)


def test_production_secret_allowed_in_desktop_mode():
    settings = Settings(
        environment="production",
        app_mode="desktop",
        auth_secret_key="change-me-in-production",
    )
    assert settings.app_mode == "desktop"


def test_production_secret_custom_allowed_in_web_mode():
    settings = Settings(
        environment="production",
        app_mode="web",
        auth_secret_key="super-secure-production-secret-key-12345",
    )
    assert settings.app_mode == "web"
    assert settings.environment == "production"
