"""LLM streaming client (Groq, OpenAI-compatible).

Groq speaks the OpenAI chat-completions protocol, so we talk to it over
``httpx`` — already the house HTTP client (``push.py``, ``hibp.py``) — rather
than adding the ``groq``/``openai`` SDKs as dependencies.

Follows the same degrade-gracefully convention as ``ocr.py`` and ``email.py``:
with no ``GROQ_API_KEY`` configured the module yields a deterministic stub
reply, so the entire assistant flow (routing, SSE, persistence, rendering) is
exercisable end-to-end with zero external accounts.
"""

from __future__ import annotations

import asyncio
import json
from collections.abc import AsyncIterator
from typing import Literal, NamedTuple

import httpx

from app.core.config import settings


class LLMError(RuntimeError):
    """The provider rejected the request or returned a malformed stream."""


class Delta(NamedTuple):
    """One piece of the model's output, tagged with which stream it came from.

    ``kind`` separates the reasoning trace from the answer itself. Reasoning
    models (gpt-oss among them) emit a long run of reasoning *before* the first
    content token — on a hard question that run outlasts the answer. The two
    therefore have to travel separately: the answer is what gets persisted and
    shown as the reply, the trace is a progress signal that fills the UI while
    the model is still working the problem out.
    """

    kind: Literal["reasoning", "content"]
    text: str


# Streaming needs a generous read timeout: the gap between tokens is normal,
# but a whole response can take a while on a long answer.
_TIMEOUT = httpx.Timeout(connect=10.0, read=60.0, write=10.0, pool=10.0)


def active_model_label() -> str | None:
    """The model id that will serve the next call, or None in stub mode.

    Stored on each assistant turn so a reply in the transcript can be traced to
    what produced it — including "nothing, this was the offline stub".
    """

    return settings.assistant_model if settings.assistant_live else None


async def stream_completion(
    messages: list[dict[str, str]],
    *,
    model: str | None = None,
    temperature: float | None = None,
    max_tokens: int | None = None,
) -> AsyncIterator[Delta]:
    """Yield the model's output as tagged deltas — reasoning first, then answer.

    ``messages`` is the full OpenAI-style transcript (system + history + the new
    user turn). Raises ``LLMError`` if the provider rejects the call.
    """

    if not settings.assistant_live:
        async for delta in _stub_stream(messages):
            yield delta
        return

    payload = {
        "model": model or settings.assistant_model,
        "messages": messages,
        "temperature": settings.assistant_temperature if temperature is None else temperature,
        "max_completion_tokens": (
            settings.assistant_max_completion_tokens if max_tokens is None else max_tokens
        ),
        "top_p": 1,
        "stream": True,
    }

    try:
        async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
            async with client.stream(
                "POST",
                f"{settings.groq_base_url}/chat/completions",
                json=payload,
                headers={
                    "Authorization": f"Bearer {settings.groq_api_key}",
                    "Content-Type": "application/json",
                },
            ) as response:
                if response.status_code >= 400:
                    # Read the body so the caller can log a real reason rather
                    # than just a status code.
                    detail = (await response.aread()).decode("utf-8", "replace")
                    raise LLMError(f"Groq returned {response.status_code}: {detail[:500]}")

                async for line in response.aiter_lines():
                    delta = _parse_sse_line(line)
                    if delta is _DONE:
                        break
                    if delta:
                        yield delta
    except httpx.HTTPError as exc:
        raise LLMError(f"Could not reach the model provider: {exc}") from exc


# Sentinel distinguishing "stream finished" from "this frame had no text".
_DONE = object()


def _parse_sse_line(line: str) -> Delta | object | None:
    """Decode one SSE frame into a tagged delta.

    Returns a `Delta`, `_DONE` at end-of-stream, or None for frames that carry
    no text (keep-alives, and the role-only opening frame). Content wins when a
    frame somehow carries both, so the answer is never held back behind the
    trace.
    """

    line = line.strip()
    if not line or not line.startswith("data:"):
        return None

    data = line[len("data:") :].strip()
    if data == "[DONE]":
        return _DONE
    if not data:
        return None

    try:
        parsed = json.loads(data)
    except json.JSONDecodeError:
        return None  # tolerate junk frames rather than killing the stream

    choices = parsed.get("choices") or []
    if not choices:
        return None

    delta = choices[0].get("delta") or {}
    content = delta.get("content")
    if content:
        return Delta("content", content)
    reasoning = delta.get("reasoning")
    if reasoning:
        return Delta("reasoning", reasoning)
    return None


async def _stub_stream(messages: list[dict[str, str]]) -> AsyncIterator[Delta]:
    """Deterministic offline reply, chunked so the UI streams for real.

    Deliberately reports what context it was handed — that makes it obvious
    during verification whether grounding was assembled correctly, even with
    the provider switched off.
    """

    question = next(
        (m["content"] for m in reversed(messages) if m.get("role") == "user"),
        "",
    )
    system = next((m["content"] for m in messages if m.get("role") == "system"), "")
    history = sum(1 for m in messages if m.get("role") in {"user", "assistant"})

    text = (
        "**[offline stub — no GROQ_API_KEY configured]**\n\n"
        f"You asked: {question}\n\n"
        f"I was given {len(system):,} characters of organization context and "
        f"{history} message(s) of history, so grounding is wired up correctly. "
        "Set GROQ_API_KEY in backend/.env to get a real answer."
    )

    for word in text.split(" "):
        await asyncio.sleep(0.02)  # simulate token cadence so streaming is visible
        yield Delta("content", word + " ")
