from app.utils.logger import get_logger

logger = get_logger(__name__)
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
        note_collection.add(documents=[text], metadatas=[{"note_id": note_id, "title": title}], ids=[note_id])
    except Exception as e:
        logger.info(f"ChromaDB Error (Add): {e}")


def update_note_embedding(note_id: str, title: str, content: str):
    try:
        text = f"{title}\n\n{content}"
        note_collection.update(documents=[text], metadatas=[{"note_id": note_id, "title": title}], ids=[note_id])
    except Exception as e:
        logger.info(f"ChromaDB Error (Update): {e}")


def delete_note_embedding(note_id: str):
    try:
        note_collection.delete(ids=[note_id])
    except Exception as e:
        logger.info(f"ChromaDB Error (Delete): {e}")


def search_similar(query_text: str, top_k: int = 5):
    """Base similarity search function."""
    try:
        results = note_collection.query(query_texts=[query_text], n_results=top_k)

        output = []
        if results and results["ids"] and len(results["ids"][0]) > 0:
            for i in range(len(results["ids"][0])):
                output.append(
                    {
                        "id": results["ids"][0][i],
                        "score": results["distances"][0][i] if "distances" in results and results["distances"] else 0,
                        "metadata": results["metadatas"][0][i]
                        if "metadatas" in results and results["metadatas"]
                        else {},
                    }
                )
        return output
    except Exception as e:
        logger.error(f"ChromaDB Query Error: {e}")
        return []


def search_similar_notes(query: str, n_results: int = 5):
    """Alias for benchmark and other services expecting different param names."""
    return search_similar(query_text=query, top_k=n_results)
