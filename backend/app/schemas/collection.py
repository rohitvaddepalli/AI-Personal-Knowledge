from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
from app.schemas.note import NoteResponse

class CollectionBase(BaseModel):
    name: str
    description: Optional[str] = None

class CollectionCreate(CollectionBase):
    pass

class CollectionResponse(CollectionBase):
    id: int
    created_at: datetime
    notes: List[NoteResponse] = []

    class Config:
        from_attributes = True
