"""Workflows: deterministic paths that use the model for one step (ADR 018).

Not every job should be an autonomous agent. The weekly briefing has a fixed
shape — gather known numbers, then narrate them — so it is a workflow: the data
fetch is deterministic and only the summary is model-driven. This is the
"prompt chaining" pattern, and it costs one model call with no tools bound.
"""

from __future__ import annotations

from langchain_core.messages import HumanMessage, SystemMessage
from sqlalchemy.ext.asyncio import AsyncSession

from app.agent.model import build_chat_model
from app.agent.tools._serialize import payroll_run_row, receipt_row
from app.core.constants import Role
from app.services import analytics_service
from app.services import payroll_service as payroll
from app.services import receipts_service as receipts

_SYSTEM = (
    "You write a short, factual briefing for a gym owner. Use only the numbers "
    "provided. Lead with the headline, then flag anything that needs action "
    "(pending approvals, receipts to review, a payroll run not yet finalized). "
    "No preamble, no invented numbers, a few sentences at most."
)


async def weekly_briefing(session: AsyncSession, *, org_id: str, role: Role) -> str:
    """Gather the org's numbers and narrate them in one model call.

    Unlike the chat agent, this binds no tools: the fetch is fixed, so there is
    nothing for the model to decide and nothing for it to get wrong.
    """

    metrics = await analytics_service.headline_metrics(session, org_id=org_id)
    revenue = await analytics_service.revenue_analytics(session, org_id=org_id)
    pending = await receipts.review_queue(session, org_id=org_id)
    runs = await payroll.list_runs(session, org_id=org_id)

    lines = [
        f"- Headline: {metrics}",
        f"- Revenue: {revenue}",
        f"- Pending receipts: {len(pending)}",
    ]
    for receipt in pending[:5]:
        lines.append(f"  - receipt: {receipt_row(receipt)}")
    for run in runs[:3]:
        lines.append(f"- payroll run: {payroll_run_row(run)}")

    model = build_chat_model()
    response = await model.ainvoke(
        [SystemMessage(content=_SYSTEM), HumanMessage(content="\n".join(lines))]
    )
    return str(response.content)
