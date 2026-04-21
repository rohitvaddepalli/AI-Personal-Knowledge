from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import text
from typing import List, Optional
from pydantic import BaseModel
from app.database import get_db
from app.models.note import Note
import json
from datetime import datetime, timedelta

router = APIRouter(prefix="/api/inbox", tags=["inbox"])


def _note_to_dict(note: Note) -> dict:
    tags = json.loads(note.tags) if note.tags else []
    return {
        "id": note.id,
        "title": note.title,
        "content": note.content,
        "tags": tags,
        "source_type": note.source_type,
        "created_at": note.created_at.isoformat() if note.created_at else None,
    }


@router.get("")
def get_inbox(db: Session = Depends(get_db)):
    """
    Inbox = notes that are:
    - not archived / deleted
    - have no tags OR have source_type 'import' / 'url'
    - created in the last 30 days (anything older is assumed already processed)
    """
    cutoff = datetime.utcnow() - timedelta(days=30)
    notes = (
        db.query(Note)
        .filter(
            Note.is_archived == False,
            Note.deleted_at == None,
            Note.created_at >= cutoff,
        )
        .order_by(Note.created_at.desc())
        .all()
    )

    inbox_notes = []
    for note in notes:
        tags = json.loads(note.tags) if note.tags else []
        # Inbox: no meaningful tags or is an import that hasn't been tagged beyond auto-tags
        is_unprocessed = (
            not tags
            or note.source_type in ("url", "import", "youtube")
        )
        if is_unprocessed:
            inbox_notes.append(_note_to_dict(note))

    return inbox_notes


@router.get("/stats")
def get_inbox_stats(db: Session = Depends(get_db)):
    """Return stats used by the Dashboard Today section."""
    cutoff = datetime.utcnow() - timedelta(days=1)

    # Captured today
    captured_today = (
        db.query(Note)
        .filter(
            Note.is_archived == False,
            Note.deleted_at == None,
            Note.created_at >= cutoff,
        )
        .count()
    )

    # Notes with connections (have at least one tag or are linked)
    connected_notes = (
        db.query(Note)
        .filter(
            Note.is_archived == False,
            Note.deleted_at == None,
            Note.tags != None,
            Note.tags != "[]",
            Note.tags != "",
        )
        .count()
    )

    # Due for review today
    now = datetime.utcnow()
    due_review = (
        db.query(Note)
        .filter(
            Note.is_archived == False,
            Note.deleted_at == None,
            Note.next_review_at != None,
            Note.next_review_at <= now,
        )
        .count()
    )

    # Total notes
    total_notes = (
        db.query(Note)
        .filter(Note.is_archived == False, Note.deleted_at == None)
        .count()
    )

    return {
        "captured_today": captured_today,
        "connected_notes": connected_notes,
        "due_review": due_review,
        "total_notes": total_notes,
    }


class TriageRequest(BaseModel):
    action: str          # "archive" | "schedule_review" | "add_tags"
    tags: Optional[List[str]] = None


@router.post("/{note_id}/triage")
def triage_note(note_id: str, req: TriageRequest, db: Session = Depends(get_db)):
    note = db.query(Note).filter(Note.id == note_id).first()
    if not note:
        raise HTTPException(status_code=404, detail="Note not found")

    if req.action == "archive":
        note.is_archived = True
        note.deleted_at = datetime.utcnow()

    elif req.action == "schedule_review":
        note.next_review_at = datetime.utcnow() + timedelta(days=1)

    elif req.action == "add_tags" and req.tags:
        existing = json.loads(note.tags) if note.tags else []
        merged = list(set(existing + req.tags))
        note.tags = json.dumps(merged)

    db.commit()
    return {"status": "ok", "action": req.action}


class SeedRequest(BaseModel):
    goal: str  # "student" | "researcher" | "creator" | "developer"


SAMPLE_NOTES = {
    "student": [
        {
            "title": "How to Use Your Second Brain",
            "content": (
                "# Welcome to Your Second Brain\n\n"
                "This is your personal knowledge management system. Here's how to make the most of it:\n\n"
                "## Capture\n- Write down ideas as soon as they come to you\n- Import articles and URLs you want to remember\n\n"
                "## Connect\n- Link related notes using [[Note Title]] syntax\n- Use the Graph view to see your knowledge map\n\n"
                "## Review\n- Use the Flashcard Review to reinforce learning\n- Spaced repetition helps you retain knowledge longer\n\n"
                "## Ask\n- Use Ask Brain to query your notes with AI\n- Try: *What are the key concepts in my notes?*"
            ),
            "tags": ["getting-started", "guide"],
            "source_type": "guide",
        },
        {
            "title": "The Feynman Technique",
            "content": (
                "# The Feynman Technique\n\n"
                "A powerful learning method developed by physicist Richard Feynman.\n\n"
                "## Steps\n1. **Choose a concept** you want to understand\n"
                "2. **Teach it to a child** — explain it in simple terms\n"
                "3. **Identify gaps** — where did you struggle?\n"
                "4. **Review and simplify** — go back to the source and fill gaps\n\n"
                "## Why it works\nExplaining forces active recall. Gaps reveal exactly what you don't know yet.\n\n"
                "## Try it\nPick any note in your vault and try to explain it in 3 sentences."
            ),
            "tags": ["learning", "techniques", "memory"],
            "source_type": "guide",
        },
    ],
    "researcher": [
        {
            "title": "Zettelkasten Method",
            "content": (
                "# Zettelkasten Method\n\n"
                "A note-taking system developed by sociologist Niklas Luhmann.\n\n"
                "## Core Ideas\n- Each note contains **one idea only**\n"
                "- Notes are **linked** to each other — not categorized in folders\n"
                "- Over time, a **thought network** emerges\n\n"
                "## Note Types\n- **Fleeting notes**: quick captures for processing later\n"
                "- **Literature notes**: summaries of sources read\n"
                "- **Permanent notes**: synthesized ideas in your own words\n\n"
                "## In Second Brain\nUse [[wikilink]] syntax to create connections between your notes."
            ),
            "tags": ["research", "pkm", "zettelkasten"],
            "source_type": "guide",
        },
    ],
    "creator": [
        {
            "title": "Content Creation Workflow",
            "content": (
                "# Content Creation Workflow\n\n"
                "## Idea Capture\n- Use Quick Capture for raw ideas\n"
                "- Import URLs and articles that inspire you\n\n"
                "## Development\n- Expand captured ideas into full notes\n"
                "- Use AI Summarize to extract key points\n"
                "- Connect ideas with [[wikilinks]]\n\n"
                "## Production\n- Use Ask Brain: *What content ideas connect to [topic]?*\n"
                "- Export notes as Markdown for your editor\n\n"
                "## Review\n- Weekly: review captured ideas and develop the best ones\n"
                "- Monthly: look at your graph for emerging themes"
            ),
            "tags": ["creator", "workflow", "content"],
            "source_type": "guide",
        },
    ],
    "developer": [
        {
            "title": "Technical Knowledge Base Setup",
            "content": (
                "# Technical Knowledge Base\n\n"
                "Use your Second Brain as a personal engineering wiki.\n\n"
                "## What to Capture\n- Solutions to bugs you've solved\n"
                "- Architecture decisions and their rationale\n"
                "- Useful code snippets and patterns\n"
                "- Meeting notes and tech specs\n\n"
                "## Organization Tips\n- Tag by technology: `python`, `docker`, `react`\n"
                "- Use daily notes to track what you worked on\n"
                "- Link related topics with [[wikilinks]]\n\n"
                "## Power Features\n- Ask Brain: *How did I solve the Redis connection issue?*\n"
                "- Import docs URLs for AI-powered summarization\n"
                "- Use the Graph to see tech dependency maps"
            ),
            "tags": ["developer", "engineering", "workflow"],
            "source_type": "guide",
        },
    ],
}

# Common note for all goals
COMMON_NOTE = {
    "title": "Quick Capture Guide",
    "content": (
        "# Quick Capture\n\n"
        "The **Capture** button in the sidebar is your fastest way to add knowledge.\n\n"
        "## Keyboard Shortcuts\n"
        "- `Ctrl+N` — New note\n"
        "- `Ctrl+K` — Command palette\n\n"
        "## Import Sources\n"
        "- **URL import** — paste any article URL and the AI will summarize it\n"
        "- **Daily Note** — auto-created each day for journaling\n\n"
        "## Pro Tips\n"
        "- Use `@note-title` in Ask Brain to query a specific note\n"
        "- Use `[[Note Title]]` in any note to create links\n"
        "- Type `/` in the editor for block commands"
    ),
    "tags": ["guide", "shortcuts"],
    "source_type": "guide",
}


@router.post("/seed")
def seed_sample_notes(req: SeedRequest, db: Session = Depends(get_db)):
    """Create sample notes for a new user based on their goal."""
    from app.services.embedding_service import add_note_embedding

    goal = req.goal if req.goal in SAMPLE_NOTES else "student"
    notes_to_create = SAMPLE_NOTES[goal] + [COMMON_NOTE]

    created = []
    for n in notes_to_create:
        # Skip if already seeded (check by exact title)
        existing = db.query(Note).filter(Note.title == n["title"]).first()
        if existing:
            continue

        db_note = Note(
            title=n["title"],
            content=n["content"],
            tags=json.dumps(n.get("tags", [])),
            source_type=n.get("source_type", "guide"),
        )
        db.add(db_note)
        db.commit()
        db.refresh(db_note)

        try:
            add_note_embedding(db_note.id, db_note.title, db_note.content)
        except Exception as e:
            print(f"Embedding failed for seeded note: {e}")

        created.append(db_note.id)

    return {"seeded": len(created), "ids": created}
