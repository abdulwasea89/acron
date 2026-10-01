"use client";

import { useEffect, useState } from "react";
import { Glyph } from "@/components/Glyph";
import { api } from "@/lib/api";
import { titleCase } from "@/lib/format";
import type { CompanyListItem, MemberDirectoryItem, PlanOut } from "@/lib/types";

/* ── ReferencePicker ──────────────────────────────────────────────────────
   Pick an app record to reference in a prompt. The record is inserted as a
   plain `@kind:"label"` token, so the assistant page stays a single text
   protocol — no new message types — and the model can resolve the record with
   its existing lookup tools. */

export interface Reference {
  kind: "plan" | "member" | "company";
  label: string;
}

interface ReferenceItem extends Reference {
  sub: string;
}

function SearchIcon() {
  return (
    <Glyph className="h-3.5 w-3.5"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" /></Glyph>
  );
}

export function ReferencePicker({
  onPick,
  onClose,
}: {
  onPick: (ref: Reference) => void;
  onClose: () => void;
}) {
  const [items, setItems] = useState<ReferenceItem[] | null>(null);
  const [query, setQuery] = useState("");

  // Load once on open. Each source is best-effort: a failed list just drops
  // that kind from the picker rather than blocking the others.
  useEffect(() => {
    let cancelled = false;
    Promise.all([
      api.get<PlanOut[]>("/plans").catch(() => []),
      api.get<MemberDirectoryItem[]>("/members").catch(() => []),
      api.get<CompanyListItem[]>("/companies").catch(() => []),
    ]).then(([plans, members, companies]) => {
      if (cancelled) return;
      setItems([
        ...plans.map((p) => ({
          kind: "plan" as const,
          label: p.name,
          sub: titleCase(p.offer_kind ?? "membership"),
        })),
        ...members.map((m) => ({
          kind: "member" as const,
          label: m.display_name || m.full_name || m.email,
          sub: m.email,
        })),
        ...companies.map((c) => ({
          kind: "company" as const,
          label: c.name,
          sub: titleCase(c.status),
        })),
      ]);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const q = query.trim().toLowerCase();
  const matches = (items ?? []).filter(
    (it) => !q || it.label.toLowerCase().includes(q) || it.sub.toLowerCase().includes(q),
  );

  return (
    <>
      <button
        type="button"
        aria-label="Close reference picker"
        onClick={onClose}
        className="fixed inset-0 z-20 cursor-default"
      />
      <div className="absolute bottom-full left-4 right-4 z-30 mb-2 sm:left-6 sm:right-6">
        <div className="mx-auto w-full max-w-3xl overflow-hidden rounded-xl border border-[var(--border)] bg-card shadow-xl shadow-black/10">
          <div className="flex items-center gap-2 border-b border-foreground/[0.08] px-3 py-2">
            <span className="text-muted-foreground"><SearchIcon /></span>
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Reference a plan, member, or company…"
              aria-label="Search records to reference"
              className="h-7 w-full bg-transparent text-[13px] text-foreground placeholder:text-muted-foreground focus:outline-none"
            />
          </div>
          <ul className="max-h-64 overflow-y-auto p-1">
            {items === null ? (
              <li className="px-3 py-3 text-xs text-muted-foreground">Loading…</li>
            ) : matches.length === 0 ? (
              <li className="px-3 py-3 text-xs text-muted-foreground">No matching records.</li>
            ) : (
              matches.slice(0, 30).map((it, i) => (
                <li key={`${it.kind}-${it.label}-${i}`}>
                  <button
                    type="button"
                    onClick={() => onPick({ kind: it.kind, label: it.label })}
                    className="flex w-full cursor-pointer items-center gap-2 rounded-md px-2.5 py-1.5 text-left transition-colors hover:bg-foreground/[0.06]"
                  >
                    <span className="flex h-5 w-9 shrink-0 items-center justify-center rounded bg-foreground/[0.06] font-mono text-[9px] uppercase tracking-wide text-muted-foreground">
                      {it.kind}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-[13px] text-foreground">{it.label}</span>
                    <span className="max-w-[40%] shrink-0 truncate text-[11px] text-muted-foreground">{it.sub}</span>
                  </button>
                </li>
              ))
            )}
          </ul>
        </div>
      </div>
    </>
  );
}
