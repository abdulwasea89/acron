"""The one place an LLM provider is named (ADR 018).

``build_chat_model`` returns a live ``ChatGroq`` model when a key is configured,
and a deterministic offline stub otherwise — the same degrade-gracefully rule
``ocr.py``, ``email.py`` and the old ``llm.py`` followed, so the whole agent path
(routing, streaming, persistence, interrupts) is exercisable with no vendor
account.

The stub consumes one ``AIMessage`` per call from a script when handed one; the
graph therefore drives the same ReAct loop in tests as in production, including
tool calls. With no script it answers text-only and reports the context it was
handed, which is what makes a mis-wired prompt visible in a test.
"""

from __future__ import annotations

import json
from collections.abc import AsyncIterator, Iterator, Sequence
from typing import Any

from langchain_core.callbacks import (
    AsyncCallbackManagerForLLMRun,
    CallbackManagerForLLMRun,
)
from langchain_core.language_models.chat_models import BaseChatModel
from langchain_core.messages import AIMessage, AIMessageChunk, BaseMessage
from langchain_core.outputs import ChatGeneration, ChatGenerationChunk, ChatResult

from app.core.config import settings


def build_chat_model(*, script: Sequence[AIMessage] | None = None) -> BaseChatModel:
    """Build the chat model for one run.

    ``script`` is a test seam: when given, an offline stub returns those
    messages in order, letting tests exercise tool calls and interrupts without
    a provider. In live mode the script is ignored.
    """

    if settings.assistant_live:
        from langchain_groq import ChatGroq
        from pydantic import SecretStr

        return ChatGroq(
            model=settings.assistant_model,
            api_key=SecretStr(settings.groq_api_key),
            temperature=settings.assistant_temperature,
            max_tokens=settings.assistant_max_completion_tokens,
            timeout=60,
        )
    return StubChatModel(script=list(script) if script else None)


class StubChatModel(BaseChatModel):
    """Deterministic offline model. Never calls a provider."""

    script: list[AIMessage] | None = None

    @property
    def _llm_type(self) -> str:
        return "acron-stub"

    # The graph binds tools to the model before invoking it. The stub ignores
    # them (it either follows its script or answers text-only), but must accept
    # the bind so a non-live environment still builds the graph.
    def bind_tools(self, tools: Any, **kwargs: Any) -> "StubChatModel":  # noqa: ARG002
        return self

    def _next(self, messages: list[BaseMessage]) -> AIMessage:
        if self.script:
            return self.script.pop(0)
        return AIMessage(content=_stub_text(messages))

    def _generate(
        self,
        messages: list[BaseMessage],
        stop: list[str] | None = None,  # noqa: ARG002
        run_manager: CallbackManagerForLLMRun | None = None,  # noqa: ARG002
        **kwargs: Any,  # noqa: ARG002
    ) -> ChatResult:
        return ChatResult(generations=[ChatGeneration(message=self._next(messages))])

    def _stream(
        self,
        messages: list[BaseMessage],
        stop: list[str] | None = None,  # noqa: ARG002
        run_manager: CallbackManagerForLLMRun | None = None,
        **kwargs: Any,  # noqa: ARG002
    ) -> Iterator[ChatGenerationChunk]:
        for chunk in _chunks(self._next(messages)):
            if run_manager and chunk.content:
                run_manager.on_llm_new_token(str(chunk.content))
            yield ChatGenerationChunk(message=chunk)

    async def _astream(
        self,
        messages: list[BaseMessage],
        stop: list[str] | None = None,  # noqa: ARG002
        run_manager: AsyncCallbackManagerForLLMRun | None = None,
        **kwargs: Any,  # noqa: ARG002
    ) -> AsyncIterator[ChatGenerationChunk]:
        for chunk in _chunks(self._next(messages)):
            if run_manager and chunk.content:
                await run_manager.on_llm_new_token(str(chunk.content))
            yield ChatGenerationChunk(message=chunk)


def _chunks(message: AIMessage) -> list[AIMessageChunk]:
    """Turn a complete message into streamed chunks.

    A scripted tool call travels as one chunk carrying ``tool_call_chunks`` so
    accumulation on the graph side reconstructs ``.tool_calls``. Text is split
    on whitespace only so the stub streams like a real provider.
    """

    out: list[AIMessageChunk] = []
    if message.tool_calls:
        out.append(
            AIMessageChunk(
                content=message.content or "",
                tool_call_chunks=[
                    {
                        "name": call["name"],
                        "args": json.dumps(call["args"]),
                        "id": call["id"],
                        "index": i,
                        "type": "tool_call_chunk",
                    }
                    for i, call in enumerate(message.tool_calls)
                ],
            )
        )
        return out
    if message.content:
        content = str(message.content)
        out.extend(AIMessageChunk(content=word + " ") for word in content.split(" "))
    return out


def _stub_text(messages: list[BaseMessage]) -> str:
    question = next(
        (m.content for m in reversed(messages) if m.type == "human" and m.content),
        "",
    )
    system = next((m.content for m in messages if m.type == "system"), "")
    history = sum(1 for m in messages if m.type in {"human", "ai"})
    return (
        "**[offline stub — no GROQ_API_KEY configured]**\n\n"
        f"You asked: {question}\n\n"
        f"I was given {len(system):,} characters of organization context and "
        f"{history} message(s) of history, so grounding is wired up correctly. "
        "Set GROQ_API_KEY in backend/.env to get a real answer."
    )
