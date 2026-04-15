from pydantic import BaseModel
from typing import List, Optional

class SearchResultResponse(BaseModel):
    id: str
    title: str
    content: str
    score: float
    source_type: Optional[str] = None
    tags: List[str] = []

class AskRequest(BaseModel):
    question: str
    session_id: Optional[int] = None
    note_id: Optional[str] = None
    profile_context: Optional[str] = None
    model: Optional[str] = "qwen2.5:0.5b"
    
class AskResponse(BaseModel):
    answer: str
    sources: List[dict]
    session_id: Optional[int] = None

class AutoSuggestRequest(BaseModel):
    content_before: str
    content_after: Optional[str] = ""
    note_id: Optional[str] = None
    model: Optional[str] = "qwen2.5:0.5b"

class AIEditRequest(BaseModel):
    instruction: str
    selected_text: str
    context_text: Optional[str] = ""
    model: Optional[str] = "qwen2.5:0.5b"
