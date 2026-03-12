import chromadb
from app.config import settings

client = chromadb.PersistentClient(path=settings.chroma_persist_dir)

# Make sure we have the collections
note_collection = client.get_or_create_collection(name="note_embeddings")
chunk_collection = client.get_or_create_collection(name="chunk_embeddings")

def add_note_embedding(note_id: str, title: str, content: str):
    text = f"{title}\n\n{content}"
    # Using the default sentence-transformers model embedded in chromadb 
    note_collection.add(
        documents=[text],
        metadatas=[{"note_id": note_id, "title": title}],
        ids=[note_id]
    )
    
def update_note_embedding(note_id: str, title: str, content: str):
    text = f"{title}\n\n{content}"
    note_collection.update(
        documents=[text],
        metadatas=[{"note_id": note_id, "title": title}],
        ids=[note_id]
    )

def delete_note_embedding(note_id: str):
    note_collection.delete(ids=[note_id])
