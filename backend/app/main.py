"""FastAPI application entrypoint for the Gym Operations Platform backend.

Wires configuration, the database lifespan, and the versioned API router. On
startup it ensures tables exist (via ``init_db``) so the app runs out-of-the-box
with the default SQLite database; in production Alembic migrations manage schema.
"""

from __future__ import annotations

from contextlib import asynccontextmanager

import logging

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api.v1.router import api_router
from app.core.config import settings
from app.db.session import engine, init_db



@asynccontextmanager    
async def lifespan(app: FastAPI):
    # Create tables for local/dev SQLite so the app is runnable immediately.
    if settings.is_sqlite:
        await init_db()
    yield
    await engine.dispose()


app = FastAPI(
    title=settings.app_name,
    version="0.1.0",
    lifespan=lifespan,
    debug=settings.debug,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router, prefix=settings.api_v1_prefix)


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """Return clean JSON for unhandled errors — traceback goes to terminal only."""
    logging.exception("Unhandled exception")
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error"},
    )


@app.get("/health", tags=["health"])
async def health() -> dict[str, str]:
    return {"status": "ok", "app": settings.app_name, "env": settings.app_env}
