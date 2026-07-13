"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Alert, Button, Input } from "@/components/ui";

// Magic-link sign-in (Section 5.4). Admin-only: request a single-use link by
// org code + email, then paste the emailed token to sign in. MFA still applies.
export default function MagicLinkPage() {
  const router = useRouter();

  const [step, setStep] = useState<"request" | "verify">("request");
  const [orgCode, setOrgCode] = useState("");
  const [email, setEmail] = useState("");
  const [token, setToken] = useState("");
  const [mfaCode, setMfaCode] = useState("");
  const [needsMfa, setNeedsMfa] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function requestLink(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setNotice("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/magic-link/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ org_code: orgCode, email }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Request failed");
      // Response is deliberately vague — never reveals whether the email is an admin.
      setNotice("If that email is an admin of this gym, a sign-in link was sent. Paste the token below.");
      setStep("verify");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function verify(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/magic-link/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          org_code: orgCode,
          email,
          token: token.trim(),
          mfa_code: mfaCode || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Sign-in failed");
      if (data.requires_mfa) {
        setNeedsMfa(true);
        setError("");
        return;
      }
      router.push("/app");
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
          <h1 className="text-xl font-semibold">Sign in with a link</h1>
          <p className="mt-1 text-sm text-[var(--muted)]">
            {step === "request"
              ? "For gym owners & managers — no password needed"
              : "Enter the token from your email"}
          </p>
        </div>

        {step === "request" ? (
          <form
            onSubmit={requestLink}
            className="space-y-4 rounded-xl border border-[var(--border)] bg-white p-6 shadow-sm"
          >
            {error && <Alert>{error}</Alert>}
            <Input
              label="Org code"
              required
              value={orgCode}
              onChange={(e) => setOrgCode(e.target.value.toUpperCase())}
              placeholder="IRON-PULS-3K9"
            />
            <Input
              label="Email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="owner@yourgym.com"
            />
            <Button type="submit" loading={loading} className="w-full">
              Email me a link
            </Button>
            <div className="text-center text-sm">
              <Link href="/login" className="text-[var(--primary)] hover:underline">
                Use a password instead
              </Link>
            </div>
          </form>
        ) : (
          <form
            onSubmit={verify}
            className="space-y-4 rounded-xl border border-[var(--border)] bg-white p-6 shadow-sm"
          >
            {notice && <Alert tone="success">{notice}</Alert>}
            {error && <Alert>{error}</Alert>}
            <Input
              label="Sign-in token"
              required
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="Paste the token from your email"
              hint="Single-use, expires in 15 minutes."
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
              <button
                type="button"
                onClick={() => {
                  setStep("request");
                  setToken("");
                  setNeedsMfa(false);
                  setError("");
                }}
                className="text-[var(--muted)] hover:underline"
              >
                ← Start over
              </button>
              <Link href="/login" className="text-[var(--primary)] hover:underline">
                Use a password
              </Link>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
