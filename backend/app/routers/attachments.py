import os
import uuid
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session
from typing import List
from app.database import get_db
from app.models.attachment import Attachment as AttachmentModel
from app.models.note import Note as NoteModel
from app.schemas.attachment import AttachmentResponse
from app.config import settings
import re

router = APIRouter(prefix="/api/notes/{note_id}/attachments", tags=["attachments"])

# Configure upload directory
UPLOAD_DIR = str(settings.upload_path)
os.makedirs(UPLOAD_DIR, exist_ok=True)

def _safe_ext(filename: str) -> str:
    # Keep a small, safe extension subset of the original name.
    ext = os.path.splitext(filename or "")[1].lower()
    if not ext or len(ext) > 16:
        return ""
    if not re.fullmatch(r"\.[a-z0-9]{1,15}", ext):
        return ""
    return ext

def _safe_download_filename(filename: str) -> str:
    # Prevent header injection and weird paths in Content-Disposition.
    name = (filename or "attachment").replace("\r", "").replace("\n", "")
    name = name.replace("\\", "_").replace("/", "_")
    name = re.sub(r"[^A-Za-z0-9._ -]+", "_", name).strip(" .")
    return name or "attachment"

def _ensure_within_upload_dir(path: str) -> str:
    base = os.path.realpath(UPLOAD_DIR)
    real = os.path.realpath(path)
    if real != base and not real.startswith(base + os.sep):
        raise HTTPException(status_code=400, detail="Invalid attachment path")
    return real

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
    file_ext = _safe_ext(file.filename or "")
    unique_filename = f"{uuid.uuid4()}{file_ext}"
    file_path = os.path.join(UPLOAD_DIR, unique_filename)
    
    # Save file (streaming, with max size enforcement)
    max_bytes = int(settings.max_upload_size_mb) * 1024 * 1024
    bytes_written = 0
    try:
        with open(file_path, "wb") as buffer:
            while True:
                chunk = await file.read(1024 * 1024)  # 1 MiB
                if not chunk:
                    break
                bytes_written += len(chunk)
                if bytes_written > max_bytes:
                    raise HTTPException(status_code=413, detail=f"File too large (max {settings.max_upload_size_mb} MB)")
                buffer.write(chunk)
    except Exception as e:
        # Best-effort cleanup if a partial file was written.
        try:
            if os.path.exists(file_path):
                os.remove(file_path)
        except Exception:
            pass
        if isinstance(e, HTTPException):
            raise
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
        real_path = _ensure_within_upload_dir(attachment.storage_path)
        if os.path.exists(real_path):
            os.remove(real_path)
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
    
    real_path = _ensure_within_upload_dir(attachment.storage_path)

    if not os.path.exists(real_path):
        raise HTTPException(status_code=404, detail="File not found on disk")
    
    return FileResponse(
        real_path,
        filename=_safe_download_filename(attachment.original_filename),
        media_type=attachment.mime_type
    )
