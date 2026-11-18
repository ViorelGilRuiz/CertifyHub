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


def test_inventory_is_optional_and_validated(client):
    metrics = {
        "windows_build": "26100",
        "logical_processors": 8,
        "memory_bytes": 16 * 2**30,
        "system_disk_free_bytes": 42 * 2**30,
    }
    assert client.post("/diagnostics", json=metrics).json()["metrics"]["inventory"] is None

    inventory = {
        "cpu": "Procesador de prueba",
        "architecture": "x64",
        "secure_boot": False,
        "modules": [{"capacity": 16 * 2**30}],
        "update_status": "complete",
        "update_count": 1,
        "pending_updates": [{"title": "Actualización de prueba", "kb": "KB1234567"}],
    }
    response = client.post("/diagnostics", json={**metrics, "inventory": inventory})
    assert response.status_code == 201
    saved = client.get("/diagnostics/latest").json()["metrics"]["inventory"]
    assert saved["secure_boot"] is False
    assert saved["pending_updates"][0]["kb"] == "KB1234567"
    assert client.post(
        "/diagnostics", json={**metrics, "inventory": {**inventory, "serial_number": "example"}}
    ).status_code == 422
