from typing import List

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas.search import SearchResultResponse
from app.services.search_service import hybrid_search

router = APIRouter(prefix="/api/search", tags=["search"])


class SearchRequest(BaseModel):
    query: str
    limit: int = 20


@router.post("", response_model=List[SearchResultResponse])
def execute_search(req: SearchRequest, db: Session = Depends(get_db)):
    results = hybrid_search(db, req.query, req.limit)
    return results
