"""The assistant's multi-agent swarm (ADR 019).

Exports the two things the graph node needs and nothing else: the roster it plans
against, and the runner that executes a plan. Everything internal to the phase
machine lives in ``orchestrator``.
"""

from app.agent.swarm.orchestrator import plan_turn, run_swarm
from app.agent.swarm.roster import BY_DOMAIN, BY_ID, DOMAINS, SPECIALISTS
from app.agent.swarm.types import AgentPlan, Assignment, Domain, Finding, Specialist

__all__ = [
    "AgentPlan",
    "Assignment",
    "BY_DOMAIN",
    "BY_ID",
    "DOMAINS",
    "Domain",
    "Finding",
    "SPECIALISTS",
    "Specialist",
    "plan_turn",
    "run_swarm",
]
