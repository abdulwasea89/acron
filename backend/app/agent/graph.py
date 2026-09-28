"""Assemble the assistant graph (ADR 018).

Shape: ``START → guardrail → (blocked? END : model) → (tool_calls? tools : END)``,
with ``tools → model`` closing the loop. The model node streams tokens and
reasoning to the client as it accumulates the message; tool execution pauses
inside the tool on ``interrupt()`` for writes, which the service surfaces.
"""

from __future__ import annotations

from collections.abc import Sequence
from typing import Any

from langchain_core.messages import AIMessage
from langgraph.config import get_stream_writer
from langgraph.graph import END, START, StateGraph
from langgraph.prebuilt import ToolNode

from app.agent.guardrails import input_guardrail
from app.agent.model import build_chat_model
from app.agent.state import AgentState
from app.agent.tools import ALL_TOOLS


def _stream_writer() -> Any:
    """The custom-mode writer, or a no-op when the run is not streaming custom."""

    try:
        return get_stream_writer()
    except Exception:  # noqa: BLE001 — outside a streaming run there is no writer
        return lambda _payload: None


def _reasoning(chunk: Any) -> str | None:
    """Reasoning text from a chunk, across the keys providers use.

    gpt-oss emits a reasoning trace before its answer; forwarding it keeps the
    UI alive during the longest part of the wait.
    """

    extra = getattr(chunk, "additional_kwargs", None) or {}
    return extra.get("reasoning_content") or extra.get("reasoning")


def _sanitize(messages: list[Any]) -> list[Any]:
    """Guarantee no ``role:tool`` message reaches the provider with blank content.

    A tool that returns an empty value yields a ToolMessage whose content is
    empty — or, worse, ``[]`` — which providers reject as invalid ("must be a
    string or at least one item"). Tools now return JSON strings, but a blank
    output must never take the whole run down, so the boundary is guarded here.
    """

    clean: list[Any] = []
    for message in messages:
        if getattr(message, "type", None) == "tool" and not getattr(message, "content", None):
            message = message.model_copy(update={"content": "(no output)"})
        clean.append(message)
    return clean


def build_graph(*, checkpointer: Any, script: Sequence[AIMessage] | None = None) -> Any:
    """Compile the assistant graph for one run.

    ``script`` is a test seam forwarded to the model factory (see
    ``app.agent.model``). The graph is rebuilt per run so a test can swap the
    model; compilation is cheap and the checkpointer is shared.
    """

    model = build_chat_model(script=script).bind_tools(ALL_TOOLS)
    tools_node = ToolNode(ALL_TOOLS)

    async def call_model(state: AgentState) -> dict:
        writer = _stream_writer()
        chunks: list[Any] = []
        async for chunk in model.astream(_sanitize(state["messages"])):
            chunks.append(chunk)
            if chunk.content:
                writer({"delta": str(chunk.content)})
            if reasoning := _reasoning(chunk):
                writer({"thinking": reasoning})
        if not chunks:
            return {"messages": [AIMessage(content="")]}
        message = chunks[0]
        for extra in chunks[1:]:
            message = message + extra
        return {"messages": [message]}

    def after_guardrail(state: AgentState) -> str:
        return END if state.get("blocked") else "model"

    def should_continue(state: AgentState) -> str:
        last = state["messages"][-1]
        return "tools" if getattr(last, "tool_calls", None) else END

    builder = StateGraph(AgentState)
    builder.add_node("guardrail", input_guardrail)
    builder.add_node("model", call_model)
    builder.add_node("tools", tools_node)
    builder.add_edge(START, "guardrail")
    builder.add_conditional_edges("guardrail", after_guardrail, {"model": "model", END: END})
    builder.add_conditional_edges("model", should_continue, {"tools": "tools", END: END})
    builder.add_edge("tools", "model")
    return builder.compile(checkpointer=checkpointer)
