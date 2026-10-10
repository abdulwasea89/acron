"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui";

type HistoryItem = {
  id: string;
  previous_stage: string | null;
  stage: string;
  actor_name: string | null;
  actor_user_id: string | null;
  created_at: string;
  origin: string;
  created: boolean;
};
type History = { items: HistoryItem[]; total: number; page: number; page_size: number };

export function StageHistory({ leadId }: { leadId: string }) {
  const [page, setPage] = useState(1);
  const [attempt, setAttempt] = useState(0);
  const [history, setHistory] = useState<History | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    api.get<History>(`/leads/${leadId}/history?page=${page}&page_size=10`).then(
      (data) => { if (active) setHistory(data); },
      (failure: Error) => { if (active) setError(failure.message); },
    );
    return () => { active = false; };
  }, [leadId, page, attempt]);

  function goTo(next: number) {
    setHistory(null);
    setError("");
    setPage(next);
  }

  return <section className="mt-6 border-t border-border pt-5" aria-label="Stage history">
    <h3 className="font-semibold">Stage history</h3>
    <p className="mt-1 text-xs text-muted-foreground">Older entries may have an unknown previous stage. Some historical changes were not recorded.</p>
    {error ? <div role="alert" className="mt-3"><p>{error}</p><Button onClick={() => { setError(""); setAttempt((value) => value + 1); }}>Retry history</Button></div> : history === null ? <p role="status" className="mt-3">Loading history…</p> : <>
      {history.items.length === 0 ? <p className="mt-3 text-sm text-muted-foreground">No recorded stage changes.</p> : <ol className="mt-3 space-y-4">
        {history.items.map((entry) => <li key={entry.id} className="border-l-2 border-border pl-3">
          <p className="text-sm capitalize">{entry.created ? "Created" : (entry.previous_stage?.replaceAll("_", " ") ?? "Unknown")} → {entry.stage.replaceAll("_", " ")}</p>
          <p className="mt-1 text-xs text-muted-foreground">{entry.actor_name || (entry.actor_user_id ? "Unknown user" : "System")} · {entry.origin === "referral" ? "Referral conversion" : "Manual"} · <time dateTime={entry.created_at}>{new Date(entry.created_at).toLocaleString()}</time></p>
        </li>)}
      </ol>}
      <div className="mt-4 flex items-center gap-3"><Button variant="secondary" disabled={page === 1} onClick={() => goTo(page - 1)}>Previous</Button><span className="text-xs">Page {page} of {Math.max(1, Math.ceil(history.total / history.page_size))}</span><Button variant="secondary" disabled={page * history.page_size >= history.total} onClick={() => goTo(page + 1)}>Next</Button></div>
    </>}
  </section>;
}
