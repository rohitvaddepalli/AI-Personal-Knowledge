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
    mode: Optional[str] = "auto"  # "auto" | "search_only" | "strict_cited"
    provider: Optional[str] = None
    top_k: Optional[int] = 5
    tags: Optional[List[str]] = None
    source_types: Optional[List[str]] = None
    date_from: Optional[str] = None
    date_to: Optional[str] = None
    require_summary: bool = False
    require_flashcards: bool = False
    rerank_bias: float = 0.5

class AskResponse(BaseModel):
    answer: str
    sources: List[dict]
    session_id: Optional[int] = None
    confidence: Optional[float] = None
    retrieval_explanation: Optional[str] = None

class AutoSuggestRequest(BaseModel):
    content_before: str
    content_after: Optional[str] = ""
    note_id: Optional[str] = None
    model: Optional[str] = "qwen2.5:0.5b"
    provider: Optional[str] = None

class AIEditRequest(BaseModel):
    instruction: str
    selected_text: str
    context_text: Optional[str] = ""
    model: Optional[str] = "qwen2.5:0.5b"
    provider: Optional[str] = None
