"""M0 accept test: every endpoint has a mock JSON that validates against its
pydantic schema, and the app boots.

Run: pytest -q
"""
from __future__ import annotations

import pytest
from fastapi.testclient import TestClient
from pydantic import TypeAdapter

from api.main import app
from api.schemas import MOCK_DIR, MOCK_FILES


@pytest.mark.parametrize("name", sorted(MOCK_FILES))
def test_mock_file_exists(name: str) -> None:
    assert (MOCK_DIR / f"{name}.json").exists(), f"missing mock for {name}"


@pytest.mark.parametrize("name", sorted(MOCK_FILES))
def test_mock_validates(name: str) -> None:
    schema = MOCK_FILES[name]
    data = __import__("json").loads((MOCK_DIR / f"{name}.json").read_text(encoding="utf-8"))
    TypeAdapter(schema).validate_python(data)


def test_health_endpoint() -> None:
    client = TestClient(app)
    resp = client.get("/health")
    assert resp.status_code == 200
    assert resp.json() == {"status": "ok"}
