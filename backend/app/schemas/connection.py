from datetime import datetime
from typing import Optional

from pydantic import BaseModel


class ConnectionBase(BaseModel):
    source_note_id: str
    target_note_id: str
    relationship_type: Optional[str] = None
    strength: Optional[float] = 0.0
    ai_explanation: Optional[str] = None


class ConnectionCreate(ConnectionBase):
    pass


class ConnectionResponse(ConnectionBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True
