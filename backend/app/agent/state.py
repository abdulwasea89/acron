"""Graph state for the assistant agent.

``MessagesState`` supplies the ``messages`` channel with the ``add_messages``
reducer (append, and update-by-id on resume). The one added channel, ``blocked``,
lets the input guardrail short-circuit the graph to END before a model call.
Tool activity is read from the message stream rather than stored separately, so
there is no second source of truth to keep in sync.
"""

from __future__ import annotations

from langgraph.graph import MessagesState


class AgentState(MessagesState):
    """State threaded through the assistant graph."""

    # Set by the input guardrail when a request is refused before the model runs.
    blocked: bool
