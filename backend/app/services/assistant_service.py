"""Assistant conversations: persistence + prompt assembly.

Two responsibilities:

1. Store threads and turns, always filtered by ``organization_id`` so tenant
   isolation is a column predicate rather than something a caller could forget.
2. Expose the system prompt to the agent. The prompt is identity + policy only
   (see ``app/agent/prompts.py``); org data reaches the model through tools, not
   the prompt (ADR 018).

Every function takes ``session`` first and keyword-only args (house convention)
and never commits — ``get_session`` commits on success.
"""

from __future__ import annotations

import json

from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select

from app.agent.prompts import build_system_prompt as _build_agent_prompt
from app.core.constants import Role
from app.models.base import utcnow
from app.models.conversation import Conversation
from app.models.conversation_message import ConversationMessage

ROLE_USER = "user"
ROLE_ASSISTANT = "assistant"

# Opening prompt becomes the thread title; long prompts get an ellipsis rather
# than a wall of text in the history rail.
_TITLE_MAX = 60


def derive_title(text: str) -> str:
    """A short, single-line title from the opening prompt."""
    clean = " ".join(text.split())
    if not clean:
        return "New chat"
    return clean if len(clean) <= _TITLE_MAX else clean[: _TITLE_MAX - 1].rstrip() + "…"


async def create_conversation(
    session: AsyncSession, *, org_id: str, user_id: str, title: str
) -> Conversation:
    now = utcnow()
    conversation = Conversation(
        organization_id=org_id,
        user_id=user_id,
        title=derive_title(title),
        last_message_at=now,
    )
    session.add(conversation)
    await session.flush()
    return conversation


async def list_conversations(
    session: AsyncSession, *, org_id: str, user_id: str, limit: int = 50
) -> list[Conversation]:
    stmt = (
        select(Conversation)
        .where(
            Conversation.organization_id == org_id,
            Conversation.user_id == user_id,
        )
        .order_by(Conversation.last_message_at.desc())
        .limit(limit)
    )
    return list((await session.execute(stmt)).scalars())


async def get_conversation(
    session: AsyncSession, *, org_id: str, user_id: str, conversation_id: str
) -> Conversation | None:
    """Fetch one thread, scoped to its org *and* owner.

    Returning None (rather than raising) lets the route answer 404 for a
    conversation that exists in another tenant — never 403, which would leak
    that the id is real.
    """

    stmt = select(Conversation).where(
        Conversation.id == conversation_id,
        Conversation.organization_id == org_id,
        Conversation.user_id == user_id,
    )
    return (await session.execute(stmt)).scalars().first()


async def delete_conversation(
    session: AsyncSession, *, org_id: str, user_id: str, conversation_id: str
) -> bool:
    conversation = await get_conversation(
        session, org_id=org_id, user_id=user_id, conversation_id=conversation_id
    )
    if conversation is None:
        return False

    messages = (
        await session.execute(
            select(ConversationMessage).where(
                ConversationMessage.organization_id == org_id,
                ConversationMessage.conversation_id == conversation_id,
            )
        )
    ).scalars()
    for message in messages:
        await session.delete(message)
    await session.delete(conversation)
    return True


async def list_messages(
    session: AsyncSession, *, org_id: str, conversation_id: str
) -> list[ConversationMessage]:
    stmt = (
        select(ConversationMessage)
        .where(
            ConversationMessage.organization_id == org_id,
            ConversationMessage.conversation_id == conversation_id,
        )
        .order_by(ConversationMessage.created_at.asc(), ConversationMessage.id.asc())
    )
    return list((await session.execute(stmt)).scalars())


async def set_message_feedback(
    session: AsyncSession, *, org_id: str, message_id: str, feedback: str | None
) -> ConversationMessage | None:
    """Record a thumbs rating on a message, scoped to the org.

    Returns ``None`` when the id is unknown to this tenant — the caller maps
    that to a 404 so a foreign id is indistinguishable from a missing one.
    """

    message = (
        await session.execute(
            select(ConversationMessage).where(
                ConversationMessage.id == message_id,
                ConversationMessage.organization_id == org_id,
            )
        )
    ).scalar_one_or_none()
    if message is None:
        return None
    message.feedback = feedback
    session.add(message)
    return message


async def append_message(
    session: AsyncSession,
    *,
    org_id: str,
    conversation_id: str,
    role: str,
    content: str,
    model: str | None = None,
    error: str | None = None,
    steps: list[dict] | None = None,
) -> ConversationMessage:
    message = ConversationMessage(
        organization_id=org_id,
        conversation_id=conversation_id,
        role=role,
        content=content,
        model=model,
        error=error,
        steps_json=json.dumps(steps) if steps else None,
    )
    session.add(message)

    # Touch the thread so the history rail re-sorts.
    conversation = await session.get(Conversation, conversation_id)
    if conversation is not None and conversation.organization_id == org_id:
        conversation.last_message_at = utcnow()
        conversation.updated_at = utcnow()
        session.add(conversation)

    await session.flush()
    return message


async def last_message(
    session: AsyncSession, *, org_id: str, conversation_id: str
) -> ConversationMessage | None:
    stmt = (
        select(ConversationMessage)
        .where(
            ConversationMessage.organization_id == org_id,
            ConversationMessage.conversation_id == conversation_id,
        )
        .order_by(ConversationMessage.created_at.desc(), ConversationMessage.id.desc())
        .limit(1)
    )
    return (await session.execute(stmt)).scalars().first()


async def build_system_prompt(
    session: AsyncSession, *, org_id: str, role: Role = Role.OWNER
) -> str:
    """The assistant's system prompt: identity + policy (ADR 018).

    Delegates to the agent layer so there is exactly one prompt definition. Org
    data is not embedded here; tools fetch it.
    """

    return await _build_agent_prompt(session, org_id=org_id, role=role)
