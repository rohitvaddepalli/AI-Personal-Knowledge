from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from app.database import get_db
from app.models.connection import Connection
from app.schemas.connection import ConnectionCreate, ConnectionResponse

router = APIRouter(prefix="/api/connections", tags=["connections"])

@router.post("", response_model=ConnectionResponse)
def create_connection(conn: ConnectionCreate, db: Session = Depends(get_db)):
    db_conn = Connection(**conn.model_dump())
    db.add(db_conn)
    try:
        db.commit()
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=400, detail="Connection already exists or invalid.")
    db.refresh(db_conn)
    return db_conn

@router.get("/note/{note_id}", response_model=List[ConnectionResponse])
def get_connections(note_id: str, db: Session = Depends(get_db)):
    conns = db.query(Connection).filter(
        (Connection.source_note_id == note_id) | (Connection.target_note_id == note_id)
    ).all()
    return conns

@router.delete("/{connection_id}")
def delete_connection(connection_id: int, db: Session = Depends(get_db)):
    db_conn = db.query(Connection).filter(Connection.id == connection_id).first()
    if not db_conn:
        raise HTTPException(status_code=404, detail="Not found")
    db.delete(db_conn)
    db.commit()
    return {"status": "deleted"}
