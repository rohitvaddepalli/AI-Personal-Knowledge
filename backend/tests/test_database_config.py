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
