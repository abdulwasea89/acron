"""Unit tests for the LLM SSE frame parser.

The parser is the only place that knows the provider's wire format, and the one
decision it makes — reasoning versus content — is what the UI's streaming
behaviour rests on. A reasoning model (gpt-oss, which is what we default to)
emits a long run of `delta.reasoning` frames *before* its first `delta.content`,
so dropping or merging the two changes what the reader sees during the slowest
part of the wait. These pin that contract without needing the provider.
"""

from __future__ import annotations

import json

from app.integrations.llm import _DONE, Delta, _parse_sse_line


def frame(delta: dict) -> str:
    return "data: " + json.dumps({"choices": [{"delta": delta}]})


def test_content_frame_is_tagged_content():
    parsed = _parse_sse_line(frame({"content": "Hello"}))
    assert parsed == Delta("content", "Hello")


def test_reasoning_frame_is_tagged_reasoning():
    parsed = _parse_sse_line(frame({"reasoning": "The user asked about..."}))
    assert parsed == Delta("reasoning", "The user asked about...")


def test_content_wins_when_a_frame_carries_both():
    # Never hold the answer back behind the trace: if a frame somehow has both,
    # the visible text takes priority.
    parsed = _parse_sse_line(frame({"content": "Answer", "reasoning": "Thinking"}))
    assert parsed == Delta("content", "Answer")


def test_done_sentinel_is_distinct_from_text():
    assert _parse_sse_line("data: [DONE]") is _DONE


def test_empty_and_role_only_frames_yield_nothing():
    # The opening frame carries only a role, and keep-alives carry nothing at
    # all; neither is text, and neither may end the stream.
    assert _parse_sse_line(frame({"role": "assistant"})) is None
    assert _parse_sse_line("") is None
    assert _parse_sse_line(": keep-alive") is None
    assert _parse_sse_line("data: ") is None


def test_malformed_frames_are_tolerated():
    # One junk frame must not kill a stream that is otherwise fine.
    assert _parse_sse_line("data: {not json") is None
    assert _parse_sse_line("data: {}") is None
    assert _parse_sse_line("data: " + json.dumps({"choices": []})) is None


def test_empty_string_delta_is_not_text():
    # Some providers pad with "" deltas; they are not progress and must not
    # produce a frame the client has to render.
    assert _parse_sse_line(frame({"content": ""})) is None
    assert _parse_sse_line(frame({"reasoning": ""})) is None
