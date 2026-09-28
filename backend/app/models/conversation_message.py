"""ConversationMessage: one turn (user or assistant) inside a thread.

Carries ``organization_id`` in addition to ``conversation_id`` so the tenant
filter is a plain column predicate on this table too — no join needed to prove
isolation (Security Rule #1).

``error`` is set when generation failed part-way; the partial ``content`` that
did stream is kept so the UI can show what arrived rather than silently losing
the turn.

``steps_json`` stores the turn's reasoning + tool trace (ADR 018) so the
transcript can show the steps that produced an answer after a reload, the way a
chat assistant does. It is a JSON list of step objects; ``NULL`` for a plain
turn that ran no tools.
"""

from __future__ import annotations

from sqlmodel import Field

from app.models.base import TimestampModel, UUIDModel


class ConversationMessage(UUIDModel, TimestampModel, table=True):
    __tablename__ = "conversation_messages"

    organization_id: str = Field(index=True, foreign_key="organizations.id")
    conversation_id: str = Field(index=True, foreign_key="conversations.id")

    # "user" | "assistant" (mirrors the LLM chat roles).
    role: str = Field(index=True)
    content: str = Field(default="")

    model: str | None = Field(default=None)
    error: str | None = Field(default=None)
    steps_json: str | None = Field(default=None)
