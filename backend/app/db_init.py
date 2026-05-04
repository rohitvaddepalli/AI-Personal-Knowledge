from app.utils.logger import get_logger
logger = get_logger(__name__)
from sqlalchemy import inspect, text

from app.config import settings
from app.database import Base, engine


def initialize_database() -> None:
    Base.metadata.create_all(bind=engine)
    
    # Run migrations even for non-sqlite (Postgres)
    _apply_generic_migrations()
    
    if not settings.is_sqlite:
        return

    _initialize_sqlite_fts()
    _initialize_phase5_tables()
    _initialize_phase6_schema()


def _apply_generic_migrations() -> None:
    """Apply migrations that work on both SQLite and Postgres."""
    with engine.begin() as conn:
        try:
            inspector = inspect(conn)
            existing_columns = {
                column["name"]
                for column in inspector.get_columns("notes")
            }

            # Columns needed for various phases
            migrations = [
                ("is_pinned", "BOOLEAN DEFAULT FALSE"),
                ("deleted_at", "TIMESTAMP" if not settings.is_sqlite else "DATETIME"),
                ("review_count", "INTEGER DEFAULT 0"),
                ("next_review_at", "TIMESTAMP" if not settings.is_sqlite else "DATETIME"),
                ("last_reviewed_at", "TIMESTAMP" if not settings.is_sqlite else "DATETIME"),
                ("parent_note_id", "VARCHAR"),
                ("order", 'INTEGER DEFAULT 0'),
                ("is_public", "BOOLEAN DEFAULT FALSE")
            ]

            for name, col_type in migrations:
                if name in existing_columns:
                    continue
                
                # Handle "order" reserved keyword in some DBs
                col_name = f'"{name}"' if name == "order" else name
                try:
                    conn.execute(text(f"ALTER TABLE notes ADD COLUMN {col_name} {col_type}"))
                    logger.info(f"Migration: Added column {name} to notes")
                except Exception as e:
                    logger.warning(f"Failed to add column {name}: {e}")

            # Also ensure webhook_calls table exists for non-sqlite
            if not settings.is_sqlite:
                conn.execute(text("""
                    CREATE TABLE IF NOT EXISTS webhook_calls (
                        id SERIAL PRIMARY KEY,
                        hook_id VARCHAR NOT NULL,
                        note_id VARCHAR,
                        payload_size INTEGER DEFAULT 0,
                        called_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    );
                """))
                conn.execute(text("CREATE INDEX IF NOT EXISTS ix_webhook_calls_hook ON webhook_calls(hook_id);"))

        except Exception as exc:
            logger.error(f"Generic migration check error: {exc}")


def _apply_sqlite_legacy_columns() -> None:
    # Deprecated in favor of _apply_generic_migrations
    pass


def _initialize_sqlite_fts() -> None:
    with engine.begin() as conn:
        try:
            conn.execute(text("CREATE VIRTUAL TABLE IF NOT EXISTS notes_fts USING fts5(id UNINDEXED, title, content, tags);"))
            # ... (rest of the FTS logic)
            conn.execute(text("""
                INSERT INTO notes_fts(id, title, content, tags)
                SELECT id, title, content, tags FROM notes
                WHERE id NOT IN (SELECT id FROM notes_fts);
            """))

            conn.execute(text("""
            CREATE TRIGGER IF NOT EXISTS notes_ai AFTER INSERT ON notes BEGIN
                INSERT INTO notes_fts(id, title, content, tags) VALUES (new.id, new.title, new.content, new.tags);
            END;"""))

            conn.execute(text("""
            CREATE TRIGGER IF NOT EXISTS notes_ad AFTER DELETE ON notes BEGIN
                DELETE FROM notes_fts WHERE id=old.id;
            END;"""))

            conn.execute(text("""
            CREATE TRIGGER IF NOT EXISTS notes_au AFTER UPDATE ON notes BEGIN
                DELETE FROM notes_fts WHERE id=old.id;
                INSERT INTO notes_fts(id, title, content, tags) VALUES (new.id, new.title, new.content, new.tags);
            END;"""))
        except Exception as exc:
            logger.info(f"FTS Table setup error: {exc}")


def _initialize_phase5_tables() -> None:
    """Ensure Phase 5 tables exist (user_activity, user_preferences, milestones)."""
    with engine.begin() as conn:
        try:
            conn.execute(text("""
                CREATE TABLE IF NOT EXISTS user_activity (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    date VARCHAR NOT NULL,
                    notes_captured INTEGER DEFAULT 0,
                    notes_reviewed INTEGER DEFAULT 0,
                    notes_connected INTEGER DEFAULT 0,
                    minutes_active INTEGER DEFAULT 0,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
                );
            """))
            conn.execute(text("CREATE INDEX IF NOT EXISTS ix_user_activity_date ON user_activity(date);"))
            conn.execute(text("""
                CREATE TABLE IF NOT EXISTS user_preferences (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    key VARCHAR UNIQUE NOT NULL,
                    value TEXT NOT NULL,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
                );
            """))
            conn.execute(text("CREATE INDEX IF NOT EXISTS ix_user_preferences_key ON user_preferences(key);"))
            conn.execute(text("""
                CREATE TABLE IF NOT EXISTS milestones (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    milestone_type VARCHAR NOT NULL,
                    achieved_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    is_seen INTEGER DEFAULT 0
                );
            """))
        except Exception as exc:
            logger.info(f"Phase 5 table setup error: {exc}")


def _initialize_phase6_schema() -> None:
    """SQLite specific Phase 6 schema."""
    with engine.begin() as conn:
        try:
            conn.execute(text("""
                CREATE TABLE IF NOT EXISTS webhook_calls (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    hook_id VARCHAR NOT NULL,
                    note_id VARCHAR,
                    payload_size INTEGER DEFAULT 0,
                    called_at DATETIME DEFAULT CURRENT_TIMESTAMP
                );
            """))
            conn.execute(text(
                "CREATE INDEX IF NOT EXISTS ix_webhook_calls_hook ON webhook_calls(hook_id);"
            ))
        except Exception as exc:
            logger.info(f"Phase 6 schema error: {exc}")

