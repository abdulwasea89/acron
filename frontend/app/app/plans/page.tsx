"use client";

import { useEffect, useState } from "react";
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
    load();
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
        action={<Button onClick={() => setShowForm((s) => !s)}>{showForm ? "Close" : "New plan"}</Button>}
      />

      {error && <div className="mb-4"><Alert>{error}</Alert></div>}

      {showForm && (
        <div className="mb-6">
          <PlanForm
            onCreated={() => {
              setShowForm(false);
              load();
            }}
          />
        </div>
      )}

      <Card>
        <CardHeader title="All plans" subtitle={plans ? `${plans.length} total` : undefined} />
        {plans === null ? (
          <Spinner />
        ) : plans.length === 0 ? (
          <EmptyState title="No plans yet" hint="Create your first plan — members can't sign up until one is published." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase tracking-wide text-[var(--muted)]">
                <tr className="border-b border-[var(--border)]">
                  <th className="px-5 py-3 font-medium">Name</th>
                  <th className="px-5 py-3 font-medium">Price</th>
                  <th className="px-5 py-3 font-medium">Billing</th>
                  <th className="px-5 py-3 font-medium">Visibility</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                  <th className="px-5 py-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {plans.map((p) => (
                  <tr key={p.id} className="hover:bg-gray-50/60">
                    <td className="px-5 py-3 font-medium">
                      {p.name}
                      {p.featured && <span className="ml-2 text-xs text-[var(--primary)]">★ featured</span>}
                    </td>
                    <td className="px-5 py-3 tabular-nums">{money(p.price, p.currency)}</td>
                    <td className="px-5 py-3">{titleCase(p.billing_type)}</td>
                    <td className="px-5 py-3">{titleCase(p.visibility)}</td>
                    <td className="px-5 py-3">
                      <Badge tone={statusTone(p.status)}>{titleCase(p.status)}</Badge>
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex justify-end gap-2">
                        {p.status === "draft" && (
                          <Button variant="secondary" onClick={() => act(p.id, "publish")}>Publish</Button>
                        )}
                        {p.status === "published" && (
                          <Button variant="secondary" onClick={() => act(p.id, "pause")}>Pause</Button>
                        )}
                        {p.status === "paused" && (
                          <Button variant="secondary" onClick={() => act(p.id, "resume")}>Resume</Button>
                        )}
                        <Button variant="ghost" onClick={() => act(p.id, "archive")}>Archive</Button>
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
    <Card>
      <CardHeader title="Create plan" subtitle="Saved as a draft — publish it when ready" />
      <form onSubmit={submit} className="grid gap-4 p-5 sm:grid-cols-2">
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
    </Card>
  );
}
