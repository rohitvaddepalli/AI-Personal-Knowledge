from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
import json
from app.database import get_db
from app.models.note_version import NoteVersion as NoteVersionModel
from app.models.note import Note as NoteModel
from app.schemas.note_version import NoteVersionResponse

router = APIRouter(prefix="/api/notes/{note_id}/versions", tags=["note_versions"])

def save_version(db: Session, note_id: str, title: str, content: str, tags: str):
    """Save a new version of a note"""
    # Get next version number
    latest = db.query(NoteVersionModel).filter(
        NoteVersionModel.note_id == note_id
    ).order_by(NoteVersionModel.version_number.desc()).first()
    
    version_num = (latest.version_number + 1) if latest else 1
    
    version = NoteVersionModel(
        note_id=note_id,
        title=title,
        content=content,
        tags=tags,
        version_number=version_num
    )
    db.add(version)
    db.commit()
    return version

@router.get("", response_model=List[NoteVersionResponse])
def get_versions(note_id: str, db: Session = Depends(get_db)):
    """Get all versions for a note"""
    versions = db.query(NoteVersionModel).filter(
        NoteVersionModel.note_id == note_id
    ).order_by(NoteVersionModel.version_number.desc()).all()
    return versions

@router.get("/{version_id}", response_model=NoteVersionResponse)
def get_version(note_id: str, version_id: str, db: Session = Depends(get_db)):
    """Get a specific version"""
    version = db.query(NoteVersionModel).filter(
        NoteVersionModel.id == version_id,
        NoteVersionModel.note_id == note_id
    ).first()
    
    if not version:
        raise HTTPException(status_code=404, detail="Version not found")
    
    return version

@router.post("/{version_id}/restore", response_model=NoteVersionResponse)
def restore_version(note_id: str, version_id: str, db: Session = Depends(get_db)):
    """Restore a note to a previous version"""
    version = db.query(NoteVersionModel).filter(
        NoteVersionModel.id == version_id,
        NoteVersionModel.note_id == note_id
    ).first()
    
    if not version:
        raise HTTPException(status_code=404, detail="Version not found")
    
    # Get the note
    note = db.query(NoteModel).filter(NoteModel.id == note_id).first()
    if not note:
        raise HTTPException(status_code=404, detail="Note not found")
    
    # Save current state as new version before restoring
    save_version(db, note_id, note.title, note.content, note.tags or "[]")
    
    # Restore to the selected version
    note.title = version.title
    note.content = version.content
    note.tags = version.tags
    db.commit()
    db.refresh(note)
    
    return version

@router.delete("/{version_id}")
def delete_version(note_id: str, version_id: str, db: Session = Depends(get_db)):
    """Delete a specific version"""
    version = db.query(NoteVersionModel).filter(
        NoteVersionModel.id == version_id,
        NoteVersionModel.note_id == note_id
    ).first()
    
    if not version:
        raise HTTPException(status_code=404, detail="Version not found")
    
    db.delete(version)
    db.commit()
    
    return {"status": "deleted"}
