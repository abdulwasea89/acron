"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Input, Select, Alert } from "@/components/ui";
import type { SaasTier } from "@/lib/types";

const TIERS: { value: SaasTier; label: string; price: string; members: string }[] = [
  { value: "starter", label: "Starter", price: "$29/mo", members: "Up to 25 members" },
  { value: "pro", label: "Pro", price: "$79/mo", members: "Up to 100 members" },
  { value: "enterprise", label: "Enterprise", price: "Custom", members: "Unlimited" },
];

export default function CreateGymPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [timezone, setTimezone] = useState("UTC");
  const [currency, setCurrency] = useState("USD");
  const [tier, setTier] = useState<SaasTier>("starter");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!name.trim()) {
      setError("Gym name is required.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/create-gym", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          details: {
            name: name.trim(),
            address: address.trim() || null,
            timezone,
            default_currency: currency,
          },
          tier,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Failed to create gym");
      router.push("/app");
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-xl py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-[var(--foreground)]">Create New Gym</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Add another gym to your account. A new SaaS subscription will be created.
        </p>
      </div>

      <form onSubmit={onSubmit} className="space-y-6">
        {error && <Alert onDismiss={() => setError("")}>{error}</Alert>}

        <Input
          label="Gym name"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Downtown Yoga"
        />

        <Input
          label="Address"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          placeholder="Street, city, country"
        />

        <div className="grid grid-cols-2 gap-4">
          <Select
            label="Timezone"
            value={timezone}
            onChange={(e) => setTimezone(e.target.value)}
          >
            <option value="UTC">UTC</option>
            <option value="US/Eastern">US/Eastern</option>
            <option value="US/Central">US/Central</option>
            <option value="US/Mountain">US/Mountain</option>
            <option value="US/Pacific">US/Pacific</option>
            <option value="Europe/London">Europe/London</option>
            <option value="Europe/Berlin">Europe/Berlin</option>
            <option value="Asia/Dubai">Asia/Dubai</option>
            <option value="Asia/Karachi">Asia/Karachi</option>
            <option value="Asia/Kolkata">Asia/Kolkata</option>
          </Select>

          <Select
            label="Currency"
            value={currency}
            onChange={(e) => setCurrency(e.target.value)}
          >
            <option value="USD">USD ($)</option>
            <option value="EUR">EUR (€)</option>
            <option value="GBP">GBP (£)</option>
            <option value="PKR">PKR (₨)</option>
            <option value="AED">AED (د.إ)</option>
            <option value="INR">INR (₹)</option>
          </Select>
        </div>

        <div>
          <label className="mb-1.5 block text-[13px] font-medium text-[var(--foreground)]">
            SaaS Plan
          </label>
          <div className="grid grid-cols-3 gap-3">
            {TIERS.map((t) => (
              <button
                key={t.value}
                type="button"
                onClick={() => setTier(t.value)}
                className={`rounded-xl border-2 p-4 text-left transition-all ${
                  tier === t.value
                    ? "border-[var(--primary)] bg-[var(--primary-light)]"
                    : "border-[var(--border)] bg-white hover:border-gray-300"
                }`}
              >
                <div className="text-sm font-bold text-[var(--foreground)]">{t.label}</div>
                <div className="mt-1 text-lg font-bold text-[var(--foreground)]">{t.price}</div>
                <div className="mt-0.5 text-xs text-[var(--muted)]">{t.members}</div>
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-3 pt-2">
          <Button type="submit" loading={loading} size="lg">
            Create Gym
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="lg"
            onClick={() => router.back()}
          >
            Cancel
          </Button>
        </div>
      </form>
    </div>
  );
}
