"""Assistant conversations: persistence + grounded prompt assembly.

Two responsibilities:

1. Store threads and turns, always filtered by ``organization_id`` so tenant
   isolation is a column predicate rather than something a caller could forget.
2. Build the system prompt from a snapshot of the org's own data, so the model
   answers "how many active members do we have" with this gym's number instead
   of a generic one.

Every function takes ``session`` first and keyword-only args (house convention)
and never commits — ``get_session`` commits on success.
"""

from __future__ import annotations

from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select

from app.core.config import settings
from app.core.constants import PlanStatus
from app.models.base import utcnow
from app.models.conversation import Conversation
from app.models.conversation_message import ConversationMessage
from app.models.organization import Organization
from app.models.plan import MembershipPlan
from app.services import analytics_service

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


async def append_message(
    session: AsyncSession,
    *,
    org_id: str,
    conversation_id: str,
    role: str,
    content: str,
    model: str | None = None,
    error: str | None = None,
) -> ConversationMessage:
    message = ConversationMessage(
        organization_id=org_id,
        conversation_id=conversation_id,
        role=role,
        content=content,
        model=model,
        error=error,
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


async def build_system_prompt(session: AsyncSession, *, org_id: str) -> str:
    """A snapshot of this org's data, rendered for the model's context.

    Deliberately a snapshot, not a live query interface: the assistant can
    describe what it was handed but cannot go and fetch more. Numbers come from
    the same services the dashboard itself uses, so the two can't disagree.
    """

    org = await session.get(Organization, org_id)
    if org is None:
        return _BASE_INSTRUCTIONS

    metrics = await analytics_service.headline_metrics(session, org_id=org_id)
    plans = (
        await session.execute(
            select(MembershipPlan)
            .where(
                MembershipPlan.organization_id == org_id,
                MembershipPlan.status == PlanStatus.PUBLISHED,
            )
            .order_by(MembershipPlan.price.asc())
        )
    ).scalars()

    lines = [
        _BASE_INSTRUCTIONS,
        "",
        "## Organization",
        f"- Name: {org.name}",
        f"- Industry: {org.industry}",
        f"- Organization code: {org.org_code}",
        f"- Default currency: {org.default_currency}",
        f"- Timezone: {org.timezone}",
        # `.value`, not the enum itself: f-stringing a `str`-mixin Enum yields
        # "GymStatus.OPEN" on modern Python, which reads as noise in a prompt.
        f"- Gym status: {getattr(org.gym_status, 'value', org.gym_status)}",
        "",
        "## Today's metrics",
    ]
    for key, value in metrics.items():
        lines.append(f"- {key}: {value}")

    lines.append("")
    lines.append("## Published plans")
    published = list(plans)
    if published:
        for plan in published:
            cycle = f" per {plan.cycle_unit}" if plan.cycle_unit else ""
            lines.append(f"- {plan.name}: {plan.price} {plan.currency}{cycle}")
    else:
        lines.append("- (none published yet)")

    return "\n".join(lines)


_BASE_INSTRUCTIONS = (
    "You are the operations assistant inside Acron, a gym-management platform. "
    "You are talking to an owner or manager about the organization described "
    "below. Answer using that data. If the data does not cover the question, "
    "say so plainly rather than guessing — never invent a number, member name, "
    "or payment. Be concise and practical; owners are reading this between "
    "other tasks. Amounts are in the organization's default currency."
)


def build_chat_messages(
    system_prompt: str, history: list[ConversationMessage]
) -> list[dict[str, str]]:
    """Assemble the OpenAI-style transcript, newest turns last."""

    messages: list[dict[str, str]] = [{"role": "system", "content": system_prompt}]
    for message in history[-settings.assistant_history_limit :]:
        if message.role not in {ROLE_USER, ROLE_ASSISTANT}:
            continue
        if not message.content:
            continue
        # Failed turns carry an `error`; replay them as opaque text so the model
        # doesn't try to build on an answer that never arrived.
        content = message.content if not message.error else f"(generation failed: {message.error})"
        messages.append({"role": message.role, "content": content})
    return messages
