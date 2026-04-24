from __future__ import annotations

from sqlalchemy.orm import Session

from app.database import SessionLocal
from app.llm.router import generate_text
from app.llm.types import LLMRequest
from app.models.connection import Connection
from app.services.embedding_service import note_collection
from app.utils.security import sanitize_content_for_prompt


async def classify_relationship(note_a: str, note_b: str) -> dict:
    prompt = (
        "Classify the relationship between these notes. "
        "Options: similar, contradicts, extends, inspires, prerequisite. "
        "Return only one option.\n\n"
        f"Note A:\n{sanitize_content_for_prompt(note_a)}\n\n"
        f"Note B:\n{sanitize_content_for_prompt(note_b)}"
    )
    try:
        result = await generate_text(LLMRequest(feature="summarize", prompt=prompt, max_tokens=24))
        value = result.content.lower().strip()
        for option in ["similar", "contradicts", "extends", "inspires", "prerequisite"]:
            if option in value:
                return {"relationship_type": option, "ai_explanation": f"Auto generated via {result.provider}"}
    except Exception as exc:
        return {"relationship_type": "similar", "ai_explanation": str(exc)}
    return {"relationship_type": "similar", "ai_explanation": "Auto connection via embeddings"}


async def auto_connect_note(note_id: str):
    db: Session = SessionLocal()
    try:
        results = note_collection.get(ids=[note_id], include=["embeddings", "documents"])
        if not results or results.get("embeddings") is None or not results["embeddings"]:
            return
        embedding = results["embeddings"][0]
        content_a = results["documents"][0]
        similar = note_collection.query(query_embeddings=[embedding], n_results=6)
        if not similar or not similar.get("ids"):
            return

        for idx, match_id in enumerate(similar["ids"][0]):
            if match_id == note_id:
                continue
            score = 1 - (similar["distances"][0][idx] / 2)
            if score <= 0.75:
                continue
            exists = db.query(Connection).filter(
                ((Connection.source_note_id == note_id) & (Connection.target_note_id == match_id))
                | ((Connection.source_note_id == match_id) & (Connection.target_note_id == note_id))
            ).first()
            if exists:
                continue
            content_b = similar["documents"][0][idx]
            relationship = await classify_relationship(content_a[:500], content_b[:500])
            db.add(
                Connection(
                    source_note_id=note_id,
                    target_note_id=match_id,
                    relationship_type=relationship["relationship_type"],
                    strength=score,
                    ai_explanation=relationship["ai_explanation"],
                )
            )
            try:
                db.commit()
            except Exception:
                db.rollback()
    finally:
        db.close()
