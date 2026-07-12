"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { Alert, Badge, Button, Card, CardHeader, EmptyState, Input, Spinner } from "@/components/ui";
import { api, ApiError } from "@/lib/api";
import { money } from "@/lib/format";
import type { ReceiptReviewItem } from "@/lib/types";

export default function ReceiptsPage() {
  const [items, setItems] = useState<ReceiptReviewItem[] | null>(null);
  const [error, setError] = useState("");

  async function load() {
    setError("");
    try {
      setItems(await api.get<ReceiptReviewItem[]>("/receipts/review-queue"));
    } catch (e) {
      setError((e as ApiError).message);
      setItems([]);
    }
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <>
      <PageHeader
        title="Receipt review"
        subtitle="AI-scored offline payment proofs awaiting an admin decision"
      />

      {error && <div className="mb-4"><Alert>{error}</Alert></div>}

      {items === null ? (
        <Spinner />
      ) : items.length === 0 ? (
        <Card>
          <EmptyState title="Queue is clear" hint="Receipts scoring 70-94% (or flagged) land here for review." />
        </Card>
      ) : (
        <div className="space-y-4">
          {items.map((r) => (
            <ReceiptCard key={r.id} receipt={r} onDone={load} onError={setError} />
          ))}
        </div>
      )}
    </>
  );
}

function confidenceTone(score: number | null): "success" | "warning" | "danger" | "neutral" {
  if (score === null) return "neutral";
  if (score >= 95) return "success";
  if (score >= 70) return "warning";
  return "danger";
}

function ReceiptCard({
  receipt,
  onDone,
  onError,
}: {
  receipt: ReceiptReviewItem;
  onDone: () => void;
  onError: (msg: string) => void;
}) {
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  async function review(action: "approve" | "reject" | "request_info") {
    onError("");
    setBusy(true);
    try {
      await api.post(`/receipts/${receipt.id}/review`, { action, reason: reason || null });
      onDone();
    } catch (e) {
      onError((e as ApiError).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader
        title={`Member ${receipt.member_id.slice(0, 8)}`}
        subtitle={receipt.extracted_date ? `Dated ${receipt.extracted_date}` : "No date extracted"}
      />
      <div className="grid gap-4 p-5 sm:grid-cols-3">
        <div>
          <div className="text-xs uppercase tracking-wide text-[var(--muted)]">Confidence</div>
          <div className="mt-1">
            <Badge tone={confidenceTone(receipt.confidence_score)}>
              {receipt.confidence_score === null ? "—" : `${receipt.confidence_score.toFixed(0)}%`}
            </Badge>
          </div>
        </div>
        <div>
          <div className="text-xs uppercase tracking-wide text-[var(--muted)]">Amount</div>
          <div className="mt-1 tabular-nums">{receipt.extracted_amount === null ? "—" : money(receipt.extracted_amount)}</div>
        </div>
        <div>
          <div className="text-xs uppercase tracking-wide text-[var(--muted)]">Payee</div>
          <div className="mt-1">{receipt.extracted_payee || "—"}</div>
        </div>
        {receipt.is_duplicate && (
          <div className="sm:col-span-3">
            <Badge tone="danger">Possible duplicate</Badge>
          </div>
        )}
        {receipt.flags.length > 0 && (
          <div className="sm:col-span-3 flex flex-wrap gap-2">
            {receipt.flags.map((f) => (
              <Badge key={f} tone="warning">{f}</Badge>
            ))}
          </div>
        )}
        {receipt.original_image_url && (
          <div className="sm:col-span-3">
            <a
              href={receipt.original_image_url}
              target="_blank"
              rel="noreferrer"
              className="text-sm text-[var(--primary)] underline"
            >
              View receipt image
            </a>
          </div>
        )}
      </div>

      <div className="border-t border-[var(--border)] p-5">
        <Input
          label="Reason (required to reject / request info)"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Optional note for the member"
        />
        <div className="mt-3 flex flex-wrap gap-2">
          <Button loading={busy} onClick={() => review("approve")}>Approve</Button>
          <Button variant="secondary" loading={busy} disabled={!reason} onClick={() => review("request_info")}>
            Request info
          </Button>
          <Button variant="danger" loading={busy} disabled={!reason} onClick={() => review("reject")}>
            Reject
          </Button>
        </div>
      </div>
    </Card>
  );
}
