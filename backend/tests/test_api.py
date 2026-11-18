import os

import psycopg
import pytest
from fastapi.testclient import TestClient

from app import storage
from app.main import app


@pytest.fixture
def client():
    assert os.environ["PGDATABASE"] == "certifyhub_test"
    with TestClient(app) as client:
        with psycopg.connect() as connection:
            connection.execute("TRUNCATE diagnostics")
        yield client


def test_save_and_retrieve(client):
    assert client.get("/health").json() == {"status": "ok"}
    assert client.get("/diagnostics/latest").json() is None

    metrics = {
        "windows_build": "26100",
        "logical_processors": 8,
        "memory_bytes": 16 * 2**30,
        "system_disk_free_bytes": 42 * 2**30,
    }
    first = client.post("/diagnostics", json=metrics)
    assert first.status_code == 201
    second = client.post("/diagnostics", json={**metrics, "logical_processors": 12})
    assert second.status_code == 201
    assert second.json()["id"] > first.json()["id"]
    assert second.json()["received_at"]
    assert client.get("/diagnostics/latest").json() == second.json()


@pytest.mark.parametrize("change", [
    {"logical_processors": "8"},
    {"system_disk_free_bytes": -1},
    {"windows_build": "bad"},
    {"unexpected": True},
])
def test_reject_invalid_report(client, change):
    metrics = {
        "windows_build": "26100",
        "logical_processors": 8,
        "memory_bytes": 1024,
        "system_disk_free_bytes": 1024,
    }
    assert client.post("/diagnostics", json={**metrics, **change}).status_code == 422
    assert client.get("/diagnostics/latest").json() is None


def test_database_unavailable(monkeypatch):
    def unavailable():
        raise psycopg.OperationalError()

    monkeypatch.setattr(storage, "latest", unavailable)
    assert TestClient(app).get("/health").status_code == 503
