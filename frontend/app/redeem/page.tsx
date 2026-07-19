"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { AuthShell } from "@/components/AuthShell";
import { Alert, Button, Input } from "@/components/ui";

export default function RedeemPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const codeParam = searchParams.get("code") || "";

  const [code, setCode] = useState(codeParam);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (codeParam) setCode(codeParam);
  }, [codeParam]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!code.trim()) { setError("Enter your invite code."); return; }
    if (!fullName.trim()) { setError("Enter your full name."); return; }
    if (!email.trim()) { setError("Enter your email."); return; }
    if (!password) { setError("Enter a password."); return; }

    setLoading(true);
    try {
      const res = await fetch("/api/proxy/staff/invites/redeem", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: code.trim(), full_name: fullName.trim(), password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.detail || "Failed to redeem invite.");
        return;
      }
      setDone(true);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  if (done) {
    return (
      <AuthShell
        eyebrow="STAFF INVITE"
        title="Welcome to the team"
        description="Your account has been created. You can now log in."
      >
        <div className="auth-form-card">
          <Button onClick={() => router.push("/login")} className="w-full">
            Go to login
          </Button>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      eyebrow="STAFF INVITE"
      title="Join your team"
      description="Enter the invite code shared by your gym"
      footer={
        <span>
          Already have an account? <Link href="/login" className="auth-link">Log in</Link>
        </span>
      }
    >
      <form onSubmit={onSubmit} className="auth-form-card space-y-4">
        {error && <Alert>{error}</Alert>}

        <Input
          label="Invite code"
          required
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="STAFF-XXXX-XXXX"
          hint="Ask your gym owner for this code"
        />

        <Input
          label="Full name"
          required
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          placeholder="Jane Smith"
        />

        <Input
          label="Email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="jane@example.com"
        />

        <Input
          label="Password"
          type="password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="At least 12 characters"
          hint="12+ characters, mixed case, numbers, symbols"
        />

        <Button type="submit" loading={loading} className="w-full">
          Create account
        </Button>
      </form>
    </AuthShell>
  );
}
