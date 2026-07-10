"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { Alert, Badge, Button, Card, CardHeader, Select, Spinner } from "@/components/ui";
import { api, ApiError } from "@/lib/api";
import { statusTone, titleCase } from "@/lib/format";
import type { OrganizationOut } from "@/lib/types";

export default function SettingsPage() {
  const [org, setOrg] = useState<OrganizationOut | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [enrollment, setEnrollment] = useState("open");

  async function load() {
    setError("");
    try {
      const o = await api.get<OrganizationOut>("/organizations/me");
      setOrg(o);
      setEnrollment(o.enrollment_mode);
    } catch (e) {
      setError((e as ApiError).message);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function saveEnrollment() {
    setError("");
    setNotice("");
    try {
      await api.patch("/organizations/me/enrollment", { enrollment_mode: enrollment });
      setNotice("Enrollment mode updated.");
      load();
    } catch (e) {
      setError((e as ApiError).message);
    }
  }

  async function connectStripe() {
    setError("");
    try {
      const res = await api.post<{ onboarding_url: string }>("/organizations/me/connect");
      // In production this URL is Stripe-hosted onboarding.
      window.open(res.onboarding_url, "_blank");
      setNotice("Stripe onboarding started in a new tab.");
    } catch (e) {
      setError((e as ApiError).message);
    }
  }

  async function rotateCode() {
    setError("");
    setNotice("");
    if (!confirm("Rotate the org code? The old code stops working immediately and member sessions are revoked.")) return;
    try {
      const res = await api.post<{ org_code: string }>("/organizations/me/rotate-code");
      setNotice(`New org code: ${res.org_code}`);
      load();
    } catch (e) {
      setError((e as ApiError).message);
    }
  }

  if (org === null && !error) return <Spinner />;

  return (
    <>
      <PageHeader title="Settings" subtitle="Gym configuration & security" />

      {error && <div className="mb-4"><Alert>{error}</Alert></div>}
      {notice && <div className="mb-4"><Alert tone="success">{notice}</Alert></div>}

      {org && (
        <div className="grid gap-6">
          <Card>
            <CardHeader title="Gym details" />
            <dl className="grid gap-4 p-5 sm:grid-cols-2">
              <Field label="Name" value={org.name} />
              <Field label="Org code" value={org.org_code} mono />
              <Field label="Tier" value={titleCase(org.saas_tier)} />
              <div>
                <dt className="text-sm text-[var(--muted)]">Subscription</dt>
                <dd className="mt-1"><Badge tone={statusTone(org.saas_status)}>{titleCase(org.saas_status)}</Badge></dd>
              </div>
            </dl>
          </Card>

          <Card>
            <CardHeader title="Enrollment mode" subtitle="Controls how new members can join" />
            <div className="flex flex-wrap items-end gap-3 p-5">
              <div className="min-w-[220px]">
                <Select value={enrollment} onChange={(e) => setEnrollment(e.target.value)}>
                  <option value="open">Open — anyone with the code can join & pay</option>
                  <option value="approved">Approved — admin approves before payment</option>
                  <option value="invite_only">Invite-only — code disabled</option>
                </Select>
              </div>
              <Button onClick={saveEnrollment} disabled={enrollment === org.enrollment_mode}>
                Save
              </Button>
            </div>
          </Card>

          <Card>
            <CardHeader
              title="Payments (Stripe Connect)"
              subtitle="Member fees flow directly into your bank account"
              action={<Badge tone={statusTone(org.stripe_connect_status)}>{titleCase(org.stripe_connect_status)}</Badge>}
            />
            <div className="p-5">
              <Button variant="secondary" onClick={connectStripe}>
                {org.stripe_connect_status === "active" ? "Manage Stripe" : "Connect Stripe"}
              </Button>
            </div>
          </Card>

          <Card>
            <CardHeader title="Security" subtitle="Org code rotation" />
            <div className="p-5">
              <p className="mb-3 text-sm text-[var(--muted)]">
                Rotating invalidates the current code everywhere and revokes member sessions authenticated via it.
              </p>
              <Button variant="danger" onClick={rotateCode}>Rotate org code</Button>
            </div>
          </Card>
        </div>
      )}
    </>
  );
}

function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <dt className="text-sm text-[var(--muted)]">{label}</dt>
      <dd className={`mt-1 font-medium ${mono ? "font-mono" : ""}`}>{value}</dd>
    </div>
  );
}
