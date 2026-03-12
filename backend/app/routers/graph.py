from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.database import get_db
from app.services.graph_service import get_graph_data_for_viz

router = APIRouter(prefix="/api/graph", tags=["graph"])

@router.get("")
def get_graph(db: Session = Depends(get_db)):
    return get_graph_data_for_viz(db)
