"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { AuthShell } from "@/components/AuthShell";
import { Alert, Button, Input } from "@/components/ui";

export default function RecoverCodesPage() {
  const [email, setEmail] = useState("");
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const emailRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    emailRef.current?.focus();
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!email.trim()) { setError("Enter your email."); return; }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/recover-codes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Request failed");
      setDone(true);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell
      eyebrow="Recover gym codes"
      title={done ? "Check your inbox" : "Forgot your gym code?"}
      description={done
        ? `If an account exists for ${email}, your gym codes have been sent.`
        : "Enter your email and we'll send you a list of all your gyms and their codes."}
      footer={<>Back to <Link href="/login" className="auth-link">sign in</Link></>}
    >
      <div className="auth-form-card">
        {error && (
          <div className="mb-5">
            <Alert onDismiss={() => setError("")}>{error}</Alert>
          </div>
        )}

        {done ? (
          <div className="flex flex-col items-center gap-4 py-4 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100">
              <svg className="h-7 w-7 text-emerald-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 8.5l9-5 9 5M5 18V9l7-4 7 4v9M9 13h6v6H9z" />
              </svg>
            </div>
            <p className="text-sm text-[var(--muted)]">
              If your email is registered, you&apos;ll receive a message shortly with all your gym codes.
            </p>
            <Link href="/login" className="auth-link text-sm font-medium">Back to sign in</Link>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="space-y-5">
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
              Send my codes
            </Button>
          </form>
        )}
      </div>
    </AuthShell>
  );
}
