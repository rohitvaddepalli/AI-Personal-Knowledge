from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from typing import List
from app.database import get_db
from app.services.search_service import hybrid_search
from app.schemas.search import SearchResultResponse
from pydantic import BaseModel

router = APIRouter(prefix="/api/search", tags=["search"])

class SearchRequest(BaseModel):
    query: str
    limit: int = 20

@router.post("", response_model=List[SearchResultResponse])
def execute_search(req: SearchRequest, db: Session = Depends(get_db)):
    results = hybrid_search(db, req.query, req.limit)
    return results
