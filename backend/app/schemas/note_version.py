from datetime import datetime
from typing import Optional

from pydantic import BaseModel


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
