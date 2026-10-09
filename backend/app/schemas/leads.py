"""API schemas for gym sales leads."""

from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class LeadCreate(BaseModel):
    name: str = Field(min_length=1, max_length=160)
    email: str | None = Field(default=None, max_length=320)
    phone: str | None = Field(default=None, max_length=40)
    goal: str | None = Field(default=None, max_length=2000)
    budget: str | None = Field(default=None, max_length=200)
    preferred_times: str | None = Field(default=None, max_length=500)
    preferences: str | None = Field(default=None, max_length=2000)
    source: str = Field(default="staff_entered", max_length=40)


class LeadUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=160)
    email: str | None = Field(default=None, max_length=320)
    phone: str | None = Field(default=None, max_length=40)
    goal: str | None = Field(default=None, max_length=2000)
    budget: str | None = Field(default=None, max_length=200)
    preferred_times: str | None = Field(default=None, max_length=500)
    preferences: str | None = Field(default=None, max_length=2000)
    stage: str | None = Field(default=None, pattern="^(new|contacted|trial_booked|visited|joined|lost)$")


class LeadOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    email: str | None
    phone: str | None
    goal: str | None
    budget: str | None
    preferred_times: str | None
    preferences: str | None
    source: str
    stage: str
    profile_sources: dict[str, str]
    created_at: datetime
    updated_at: datetime
