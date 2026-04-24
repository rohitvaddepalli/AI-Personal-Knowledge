import json

from app.database import SessionLocal
from app.llm.router import generate_text
from app.llm.types import LLMRequest
from app.models.insight import Insight
from app.models.note import Note


async def generate_daily_digest():
    db = SessionLocal()
    try:
        notes = db.query(Note).order_by(Note.created_at.desc()).limit(10).all()
        if len(notes) < 3:
            return

        context_lines = []
        note_ids = []
        for note in notes:
            context_lines.append(f"TITLE: {note.title}\nCONTENT: {note.content[:200]}")
            note_ids.append(note.id)

        response = await generate_text(
            LLMRequest(
                feature="summarize",
                prompt="\n---\n".join(context_lines),
                system=(
                    "You are an AI personal knowledge manager. Generate a daily digest with "
                    "1 emerging pattern, 1 contradiction, and 1 question to explore."
                ),
                max_tokens=700,
            )
        )
        if response.content:
            db.add(Insight(insight_type="daily_digest", content=response.content, related_note_ids=json.dumps(note_ids)))
            db.commit()
    finally:
        db.close()
