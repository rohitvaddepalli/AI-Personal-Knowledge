from pydantic import BaseModel
from typing import Optional
from datetime import datetime

class AttachmentResponse(BaseModel):
    id: str
    note_id: str
    filename: str
    original_filename: str
    mime_type: str
    file_size: int
    created_at: datetime

    class Config:
        from_attributes = True
