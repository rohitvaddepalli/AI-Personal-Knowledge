from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
import json
import zipfile
import io
from app.database import get_db
from app.models.note import Note as NoteModel
from app.schemas.note import NoteResponse

router = APIRouter(prefix="/api/export", tags=["export"])

@router.get("/note/{note_id}/markdown")
def export_note_markdown(note_id: str, db: Session = Depends(get_db)):
    """Export a single note as Markdown"""
    note = db.query(NoteModel).filter(NoteModel.id == note_id).first()
    if not note:
        raise HTTPException(status_code=404, detail="Note not found")
    
    tags = json.loads(note.tags) if note.tags else []
    tag_str = " ".join([f"#{t}" for t in tags])
    
    markdown = f"""# {note.title}

{tag_str}

{note.content}

---
*Exported from Second Brain on {note.created_at}*
"""
    
    return {"filename": f"{note.title.replace(' ', '_')}.md", "content": markdown}

@router.get("/vault/obsidian")
def export_obsidian_vault(db: Session = Depends(get_db)):
    """Export all notes as Obsidian-compatible vault ZIP"""
    notes = db.query(NoteModel).filter(
        NoteModel.is_archived == False,
        NoteModel.deleted_at == None
    ).all()
    
    # Create ZIP in memory
    zip_buffer = io.BytesIO()
    with zipfile.ZipFile(zip_buffer, 'w', zipfile.ZIP_DEFLATED) as zip_file:
        for note in notes:
            tags = json.loads(note.tags) if note.tags else []
            tag_str = " ".join([f"#{t}" for t in tags])
            
            content = f"""# {note.title}

{tag_str}

{note.content}
"""
            filename = f"{note.title.replace(' ', '_').replace('/', '_')}.md"
            zip_file.writestr(filename, content)
        
        # Add basic Obsidian config
        zip_file.writestr(".obsidian/app.json", "{}")
    
    zip_buffer.seek(0)
    from fastapi.responses import StreamingResponse
    
    return StreamingResponse(
        zip_buffer,
        media_type="application/zip",
        headers={"Content-Disposition": "attachment; filename=second_brain_vault.zip"}
    )

@router.get("/all/zip")
def export_all_notes_zip(db: Session = Depends(get_db)):
    """Export all notes as Markdown files in ZIP"""
    notes = db.query(NoteModel).filter(
        NoteModel.is_archived == False,
        NoteModel.deleted_at == None
    ).all()
    
    zip_buffer = io.BytesIO()
    with zipfile.ZipFile(zip_buffer, 'w', zipfile.ZIP_DEFLATED) as zip_file:
        for note in notes:
            tags = json.loads(note.tags) if note.tags else []
            tag_str = " ".join([f"#{t}" for t in tags])
            
            content = f"""# {note.title}

Tags: {tag_str}
Created: {note.created_at}

---

{note.content}
"""
            filename = f"notes/{note.title.replace(' ', '_').replace('/', '_')}.md"
            zip_file.writestr(filename, content)
    
    zip_buffer.seek(0)
    from fastapi.responses import StreamingResponse
    
    return StreamingResponse(
        zip_buffer,
        media_type="application/zip",
        headers={"Content-Disposition": "attachment; filename=all_notes.zip"}
    )
