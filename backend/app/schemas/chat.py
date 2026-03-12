from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime

class ChatMessageBase(BaseModel):
    role: str
    content: str

class ChatMessageResponse(ChatMessageBase):
    id: int
    created_at: datetime
    class Config:
        from_attributes = True

class ChatSessionBase(BaseModel):
    title: Optional[str] = None
    note_id: Optional[str] = None

class ChatSessionCreate(ChatSessionBase):
    pass

class ChatSessionUpdate(BaseModel):
    title: str

class ChatSessionResponse(ChatSessionBase):
    id: int
    created_at: datetime
    messages: List[ChatMessageResponse] = []
    class Config:
        from_attributes = True

class AskRequest(BaseModel):
    question: str
    session_id: Optional[int] = None
    note_id: Optional[str] = None
