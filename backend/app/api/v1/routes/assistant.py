"""Assistant routes: conversation CRUD plus SSE streaming replies.

Every conversation is resolved through a query filtered by ``organization_id``
*and* the calling user. An id from another tenant therefore answers 404, never
403 — a 403 would confirm the id is real (Security Rule #1).

The reply rides Server-Sent Events rather than the realtime WebSocket: WS frames
in this codebase are signals ("refetch"), not payloads, and tokens are payload.
"""

from __future__ import annotations

import json
import logging
from collections.abc import AsyncIterator

from fastapi import APIRouter, Depends, Header, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_session, require_capability
from app.core.permissions import Capability
from app.core.tenancy import IDEMPOTENCY_HEADER, TenantContext
from app.integrations import llm
from app.models.conversation import Conversation
from app.models.conversation_message import ConversationMessage
from app.models.idempotency_key import IdempotencyKey
from app.schemas.assistant import (
    ConversationCreate,
    ConversationDetailOut,
    ConversationOut,
    MessageOut,
    StreamRequest,
)
from app.schemas.common import Message
from app.services import assistant_service as assistant
from app.services import idempotency_service

logger = logging.getLogger(__name__)

router = APIRouter()

# Idempotency namespaces. Full paths, matching the style of other services.
_CREATE_ENDPOINT = "POST /assistant/conversations"
_STREAM_ENDPOINT = "POST /assistant/conversations/{id}/stream"

# `X-Accel-Buffering: no` stops nginx from collecting the stream into one lump
# before forwarding it, which would defeat the whole point of streaming.
_STREAM_HEADERS = {
    "Cache-Control": "no-cache",
    "X-Accel-Buffering": "no",
}


# --------------------------------------------------------------------------- #
# Mappers (explicit, matching the rest of app/api/v1/routes)
# --------------------------------------------------------------------------- #


def _message_out(message: ConversationMessage) -> MessageOut:
    return MessageOut(
        id=message.id,
        role=message.role,
        content=message.content,
        model=message.model,
        error=message.error,
        created_at=message.created_at,
    )


def _conversation_out(conversation: Conversation) -> ConversationOut:
    return ConversationOut(
        id=conversation.id,
        title=conversation.title,
        last_message_at=conversation.last_message_at,
        created_at=conversation.created_at,
    )


def _detail_out(
    conversation: Conversation, messages: list[ConversationMessage]
) -> ConversationDetailOut:
    return ConversationDetailOut(
        **_conversation_out(conversation).model_dump(),
        messages=[_message_out(m) for m in messages],
    )


def _sse(payload: dict) -> str:
    """One Server-Sent Events frame. ``data:`` only — we control both ends."""

    return f"data: {json.dumps(payload)}\n\n"


def _replay_response(payload: dict) -> StreamingResponse:
    """Re-emit an already-stored answer as a one-shot SSE stream.

    Keeps a single response shape for the client: this endpoint always answers
    with SSE, whether the text came from the model a moment ago or from the
    database, so the frontend never needs a second code path.
    """

    async def _frames() -> AsyncIterator[str]:
        content = payload.get("content") or ""
        if content:
            yield _sse({"delta": content})
        yield _sse(
            {
                "done": True,
                "message_id": payload.get("message_id"),
                "title": payload.get("title"),
            }
        )

    return StreamingResponse(_frames(), media_type="text/event-stream", headers=_STREAM_HEADERS)


def _replay(claim: idempotency_service.ClaimResult) -> dict:
    """The cached outcome of a replayed request, or its cached error re-raised."""

    code = claim.cached_code or 200
    body = claim.cached_response
    if code >= 400:
        detail = "Request failed."
        if body:
            try:
                detail = json.loads(body).get("detail") or detail
            except (ValueError, TypeError, AttributeError):
                pass
        raise HTTPException(status_code=code, detail=detail)

    if not body:
        raise HTTPException(status_code=409, detail="Request already in progress.")
    try:
        return json.loads(body)
    except (ValueError, TypeError) as exc:
        raise HTTPException(status_code=409, detail="Request already in progress.") from exc


# --------------------------------------------------------------------------- #
# Conversation CRUD
# --------------------------------------------------------------------------- #


@router.get("/conversations", response_model=list[ConversationOut])
async def list_conversations(
    ctx: TenantContext = Depends(require_capability(Capability.USE_ASSISTANT)),
    session: AsyncSession = Depends(get_session),
):
    rows = await assistant.list_conversations(
        session, org_id=ctx.org_id, user_id=ctx.user_id
    )
    return [_conversation_out(c) for c in rows]


@router.post("/conversations", response_model=ConversationDetailOut, status_code=201)
async def create_conversation(
    data: ConversationCreate,
    idempotency_key: str = Header(default="", alias=IDEMPOTENCY_HEADER),
    ctx: TenantContext = Depends(require_capability(Capability.USE_ASSISTANT)),
    session: AsyncSession = Depends(get_session),
):
    """Open a thread and record the opening prompt.

    Idempotent (Security Rule #2): a double-tapped send returns the same
    conversation rather than opening a second one, which is the behaviour the
    client needs when a tap is retried after a lost response.
    """

    claim = await idempotency_service.claim(
        session,
        key=idempotency_key,
        endpoint=_CREATE_ENDPOINT,
        body={"content": data.content},
        organization_id=ctx.org_id,
        user_id=ctx.user_id,
    )
    if not claim.claimed:
        return _replay(claim)

    conversation = await assistant.create_conversation(
        session, org_id=ctx.org_id, user_id=ctx.user_id, title=data.content
    )
    await assistant.append_message(
        session,
        org_id=ctx.org_id,
        conversation_id=conversation.id,
        role=assistant.ROLE_USER,
        content=data.content,
    )
    messages = await assistant.list_messages(
        session, org_id=ctx.org_id, conversation_id=conversation.id
    )
    detail = _detail_out(conversation, messages)
    await idempotency_service.complete(
        session, claim.record, code=201, body=detail.model_dump_json()
    )
    return detail


@router.get("/conversations/{conversation_id}", response_model=ConversationDetailOut)
async def get_conversation(
    conversation_id: str,
    ctx: TenantContext = Depends(require_capability(Capability.USE_ASSISTANT)),
    session: AsyncSession = Depends(get_session),
):
    conversation = await assistant.get_conversation(
        session, org_id=ctx.org_id, user_id=ctx.user_id, conversation_id=conversation_id
    )
    if conversation is None:
        raise HTTPException(status_code=404, detail="Conversation not found.")
    messages = await assistant.list_messages(
        session, org_id=ctx.org_id, conversation_id=conversation_id
    )
    return _detail_out(conversation, messages)


@router.delete("/conversations/{conversation_id}", response_model=Message)
async def delete_conversation(
    conversation_id: str,
    ctx: TenantContext = Depends(require_capability(Capability.USE_ASSISTANT)),
    session: AsyncSession = Depends(get_session),
):
    deleted = await assistant.delete_conversation(
        session, org_id=ctx.org_id, user_id=ctx.user_id, conversation_id=conversation_id
    )
    if not deleted:
        raise HTTPException(status_code=404, detail="Conversation not found.")
    return Message(message="Conversation deleted.")


# --------------------------------------------------------------------------- #
# Streaming reply
# --------------------------------------------------------------------------- #


@router.post("/conversations/{conversation_id}/stream")
async def stream_reply(
    conversation_id: str,
    data: StreamRequest,
    idempotency_key: str = Header(default="", alias=IDEMPOTENCY_HEADER),
    ctx: TenantContext = Depends(require_capability(Capability.USE_ASSISTANT)),
    session: AsyncSession = Depends(get_session),
):
    """Answer the conversation, streaming tokens as they are produced.

    Two entry points, one shape:

    * ``content`` supplied — appended as a new user turn, then answered. This is
      the composer sending a message.
    * ``content`` omitted — answers whatever the trailing user turn already is,
      which is what the session page sends on load so a conversation created on
      the dashboard starts replying without the prompt being sent twice.
    """

    conversation = await assistant.get_conversation(
        session, org_id=ctx.org_id, user_id=ctx.user_id, conversation_id=conversation_id
    )
    if conversation is None:
        raise HTTPException(status_code=404, detail="Conversation not found.")

    claim: idempotency_service.ClaimResult | None = None
    if data.content:
        if idempotency_key:
            claim = await idempotency_service.claim(
                session,
                key=idempotency_key,
                endpoint=_STREAM_ENDPOINT,
                body={"conversation_id": conversation_id, "content": data.content},
                organization_id=ctx.org_id,
                user_id=ctx.user_id,
            )
            if not claim.claimed:
                return _replay_response(_replay(claim))
        await assistant.append_message(
            session,
            org_id=ctx.org_id,
            conversation_id=conversation_id,
            role=assistant.ROLE_USER,
            content=data.content,
        )

    history = await assistant.list_messages(
        session, org_id=ctx.org_id, conversation_id=conversation_id
    )
    if not history:
        raise HTTPException(status_code=409, detail="Nothing to answer.")

    trailing = history[-1]
    if trailing.role != assistant.ROLE_USER:
        # Already answered — a reload after the reply landed, or a second tab
        # arriving late. Replay the stored answer instead of paying for another
        # generation. This is what makes "at most one reply per question" hold
        # without depending on an idempotency key being present.
        return _replay_response(
            {
                "message_id": trailing.id,
                "title": conversation.title,
                "content": trailing.content,
            }
        )

    system_prompt = await assistant.build_system_prompt(session, org_id=ctx.org_id)
    chat_messages = assistant.build_chat_messages(system_prompt, history)

    # `get_session` stays open for the whole body: FastAPI closes request-scoped
    # dependencies only after the response has been sent, so the generator can
    # write through the same session the route used.
    return StreamingResponse(
        _generate(
            session=session,
            conversation_id=conversation_id,
            org_id=ctx.org_id,
            title=conversation.title,
            chat_messages=chat_messages,
            claim_id=claim.record.id if claim is not None else None,
        ),
        media_type="text/event-stream",
        headers=_STREAM_HEADERS,
    )


async def _generate(
    *,
    session: AsyncSession,
    conversation_id: str,
    org_id: str,
    title: str,
    chat_messages: list[dict[str, str]],
    claim_id: str | None,
) -> AsyncIterator[str]:
    """Stream the reply, then persist it — even if the client walks away.

    The `finally` is what makes an abandoned answer safe: closing the tab closes
    this generator at a `yield`, and without it the partial text and the
    idempotency row would be left stranded.
    """

    collected: list[str] = []
    error: str | None = None
    message_id: str | None = None

    try:
        try:
            async for delta in llm.stream_completion(chat_messages):
                if delta.kind == "reasoning":
                    # Forwarded but never persisted: the trace is a progress
                    # signal, not the answer. Reasoning models can spend longer
                    # thinking than answering, so without this the reader stares
                    # at a spinner through the longest part of the wait.
                    yield _sse({"thinking": delta.text})
                    continue
                collected.append(delta.text)
                yield _sse({"delta": delta.text})
        except llm.LLMError as exc:
            error = str(exc)
        except Exception as exc:  # noqa: BLE001 — the client must always get a terminal frame
            logger.exception("Assistant generation failed for %s", conversation_id)
            error = f"Unexpected assistant failure: {type(exc).__name__}"
    finally:
        try:
            message_id = await _persist(
                session,
                conversation_id=conversation_id,
                org_id=org_id,
                content="".join(collected),
                error=error,
                claim_id=claim_id,
                title=title,
            )
        except Exception:  # noqa: BLE001 — never let a write failure break the stream
            logger.exception("Could not persist the assistant reply for %s", conversation_id)

    if error:
        yield _sse({"error": error})
    else:
        yield _sse({"done": True, "message_id": message_id, "title": title})


async def _persist(
    session: AsyncSession,
    *,
    conversation_id: str,
    org_id: str,
    content: str,
    error: str | None,
    claim_id: str | None,
    title: str,
) -> str:
    """Store the assistant turn and settle its idempotency record.

    Commits immediately rather than leaving it to the dependency's teardown: if
    the client disconnects, teardown rolls back, and an answer the user already
    watched arrive would vanish from the transcript.

    A provider failure still *completes* the request — the turn was stored and
    the client was told — so replaying it returns that outcome rather than
    re-billing the model for an answer already known to have failed.
    """

    message = await assistant.append_message(
        session,
        org_id=org_id,
        conversation_id=conversation_id,
        role=assistant.ROLE_ASSISTANT,
        content=content,
        model=llm.active_model_label(),
        error=error,
    )
    if claim_id:
        record = await session.get(IdempotencyKey, claim_id)
        if record is not None:
            await idempotency_service.complete(
                session,
                record,
                code=200,
                body=json.dumps(
                    {
                        "message_id": message.id,
                        "title": title,
                        "content": content,
                        "error": error,
                    }
                ),
            )
    await session.commit()
    return message.id
