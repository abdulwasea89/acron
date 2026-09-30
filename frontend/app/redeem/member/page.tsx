"use client";

// Member / seat-holder invite redemption. Pairs with the email sent by
// members_service._send_invite_email. The sibling /redeem page handles staff
// invites, which go to a different endpoint and do not need an org code.

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { AuthShell } from "@/components/AuthShell";
import { Alert, Button, Input } from "@/components/ui";
import { redeemMemberInviteSchema } from "@/lib/validation/auth";
import { collectErrors } from "@/lib/validation/shared";

function RedeemMemberInviteForm() {
  const router = useRouter();
  const params = useSearchParams();

  // Prefill from the emailed link so the member only types a password.
  const [orgCode, setOrgCode] = useState(params.get("org_code") || "");
  const [email, setEmail] = useState(params.get("email") || "");
  const [code, setCode] = useState(params.get("code") || "");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setFieldErrors({});

    const { success, errors, data } = collectErrors(redeemMemberInviteSchema, {
      orgCode,
      email,
      code,
      password,
    });
    if (!success) {
      setFieldErrors(errors);
      return;
    }
    if (!data) return;

    setLoading(true);
    try {
      const res = await fetch("/api/proxy/memberships/invite/redeem", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          org_code: data.orgCode,
          email: data.email,
          code: data.code,
          password: data.password,
        }),
      });
      const body = await res.json();
      if (!res.ok) {
        setError(
          body?.detail === "Invalid or expired code."
            ? "That invite code is not valid for this gym and email. It may have already been used — ask for a fresh invite."
            : body?.detail || "Could not redeem this invite.",
        );
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
        eyebrow="INVITATION"
        title="You're in"
        description="Your account is ready. Log in with the password you just set."
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
      eyebrow="INVITATION"
      title="Accept your invite"
      description="Use the details from your invitation email to set up your account"
      footer={
        <span>
          Already have an account? <Link href="/login" className="auth-link">Log in</Link>
        </span>
      }
    >
      <form onSubmit={onSubmit} className="auth-form-card space-y-4">
        {error && <Alert>{error}</Alert>}

        <Input
          label="Organization code"
          required
          value={orgCode}
          onChange={(e) => setOrgCode(e.target.value)}
          placeholder="ACME-SUIT-6G2"
          error={fieldErrors.orgCode}
          hint="Shown in your invitation email"
        />

        <Input
          label="Email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@company.com"
          error={fieldErrors.email}
          hint="Must match the email you were invited with"
        />

        <Input
          label="Invite code"
          required
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="Paste your invite code"
          error={fieldErrors.code}
          hint="If it wrapped onto a second line, paste it anyway — extra spaces are ignored"
        />

        <Input
          label="Create a password"
          type={showPassword ? "text" : "password"}
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="At least 12 characters"
          error={fieldErrors.password}
          hint="12+ characters, mixed case, numbers, symbols"
          trailing={
            <button
              type="button"
              className="password-toggle"
              onClick={() => setShowPassword((s) => !s)}
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? "Hide" : "Show"}
            </button>
          }
        />

        <Button type="submit" loading={loading} className="w-full">
          Activate my account
        </Button>
      </form>
    </AuthShell>
  );
}

export default function RedeemMemberPage() {
  return (
    <Suspense>
      <RedeemMemberInviteForm />
    </Suspense>
  );
}
