"""Assistant run service: the API the route calls (ADR 018).

Owns the translation between our stored transcript and the LangGraph runtime:

* Rebuilds the model input from the org's stored turns, assigning each message
  the DB id as its LangChain id so the ``add_messages`` reducer replaces rather
  than duplicates on a resumed thread.
* Binds the request-scoped :class:`AgentContext` around the run so tools are
  org-scoped without an ``org_id`` argument.
* Streams a provider-agnostic frame protocol (``delta``, ``thinking``,
  ``tool_start``, ``tool_result``, ``interrupt``, ``done``, ``error``) that the
  route turns into SSE.
"""

from __future__ import annotations

import logging
from collections.abc import AsyncIterator, Sequence

from langchain_core.messages import (
    AIMessage,
    BaseMessage,
    HumanMessage,
    SystemMessage,
    ToolMessage,
)
from langgraph.types import Command
from sqlalchemy.ext.asyncio import AsyncSession

from app.agent.checkpointer import get_checkpointer
from app.agent.context import AgentContext, bind_context, clear_context
from app.agent.graph import build_graph
from app.agent.prompts import build_system_prompt
from app.core.config import settings
from app.core.constants import Role
from app.models.conversation_message import ConversationMessage

logger = logging.getLogger(__name__)

_SYSTEM_ID = "system"
_TOOL_SUMMARY_MAX = 600


def build_messages(system_prompt: str, history: Sequence[ConversationMessage]) -> list[BaseMessage]:
    """Turn stored turns into the model input, newest last.

    Ids are the DB ids (or ``system``) so a checkpointed thread updates in place
    when the same conversation is re-sent, instead of growing a duplicate copy
    of every prior turn.
    """

    messages: list[BaseMessage] = [SystemMessage(content=system_prompt, id=_SYSTEM_ID)]
    for message in history[-settings.assistant_history_limit :]:
        if message.role not in {"user", "assistant"} or not message.content:
            continue
        cls = HumanMessage if message.role == "user" else AIMessage
        messages.append(cls(content=message.content, id=message.id))
    return messages


async def stream_run(
    *,
    session: AsyncSession,
    org_id: str,
    user_id: str,
    role: Role,
    thread_id: str,
    history: Sequence[ConversationMessage],
    resume: dict | None = None,
    script: list[AIMessage] | None = None,
) -> AsyncIterator[dict]:
    """Run one turn (or resume a paused one), yielding frame dicts."""

    checkpointer = await get_checkpointer()
    graph = build_graph(checkpointer=checkpointer, script=script)
    config = {
        "configurable": {"thread_id": thread_id},
        "recursion_limit": settings.assistant_recursion_limit,
    }
    context = AgentContext(org_id=org_id, user_id=user_id, role=role, session=session)
    token = bind_context(context)
    interrupted = False
    try:
        if resume is not None:
            stream = graph.astream(
                Command(resume=resume),
                config,
                stream_mode=["updates", "custom"],
                version="v2",
            )
        else:
            system_prompt = await build_system_prompt(session, org_id=org_id, role=role)
            graph_input = {"messages": build_messages(system_prompt, history), "blocked": False}
            stream = graph.astream(
                graph_input,
                config,
                stream_mode=["updates", "custom"],
                version="v2",
            )

        async for part in stream:
            if part["type"] == "custom":
                yield part["data"]
            else:
                for frame in _frames_from_update(part["data"]):
                    if "interrupt" in frame:
                        interrupted = True
                    yield frame
        if not interrupted:
            yield {"done": True}
    except Exception as exc:  # noqa: BLE001 — the client must always get a terminal frame
        logger.exception("Assistant run failed for thread %s", thread_id)
        yield {"error": f"Assistant failed: {type(exc).__name__}"}
    finally:
        clear_context(token)


def _frames_from_update(data: dict) -> list[dict]:
    """Map a LangGraph update into frames we can show.

    An ``updates`` chunk is ``{node: update}``. We care about: tool calls the
    model asked for (``tool_start``), tool results (``tool_result``), and any
    interrupt raised inside a tool (``interrupt``).
    """

    frames: list[dict] = []
    interrupts = data.get("__interrupt__")
    if interrupts:
        frames.extend({"interrupt": _interrupt_payload(i)} for i in interrupts)

    for node, update in data.items():
        if node == "__interrupt__":
            continue
        if not isinstance(update, dict):
            continue
        node_interrupts = update.get("__interrupt__")
        if node_interrupts:
            frames.extend({"interrupt": _interrupt_payload(i)} for i in node_interrupts)
        # A guardrail refusal never reaches the model node, so it has no custom
        # stream writer to carry it. Emit its text here instead, or the client
        # would show an empty answer.
        if node == "guardrail" and update.get("blocked"):
            for message in update.get("messages") or []:
                if getattr(message, "content", None):
                    frames.append({"delta": str(message.content)})
        for message in update.get("messages") or []:
            if isinstance(message, AIMessage) and message.tool_calls:
                frames.extend(
                    {"tool_start": {"name": call["name"], "args": call["args"]}}
                    for call in message.tool_calls
                )
            elif isinstance(message, ToolMessage):
                frames.append(
                    {
                        "tool_result": {
                            "name": message.name or "tool",
                            "summary": str(message.content)[:_TOOL_SUMMARY_MAX],
                        }
                    }
                )
    return frames


def _interrupt_payload(value: object) -> dict:
    """Normalize a LangGraph ``Interrupt`` into a plain dict for the client."""

    return {
        "id": getattr(value, "id", None),
        "value": getattr(value, "value", value),
    }
