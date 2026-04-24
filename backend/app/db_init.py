from sqlalchemy import inspect, text

from app.config import settings
from app.database import Base, engine


def initialize_database() -> None:
    Base.metadata.create_all(bind=engine)
    if not settings.is_sqlite:
        return

    _apply_sqlite_legacy_columns()
    _initialize_sqlite_fts()


def _apply_sqlite_legacy_columns() -> None:
    with engine.begin() as conn:
        try:
            inspector = inspect(conn)
            existing_columns = {
                column["name"]
                for column in inspector.get_columns("notes")
            }

            needed_columns = [
                ("is_pinned", "is_pinned BOOLEAN DEFAULT 0"),
                ("deleted_at", "deleted_at DATETIME"),
                ("review_count", "review_count INTEGER DEFAULT 0"),
                ("next_review_at", "next_review_at DATETIME"),
                ("last_reviewed_at", "last_reviewed_at DATETIME"),
                ("parent_note_id", "parent_note_id VARCHAR"),
                ("order", '"order" INTEGER DEFAULT 0'),
            ]

            for name, column_sql in needed_columns:
                if name in existing_columns:
                    continue
                conn.execute(text(f"ALTER TABLE notes ADD COLUMN {column_sql}"))
        except Exception as exc:
            print(f"DB migration check error: {exc}")


def _initialize_sqlite_fts() -> None:
    with engine.begin() as conn:
        try:
            conn.execute(text("CREATE VIRTUAL TABLE IF NOT EXISTS notes_fts USING fts5(id UNINDEXED, title, content, tags);"))

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
            print(f"FTS Table setup error: {exc}")
