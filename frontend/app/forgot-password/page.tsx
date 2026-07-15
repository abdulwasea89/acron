"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { AuthShell } from "@/components/AuthShell";
import { Alert, Button, Input } from "@/components/ui";

export default function ForgotPasswordPage() {
  const [step, setStep] = useState<"request" | "reset">("request");
  const [email, setEmail] = useState("");
  const [token, setToken] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const emailRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    emailRef.current?.focus();
  }, []);

  async function sendReset(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!email.trim()) { setError("Enter your email."); return; }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/password-reset/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Request failed");
      setStep("reset");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function confirmReset(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!token.trim()) { setError("Enter the reset token from your email."); return; }
    if (newPassword.length < 12) { setError("Password must be at least 12 characters."); return; }
    if (newPassword !== confirmPassword) { setError("Passwords do not match."); return; }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/password-reset/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, token: token.trim(), new_password: newPassword }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Reset failed");
      setDone(true);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  if (done) {
    return (
      <AuthShell
        eyebrow="Password reset"
        title="Password reset"
        description="Your password has been updated."
        footer={<>Back to <Link href="/login" className="auth-link">sign in</Link></>}
      >
        <div className="auth-form-card">
          <div className="flex flex-col items-center gap-4 py-4 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100">
              <svg className="h-7 w-7 text-emerald-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="m5 13 4 4L19 7" />
              </svg>
            </div>
            <p className="text-sm text-[var(--muted)]">Sign in with your new password.</p>
            <Link href="/login" className="auth-link text-sm font-medium">Go to sign in</Link>
          </div>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      eyebrow="Password reset"
      title={step === "request" ? "Reset your password" : "Check your email"}
      description={step === "request" ? "Enter your email and we'll send you a reset token." : `A reset token was sent to ${email}. Enter it below with your new password.`}
      footer={<>Back to <Link href="/login" className="auth-link">sign in</Link></>}
    >
      <div className="auth-form-card">
        {error && (
          <div className="mb-5">
            <Alert onDismiss={() => setError("")}>{error}</Alert>
          </div>
        )}

        {step === "request" ? (
          <form onSubmit={sendReset} className="space-y-5">
            <Input
              ref={emailRef}
              label="Work email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@yourgym.com"
            />
            <Button type="submit" loading={loading} className="w-full">
              Send reset token
            </Button>
          </form>
        ) : (
          <form onSubmit={confirmReset} className="space-y-5">
            <div className="rounded-xl bg-sky-50 px-4 py-3.5 text-sm leading-relaxed text-sky-700">
              A reset token was sent to {email}. It expires in 15 minutes.
            </div>

            <Input
              label="Reset token"
              required
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="Paste the token from your email"
            />

            <div className="password-field">
              <Input
                label="New password"
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
                required
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="12+ chars, mixed case, number, symbol"
              />
              <button
                type="button"
                className="password-toggle"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? "Hide" : "Show"}
              </button>
            </div>

            <Input
              label="Confirm password"
              type="password"
              autoComplete="new-password"
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Repeat your new password"
            />

            <Button type="submit" loading={loading} className="w-full">
              Reset password
            </Button>
          </form>
        )}
      </div>
    </AuthShell>
  );
}
