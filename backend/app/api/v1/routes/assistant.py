"""Assistant routes: conversation CRUD plus SSE streaming and resume (ADR 018).

Every conversation is resolved through a query filtered by ``organization_id``
*and* the calling user. An id from another tenant therefore answers 404, never
403 — a 403 would confirm the id is real (Security Rule #1).

The reply rides Server-Sent Events rather than the realtime WebSocket: WS frames
in this codebase are signals ("refetch"), not payloads, and tokens are payload.
Agent runs that pause for write confirmation resume through ``/resume``.
"""

from __future__ import annotations

import json
import logging
from collections.abc import AsyncIterator

from fastapi import APIRouter, Depends, Header, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.agent import service as agent_service
from app.agent import workflows
from app.api.deps import get_session, require_capability
from app.core.permissions import Capability
from app.core.tenancy import IDEMPOTENCY_HEADER, TenantContext
from app.integrations import llm
from app.models.conversation import Conversation
from app.models.conversation_message import ConversationMessage
from app.models.idempotency_key import IdempotencyKey
from app.schemas.assistant import (
    BriefingOut,
    ConversationCreate,
    ConversationDetailOut,
    ConversationOut,
    FeedbackRequest,
    MessageOut,
    ResumeRequest,
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
_RESUME_ENDPOINT = "POST /assistant/conversations/{id}/resume"

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
    steps = None
    if message.steps_json:
        try:
            steps = json.loads(message.steps_json)
        except (ValueError, TypeError):
            steps = None
    return MessageOut(
        id=message.id,
        role=message.role,
        content=message.content,
        model=message.model,
        error=message.error,
        created_at=message.created_at,
        steps=steps,
        feedback=message.feedback,
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


def _push_thinking(steps: list[dict], text: str) -> None:
    """Merge a reasoning delta into the trailing thinking step (or start one)."""

    if steps and steps[-1].get("type") == "thinking":
        steps[-1]["text"] += text
    else:
        steps.append({"type": "thinking", "text": text})


def _finish_tool(steps: list[dict], result: dict) -> None:
    """Attach a tool result to the newest unfinished tool step."""

    for step in reversed(steps):
        if step.get("type") == "tool" and not step.get("done"):
            step["done"] = True
            step["summary"] = result.get("summary")
            return
    steps.append(
        {
            "type": "tool",
            "name": result.get("name", "tool"),
            "summary": result.get("summary"),
            "done": True,
        }
    )


def _save_agent(steps: list[dict], event: dict) -> None:
    """Open or settle one agent row in the swarm tree (ADR 019).

    Keyed by ``id`` rather than by position, unlike ``_finish_tool``: tools run
    one at a time so the newest unfinished step is always the one that just
    finished, but the swarm's agents run concurrently and settle out of order.
    Position would attribute a finding to whichever agent happened to start
    last, which is worse than showing nothing.
    """

    agent_id = event.get("id")
    if not agent_id:
        return
    for step in steps:
        if step.get("type") == "agent" and step.get("id") == agent_id:
            step.update(event)
            return
    steps.append({"type": "agent", **event})


def _save_swarm_stats(steps: list[dict], event: dict) -> None:
    """Record what the swarm turn cost, as one step for the whole turn.

    Replaces rather than appends on a repeat, so a resumed turn (an approval
    interrupt on the direct path, a retried stream) cannot accumulate two
    conflicting sets of numbers in one panel.
    """

    for step in steps:
        if step.get("type") == "swarm":
            step.update(event)
            return
    steps.append({"type": "swarm", **event})


def _replay_response(payload: dict) -> StreamingResponse:
    """Re-emit an already-stored answer as a one-shot SSE stream.

    Keeps a single response shape for the client: this endpoint always answers
    with SSE, whether the text came from the model a moment ago or from the
    database, so the frontend never needs a second code path.
    """

    async def _frames() -> AsyncIterator[str]:
        if payload.get("interrupt"):
            yield _sse({"interrupt": payload["interrupt"], "awaiting_approval": True})
        elif payload.get("content"):
            yield _sse({"delta": payload["content"]})
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


@router.post("/messages/{message_id}/feedback", response_model=MessageOut)
async def set_message_feedback(
    message_id: str,
    data: FeedbackRequest,
    ctx: TenantContext = Depends(require_capability(Capability.USE_ASSISTANT)),
    session: AsyncSession = Depends(get_session),
):
    """Record (or clear) a thumbs rating on a message.

    Feedback is for product improvement only: it is stored on the message and
    never re-enters the conversation. An id from another tenant answers 404.
    """

    message = await assistant.set_message_feedback(
        session, org_id=ctx.org_id, message_id=message_id, feedback=data.feedback
    )
    if message is None:
        raise HTTPException(status_code=404, detail="Message not found.")
    return _message_out(message)


@router.post("/briefing", response_model=BriefingOut)
async def weekly_briefing(
    ctx: TenantContext = Depends(require_capability(Capability.USE_ASSISTANT)),
    session: AsyncSession = Depends(get_session),
):
    """Narrate the org's numbers as a short briefing (ADR 018).

    A workflow, not the agent: the data fetch is fixed and only the summary is
    model-driven, so it is one model call with no tools and nothing to decide.
    """

    briefing = await workflows.weekly_briefing(session, org_id=ctx.org_id, role=ctx.role)
    return BriefingOut(briefing=briefing)


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
    """Answer the conversation, streaming frames as they are produced.

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

    # `get_session` stays open for the whole body: FastAPI closes request-scoped
    # dependencies only after the response has been sent, so the generator and
    # its tools can write through the same session the route used.
    return StreamingResponse(
        _generate(
            session=session,
            conversation=conversation,
            ctx=ctx,
            history=history,
            claim_id=claim.record.id if claim is not None else None,
        ),
        media_type="text/event-stream",
        headers=_STREAM_HEADERS,
    )


@router.post("/conversations/{conversation_id}/resume")
async def resume_reply(
    conversation_id: str,
    data: ResumeRequest,
    idempotency_key: str = Header(default="", alias=IDEMPOTENCY_HEADER),
    ctx: TenantContext = Depends(require_capability(Capability.USE_ASSISTANT)),
    session: AsyncSession = Depends(get_session),
):
    """Resume a run paused at a write confirmation (ADR 018).

    ``data.resume`` becomes the return value of the tool's ``interrupt()`` — for
    our tools, ``{"approved": true|false}``. The thread id is the conversation
    id, so this resumes the exact checkpoint the interrupt saved.
    """

    conversation = await assistant.get_conversation(
        session, org_id=ctx.org_id, user_id=ctx.user_id, conversation_id=conversation_id
    )
    if conversation is None:
        raise HTTPException(status_code=404, detail="Conversation not found.")

    claim: idempotency_service.ClaimResult | None = None
    if idempotency_key:
        claim = await idempotency_service.claim(
            session,
            key=idempotency_key,
            endpoint=_RESUME_ENDPOINT,
            body={"conversation_id": conversation_id, "resume": data.resume},
            organization_id=ctx.org_id,
            user_id=ctx.user_id,
        )
        if not claim.claimed:
            return _replay_response(_replay(claim))

    history = await assistant.list_messages(
        session, org_id=ctx.org_id, conversation_id=conversation_id
    )
    return StreamingResponse(
        _generate(
            session=session,
            conversation=conversation,
            ctx=ctx,
            history=history,
            claim_id=claim.record.id if claim is not None else None,
            resume=data.resume,
        ),
        media_type="text/event-stream",
        headers=_STREAM_HEADERS,
    )


async def _generate(
    *,
    session: AsyncSession,
    conversation: Conversation,
    ctx: TenantContext,
    history: list[ConversationMessage],
    claim_id: str | None,
    resume: dict | None = None,
) -> AsyncIterator[str]:
    """Stream frames from the agent run, then persist — unless it paused.

    The `finally` is what makes an abandoned answer safe: closing the tab closes
    this generator at a `yield`, and without it the partial text and the
    idempotency row would be left stranded.
    """

    collected: list[str] = []
    steps: list[dict] = []
    error: str | None = None
    interrupted: dict | None = None
    message_id: str | None = None
    cancelled = False

    try:
        async for frame in agent_service.stream_run(
            session=session,
            org_id=ctx.org_id,
            user_id=ctx.user_id,
            role=ctx.role,
            thread_id=conversation.id,
            history=history,
            resume=resume,
        ):
            if "delta" in frame:
                collected.append(frame["delta"])
                yield _sse({"delta": frame["delta"]})
            elif "thinking" in frame:
                _push_thinking(steps, frame["thinking"])
                yield _sse({"thinking": frame["thinking"]})
            elif "tool_start" in frame:
                steps.append(
                    {
                        "type": "tool",
                        "name": frame["tool_start"]["name"],
                        "args": frame["tool_start"]["args"],
                        "done": False,
                    }
                )
                yield _sse(frame)
            elif "tool_result" in frame:
                _finish_tool(steps, frame["tool_result"])
                yield _sse(frame)
            elif "agent_start" in frame:
                _save_agent(steps, dict(frame["agent_start"]))
                yield _sse(frame)
            elif "agent_done" in frame:
                _save_agent(steps, dict(frame["agent_done"]))
                yield _sse(frame)
            elif "swarm_stats" in frame:
                _save_swarm_stats(steps, dict(frame["swarm_stats"]))
                yield _sse(frame)
            elif "interrupt" in frame:
                interrupted = frame["interrupt"]
                yield _sse({"interrupt": interrupted, "awaiting_approval": True})
            elif "error" in frame:
                error = frame["error"]
    except GeneratorExit:
        # The client walked away mid-answer; persist what was said.
        cancelled = True
        raise
    except Exception as exc:  # noqa: BLE001
        logger.exception("Assistant stream failed for %s", conversation.id)
        error = f"Unexpected assistant failure: {type(exc).__name__}"

    finally:
        if interrupted is None and not cancelled:
            try:
                message_id = await _persist(
                    session,
                    conversation=conversation,
                    ctx=ctx,
                    content="".join(collected),
                    steps=steps,
                    error=error,
                    claim_id=claim_id,
                )
            except Exception:  # noqa: BLE001 — never let a write failure break the stream
                logger.exception("Could not persist the assistant reply for %s", conversation.id)
                message_id = None
        else:
            message_id = None
            if interrupted is not None:
                await _settle_interrupt(session, claim_id=claim_id, conversation=conversation, interrupt=interrupted)

    if cancelled or interrupted is not None:
        return
    if error:
        yield _sse({"error": error})
    else:
        yield _sse({"done": True, "message_id": message_id, "title": conversation.title})


async def _persist(
    session: AsyncSession,
    *,
    conversation: Conversation,
    ctx: TenantContext,
    content: str,
    steps: list[dict] | None,
    error: str | None,
    claim_id: str | None,
) -> str:
    """Store the assistant turn and settle its idempotency record.

    Commits immediately rather than leaving it to the dependency's teardown: if
    the client disconnects, teardown rolls back, and an answer the user already
    watched arrive would vanish from the transcript.
    """

    message = await assistant.append_message(
        session,
        org_id=ctx.org_id,
        conversation_id=conversation.id,
        role=assistant.ROLE_ASSISTANT,
        content=content,
        model=llm.active_model_label(),
        error=error,
        steps=steps or None,
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
                        "title": conversation.title,
                        "content": content,
                        "error": error,
                    }
                ),
            )
    await session.commit()
    return message.id


async def _settle_interrupt(
    session: AsyncSession,
    *,
    claim_id: str | None,
    conversation: Conversation,
    interrupt: dict,
) -> None:
    """Settle the idempotency record for a run that paused for confirmation.

    No assistant turn is stored: the run has not produced an answer yet. Caching
    the interrupt means a replay with the same key re-shows the confirmation
    instead of starting a second run.
    """

    if not claim_id:
        return
    record = await session.get(IdempotencyKey, claim_id)
    if record is None:
        return
    await idempotency_service.complete(
        session,
        record,
        code=200,
        body=json.dumps({"title": conversation.title, "interrupt": interrupt}),
    )
    await session.commit()
