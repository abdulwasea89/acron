"""Assistant conversation schemas (grounded chat over the org's own data).

Mirrors the ``*Out`` convention used across ``app/schemas``: flat snake_case
fields, explicit mappers in the route module, no ``from_attributes``.
"""

from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, Field

# A prompt longer than this is almost certainly a paste accident, and every
# character rides into the model's context window on each turn.
PROMPT_MAX = 8000


class ConversationCreate(BaseModel):
    """Opening prompt — becomes both the first user turn and the thread title."""

    content: str = Field(min_length=1, max_length=PROMPT_MAX)


class StreamRequest(BaseModel):
    """Either a new turn to append, or (``content`` omitted) a request to answer
    whatever the trailing user turn already is.

    The second form is what the session page sends on load, so navigating to a
    freshly created conversation starts its reply without re-sending the prompt.
    """

    content: str | None = Field(default=None, max_length=PROMPT_MAX)


class MessageOut(BaseModel):
    id: str
    role: str
    content: str
    model: str | None = None
    error: str | None = None
    created_at: datetime


class ConversationOut(BaseModel):
    id: str
    title: str
    last_message_at: datetime
    created_at: datetime


class ConversationDetailOut(ConversationOut):
    messages: list[MessageOut]
