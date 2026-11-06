import json
from typing import Any, Dict, List

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.models.connection import Connection
from app.models.note import Note as NoteModel
from app.routers.note_versions import save_version
from app.schemas.note import NoteCreate, NoteUpdate
from app.services.embedding_service import (
    add_note_embedding,
    search_similar,
)
from app.utils.logger import get_logger

logger = get_logger(__name__)


class NoteService:
    @staticmethod
    def extract_wikilinks(content: str) -> list:
        """Extract [[note titles]] from content"""
        import re

        pattern = r"\[\[(.*?)\]\]"
        return re.findall(pattern, content)

    @staticmethod
    def create_wikilink_connections(note_id: str, content: str, db: Session):
        """Create connections for wikilinks in content"""
        titles = [t.strip() for t in NoteService.extract_wikilinks(content)]
        if not titles:
            return

        targets = (
            db.query(NoteModel)
            .filter(NoteModel.title.in_(titles), NoteModel.is_archived == False, NoteModel.deleted_at == None)
            .all()
        )

        target_ids = [t.id for t in targets if t.id != note_id]
        if not target_ids:
            return

        existing_conns = (
            db.query(Connection)
            .filter(Connection.source_note_id == note_id, Connection.target_note_id.in_(target_ids))
            .all()
        )
        existing_target_ids = {c.target_note_id for c in existing_conns}

        new_conns = []
        for target_id in target_ids:
            if target_id not in existing_target_ids:
                new_conns.append(
                    Connection(
                        source_note_id=note_id,
                        target_note_id=target_id,
                        relationship_type="references",
                        strength=1.0,
                        ai_explanation="WikiLink reference",
                    )
                )

        if new_conns:
            db.add_all(new_conns)
            db.commit()

    @staticmethod
    def create_note(db: Session, note_data: NoteCreate) -> NoteModel:
        db_note = NoteModel(
            title=note_data.title,
            content=note_data.content,
            source=note_data.source,
            source_type=note_data.source_type,
            tags=json.dumps(note_data.tags) if note_data.tags else "[]",
            is_archived=note_data.is_archived,
            is_pinned=note_data.is_pinned,
        )
        db.add(db_note)
        db.commit()
        db.refresh(db_note)

        try:
            add_note_embedding(db_note.id, db_note.title, db_note.content)
        except Exception as e:
            logger.info(f"Failed to generate embedding: {e}")

        # Create wikilink connections
        NoteService.create_wikilink_connections(db_note.id, db_note.content, db)

        db_note.tags = json.loads(db_note.tags) if db_note.tags else []
        return db_note

    @staticmethod
    def update_note(db: Session, note_id: str, note_update: NoteUpdate) -> tuple[NoteModel, bool]:
        db_note = db.query(NoteModel).filter(NoteModel.id == note_id).first()
        if db_note is None:
            raise HTTPException(status_code=404, detail="Note not found")

        update_data = note_update.dict(exclude_unset=True)
        if "tags" in update_data:
            update_data["tags"] = json.dumps(update_data["tags"])

        needs_embedding_update = False
        content_changed = False
        if "title" in update_data or "content" in update_data:
            needs_embedding_update = True
        if "content" in update_data:
            content_changed = True

        for key, value in update_data.items():
            setattr(db_note, key, value)

        db.commit()
        db.refresh(db_note)

        # Save version if content or title changed
        if content_changed or "title" in update_data:
            save_version(db, note_id, db_note.title, db_note.content, db_note.tags or "[]")

        # Update wikilink connections if content changed
        if content_changed:
            NoteService.create_wikilink_connections(db_note.id, db_note.content, db)

        db_note.tags = json.loads(db_note.tags) if db_note.tags else []
        return db_note, needs_embedding_update

    @staticmethod
    def get_related_notes(db: Session, note_id: str, limit: int = 6) -> List[Dict[str, Any]]:
        note = db.query(NoteModel).filter(NoteModel.id == note_id, NoteModel.deleted_at == None).first()
        if not note:
            raise HTTPException(status_code=404, detail="Note not found")

        # Vector similarity via embedding service
        try:
            results = search_similar(note.title + " " + note.content[:500], top_k=limit + 1)
            related_ids = [r["id"] for r in results if r["id"] != note_id][:limit]
            if related_ids:
                related = (
                    db.query(NoteModel)
                    .filter(
                        NoteModel.id.in_(related_ids),
                        NoteModel.is_archived == False,
                        NoteModel.deleted_at == None,
                    )
                    .all()
                )
                for n in related:
                    n.tags = json.loads(n.tags) if n.tags else []
                return [
                    {"id": n.id, "title": n.title, "tags": n.tags, "updated_at": n.updated_at, "source": "vector"}
                    for n in related
                ]
        except Exception:
            pass

        # Fallback: shared tags + title keyword overlap
        note_tags = set(json.loads(note.tags) if note.tags else [])
        note_words = set(note.title.lower().split())
        candidates = (
            db.query(NoteModel)
            .filter(
                NoteModel.id != note_id,
                NoteModel.is_archived == False,
                NoteModel.deleted_at == None,
            )
            .limit(200)
            .all()
        )

        scored = []
        for c in candidates:
            c_tags = set(json.loads(c.tags) if c.tags else [])
            c_words = set(c.title.lower().split())
            score = len(note_tags & c_tags) * 3 + len(note_words & c_words)
            if score > 0:
                scored.append((score, c))
        scored.sort(key=lambda x: x[0], reverse=True)

        out = []
        for _, n in scored[:limit]:
            n.tags = json.loads(n.tags) if n.tags else []
            out.append({"id": n.id, "title": n.title, "tags": n.tags, "updated_at": n.updated_at, "source": "keyword"})
        return out

    @staticmethod
    def get_note_tree(db: Session, note_id: str) -> Dict[str, Any]:
        note = db.query(NoteModel).filter(NoteModel.id == note_id).first()
        if not note:
            raise HTTPException(status_code=404, detail="Note not found")

        all_notes = (
            db.query(NoteModel.id, NoteModel.title, NoteModel.parent_note_id)
            .filter(NoteModel.is_archived == False, NoteModel.deleted_at == None)
            .all()
        )

        note_map = {
            n.id: {"id": n.id, "title": n.title, "parent_note_id": n.parent_note_id, "children": []} for n in all_notes
        }

        for n in note_map.values():
            if n["parent_note_id"] and n["parent_note_id"] in note_map:
                note_map[n["parent_note_id"]]["children"].append(n)

        if note_id not in note_map:
            return {"note": {"id": note.id, "title": note.title}, "ancestors": [], "descendants": []}

        target_node = note_map[note_id]

        ancestors = []
        current_parent_id = target_node["parent_note_id"]
        while current_parent_id and current_parent_id in note_map:
            parent = note_map[current_parent_id]
            ancestors.insert(0, {"id": parent["id"], "title": parent["title"]})
            current_parent_id = parent["parent_note_id"]

        def clean_node(node):
            return {"id": node["id"], "title": node["title"], "children": [clean_node(c) for c in node["children"]]}

        return {
            "note": {"id": note.id, "title": note.title},
            "ancestors": ancestors,
            "descendants": [clean_node(c) for c in target_node["children"]],
        }
