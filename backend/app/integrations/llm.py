"""Model label for the assistant transcript.

The provider call itself now lives in ``app/agent/model.py`` (ADR 018): the
agent talks to the model through LangChain, so this module's former hand-rolled
httpx SSE client is gone. What remains is the little helper the route needs to
stamp each stored turn with the model that produced it.
"""

from __future__ import annotations

from app.core.config import settings


def active_model_label() -> str | None:
    """The model id that served the last call, or ``None`` in stub mode.

    Stored on each assistant turn so a reply in the transcript can be traced to
    what produced it — including "nothing, this was the offline stub".
    """

    return settings.assistant_model if settings.assistant_live else None
