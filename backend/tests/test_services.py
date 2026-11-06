"""Tests for analytics, collections, export, auth, and health endpoints."""
import pytest
from fastapi.testclient import TestClient


class TestAnalytics:
    def _create_notes(self, client, count=3):
        for i in range(count):
            client.post("/api/notes", json={
                "title": f"Analytics Note {i}",
                "content": f"Content for note {i} with some words",
                "tags": ["analytics", f"tag{i}"],
                "source_type": "manual" if i % 2 == 0 else "web",
            })

    def test_analytics_overview_empty(self, client: TestClient):
        resp = client.get("/api/analytics/overview")
        assert resp.status_code == 200
        data = resp.json()
        assert data["total_notes"] == 0
        assert "total_words" in data
        assert "source_breakdown" in data

    def test_analytics_overview_with_notes(self, client: TestClient):
        self._create_notes(client, 3)
        resp = client.get("/api/analytics/overview")
        assert resp.status_code == 200
        data = resp.json()
        assert data["total_notes"] == 3
        assert data["total_words"] > 0

    def test_analytics_notes_per_day(self, client: TestClient):
        self._create_notes(client, 2)
        resp = client.get("/api/analytics/notes-per-day?days=7")
        assert resp.status_code == 200
        data = resp.json()
        assert isinstance(data, list)
        assert len(data) == 7
        assert all("date" in item and "count" in item for item in data)
        # Today should have 2 notes
        today_items = [d for d in data if d["count"] > 0]
        assert len(today_items) > 0

    def test_analytics_top_tags(self, client: TestClient):
        self._create_notes(client, 3)
        resp = client.get("/api/analytics/top-tags?limit=10")
        assert resp.status_code == 200
        data = resp.json()
        assert isinstance(data, list)
        # "analytics" tag appears on all 3 notes
        analytics_tag = next((t for t in data if t["tag"] == "analytics"), None)
        assert analytics_tag is not None
        assert analytics_tag["count"] == 3

    def test_analytics_source_breakdown(self, client: TestClient):
        self._create_notes(client, 4)
        resp = client.get("/api/analytics/source-breakdown")
        assert resp.status_code == 200
        assert isinstance(resp.json(), list)

    def test_analytics_word_count_trend(self, client: TestClient):
        self._create_notes(client, 2)
        resp = client.get("/api/analytics/word-count-trend?days=7")
        assert resp.status_code == 200
        data = resp.json()
        assert len(data) == 7
        total_words = sum(d["words"] for d in data)
        assert total_words > 0

    def test_analytics_stale_notes_empty(self, client: TestClient):
        resp = client.get("/api/analytics/stale-notes?idle_days=30")
        assert resp.status_code == 200
        assert resp.json() == []

    def test_analytics_graph_density_empty(self, client: TestClient):
        resp = client.get("/api/analytics/graph-density")
        assert resp.status_code == 200
        data = resp.json()
        assert data["total_notes"] == 0
        assert "graph_density" in data


class TestCollections:
    def test_create_collection(self, client: TestClient):
        resp = client.post("/api/collections", json={"name": "Test", "description": "Desc"})
        assert resp.status_code == 200
        assert resp.json()["name"] == "Test"

    def test_list_collections(self, client: TestClient):
        client.post("/api/collections", json={"name": "Col1", "description": ""})
        resp = client.get("/api/collections")
        assert resp.status_code == 200
        assert len(resp.json()) >= 1

    def test_add_note_to_collection(self, client: TestClient):
        note = client.post("/api/notes", json={"title": "N", "content": "c"}).json()
        col = client.post("/api/collections", json={"name": "C", "description": ""}).json()
        resp = client.post(f"/api/collections/{col['id']}/notes/{note['id']}")
        assert resp.status_code == 200


class TestExport:
    def _make_note(self, client):
        return client.post("/api/notes", json={"title": "Export Me", "content": "Some content"}).json()

    def test_export_note_markdown(self, client: TestClient):
        note = self._make_note(client)
        resp = client.get(f"/api/export/note/{note['id']}/markdown")
        assert resp.status_code == 200
        data = resp.json()
        assert "filename" in data
        assert data["filename"].endswith(".md")
        assert "Export Me" in data["content"]

    def test_export_all_zip(self, client: TestClient):
        self._make_note(client)
        resp = client.get("/api/export/all/zip")
        assert resp.status_code == 200
        assert resp.headers["content-type"] == "application/zip"

    def test_export_obsidian_vault(self, client: TestClient):
        self._make_note(client)
        resp = client.get("/api/export/vault/obsidian")
        assert resp.status_code == 200
        assert resp.headers["content-type"] == "application/zip"


class TestHealth:
    def test_root(self, client: TestClient):
        resp = client.get("/")
        assert resp.status_code == 200
        assert "message" in resp.json()

    def test_health(self, client: TestClient):
        resp = client.get("/api/health")
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "ok"
        assert "port" in data

    def test_system_metrics(self, client: TestClient):
        resp = client.get("/api/system/metrics")
        assert resp.status_code == 200
        data = resp.json()
        assert "cpuPercent" in data
        assert "ramPercent" in data


class TestAuth:
    def test_auth_mode_endpoint(self, client: TestClient):
        resp = client.get("/api/auth/mode")
        assert resp.status_code == 200
        assert "mode" in resp.json()

    def test_login_localhost_mode(self, client: TestClient):
        resp = client.post("/api/auth/login", json={"username": "admin", "password": "any"})
        assert resp.status_code == 200
        assert resp.json()["ok"] is True

    def test_logout(self, client: TestClient):
        resp = client.post("/api/auth/logout")
        assert resp.status_code == 200
        assert resp.json()["ok"] is True

    def test_register_in_localhost_mode(self, client: TestClient):
        """Registration should fail in localhost mode."""
        resp = client.post("/api/auth/register", json={"username": "newuser", "password": "password123"})
        assert resp.status_code == 400


class TestFlashcards:
    def test_flashcard_stats_empty(self, client: TestClient):
        resp = client.get("/api/flashcards/stats")
        assert resp.status_code == 200
        data = resp.json()
        assert data["total"] == 0
        assert data["due"] == 0

    def test_get_due_cards_empty(self, client: TestClient):
        resp = client.get("/api/flashcards/due")
        assert resp.status_code == 200
        assert resp.json() == []

    def test_get_cards_for_note_not_found(self, client: TestClient):
        resp = client.get("/api/flashcards/note/nonexistent-note-id")
        assert resp.status_code == 200
        assert resp.json() == []


class TestReview:
    def test_get_due_notes_empty(self, client: TestClient):
        resp = client.get("/api/review/due")
        assert resp.status_code == 200
        assert isinstance(resp.json(), list)

    def test_mark_note_reviewed(self, client: TestClient):
        note = client.post("/api/notes", json={"title": "Review me", "content": "Important"}).json()
        resp = client.post(f"/api/review/{note['id']}", json={"quality": 4})
        assert resp.status_code == 200


class TestGarden:
    def test_garden_index_empty(self, client: TestClient):
        resp = client.get("/api/garden")
        assert resp.status_code == 200
        # Returns HTML
        assert "text/html" in resp.headers["content-type"]

    def test_publish_note(self, client: TestClient):
        note = client.post("/api/notes", json={"title": "Public Note", "content": "Hello garden"}).json()
        resp = client.put(f"/api/garden/note/{note['id']}/publish")
        assert resp.status_code == 200
        assert resp.json()["status"] == "published"
        assert "slug" in resp.json()

    def test_unpublish_note(self, client: TestClient):
        note = client.post("/api/notes", json={"title": "Public Note 2", "content": "..."}).json()
        client.put(f"/api/garden/note/{note['id']}/publish")
        resp = client.put(f"/api/garden/note/{note['id']}/unpublish")
        assert resp.status_code == 200
        assert resp.json()["status"] == "unpublished"

    def test_garden_rss(self, client: TestClient):
        resp = client.get("/api/garden/rss")
        assert resp.status_code == 200
        assert "xml" in resp.headers["content-type"]


class TestTasks:
    def test_create_and_list_task(self, client: TestClient):
        resp = client.post("/api/tasks", json={"text": "Do something"})
        assert resp.status_code == 200
        assert resp.json()["text"] == "Do something"
        assert resp.json()["is_done"] is False
        list_resp = client.get("/api/tasks")
        assert list_resp.status_code == 200
        assert len(list_resp.json()) >= 1

    def test_complete_task(self, client: TestClient):
        task = client.post("/api/tasks", json={"text": "Task"}).json()
        resp = client.put(f"/api/tasks/{task['id']}", json={"text": "Task", "is_done": True})
        assert resp.status_code == 200

    def test_delete_task(self, client: TestClient):
        task = client.post("/api/tasks", json={"text": "Delete me"}).json()
        resp = client.delete(f"/api/tasks/{task['id']}")
        assert resp.status_code == 200


class TestConnections:
    def test_create_connection(self, client: TestClient):
        note_a = client.post("/api/notes", json={"title": "A", "content": "a"}).json()
        note_b = client.post("/api/notes", json={"title": "B", "content": "b"}).json()
        resp = client.post("/api/connections", json={
            "note_id": note_a["id"],
            "connected_note_id": note_b["id"],
            "relationship_type": "related",
        })
        assert resp.status_code == 200

    def test_list_connections(self, client: TestClient):
        resp = client.get("/api/connections")
        assert resp.status_code == 200
        assert isinstance(resp.json(), list)
