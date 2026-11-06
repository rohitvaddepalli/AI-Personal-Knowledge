"""Tests for notes CRUD and core features."""
import pytest
from fastapi.testclient import TestClient


class TestNotesCreate:
    def test_create_note_basic(self, client: TestClient, sample_note_data):
        resp = client.post("/api/notes", json=sample_note_data)
        assert resp.status_code == 200
        data = resp.json()
        assert data["title"] == sample_note_data["title"]
        assert data["content"] == sample_note_data["content"]
        assert isinstance(data["id"], str)
        assert len(data["id"]) > 0

    def test_create_note_minimal(self, client: TestClient):
        resp = client.post("/api/notes", json={"title": "Min", "content": "X"})
        assert resp.status_code == 200
        assert resp.json()["title"] == "Min"

    def test_create_note_missing_fields(self, client: TestClient):
        resp = client.post("/api/notes", json={"title": "No content"})
        assert resp.status_code == 422

    def test_create_note_with_source_type(self, client: TestClient):
        resp = client.post("/api/notes", json={
            "title": "Web note", "content": "...", "source_type": "web", "source": "https://example.com"
        })
        assert resp.status_code == 200
        assert resp.json()["source_type"] == "web"


class TestNotesRead:
    def test_list_notes_empty(self, client: TestClient):
        resp = client.get("/api/notes")
        assert resp.status_code == 200
        assert resp.json() == []

    def test_list_notes_returns_notes(self, client: TestClient, sample_note_data):
        client.post("/api/notes", json=sample_note_data)
        resp = client.get("/api/notes")
        assert resp.status_code == 200
        notes = resp.json()
        assert len(notes) == 1
        assert notes[0]["title"] == sample_note_data["title"]

    def test_get_note_by_id(self, client: TestClient, sample_note_data):
        create_resp = client.post("/api/notes", json=sample_note_data)
        note_id = create_resp.json()["id"]
        resp = client.get(f"/api/notes/{note_id}")
        assert resp.status_code == 200
        assert resp.json()["id"] == note_id

    def test_get_note_not_found(self, client: TestClient):
        resp = client.get("/api/notes/nonexistent-id")
        assert resp.status_code == 404

    def test_list_notes_pagination(self, client: TestClient):
        for i in range(5):
            client.post("/api/notes", json={"title": f"Note {i}", "content": "x"})
        resp = client.get("/api/notes?limit=3&skip=0")
        assert resp.status_code == 200
        assert len(resp.json()) == 3

    def test_get_random_note_no_notes(self, client: TestClient):
        resp = client.get("/api/notes/random")
        assert resp.status_code == 404

    def test_get_random_note(self, client: TestClient, sample_note_data):
        client.post("/api/notes", json=sample_note_data)
        resp = client.get("/api/notes/random")
        assert resp.status_code == 200
        assert "id" in resp.json()


class TestNotesUpdate:
    def test_update_note_title(self, client: TestClient, sample_note_data):
        create_resp = client.post("/api/notes", json=sample_note_data)
        note_id = create_resp.json()["id"]
        resp = client.put(f"/api/notes/{note_id}", json={"title": "Updated Title"})
        assert resp.status_code == 200
        assert resp.json()["title"] == "Updated Title"

    def test_update_note_content(self, client: TestClient, sample_note_data):
        create_resp = client.post("/api/notes", json=sample_note_data)
        note_id = create_resp.json()["id"]
        new_content = "# Updated\n\nNew content here."
        resp = client.put(f"/api/notes/{note_id}", json={"content": new_content})
        assert resp.status_code == 200
        assert resp.json()["content"] == new_content

    def test_update_note_not_found(self, client: TestClient):
        resp = client.put("/api/notes/nonexistent", json={"title": "X"})
        assert resp.status_code == 404

    def test_update_note_pin(self, client: TestClient, sample_note_data):
        create_resp = client.post("/api/notes", json=sample_note_data)
        note_id = create_resp.json()["id"]
        resp = client.put(f"/api/notes/{note_id}", json={"is_pinned": True})
        assert resp.status_code == 200
        assert resp.json()["is_pinned"] is True


class TestNotesDelete:
    def test_soft_delete_note(self, client: TestClient, sample_note_data):
        create_resp = client.post("/api/notes", json=sample_note_data)
        note_id = create_resp.json()["id"]
        del_resp = client.delete(f"/api/notes/{note_id}")
        assert del_resp.status_code == 200
        assert del_resp.json()["status"] == "moved_to_trash"
        # Should not appear in normal listing
        list_resp = client.get("/api/notes")
        ids = [n["id"] for n in list_resp.json()]
        assert note_id not in ids

    def test_soft_delete_note_not_found(self, client: TestClient):
        resp = client.delete("/api/notes/nonexistent")
        assert resp.status_code == 404

    def test_trash_listing(self, client: TestClient, sample_note_data):
        create_resp = client.post("/api/notes", json=sample_note_data)
        note_id = create_resp.json()["id"]
        client.delete(f"/api/notes/{note_id}")
        trash_resp = client.get("/api/notes/trash/")
        assert resp.status_code == 200 if (resp := trash_resp) else True
        assert any(n["id"] == note_id for n in trash_resp.json())

    def test_restore_note(self, client: TestClient, sample_note_data):
        create_resp = client.post("/api/notes", json=sample_note_data)
        note_id = create_resp.json()["id"]
        client.delete(f"/api/notes/{note_id}")
        restore_resp = client.post(f"/api/notes/{note_id}/restore")
        assert restore_resp.status_code == 200
        list_resp = client.get("/api/notes")
        ids = [n["id"] for n in list_resp.json()]
        assert note_id in ids

    def test_permanent_delete(self, client: TestClient, sample_note_data):
        create_resp = client.post("/api/notes", json=sample_note_data)
        note_id = create_resp.json()["id"]
        client.delete(f"/api/notes/{note_id}")
        perm_resp = client.delete(f"/api/notes/{note_id}/permanent")
        assert perm_resp.status_code == 200
        get_resp = client.get(f"/api/notes/{note_id}")
        assert get_resp.status_code == 404


class TestDailyNotes:
    def test_get_or_create_daily_note(self, client: TestClient):
        resp = client.get("/api/notes/daily/today")
        assert resp.status_code == 200
        data = resp.json()
        assert "Daily Note" in data["title"]
        assert data["source"] == "daily"

    def test_daily_note_idempotent(self, client: TestClient):
        """Calling twice should return the same note."""
        resp1 = client.get("/api/notes/daily/today")
        resp2 = client.get("/api/notes/daily/today")
        assert resp1.json()["id"] == resp2.json()["id"]

    def test_list_daily_notes(self, client: TestClient):
        client.get("/api/notes/daily/today")
        resp = client.get("/api/notes/daily/")
        assert resp.status_code == 200
        assert isinstance(resp.json(), list)


class TestNoteSearch:
    def test_search_by_title(self, client: TestClient):
        client.post("/api/notes", json={"title": "Python programming", "content": "Learn Python"})
        client.post("/api/notes", json={"title": "Rust systems", "content": "Memory safe"})
        resp = client.get("/api/notes/search/?query=Python")
        assert resp.status_code == 200
        results = resp.json()
        assert any("Python" in n["title"] for n in results)

    def test_search_by_content(self, client: TestClient):
        client.post("/api/notes", json={"title": "Note A", "content": "quantum computing breakthrough"})
        resp = client.get("/api/notes/search/?query=quantum")
        assert resp.status_code == 200
        assert len(resp.json()) >= 1

    def test_search_no_results(self, client: TestClient):
        resp = client.get("/api/notes/search/?query=zzzznonexistent")
        assert resp.status_code == 200
        assert resp.json() == []


class TestHybridSearch:
    def test_hybrid_search_basic(self, client: TestClient):
        client.post("/api/notes", json={"title": "Machine Learning", "content": "neural networks and deep learning"})
        resp = client.post("/api/search", json={"query": "neural networks", "limit": 5})
        assert resp.status_code == 200
        results = resp.json()
        assert isinstance(results, list)

    def test_hybrid_search_empty_db(self, client: TestClient):
        resp = client.post("/api/search", json={"query": "anything", "limit": 5})
        assert resp.status_code == 200
        assert resp.json() == []


class TestNoteHierarchy:
    def test_set_parent_note(self, client: TestClient):
        parent = client.post("/api/notes", json={"title": "Parent", "content": "Parent note"}).json()
        child = client.post("/api/notes", json={"title": "Child", "content": "Child note"}).json()
        resp = client.post(f"/api/notes/{child['id']}/parent?parent_id={parent['id']}")
        assert resp.status_code == 200

    def test_self_as_parent_rejected(self, client: TestClient):
        note = client.post("/api/notes", json={"title": "Self", "content": "..."}).json()
        resp = client.post(f"/api/notes/{note['id']}/parent?parent_id={note['id']}")
        assert resp.status_code == 400

    def test_get_full_tree(self, client: TestClient):
        resp = client.get("/api/notes/full-tree")
        assert resp.status_code == 200
        assert isinstance(resp.json(), list)
