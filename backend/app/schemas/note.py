from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime


class NoteBase(BaseModel):
    title: str
    content: str
    source: Optional[str] = None
    source_type: Optional[str] = None
    tags: Optional[List[str]] = None
    is_archived: Optional[bool] = False
    is_pinned: Optional[bool] = False
    order: Optional[int] = 0
    parent_note_id: Optional[str] = None


class NoteCreate(NoteBase):
    pass


class NoteUpdate(NoteBase):
    title: Optional[str] = None
    content: Optional[str] = None
    tags: Optional[List[str]] = None


class NoteResponse(NoteBase):
    id: str
    created_at: datetime
    updated_at: datetime
    backlinks: Optional[List[dict]] = None

    class Config:
        from_attributes = True


class NoteTransformRequest(BaseModel):
    instruction: str
    model: Optional[str] = "qwen2.5:0.5b"

class NoteSummarizeRequest(BaseModel):
    model: Optional[str] = "qwen2.5:0.5b"

class NoteTransformResponse(BaseModel):
    result: str
