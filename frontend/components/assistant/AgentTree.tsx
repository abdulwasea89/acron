"use client";

import { useState } from "react";
import type { AssistantAgentStep } from "@/lib/types";

/* ── AgentTree ────────────────────────────────────────────────────────────
   The swarm, as a tree (ADR 019). Five domain groups, each led by the
   orchestrator that distilled it and holding the specialists that ran under it.

   It renders inside the same collapsible activity panel that already shows
   reasoning and tool steps, so the "down button" the user already knows is the
   one that opens this — the panel just has a richer body when the turn fanned
   out.

   Three levels collapse independently, because forty-five rows is more than
   anyone reads at once: the panel itself, each domain group, and each agent
   row. The group toggle is the one that matters — it answers "show me what the
   revenue team actually did" without scrolling past four other teams.

   All three levels are driven from one state here rather than each row owning
   its own boolean, because "open everything" has to be a single press. A tree
   that had to be opened group by group was the thing the user was actually
   reaching for, and forty-five individual toggles is not a control.

   A collapsed row carries what you would want at a glance: what the agent is
   for, which lookup it ran, and whether it found anything. Expanding adds the
   things that cannot fit on one line — why it ran, and the call's output. The
   "why" is per agent rather than per turn, because "why did forty agents run"
   is a much less useful question than "why did this one".

   Grouping is by `domain`, and the group order is the roster's, not the arrival
   order: agents finish out of order by design, and a tree that reordered itself
   as they landed would be unreadable. */

/** The five domains, in roster order. Unknown domains sink to the bottom. */
const DOMAIN_ORDER = ["members", "revenue", "payroll", "operations", "risk"];

const DOMAIN_LABELS: Record<string, string> = {
  members: "Members",
  revenue: "Revenue & billing",
  payroll: "Payroll & staff",
  operations: "Operations",
  risk: "Risk & compliance",
};

type Mode = "default" | "open" | "closed";

/** What kind of node a toggle is for. The three differ only in their default. */
type Kind = "group" | "orchestrator" | "row";

export function AgentTree({ steps }: { steps: AssistantAgentStep[] }) {
  const groups = groupByDomain(steps);
  const specialists = steps.filter((s) => s.role !== "orchestrator").length;
  const domains = groups.length;

  // One mode for the bulk action, plus per-node overrides for the individual
  // clicks that follow it. Kept apart rather than merged into one map because
  // the two have to answer differently for a node that does not exist yet: a
  // row that arrives after "expand all" while the turn is still running should
  // arrive expanded, and a map built at press time could not know about it.
  const [mode, setMode] = useState<Mode>("default");
  const [overrides, setOverrides] = useState<Record<string, boolean>>({});

  // Groups and rows key into the same map, so their ids are namespaced. A
  // specialist is not currently named after its own domain, but nothing in the
  // roster contract forbids it, and the failure would be a group and a row
  // silently sharing a toggle.
  function groupKey(domain: string): string {
    return `group:${domain}`;
  }

  function isOpen(id: string, kind: Kind): boolean {
    const override = overrides[id];
    if (override !== undefined) return override;
    if (mode === "open") return true;
    if (mode === "closed") return false;
    // The default: teams open, orchestrators open, specialists folded.
    //
    // An orchestrator is open because it is the cheap half of the tree to read —
    // five of them, one digest each, and together they are the answer's skeleton.
    // A specialist is folded because it is the expensive half: forty rows, each
    // able to carry thousands of characters of raw evidence, and the ones that
    // would say something are the ones whose team digest already said it.
    return kind !== "row";
  }

  function toggle(id: string, kind: Kind) {
    setOverrides((prev) => ({ ...prev, [id]: !isOpen(id, kind) }));
  }

  function setAll(open: boolean) {
    setOverrides({});
    setMode(open ? "open" : "closed");
  }

  // Whether the bulk control should read "Collapse all". Deliberately the mode
  // rather than a scan of every node: expanding forty-five rows by hand and then
  // seeing the button offer to expand them again is a smaller disappointment
  // than a button whose label cost a pass over the whole tree on every frame.
  const everythingOpen = mode === "open";

  return (
    <div className="space-y-2.5">
      <div className="flex items-center gap-2 px-1">
        <p className="text-[11px] text-muted-foreground">
          {specialists} {specialists === 1 ? "agent" : "agents"}
          {domains > 0 && ` · ${domains} ${domains === 1 ? "team" : "teams"}`}
        </p>
        <button
          type="button"
          onClick={() => setAll(!everythingOpen)}
          className="ml-auto rounded px-1.5 py-0.5 text-[10px] text-muted-foreground/80 transition-colors hover:bg-foreground/5 hover:text-[var(--foreground)]"
        >
          {everythingOpen ? "Collapse all" : "Expand all"}
        </button>
      </div>

      <StatusLegend />

      {groups.map(([domain, agents]) => (
        <DomainGroup
          key={domain}
          domain={domain}
          agents={agents}
          groupId={groupKey(domain)}
          isOpen={isOpen}
          onToggle={toggle}
        />
      ))}
    </div>
  );
}

/** What the dots mean, said once.
 *
 *  A colour with no key is a guess, and the three states mean genuinely
 *  different things: grey is not an error, it is an agent whose remit had
 *  nothing in this org's data to read. Without the line, a tree that is mostly
 *  grey on a new gym looks broken. */
function StatusLegend() {
  return (
    <p className="flex flex-wrap items-center gap-x-3 gap-y-1 px-1 text-[10px] text-muted-foreground/80">
      <LegendDot tone="bg-emerald-500" label="reported" />
      <LegendDot tone="bg-muted-foreground/40" label="nothing to report" />
      <LegendDot tone="bg-[var(--danger)]" label="failed" />
    </p>
  );
}

function LegendDot({ tone, label }: { tone: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1">
      <span className={`h-1.5 w-1.5 rounded-full ${tone}`} />
      {label}
    </span>
  );
}

/** One domain: a toggle, the orchestrator that distilled it, and its team. */
function DomainGroup({
  domain,
  agents,
  groupId,
  isOpen,
  onToggle,
}: {
  domain: string;
  agents: AssistantAgentStep[];
  groupId: string;
  isOpen: (id: string, kind: Kind) => boolean;
  onToggle: (id: string, kind: Kind) => void;
}) {
  const open = isOpen(groupId, "group");
  const orchestrator = agents.find((a) => a.role === "orchestrator");
  const specialists = agents.filter((a) => a.role !== "orchestrator");
  const settled = specialists.filter((a) => a.status).length;
  const running = settled < specialists.length;

  return (
    <div className="space-y-0.5">
      <button
        type="button"
        onClick={() => onToggle(groupId, "group")}
        aria-expanded={open}
        className="flex w-full items-center gap-1.5 rounded-md px-1 py-0.5 text-left text-[11px] hover:bg-foreground/5"
      >
        <Chevron open={open} />
        <span className="font-medium text-[var(--foreground)]">
          {DOMAIN_LABELS[domain] ?? domain}
        </span>
        <span className="font-mono text-[10px] text-muted-foreground/70">
          {settled}/{specialists.length}
        </span>
        {running && <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-brand" />}
      </button>

      {open && (
        <div className="space-y-0.5 pl-1.5">
          {/* The orchestrator's own row, above its team: it is one of the agents
              in the picture, it just starts once its specialists have reported. */}
          {orchestrator && (
            <AgentRow agent={orchestrator} isOpen={isOpen} onToggle={onToggle} />
          )}

          <div className="ml-1.5 space-y-0.5 border-l border-[var(--border)] pl-2.5">
            {specialists.map((agent) => (
              <AgentRow key={agent.id} agent={agent} isOpen={isOpen} onToggle={onToggle} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function AgentRow({
  agent,
  isOpen,
  onToggle,
}: {
  agent: AssistantAgentStep;
  isOpen: (id: string, kind: Kind) => boolean;
  onToggle: (id: string, kind: Kind) => void;
}) {
  const expandable = Boolean(agent.why || agent.summary || agent.detail);
  const isOrchestrator = agent.role === "orchestrator";
  // An orchestrator is its own kind so it gets its own default — see isOpen.
  const kind: Kind = isOrchestrator ? "orchestrator" : "row";
  const open = isOpen(agent.id, kind);

  return (
    <div>
      <button
        type="button"
        onClick={() => expandable && onToggle(agent.id, kind)}
        aria-expanded={expandable ? open : undefined}
        className={`flex w-full items-center gap-1.5 rounded-md px-1 py-0.5 text-left text-[11px] ${
          expandable ? "hover:bg-foreground/5" : "cursor-default"
        }`}
      >
        {/* A row that opens says so. Without this the only way to learn that a
            row holds a finding is to click one and watch — which is a discovery
            nobody makes, and the findings are the point of the whole tree. */}
        {expandable ? (
          <Chevron open={open} />
        ) : (
          <span className="h-2.5 w-2.5 shrink-0" aria-hidden="true" />
        )}
        <StatusDot status={agent.status} />
        <span className="shrink-0 font-medium text-[var(--foreground)]">{agent.name}</span>

        {/* The call this agent made. Shown on every row rather than only the
            ones that reach a model, because every agent does something and a
            chip that appears on eight rows out of forty reads as a defect. */}
        {agent.tool && (
          <code className="min-w-0 shrink truncate font-mono text-[10px] text-brand/90">
            {agent.tool}
          </code>
        )}

        {agent.specialization && (
          <span className="hidden min-w-0 flex-1 truncate text-muted-foreground sm:inline">
            {agent.specialization}
          </span>
        )}

        {agent.ms !== undefined && (
          <span className="ml-auto shrink-0 font-mono text-[10px] text-muted-foreground/70">
            {formatMs(agent.ms)}
          </span>
        )}
      </button>

      {open && (
        <div className="ml-3 space-y-1.5 border-l border-[var(--border)] py-1 pl-2.5 text-[11px]">
          {agent.why && (
            <div>
              <Label>Why this ran</Label>
              <p className="leading-4 text-muted-foreground">{agent.why}</p>
            </div>
          )}
          {agent.summary && (
            <div>
              <Label>Output</Label>
              <p className="whitespace-pre-wrap leading-4 text-[var(--foreground)]">
                {agent.summary}
              </p>
            </div>
          )}
          {/* The thinking behind a conclusion that was itself a judgement: the
              rows a model-backed agent reasoned over, or the findings an
              orchestrator distilled. Absent for a deterministic agent, whose
              summary is already the raw figure. */}
          {agent.detail && (
            <div>
              <Label>{isOrchestrator ? "Findings it distilled" : "What it read"}</Label>
              <pre className="max-h-48 overflow-auto whitespace-pre-wrap break-words rounded bg-[var(--card)] px-2 py-1.5 font-mono text-[10px] leading-4 text-muted-foreground">
                {agent.detail}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/** A section heading inside an expanded row. Sentence case and small: these
 *  label a paragraph, they are not titles. */
function Label({ children }: { children: React.ReactNode }) {
  return <p className="text-[10px] text-muted-foreground/70">{children}</p>;
}

/** Running, reported, nothing to report, or broke. */
function StatusDot({ status }: { status?: AssistantAgentStep["status"] }) {
  if (status === undefined) {
    return (
      <svg
        className="h-2.5 w-2.5 shrink-0 animate-spin text-brand"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="3"
        aria-label="running"
      >
        <path d="M12 3a9 9 0 1 0 9 9" strokeLinecap="round" />
      </svg>
    );
  }
  const tone =
    status === "done"
      ? "bg-emerald-500"
      : status === "failed"
        ? "bg-[var(--danger)]"
        : "bg-muted-foreground/40";
  return (
    <span
      className={`h-1.5 w-1.5 shrink-0 rounded-full ${tone}`}
      aria-label={status}
      title={status}
    />
  );
}

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      className={`h-2.5 w-2.5 shrink-0 text-muted-foreground transition-transform ${
        open ? "rotate-90" : ""
      }`}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M9 18l6-6-6-6" />
    </svg>
  );
}

/** 840 -> "840ms"; 12400 -> "12.4s". */
function formatMs(ms: number): string {
  if (ms < 1000) return `${Math.max(1, Math.round(ms))}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function groupByDomain(agents: AssistantAgentStep[]): [string, AssistantAgentStep[]][] {
  const map = new Map<string, AssistantAgentStep[]>();
  for (const agent of agents) {
    const bucket = map.get(agent.domain);
    if (bucket) bucket.push(agent);
    else map.set(agent.domain, [agent]);
  }
  const rank = (d: string) => {
    const at = DOMAIN_ORDER.indexOf(d);
    return at === -1 ? DOMAIN_ORDER.length : at;
  };
  return [...map.entries()].sort(([a], [b]) => rank(a) - rank(b));
}
