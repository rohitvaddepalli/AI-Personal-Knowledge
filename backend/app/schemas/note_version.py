from pydantic import BaseModel
from typing import Optional
from datetime import datetime

class NoteVersionResponse(BaseModel):
    id: str
    note_id: str
    title: str
    content: str
    tags: Optional[str]
    version_number: int
    created_at: datetime

    class Config:
        from_attributes = True
