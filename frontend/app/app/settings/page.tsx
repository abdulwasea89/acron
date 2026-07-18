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
    queueMicrotask(() => void load());
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

  if (org === null && !error) return <Spinner label="Loading settings..." />;

  return (
    <>
      <PageHeader title="Settings" subtitle="Gym configuration & security" />

      {error && <div className="mb-4"><Alert>{error}</Alert></div>}
      {notice && <div className="mb-4 animate-slide-down"><Alert tone="success">{notice}</Alert></div>}

      {org && (
        <div className="space-y-6">
          <Card>
            <CardHeader
              title="Gym details"
              subtitle="Basic information about your organization"
              action={
                <Badge tone={statusTone(org.saas_status)}>{titleCase(org.saas_status)}</Badge>
              }
            />
            <dl className="grid gap-5 p-6 sm:grid-cols-2">
              <Field label="Name" value={org.name} icon="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3 3h12m-.75 4.5H21m-3.75 3H21m-3.75 3H21" />
              <Field label="Org code" value={org.org_code} mono icon="M15.75 5.25a3 3 0 013 3m3 0a6 6 0 01-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1121.75 8.25z" />
              <Field label="Tier" value={titleCase(org.saas_tier)} icon="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
              <div>
                <dt className="text-sm text-[var(--muted)]">Subscription</dt>
                <dd className="mt-1.5">
                  <Badge tone={statusTone(org.saas_status)}>{titleCase(org.saas_status)}</Badge>
                </dd>
              </div>
            </dl>
          </Card>

          <Card>
            <CardHeader title="Enrollment mode" subtitle="Controls how new members can join" />
            <div className="flex flex-wrap items-center gap-3 p-6">
              <div className="min-w-0 sm:min-w-[280px]">
                <Select value={enrollment} onChange={(e) => setEnrollment(e.target.value)}>
                  <option value="open">Open — anyone with the code can join & pay</option>
                  <option value="approved">Approved — admin approves before payment</option>
                  <option value="invite_only">Invite-only — code disabled</option>
                </Select>
              </div>
              <Button onClick={saveEnrollment} disabled={enrollment === org.enrollment_mode} className="h-11">
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>
                Save
              </Button>
            </div>
          </Card>

          <Card>
            <CardHeader
              title="Payments (Stripe Connect)"
              subtitle="Member fees flow directly into your bank account"
              action={
                <Badge tone={statusTone(org.stripe_connect_status)}>
                  {titleCase(org.stripe_connect_status)}
                </Badge>
              }
            />
            <div className="p-6">
              <Button variant="secondary" onClick={connectStripe}>
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" /></svg>
                {org.stripe_connect_status === "active" ? "Manage Stripe" : "Connect Stripe"}
              </Button>
            </div>
          </Card>

          <Card className="border-[var(--danger-border)]">
            <CardHeader
              title="Security"
              subtitle="Org code rotation"
            />
            <div className="p-6">
              <div className="rounded-[var(--radius-md)] bg-[var(--danger-bg)] border border-[var(--danger-border)] p-4 mb-4">
                <div className="flex items-start gap-3">
                  <svg className="mt-0.5 h-5 w-5 shrink-0 text-[var(--danger)]" viewBox="0 0 24 24" fill="currentColor">
                    <path fillRule="evenodd" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" clipRule="evenodd" />
                  </svg>
                  <div>
                    <p className="text-sm font-medium text-[var(--danger)]">Danger zone</p>
                    <p className="mt-0.5 text-sm text-[var(--danger)]/80">
                      Rotating invalidates the current code everywhere and revokes member sessions authenticated via it.
                    </p>
                  </div>
                </div>
              </div>
              <Button variant="danger" onClick={rotateCode}>
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182" /></svg>
                Rotate org code
              </Button>
            </div>
          </Card>
        </div>
      )}
    </>
  );
}

function Field({ label, value, mono, icon }: { label: string; value: string; mono?: boolean; icon?: string }) {
  return (
    <div>
      <dt className="text-sm text-[var(--muted)]">{label}</dt>
      <dd className="mt-1.5 flex items-center gap-2 font-medium text-[var(--foreground)]">
        {icon && (
          <svg className="h-4 w-4 shrink-0 text-[var(--muted)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d={icon} />
          </svg>
        )}
        <span className={mono ? "font-mono" : ""}>{value}</span>
      </dd>
    </div>
  );
}
