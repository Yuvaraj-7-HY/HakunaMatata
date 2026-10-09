"""FastAPI app. M0 exposes only /health; real endpoints arrive in M6.

The pydantic response shapes in api/schemas.py are already fixed and are
exercised by the mock JSON + tests, so the frontend can be built in parallel.
"""
from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="Predictive Maintenance API", version="0.0.1")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health() -> dict:
    return {"status": "ok"}
