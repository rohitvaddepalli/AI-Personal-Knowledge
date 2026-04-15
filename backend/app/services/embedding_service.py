import chromadb
from app.config import settings
from app.runtime import ensure_app_directories

ensure_app_directories()

client = chromadb.PersistentClient(path=str(settings.chroma_persist_path))

# Make sure we have the collections
note_collection = client.get_or_create_collection(name="note_embeddings")
chunk_collection = client.get_or_create_collection(name="chunk_embeddings")

def add_note_embedding(note_id: str, title: str, content: str):
    try:
        text = f"{title}\n\n{content}"
        note_collection.add(
            documents=[text],
            metadatas=[{"note_id": note_id, "title": title}],
            ids=[note_id]
        )
    except Exception as e:
        print(f"ChromaDB Error (Add): {e}")
    
def update_note_embedding(note_id: str, title: str, content: str):
    try:
        text = f"{title}\n\n{content}"
        note_collection.update(
            documents=[text],
            metadatas=[{"note_id": note_id, "title": title}],
            ids=[note_id]
        )
    except Exception as e:
        print(f"ChromaDB Error (Update): {e}")

def delete_note_embedding(note_id: str):
    try:
        note_collection.delete(ids=[note_id])
    except Exception as e:
        print(f"ChromaDB Error (Delete): {e}")
