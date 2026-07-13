"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Alert, Button, Input } from "@/components/ui";

export default function LoginPage() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") || "/app";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [orgCode, setOrgCode] = useState("");
  const [mfaCode, setMfaCode] = useState("");
  const [needsMfa, setNeedsMfa] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          password,
          org_code: orgCode || null,
          mfa_code: mfaCode || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Login failed");
      if (data.requires_mfa) {
        setNeedsMfa(true);
        setError("");
        return;
      }
      router.push(next);
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--background)] px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <h1 className="text-xl font-semibold">Welcome back</h1>
          <p className="mt-1 text-sm text-[var(--muted)]">Sign in to your gym admin portal</p>
        </div>

        <form
          onSubmit={onSubmit}
          className="space-y-4 rounded-xl border border-[var(--border)] bg-white p-6 shadow-sm"
        >
          {error && <Alert>{error}</Alert>}

          <Input
            label="Email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="owner@yourgym.com"
          />
          <Input
            label="Password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••••••"
          />
          <Input
            label="Org code (optional)"
            value={orgCode}
            onChange={(e) => setOrgCode(e.target.value.toUpperCase())}
            placeholder="IRON-PULS-3K9"
            hint="Leave blank if you own a single gym."
          />

          {needsMfa && (
            <Input
              label="Authenticator code"
              inputMode="numeric"
              maxLength={6}
              required
              value={mfaCode}
              onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, ""))}
              placeholder="123456"
            />
          )}

          <Button type="submit" loading={loading} className="w-full">
            {needsMfa ? "Verify & sign in" : "Sign in"}
          </Button>

          <div className="flex items-center justify-between text-sm">
            <Link href="/register" className="text-[var(--primary)] hover:underline">
              Register a gym
            </Link>
            <Link href="/magic-link" className="text-[var(--primary)] hover:underline">
              Sign in with a link
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
