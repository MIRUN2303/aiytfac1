import pytest
from httpx import AsyncClient, ASGITransport
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(__file__))))


@pytest.fixture
def app():
    from main import app
    return app


@pytest.fixture
def client(app):
    return AsyncClient(transport=ASGITransport(app=app), base_url="http://test")


@pytest.mark.asyncio
async def test_read_root(client):
    response = await client.get("/")
    assert response.status_code == 200
    data = response.json()
    assert "message" in data
    assert "Welcome" in data["message"]


@pytest.mark.asyncio
async def test_health(client):
    response = await client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert "status" in data


@pytest.mark.asyncio
async def test_create_project(client):
    response = await client.post(
        "/projects/",
        json={
            "topic": "Test Topic",
            "summary": "A test summary",
            "language": "en",
            "target_audience": "general",
            "duration": "medium",
            "voice_style": "neutral",
            "story_style": "narrative",
        },
    )
    assert response.status_code == 200
    data = response.json()
    assert data["topic"] == "Test Topic"
    assert "id" in data
    return data["id"]


@pytest.mark.asyncio
async def test_get_projects(client):
    response = await client.get("/projects/")
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)


@pytest.mark.asyncio
async def test_get_single_project(client):
    pid = await test_create_project(client)
    response = await client.get(f"/projects/{pid}")
    assert response.status_code == 200
    data = response.json()
    assert data["id"] == pid


@pytest.mark.asyncio
async def test_update_project(client):
    pid = await test_create_project(client)
    response = await client.patch(
        f"/projects/{pid}",
        json={"language": "es", "duration": "short"},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["language"] == "es"
    assert data["duration"] == "short"


@pytest.mark.asyncio
async def test_cancel_project(client):
    pid = await test_create_project(client)
    response = await client.post(f"/projects/{pid}/cancel")
    assert response.status_code in (200, 400)


@pytest.mark.asyncio
async def test_archive_project(client):
    pid = await test_create_project(client)
    response = await client.post(f"/projects/{pid}/archive")
    assert response.status_code == 200


@pytest.mark.asyncio
async def test_get_settings(client):
    response = await client.get("/settings/")
    assert response.status_code == 200
    data = response.json()
    assert "pollinations_endpoint" in data


@pytest.mark.asyncio
async def test_get_queue_status(client):
    response = await client.get("/queue/")
    assert response.status_code == 200
    data = response.json()
    assert "queue_size" in data


@pytest.mark.asyncio
async def test_get_system_status(client):
    response = await client.get("/system/status")
    assert response.status_code == 200
    data = response.json()
    assert "health" in data


@pytest.mark.asyncio
async def test_get_system_stats(client):
    response = await client.get("/system/stats")
    assert response.status_code == 200
    data = response.json()
    assert "cpu" in data


@pytest.mark.asyncio
async def test_delete_project(client):
    pid = await test_create_project(client)
    response = await client.delete(f"/projects/{pid}")
    assert response.status_code == 200


@pytest.mark.asyncio
async def test_project_not_found(client):
    response = await client.get("/projects/99999")
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_duplicate_project(client):
    pid = await test_create_project(client)
    response = await client.post(f"/projects/{pid}/duplicate")
    assert response.status_code == 200
    data = response.json()
    assert data["topic"] == "Test Topic"


@pytest.mark.asyncio
async def test_get_project_files(client):
    pid = await test_create_project(client)
    response = await client.get(f"/projects/{pid}/files")
    assert response.status_code == 200
    data = response.json()
    assert "files" in data
