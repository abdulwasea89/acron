"use client";

import { useState, useEffect } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Card, CardHeader, Button, Alert, Input, Spinner } from "@/components/ui";
import { api, ApiError } from "@/lib/api";
import type { MfaStatus, MfaEnrollResponse } from "@/lib/types";

type Phase = "loading" | "disabled" | "enrolling" | "enabled";

export function MfaCard({ mfaRequired }: { mfaRequired: boolean }) {
  const [phase, setPhase] = useState<Phase>("loading");
  const [enrollData, setEnrollData] = useState<MfaEnrollResponse | null>(null);
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [confirmingDisable, setConfirmingDisable] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    api
      .get<MfaStatus>("/auth/mfa")
      .then((s) => setPhase(s.mfa_enabled ? "enabled" : "disabled"))
      .catch(() => setPhase("disabled"));
  }, []);

  async function startEnroll() {
    setError("");
    setSubmitting(true);
    try {
      const data = await api.post<MfaEnrollResponse>("/auth/mfa/enroll");
      setEnrollData(data);
      setPhase("enrolling");
    } catch (e) {
      setError((e as ApiError).message);
    } finally {
      setSubmitting(false);
    }
  }

  async function confirmEnroll(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      await api.post("/auth/mfa/confirm", { code });
      setPhase("enabled");
      setCode("");
      setEnrollData(null);
      setSuccess("Multi-factor authentication enabled.");
    } catch (e) {
      setError((e as ApiError).message);
    } finally {
      setSubmitting(false);
    }
  }

  async function disableMfa(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      await api.post("/auth/mfa/disable", { password });
      setPhase("disabled");
      setPassword("");
      setConfirmingDisable(false);
      setSuccess("Multi-factor authentication disabled.");
    } catch (e) {
      setError((e as ApiError).message);
    } finally {
      setSubmitting(false);
    }
  }

  function cancelEnroll() {
    setPhase("disabled");
    setEnrollData(null);
    setCode("");
    setError("");
  }

  function cancelDisable() {
    setConfirmingDisable(false);
    setPassword("");
    setError("");
  }

  async function copySecret() {
    if (!enrollData) return;
    try {
      await navigator.clipboard.writeText(enrollData.secret);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  }

  if (phase === "loading") {
    return (
      <Card>
        <CardHeader title="Security (MFA)" subtitle="Multi-factor authentication" />
        <div className="p-6">
          <Spinner />
        </div>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader title="Security (MFA)" subtitle="Multi-factor authentication" />
      <div className="space-y-4 p-6">
        {error && <Alert tone="danger">{error}</Alert>}
        {success && (
          <Alert tone="success" onDismiss={() => setSuccess("")}>
            {success}
          </Alert>
        )}

        {mfaRequired && phase !== "enabled" && (
          <Alert tone="warning">
            Your organization requires multi-factor authentication. Please set it up below.
          </Alert>
        )}

        {phase === "disabled" && (
          <div>
            <p className="mb-4 text-sm text-[var(--foreground-muted)]">
              Add an extra layer of security to your account. Once enabled, you'll need both your
              password and a 6-digit code from your authenticator app to sign in.
            </p>
            <Button onClick={startEnroll} loading={submitting}>
              Enable MFA
            </Button>
          </div>
        )}

        {phase === "enrolling" && enrollData && (
          <div className="space-y-5">
            <div>
              <p className="mb-3 text-sm font-medium text-[var(--foreground)]">
                Scan this QR code with Google Authenticator or any TOTP app:
              </p>
              <div className="inline-block rounded-xl border border-[var(--border)] bg-white p-3">
                <QRCodeSVG value={enrollData.otpauth_uri} size={180} />
              </div>
            </div>

            <div>
              <p className="mb-2 text-sm font-medium text-[var(--foreground)]">
                Or enter this key manually:
              </p>
              <div className="flex items-center gap-2">
                <code className="flex-1 rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 font-mono text-sm tracking-wider text-[var(--foreground)]">
                  {enrollData.secret}
                </code>
                <Button variant="secondary" onClick={copySecret} size="sm">
                  {copied ? "Copied!" : "Copy"}
                </Button>
              </div>
              <p className="mt-1.5 text-xs text-[var(--muted)]">
                You can also{" "}
                <a
                  href={enrollData.otpauth_uri}
                  className="underline hover:text-[var(--foreground)]"
                >
                  open this link in your authenticator app
                </a>
                .
              </p>
            </div>

            <form onSubmit={confirmEnroll} className="space-y-3">
              <Input
                label="Enter the 6-digit code from your app"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                placeholder="000000"
                maxLength={6}
                autoComplete="one-time-code"
                inputMode="numeric"
                pattern="[0-9]*"
              />
              <div className="flex gap-2">
                <Button type="submit" loading={submitting} disabled={code.length !== 6}>
                  Verify & Enable
                </Button>
                <Button variant="secondary" onClick={cancelEnroll} disabled={submitting}>
                  Cancel
                </Button>
              </div>
            </form>
          </div>
        )}

        {phase === "enabled" && (
          <div>
            <div className="mb-4 flex items-center gap-2">
              <span className="flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
              <span className="text-sm font-medium text-[var(--foreground)]">
                Multi-factor authentication is enabled.
              </span>
            </div>

            {!confirmingDisable ? (
              <Button variant="danger" onClick={() => setConfirmingDisable(true)}>
                Disable MFA
              </Button>
            ) : (
              <form onSubmit={disableMfa} className="space-y-3">
                <Input
                  label="Enter your password to confirm"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Current password"
                  autoComplete="current-password"
                />
                <div className="flex gap-2">
                  <Button variant="danger" type="submit" loading={submitting} disabled={!password}>
                    Confirm Disable
                  </Button>
                  <Button variant="secondary" onClick={cancelDisable} disabled={submitting}>
                    Cancel
                  </Button>
                </div>
              </form>
            )}
          </div>
        )}
      </div>
    </Card>
  );
}
