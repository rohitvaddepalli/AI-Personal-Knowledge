from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from app.database import get_db
from app.models.collection import Collection
from app.models.note import Note
from app.schemas.collection import CollectionCreate, CollectionResponse
import json

router = APIRouter(prefix="/api/collections", tags=["collections"])

@router.post("", response_model=CollectionResponse)
def create_collection(collection: CollectionCreate, db: Session = Depends(get_db)):
    db_collection = Collection(name=collection.name, description=collection.description)
    db.add(db_collection)
    db.commit()
    db.refresh(db_collection)
    return db_collection

@router.get("", response_model=List[CollectionResponse])
def get_collections(db: Session = Depends(get_db)):
    collections = db.query(Collection).all()
    for col in collections:
        for note in col.notes:
             note.tags = json.loads(note.tags) if note.tags else []
    return collections

@router.post("/{collection_id}/notes/{note_id}")
def add_note_to_collection(collection_id: int, note_id: str, db: Session = Depends(get_db)):
    collection = db.query(Collection).filter(Collection.id == collection_id).first()
    note = db.query(Note).filter(Note.id == note_id).first()
    
    if not collection or not note:
        raise HTTPException(status_code=404, detail="Collection or Note not found")
        
    collection.notes.append(note)
    db.commit()
    return {"status": "added"}
    
@router.delete("/{collection_id}/notes/{note_id}")
def remove_note_from_collection(collection_id: int, note_id: str, db: Session = Depends(get_db)):
    collection = db.query(Collection).filter(Collection.id == collection_id).first()
    note = db.query(Note).filter(Note.id == note_id).first()
    
    if not collection or not note:
        raise HTTPException(status_code=404, detail="Collection or Note not found")
        
    if note in collection.notes:
        collection.notes.remove(note)
        db.commit()
        
    return {"status": "removed"}
