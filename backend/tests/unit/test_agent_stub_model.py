"""Unit tests for the offline stub model's chunk contract (ADR 018).

The stub is what makes the whole agent path testable without a provider, and
the one decision it makes — text becomes streamed chunks, a tool call travels
whole — is what the graph accumulates and what the UI streams. The old
hand-rolled SSE parser these tests replace lived in ``app.integrations.llm``;
the wire format is now the provider adapter's concern.
"""

from __future__ import annotations

from langchain_core.messages import AIMessage, HumanMessage, SystemMessage

from app.agent.model import StubChatModel, _chunks


def _tool_call_message() -> AIMessage:
    return AIMessage(
        content="",
        tool_calls=[
            {
                "name": "change_member_status",
                "args": {"member_id": "m1", "action": "freeze"},
                "id": "call_1",
                "type": "tool_call",
            }
        ],
    )


def test_text_is_split_into_reassemblable_chunks():
    chunks = _chunks(AIMessage(content="the quick brown fox"))
    assert "".join(str(c.content) for c in chunks) == "the quick brown fox "
    assert all(c.tool_call_chunks == [] for c in chunks)


def test_tool_call_travels_whole_as_one_chunk():
    chunks = _chunks(_tool_call_message())
    assert len(chunks) == 1
    assert chunks[0].content == ""
    assert chunks[0].tool_call_chunks[0]["name"] == "change_member_status"


def test_empty_content_yields_no_chunks():
    assert _chunks(AIMessage(content="")) == []


def test_bind_tools_is_accepted_and_ignored():
    model = StubChatModel()
    assert model.bind_tools([object()]) is model


async def test_unscripted_stub_reports_its_context():
    model = StubChatModel()
    result = await model.ainvoke(
        [
            SystemMessage(content="x" * 600),
            HumanMessage(content="How many members?"),
        ]
    )
    assert "offline stub" in result.content
    assert "600 characters" in result.content
    assert "How many members?" in result.content


async def test_scripted_stub_returns_script_in_order():
    model = StubChatModel(script=[AIMessage(content="first"), _tool_call_message()])
    assert (await model.ainvoke([HumanMessage(content="hi")])).content == "first"
    assert (await model.ainvoke([HumanMessage(content="hi")])).tool_calls
