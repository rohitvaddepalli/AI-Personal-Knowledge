import os
import uuid
import shutil
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session
from typing import List
from app.database import get_db
from app.models.attachment import Attachment as AttachmentModel
from app.models.note import Note as NoteModel
from app.schemas.attachment import AttachmentResponse

router = APIRouter(prefix="/api/notes/{note_id}/attachments", tags=["attachments"])

# Configure upload directory
UPLOAD_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "data", "uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)

@router.get("", response_model=List[AttachmentResponse])
def list_attachments(note_id: str, db: Session = Depends(get_db)):
    """List all attachments for a note"""
    attachments = db.query(AttachmentModel).filter(AttachmentModel.note_id == note_id).all()
    return attachments

@router.post("", response_model=AttachmentResponse)
async def upload_attachment(
    note_id: str,
    file: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    """Upload a file attachment to a note"""
    # Verify note exists
    note = db.query(NoteModel).filter(NoteModel.id == note_id).first()
    if not note:
        raise HTTPException(status_code=404, detail="Note not found")
    
    # Generate unique filename
    file_ext = os.path.splitext(file.filename)[1]
    unique_filename = f"{uuid.uuid4()}{file_ext}"
    file_path = os.path.join(UPLOAD_DIR, unique_filename)
    
    # Save file
    try:
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save file: {str(e)}")
    finally:
        file.file.close()
    
    # Get file size
    file_size = os.path.getsize(file_path)
    
    # Create attachment record
    attachment = AttachmentModel(
        note_id=note_id,
        filename=unique_filename,
        original_filename=file.filename,
        mime_type=file.content_type or "application/octet-stream",
        file_size=file_size,
        storage_path=file_path
    )
    db.add(attachment)
    db.commit()
    db.refresh(attachment)
    
    return attachment

@router.delete("/{attachment_id}")
def delete_attachment(note_id: str, attachment_id: str, db: Session = Depends(get_db)):
    """Delete an attachment"""
    attachment = db.query(AttachmentModel).filter(
        AttachmentModel.id == attachment_id,
        AttachmentModel.note_id == note_id
    ).first()
    
    if not attachment:
        raise HTTPException(status_code=404, detail="Attachment not found")
    
    # Delete physical file
    try:
        if os.path.exists(attachment.storage_path):
            os.remove(attachment.storage_path)
    except Exception as e:
        print(f"Failed to delete file: {e}")
    
    # Delete database record
    db.delete(attachment)
    db.commit()
    
    return {"status": "deleted"}

@router.get("/{attachment_id}/download")
def download_attachment(note_id: str, attachment_id: str, db: Session = Depends(get_db)):
    """Get attachment download URL/info"""
    from fastapi.responses import FileResponse
    
    attachment = db.query(AttachmentModel).filter(
        AttachmentModel.id == attachment_id,
        AttachmentModel.note_id == note_id
    ).first()
    
    if not attachment:
        raise HTTPException(status_code=404, detail="Attachment not found")
    
    if not os.path.exists(attachment.storage_path):
        raise HTTPException(status_code=404, detail="File not found on disk")
    
    return FileResponse(
        attachment.storage_path,
        filename=attachment.original_filename,
        media_type=attachment.mime_type
    )
