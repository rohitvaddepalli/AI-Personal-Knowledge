"""Tests for the templates API endpoints."""
import pytest
from fastapi.testclient import TestClient


class TestTemplates:
    """Test suite for templates."""

    def test_list_templates(self, client: TestClient):
        """Test listing all templates."""
        response = client.get("/api/templates")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)

    def test_create_template(self, client: TestClient, sample_template_data):
        """Test creating a new template."""
        response = client.post("/api/templates", json=sample_template_data)
        assert response.status_code == 200
        data = response.json()
        assert data["name"] == sample_template_data["name"]
        assert data["icon"] == sample_template_data["icon"]

    def test_get_template(self, client: TestClient, sample_template_data):
        """Test getting a single template."""
        # Create a template
        create_response = client.post("/api/templates", json=sample_template_data)
        template_id = create_response.json()["id"]
        
        # Get the template
        response = client.get(f"/api/templates/{template_id}")
        assert response.status_code == 200
        data = response.json()
        assert data["id"] == template_id
        assert data["name"] == sample_template_data["name"]

    def test_update_template(self, client: TestClient, sample_template_data):
        """Test updating a template."""
        # Create a template
        create_response = client.post("/api/templates", json=sample_template_data)
        template_id = create_response.json()["id"]
        
        # Update it
        update_data = {
            "name": "Updated Template",
            "content_template": "Updated content",
        }
        response = client.put(f"/api/templates/{template_id}", json=update_data)
        assert response.status_code == 200
        
        # Verify
        get_response = client.get(f"/api/templates/{template_id}")
        data = get_response.json()
        assert data["name"] == "Updated Template"

    def test_delete_template(self, client: TestClient, sample_template_data):
        """Test deleting a template."""
        # Create a template
        create_response = client.post("/api/templates", json=sample_template_data)
        template_id = create_response.json()["id"]
        
        # Delete it
        response = client.delete(f"/api/templates/{template_id}")
        assert response.status_code == 200

    def test_apply_template(self, client: TestClient, sample_template_data):
        """Test applying a template with variable substitution."""
        # Create a template
        create_response = client.post("/api/templates", json=sample_template_data)
        template_id = create_response.json()["id"]
        
        # Apply it
        response = client.post(
            f"/api/templates/{template_id}/apply",
            json={"variables": {"topic": "My Topic"}},
        )
        assert response.status_code == 200
        data = response.json()
        assert "title" in data
        assert "content" in data


class TestTasks:
    """Test suite for tasks."""

    def test_create_task(self, client: TestClient):
        """Test creating a new task."""
        response = client.post("/api/tasks", json={"text": "Test task"})
        assert response.status_code == 200
        data = response.json()
        assert data["text"] == "Test task"
        assert data["is_done"] is False

    def test_list_tasks(self, client: TestClient):
        """Test listing tasks."""
        # Create some tasks
        client.post("/api/tasks", json={"text": "Task 1"})
        client.post("/api/tasks", json={"text": "Task 2"})
        
        response = client.get("/api/tasks")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) >= 2

    def test_update_task(self, client: TestClient):
        """Test updating a task."""
        # Create a task
        create_response = client.post("/api/tasks", json={"text": "Original task"})
        task_id = create_response.json()["id"]
        
        # Update it
        response = client.put(f"/api/tasks/{task_id}", json={
            "text": "Updated task",
            "is_done": True,
        })
        assert response.status_code == 200

    def test_delete_task(self, client: TestClient):
        """Test deleting a task."""
        # Create a task
        create_response = client.post("/api/tasks", json={"text": "Task to delete"})
        task_id = create_response.json()["id"]
        
        # Delete it
        response = client.delete(f"/api/tasks/{task_id}")
        assert response.status_code == 200


class TestCollections:
    """Test suite for collections."""

    def test_create_collection(self, client: TestClient):
        """Test creating a new collection."""
        response = client.post(
            "/api/collections",
            json={"name": "Test Collection", "description": "A test collection"},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["name"] == "Test Collection"

    def test_list_collections(self, client: TestClient):
        """Test listing collections."""
        # Create a collection
        client.post("/api/collections", json={
            "name": "Collection 1",
            "description": "Desc 1",
        })
        
        response = client.get("/api/collections")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) >= 1


class TestHealth:
    """Test suite for health and system endpoints."""

    def test_health_check(self, client: TestClient):
        """Test the health check endpoint."""
        response = client.get("/api/health")
        assert response.status_code == 200

    def test_system_status(self, client: TestClient):
        """Test the system status endpoint."""
        response = client.get("/api/system/status")
        assert response.status_code == 200


class TestReview:
    """Test suite for spaced repetition review."""

    def test_get_due_notes(self, client: TestClient):
        """Test getting notes due for review."""
        response = client.get("/api/review/due")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
