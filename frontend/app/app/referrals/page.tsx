"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { PageHeader } from "@/components/PageHeader";
import { Alert, Button, Card, EmptyState, Input, Spinner } from "@/components/ui";
import { useModuleGate } from "@/hooks/useModuleGate";
import { api, ApiError } from "@/lib/api";

type Program = { enabled: boolean; reward_description: string };
type Reward = { id: string; recipient_member_id: string; description: string; status: string };
type Referral = {
  id: string;
  referrer_name: string;
  referrer_email: string;
  referred_name: string;
  referred_email: string;
  status: string;
  reward_description: string;
  qualified_at: string | null;
  rewards: Reward[];
};
type Overview = { program: Program; referrals: Referral[]; pending_rewards: number; qualified_count: number };

export default function ReferralsPage() {
  const { ready } = useModuleGate("referrals");
  const [overview, setOverview] = useState<Overview | null>(null);
  const [program, setProgram] = useState<Program>({ enabled: false, reward_description: "A referral reward" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    try {
      const data = await api.get<Overview>("/referrals");
      setOverview(data);
      setProgram(data.program);
    } catch (e) {
      setError((e as ApiError).message);
    }
  }, []);

  useEffect(() => { queueMicrotask(() => void load()); }, [load]);

  async function saveProgram(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true); setError(""); setNotice("");
    try {
      await api.put<Program>("/referrals/program", program, { "Idempotency-Key": crypto.randomUUID() });
      await load(); setNotice(program.enabled ? "Referral program is live." : "Referral program paused.");
    } catch (e) { setError((e as ApiError).message); }
    finally { setBusy(false); }
  }

  async function fulfill(rewardId: string) {
    setBusy(true); setError(""); setNotice("");
    try {
      await api.post(`/referrals/rewards/${rewardId}/fulfill`, {}, { "Idempotency-Key": crypto.randomUUID() });
      await load(); setNotice("Reward marked as delivered.");
    } catch (e) { setError((e as ApiError).message); }
    finally { setBusy(false); }
  }

  if (!ready) return <div className="p-8"><Spinner /></div>;
  if (overview === null) return error ? <main className="p-8"><Alert tone="danger">{error}</Alert></main> : <div className="p-8"><Spinner /></div>;

  return (
    <main className="mx-auto max-w-7xl px-5 py-8 lg:px-8">
      <PageHeader title="Referrals" subtitle="Turn happy members into a trackable source of new signups." />
      {error && <Alert tone="danger">{error}</Alert>}
      {notice && <Alert tone="success">{notice}</Alert>}

      <section className="mb-6 grid gap-4 sm:grid-cols-3">
        <Card className="p-5"><p className="text-sm text-muted-foreground">Invited members</p><p className="mt-2 text-3xl font-semibold">{overview.referrals.length}</p></Card>
        <Card className="p-5"><p className="text-sm text-muted-foreground">Joined and paid</p><p className="mt-2 text-3xl font-semibold">{overview.qualified_count}</p></Card>
        <Card className="p-5"><p className="text-sm text-muted-foreground">Rewards to deliver</p><p className="mt-2 text-3xl font-semibold">{overview.pending_rewards}</p></Card>
      </section>

      <form onSubmit={saveProgram} className="mb-6 rounded-2xl border border-border bg-card p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div><h2 className="font-semibold">Program setup</h2><p className="mt-1 text-sm text-muted-foreground">Each successful referral earns the same reward for the member who invited and the new member. Your team records delivery here.</p></div>
          <label className="flex items-center gap-2 text-sm font-medium"><input type="checkbox" checked={program.enabled} onChange={(e) => setProgram({ ...program, enabled: e.target.checked })} />Program active</label>
        </div>
        <label className="mt-5 block max-w-xl text-sm font-medium">Reward description<Input className="mt-2" value={program.reward_description} maxLength={200} onChange={(e) => setProgram({ ...program, reward_description: e.target.value })} placeholder="A free class for both members" required minLength={3} /></label>
        <p className="mt-2 text-xs text-muted-foreground">Example: “One free class.” The owner confirms and records when the reward has been delivered.</p>
        <div className="mt-5 flex justify-end"><Button type="submit" disabled={busy}>{busy ? "Saving…" : "Save program"}</Button></div>
      </form>

      <section className="overflow-hidden rounded-2xl border border-border bg-card">
        <div className="border-b border-border px-5 py-4"><h2 className="font-semibold">Referral activity</h2><p className="mt-1 text-sm text-muted-foreground">A referral qualifies after the new member’s first payment succeeds.</p></div>
        {overview.referrals.length === 0 ? <EmptyState title="No referrals yet" hint="Once the program is active, members can share their referral code from the mobile dashboard." /> : <div className="divide-y divide-border">
          {overview.referrals.map((referral) => <article key={referral.id} className="grid gap-4 px-5 py-5 md:grid-cols-[1fr_1fr_auto] md:items-start">
            <div><p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Invited by</p><p className="mt-1 font-medium">{referral.referrer_name}</p><p className="text-sm text-muted-foreground">{referral.referrer_email}</p></div>
            <div><p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">New member</p><p className="mt-1 font-medium">{referral.referred_name}</p><p className="text-sm text-muted-foreground">{referral.referred_email || "Signup started"}</p><span className={`mt-2 inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${referral.status === "qualified" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>{referral.status === "qualified" ? "Joined and paid" : "Awaiting first payment"}</span></div>
            <div className="flex flex-wrap gap-2 md:max-w-64 md:justify-end">{referral.rewards.length ? referral.rewards.map((reward) => <div key={reward.id} className="rounded-lg border border-border px-3 py-2 text-sm"><p className="font-medium">{reward.description}</p>{reward.status === "fulfilled" ? <p className="mt-1 text-xs text-emerald-700">Delivered</p> : <Button type="button" className="mt-2" disabled={busy} onClick={() => void fulfill(reward.id)}>Mark delivered</Button>}</div>) : <span className="text-sm text-muted-foreground">Rewards unlock after payment.</span>}</div>
          </article>)}
        </div>}
      </section>
    </main>
  );
}
