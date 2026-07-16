"use client";

import { useEffect, useState } from "react";
import { Dialog } from "@/components/Dialog";
import { PageHeader } from "@/components/PageHeader";
import { Alert, Badge, Button, Card, CardHeader, EmptyState, Input, Select, Spinner } from "@/components/ui";
import { api, ApiError } from "@/lib/api";
import { money, statusTone, titleCase } from "@/lib/format";
import type { PlanOut } from "@/lib/types";

export default function PlansPage() {
  const [plans, setPlans] = useState<PlanOut[] | null>(null);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);

  async function load() {
    setError("");
    try {
      setPlans(await api.get<PlanOut[]>("/plans"));
    } catch (e) {
      setError((e as ApiError).message);
      setPlans([]);
    }
  }

  useEffect(() => {
    queueMicrotask(() => void load());
  }, []);

  async function act(id: string, action: string) {
    setError("");
    try {
      await api.post(`/plans/${id}/${action}`);
      await load();
    } catch (e) {
      setError((e as ApiError).message);
    }
  }

  return (
    <>
      <PageHeader
        title="Membership plans"
        subtitle="Owner-defined plans shown to members at signup"
        action={
          <Button onClick={() => setShowForm((s) => !s)} variant={showForm ? "secondary" : "primary"}>
            {showForm ? "Close" : "+ New plan"}
          </Button>
        }
      />

      {error && <div className="mb-4"><Alert>{error}</Alert></div>}

      <Dialog open={showForm} onClose={() => setShowForm(false)} title="Create plan" subtitle="Saved as a draft — publish it when ready" className="max-w-xl">
        <PlanForm onCreated={() => { setShowForm(false); load(); }} />
      </Dialog>

      <Card>
        <CardHeader title="All plans" subtitle={plans ? `${plans.length} total` : undefined} />
        {plans === null ? (
          <Spinner label="Loading plans..." />
        ) : plans.length === 0 ? (
          <EmptyState
            title="No plans yet"
            hint="Create your first plan — members can't sign up until one is published."
            icon={
              <svg className="h-8 w-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            }
            action={
              <Button onClick={() => setShowForm(true)} size="lg">
                + Create your first plan
              </Button>
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-[11px] font-semibold uppercase tracking-wider text-[var(--muted)]">
                <tr className="border-b border-[var(--border)]">
                  <th className="px-5 py-3">Name</th>
                  <th className="px-5 py-3">Price</th>
                  <th className="px-5 py-3">Billing</th>
                  <th className="px-5 py-3">Visibility</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {plans.map((p) => (
                  <tr key={p.id} className="hover:bg-[var(--background)] transition-colors">
                    <td className="px-5 py-3.5">
                      <div className="font-medium text-[var(--foreground)]">{p.name}</div>
                      {p.featured && (
                        <span className="text-xs text-[var(--warning)] font-medium">★ Featured</span>
                      )}
                    </td>
                    <td className="px-5 py-3.5 tabular-nums font-semibold">{money(p.price, p.currency)}</td>
                    <td className="px-5 py-3.5 text-[var(--foreground-muted)]">{titleCase(p.billing_type)}</td>
                    <td className="px-5 py-3.5 text-[var(--foreground-muted)]">{titleCase(p.visibility)}</td>
                    <td className="px-5 py-3.5">
                      <Badge tone={statusTone(p.status)}>{titleCase(p.status)}</Badge>
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex justify-end gap-1.5">
                        {p.status === "draft" && (
                          <Button variant="secondary" size="sm" onClick={() => act(p.id, "publish")}>Publish</Button>
                        )}
                        {p.status === "published" && (
                          <Button variant="secondary" size="sm" onClick={() => act(p.id, "pause")}>Pause</Button>
                        )}
                        {p.status === "paused" && (
                          <Button variant="secondary" size="sm" onClick={() => act(p.id, "resume")}>Resume</Button>
                        )}
                        <Button variant="ghost" size="sm" onClick={() => act(p.id, "archive")}>Archive</Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}

function PlanForm({ onCreated }: { onCreated: () => void }) {
  const [name, setName] = useState("");
  const [price, setPrice] = useState("0");
  const [billing, setBilling] = useState("recurring");
  const [visibility, setVisibility] = useState("public");
  const [desc, setDesc] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await api.post("/plans", {
        name,
        price: parseFloat(price) || 0,
        billing_type: billing,
        visibility,
        public_description: desc || null,
        ...(billing === "recurring" ? { cycle_unit: "month", cycle_length: 1 } : {}),
      });
      onCreated();
    } catch (e) {
      setError((e as ApiError).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
      {error && <div className="sm:col-span-2"><Alert>{error}</Alert></div>}
      <Input label="Plan name" required value={name} onChange={(e) => setName(e.target.value)} placeholder="Monthly Unlimited" />
      <Input label="Price" type="number" min="0" step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} />
      <Select label="Billing type" value={billing} onChange={(e) => setBilling(e.target.value)}>
        <option value="recurring">Recurring</option>
        <option value="one_time_pack">One-time pack</option>
        <option value="drop_in">Drop-in</option>
      </Select>
      <Select label="Visibility" value={visibility} onChange={(e) => setVisibility(e.target.value)}>
        <option value="public">Public</option>
        <option value="members_only">Members only</option>
        <option value="invite_only">Invite only</option>
      </Select>
      <div className="sm:col-span-2">
        <Input label="Public description" value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="What members see on the signup screen" />
      </div>
      <div className="sm:col-span-2">
        <Button type="submit" loading={loading}>Save draft</Button>
      </div>
    </form>
  );
}
