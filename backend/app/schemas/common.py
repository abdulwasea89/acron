"""Shared response schemas."""

from __future__ import annotations

from pydantic import BaseModel


class Message(BaseModel):
    message: str


class TokenPair(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    organization_id: str | None = None
    role: str | None = None
