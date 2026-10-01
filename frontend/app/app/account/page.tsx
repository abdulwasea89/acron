"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { Alert, Button, Input, Spinner } from "@/components/ui";
import { Row, ReadValue, Section } from "@/components/settings/primitives";
import { api, ApiError } from "@/lib/api";
import type { OrganizationOut, ProfileOut } from "@/lib/types";
import { MfaCard } from "./MfaCard";

/* The profile fields are shared: the standalone /app/account page owns and
   saves them itself, while the settings dialog stages them under its single
   global Save bar. Keeping one field implementation is what stops the two
   surfaces from drifting. */
export interface AccountFieldsValue {
  full_name: string;
  phone: string;
  address: string;
  city: string;
  occupation: string;
  education: string;
  emergency_contact: string;
}

export const emptyAccountFields: AccountFieldsValue = {
  full_name: "",
  phone: "",
  address: "",
  city: "",
  occupation: "",
  education: "",
  emergency_contact: "",
};

export function AccountFields({
  value,
  onChange,
  profile,
}: {
  value: AccountFieldsValue;
  onChange: (patch: Partial<AccountFieldsValue>) => void;
  profile: ProfileOut | null;
}) {
  return (
    <>
      <Row label="Email" description="Email cannot be changed here">
        <ReadValue>{profile?.email ?? "—"}</ReadValue>
      </Row>
      <Row label="Full name" description="Your display name across the platform">
        <Input size="sm" value={value.full_name} onChange={(e) => onChange({ full_name: e.target.value })} placeholder="Your name" />
      </Row>
      <Row label="Phone" description="Used for account recovery and alerts">
        <Input size="sm" value={value.phone} onChange={(e) => onChange({ phone: e.target.value })} placeholder="+1 555-0123" />
      </Row>
      <Row label="Address" description="Your street address">
        <Input size="sm" value={value.address} onChange={(e) => onChange({ address: e.target.value })} placeholder="Street address" />
      </Row>
      <Row label="City" description="Your city">
        <Input size="sm" value={value.city} onChange={(e) => onChange({ city: e.target.value })} placeholder="City" />
      </Row>
      <Row label="Occupation" description="What you do">
        <Input size="sm" value={value.occupation} onChange={(e) => onChange({ occupation: e.target.value })} placeholder="e.g. Personal trainer" />
      </Row>
      <Row label="Education" description="Your highest qualification">
        <Input size="sm" value={value.education} onChange={(e) => onChange({ education: e.target.value })} placeholder="e.g. Bachelor's degree" />
      </Row>
      <Row label="Emergency contact" description="Who to reach in an emergency">
        <Input size="sm" value={value.emergency_contact} onChange={(e) => onChange({ emergency_contact: e.target.value })} placeholder="Name & phone" />
      </Row>
      {profile?.gender && (
        <Row label="Gender" description="Set during onboarding">
          <ReadValue>{profile.gender}</ReadValue>
        </Row>
      )}
      {profile?.date_of_birth && (
        <Row label="Date of birth" description="Set during onboarding">
          <ReadValue>{profile.date_of_birth}</ReadValue>
        </Row>
      )}
    </>
  );
}

export default function AccountPage() {
  const [profile, setProfile] = useState<ProfileOut | null>(null);
  const [org, setOrg] = useState<OrganizationOut | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(false);
  const [fields, setFields] = useState<AccountFieldsValue>(emptyAccountFields);

  async function load() {
    setError("");
    try {
      const [p, o] = await Promise.all([
        api.get<ProfileOut>("/auth/me/profile"),
        api.get<OrganizationOut>("/organizations/me"),
      ]);
      setProfile(p);
      setOrg(o);
      setFields({
        full_name: p.full_name ?? "",
        phone: p.phone ?? "",
        address: p.address ?? "",
        city: p.city ?? "",
        occupation: p.occupation ?? "",
        education: p.education ?? "",
        emergency_contact: p.emergency_contact ?? "",
      });
    } catch (e) {
      setError((e as ApiError).message);
    }
  }

  useEffect(() => {
    queueMicrotask(() => void load());
  }, []);

  async function saveProfile() {
    setError("");
    setNotice("");
    setLoading(true);
    try {
      await api.patch("/auth/me/profile", {
        full_name: fields.full_name || null,
        phone: fields.phone || null,
        address: fields.address || null,
        city: fields.city || null,
        occupation: fields.occupation || null,
        education: fields.education || null,
        emergency_contact: fields.emergency_contact || null,
      });
      setNotice("Profile updated.");
      load();
    } catch (e) {
      setError((e as ApiError).message);
    } finally {
      setLoading(false);
    }
  }

  if (profile === null && !error) return <Spinner label="Loading profile..." />;

  return (
    <>
      <PageHeader title="Account" subtitle="Manage your personal information" />

      {error && <div className="mb-4"><Alert>{error}</Alert></div>}
      {notice && <div className="mb-4 animate-slide-down"><Alert tone="success">{notice}</Alert></div>}

      <Section id="profile" title="Profile" description="Your personal details">
        <AccountFields
          value={fields}
          onChange={(patch) => setFields((v) => ({ ...v, ...patch }))}
          profile={profile}
        />
        <Row label="Password" description="We'll email you a link to choose a new one">
          <a
            href="/forgot-password"
            className="block text-sm font-medium text-brand hover:underline sm:text-right"
          >
            Reset password
          </a>
        </Row>
      </Section>

      <div className="mt-8">
        <Section id="security" title="Security" description="Protect your account">
          <MfaCard mfaRequired={org?.mfa_required ?? false} />
        </Section>
      </div>

      <div className="mt-6 flex justify-end">
        <Button onClick={saveProfile} loading={loading}>Save changes</Button>
      </div>
    </>
  );
}
