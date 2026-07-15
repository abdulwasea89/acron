"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AuthShell } from "@/components/AuthShell";
import { Alert, Button, Input } from "@/components/ui";
import { magicRequestSchema, magicVerifySchema } from "@/lib/validation/auth";
import { collectErrors } from "@/lib/validation/shared";

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
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const emailRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    emailRef.current?.focus();
  }, [step]);

  async function requestLink(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setNotice("");
    const check = collectErrors(magicRequestSchema, { orgCode, email });
    setFieldErrors(check.errors);
    if (!check.success) return;
    setLoading(true);
    try {
      const res = await fetch("/api/auth/magic-link/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ org_code: orgCode, email }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Request failed");
      setNotice("If the details match an account, a sign-in link was sent.");
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
    const check = collectErrors(magicVerifySchema, { token });
    setFieldErrors(check.errors);
    if (!check.success) return;
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
    <AuthShell
      eyebrow="Passwordless"
      title={needsMfa ? "One more quick check" : step === "request" ? "Sign in with a link" : "Check your inbox"}
      description={needsMfa ? "Enter the code from your authenticator app to continue." : step === "request" ? "Enter your details and we'll email you a single-use sign-in link." : "Paste the token from the email to sign in securely."}
      footer={<>Back to <Link href="/login" className="auth-link">sign in with password</Link></>}
    >
      <div className="auth-form-card">
        {error && (
          <div className="mb-5">
            <Alert onDismiss={() => setError("")}>{error}</Alert>
          </div>
        )}

        {step === "request" ? (
          <form onSubmit={requestLink} className="space-y-4">
            <Input
              label="Gym code"
              required
              value={orgCode}
              onChange={(e) => { setOrgCode(e.target.value.toUpperCase()); setFieldErrors((p) => ({ ...p, orgCode: "" })); }}
              placeholder="IRON-PULS-3K9"
              autoComplete="organization"
              error={fieldErrors.orgCode}
            />

            <Input
              ref={emailRef}
              label="Work email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => { setEmail(e.target.value); setFieldErrors((p) => ({ ...p, email: "" })); }}
              placeholder="owner@yourgym.com"
              error={fieldErrors.email}
            />

            <Button type="submit" loading={loading} className="w-full">
              Email sign-in link
            </Button>
          </form>
        ) : (
          <form onSubmit={verify} className="space-y-5">
            {notice && <Alert tone="info">{notice}</Alert>}

            <Input
              label="Sign-in token"
              required
              value={token}
              onChange={(e) => { setToken(e.target.value); setFieldErrors((p) => ({ ...p, token: "" })); }}
              placeholder="Paste the token from your email"
              hint="Single-use, expires in 15 minutes"
              error={fieldErrors.token}
            />

            {needsMfa && (
              <Input
                label="Authenticator code"
                inputMode="numeric"
                maxLength={6}
                required
                value={mfaCode}
                onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, ""))}
                placeholder="000000"
                autoComplete="one-time-code"
              />
            )}

            <Button type="submit" loading={loading} className="w-full">
              {needsMfa ? "Verify & sign in" : "Sign in"}
            </Button>

            <div className="text-center">
              <button
                type="button"
                onClick={() => { setStep("request"); setToken(""); setNeedsMfa(false); setError(""); setNotice(""); setFieldErrors({}); }}
                className="text-sm font-medium text-[var(--muted)] hover:text-[var(--foreground)] transition-colors"
              >
                ← Start over
              </button>
            </div>
          </form>
        )}
      </div>
    </AuthShell>
  );
}
