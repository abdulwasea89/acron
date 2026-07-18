"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { Alert, Button, Card, CardHeader, Input, Select, Spinner } from "@/components/ui";
import { api, ApiError } from "@/lib/api";
import type { OrganizationOut, ProfileOut } from "@/lib/types";
import { MfaCard } from "./MfaCard";

export default function AccountPage() {
  const [profile, setProfile] = useState<ProfileOut | null>(null);
  const [org, setOrg] = useState<OrganizationOut | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(false);

  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [occupation, setOccupation] = useState("");
  const [education, setEducation] = useState("");
  const [emergencyContact, setEmergencyContact] = useState("");

  async function load() {
    setError("");
    try {
      const [p, o] = await Promise.all([
        api.get<ProfileOut>("/auth/me/profile"),
        api.get<OrganizationOut>("/organizations/me"),
      ]);
      setProfile(p);
      setOrg(o);
      setFullName(p.full_name ?? "");
      setPhone(p.phone ?? "");
      setAddress(p.address ?? "");
      setCity(p.city ?? "");
      setOccupation(p.occupation ?? "");
      setEducation(p.education ?? "");
      setEmergencyContact(p.emergency_contact ?? "");
    } catch (e) {
      setError((e as ApiError).message);
    }
  }

  useEffect(() => {
    queueMicrotask(() => void load());
  }, []);

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setNotice("");
    setLoading(true);
    try {
      await api.patch("/auth/me/profile", {
        full_name: fullName || null,
        phone: phone || null,
        address: address || null,
        city: city || null,
        occupation: occupation || null,
        education: education || null,
        emergency_contact: emergencyContact || null,
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

      <div className="space-y-6">
        <Card>
          <CardHeader title="Profile" subtitle="Your personal details" />
          <form onSubmit={saveProfile} className="space-y-4 p-6">
            <Input label="Email" value={profile?.email ?? ""} disabled hint="Email cannot be changed here" />

            <div className="grid gap-4 sm:grid-cols-2">
              <Input label="Full name" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Your name" />
              <Input label="Phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+1 555-0123" />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Input label="Address" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Street address" />
              <Input label="City" value={city} onChange={(e) => setCity(e.target.value)} placeholder="City" />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Input label="Occupation" value={occupation} onChange={(e) => setOccupation(e.target.value)} placeholder="e.g. Personal trainer" />
              <Input label="Education" value={education} onChange={(e) => setEducation(e.target.value)} placeholder="e.g. Bachelor's degree" />
            </div>

            <Input label="Emergency contact" value={emergencyContact} onChange={(e) => setEmergencyContact(e.target.value)} placeholder="Name & phone of emergency contact" />

            {profile?.gender || profile?.date_of_birth ? (
              <div className="grid gap-4 sm:grid-cols-2">
                {profile.gender && <Input label="Gender" value={profile.gender} disabled />}
                {profile.date_of_birth && <Input label="Date of birth" value={profile.date_of_birth} disabled />}
              </div>
            ) : null}

            <div className="flex justify-end gap-2 border-t border-[var(--border)] pt-4">
              <Button type="submit" loading={loading} size="lg" className="w-full sm:w-auto">Save changes</Button>
            </div>
          </form>
        </Card>

        <Card>
          <CardHeader title="Password" subtitle="Reset your password via email" />
          <div className="p-6">
            <p className="mb-4 text-sm text-[var(--foreground-muted)]">
              To change your password, we'll send a reset link to your email address.
            </p>
            <a
              href="/forgot-password"
              className="inline-flex items-center gap-2 rounded-[10px] border border-[var(--border)] bg-[var(--surface)] px-4 py-2.5 text-sm font-semibold text-[var(--foreground)] shadow-xs transition duration-150 hover:bg-[var(--background)] hover:border-[var(--border-strong)]"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M15.75 5.25a3 3 0 013 3m3 0a6 6 0 01-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1121.75 8.25z" />
              </svg>
              Reset password
            </a>
          </div>
        </Card>

        {org && <MfaCard mfaRequired={org.mfa_required} />}
      </div>
    </>
  );
}
