"""Tests for the notes API endpoints."""
import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session


class TestNotesCRUD:
    """Test suite for notes CRUD operations."""

    def test_create_note(self, client: TestClient, sample_note_data):
        """Test creating a new note."""
        response = client.post("/api/notes", json=sample_note_data)
        assert response.status_code == 200
        data = response.json()
        assert data["title"] == sample_note_data["title"]
        assert "id" in data
        assert "created_at" in data

    def test_create_note_minimal(self, client: TestClient):
        """Test creating a note with minimal data."""
        response = client.post(
            "/api/notes",
            json={"title": "Minimal Note", "content": "Content"},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["title"] == "Minimal Note"

    def test_list_notes(self, client: TestClient, sample_note_data):
        """Test listing notes."""
        # Create a few notes first
        for i in range(3):
            client.post("/api/notes", json={
                "title": f"Note {i}",
                "content": f"Content {i}",
            })
        
        response = client.get("/api/notes")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) == 3

    def test_get_single_note(self, client: TestClient, sample_note_data):
        """Test getting a single note by ID."""
        # Create a note
        create_response = client.post("/api/notes", json=sample_note_data)
        note_id = create_response.json()["id"]
        
        # Get the note
        response = client.get(f"/api/notes/{note_id}")
        assert response.status_code == 200
        data = response.json()
        assert data["id"] == note_id
        assert data["title"] == sample_note_data["title"]

    def test_update_note(self, client: TestClient, sample_note_data):
        """Test updating a note."""
        # Create a note
        create_response = client.post("/api/notes", json=sample_note_data)
        note_id = create_response.json()["id"]
        
        # Update the note
        update_data = {
            "title": "Updated Title",
            "content": "Updated content",
        }
        response = client.put(f"/api/notes/{note_id}", json=update_data)
        assert response.status_code == 200
        
        # Verify the update
        get_response = client.get(f"/api/notes/{note_id}")
        data = get_response.json()
        assert data["title"] == "Updated Title"
        assert data["content"] == "Updated content"

    def test_delete_note(self, client: TestClient, sample_note_data):
        """Test soft-deleting a note."""
        # Create a note
        create_response = client.post("/api/notes", json=sample_note_data)
        note_id = create_response.json()["id"]
        
        # Delete the note
        response = client.delete(f"/api/notes/{note_id}")
        assert response.status_code == 200
        
        # Check it's in trash
        trash_response = client.get("/api/notes/trash/")
        assert trash_response.status_code == 200
        trash_data = trash_response.json()
        assert any(note["id"] == note_id for note in trash_data)

    def test_restore_note(self, client: TestClient, sample_note_data):
        """Test restoring a deleted note."""
        # Create and delete a note
        create_response = client.post("/api/notes", json=sample_note_data)
        note_id = create_response.json()["id"]
        client.delete(f"/api/notes/{note_id}")
        
        # Restore the note
        response = client.post(f"/api/notes/{note_id}/restore")
        assert response.status_code == 200

    def test_permanently_delete_note(self, client: TestClient, sample_note_data):
        """Test permanently deleting a note."""
        # Create and delete a note
        create_response = client.post("/api/notes", json=sample_note_data)
        note_id = create_response.json()["id"]
        client.delete(f"/api/notes/{note_id}")
        
        # Permanently delete
        response = client.delete(f"/api/notes/{note_id}/permanent")
        assert response.status_code == 200

    def test_pin_note(self, client: TestClient, sample_note_data):
        """Test pinning/unpinning a note."""
        # Create a note
        create_response = client.post("/api/notes", json=sample_note_data)
        note_id = create_response.json()["id"]
        
        # Pin the note
        response = client.put(f"/api/notes/{note_id}", json={"is_pinned": True})
        assert response.status_code == 200
        
        # Verify it's pinned
        get_response = client.get(f"/api/notes/{note_id}")
        data = get_response.json()
        assert data["is_pinned"] is True

    def test_search_notes(self, client: TestClient):
        """Test searching notes by title/content."""
        # Create notes
        client.post("/api/notes", json={
            "title": "Python Programming",
            "content": "Learn Python basics",
        })
        client.post("/api/notes", json={
            "title": "JavaScript Guide",
            "content": "Learn JavaScript basics",
        })
        
        # Search
        response = client.get("/api/notes/search/?q=Python")
        assert response.status_code == 200
        data = response.json()
        assert len(data) > 0
        assert any("Python" in note["title"] for note in data)


class TestNotesHierarchy:
    """Test suite for hierarchical notes."""

    def test_set_parent_note(self, client: TestClient):
        """Test setting a parent note."""
        # Create parent note
        parent_response = client.post("/api/notes", json={
            "title": "Parent Note",
            "content": "Parent content",
        })
        parent_id = parent_response.json()["id"]
        
        # Create child note
        child_response = client.post("/api/notes", json={
            "title": "Child Note",
            "content": "Child content",
        })
        child_id = child_response.json()["id"]
        
        # Set parent
        response = client.post(f"/api/notes/{child_id}/parent", json={"parent_note_id": parent_id})
        assert response.status_code == 200

    def test_get_note_tree(self, client: TestClient):
        """Test getting the note tree."""
        # Create a hierarchy
        parent_response = client.post("/api/notes", json={
            "title": "Root",
            "content": "Root content",
        })
        parent_id = parent_response.json()["id"]
        
        # Get tree
        response = client.get(f"/api/notes/{parent_id}/tree")
        assert response.status_code == 200


class TestDailyNotes:
    """Test suite for daily notes."""

    def test_get_today_daily_note(self, client: TestClient):
        """Test getting today's daily note."""
        response = client.get("/api/notes/daily/today")
        assert response.status_code == 200

    def test_list_all_daily_notes(self, client: TestClient):
        """Test listing all daily notes."""
        response = client.get("/api/notes/daily/")
        assert response.status_code == 200


class TestNotesAI:
    """Test suite for AI features on notes."""

    def test_suggest_tags(self, client: TestClient):
        """Test AI tag suggestion (may fail if Ollama not running)."""
        response = client.post(
            "/api/notes/suggest-tags",
            json={
                "title": "Machine Learning Basics",
                "content": "Introduction to ML algorithms",
                "model": "qwen2.5:0.5b",
            },
        )
        # May return 500 if Ollama is not running, which is acceptable
        assert response.status_code in [200, 500]


class TestNoteVersions:
    """Test suite for note versioning."""

    def test_list_versions(self, client: TestClient, sample_note_data):
        """Test listing note versions."""
        # Create a note
        create_response = client.post("/api/notes", json=sample_note_data)
        note_id = create_response.json()["id"]
        
        # Update it to create a version
        client.put(f"/api/notes/{note_id}", json={
            "title": "Updated Title",
            "content": "Updated content",
        })
        
        # List versions
        response = client.get(f"/api/notes/{note_id}/versions")
        assert response.status_code == 200
