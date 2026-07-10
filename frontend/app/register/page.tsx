"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Alert, Button, Input, Select } from "@/components/ui";

type Step = 1 | 2 | 3;

const TIERS = [
  { id: "starter", name: "Starter", price: "$29/mo", cap: "Up to 25 members" },
  { id: "pro", name: "Pro", price: "$79/mo", cap: "Up to 100 members" },
  { id: "enterprise", name: "Enterprise", price: "Custom", cap: "Unlimited" },
];

export default function RegisterPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>(1);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // step 1
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  // step 2
  const [code, setCode] = useState("");
  // step 3
  const [gymName, setGymName] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [tier, setTier] = useState("pro");

  async function post(path: string, body: unknown) {
    const res = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || "Something went wrong");
    return data;
  }

  async function submitStep1(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (password !== confirm) return setError("Passwords do not match.");
    const pwdErrors: string[] = [];
    if (password.length < 12) pwdErrors.push("at least 12 characters");
    if (!/[a-z]/.test(password)) pwdErrors.push("a lowercase letter");
    if (!/[A-Z]/.test(password)) pwdErrors.push("an uppercase letter");
    if (!/[0-9]/.test(password)) pwdErrors.push("a number");
    if (!/[^A-Za-z0-9]/.test(password)) pwdErrors.push("a symbol");
    if (pwdErrors.length) return setError("Password must contain " + pwdErrors.join(", ") + ".");
    setLoading(true);
    try {
      await post("/api/auth/register", {
        full_name: fullName,
        email,
        password,
        confirm_password: confirm,
      });
      setStep(2);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function submitStep2(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await post("/api/auth/verify-email", { email, code });
      setStep(3);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function submitStep3(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await post("/api/auth/register-gym", {
        owner_email: email,
        details: { name: gymName, default_currency: currency },
        tier,
      });
      router.push("/app");
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--background)] px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          <h1 className="text-xl font-semibold">Register your gym</h1>
          <p className="mt-1 text-sm text-[var(--muted)]">Step {step} of 3</p>
          <div className="mx-auto mt-3 flex max-w-[200px] gap-1.5">
            {[1, 2, 3].map((n) => (
              <div
                key={n}
                className={`h-1.5 flex-1 rounded-full ${n <= step ? "bg-[var(--primary)]" : "bg-gray-200"}`}
              />
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-[var(--border)] bg-white p-6 shadow-sm">
          {error && <div className="mb-4"><Alert>{error}</Alert></div>}

          {step === 1 && (
            <form onSubmit={submitStep1} className="space-y-4">
              <Input label="Full name" required value={fullName} onChange={(e) => setFullName(e.target.value)} />
              <Input label="Email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
              <Input
                label="Password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                hint="12+ characters, mixed case, numbers & symbols."
              />
              <Input label="Confirm password" type="password" required value={confirm} onChange={(e) => setConfirm(e.target.value)} />
              <Button type="submit" loading={loading} className="w-full">Create account</Button>
            </form>
          )}

          {step === 2 && (
            <form onSubmit={submitStep2} className="space-y-4">
              <p className="text-sm text-[var(--muted)]">
                We sent a 6-digit code to <span className="font-medium text-[var(--foreground)]">{email}</span>.
              </p>
              <Input
                label="Verification code"
                inputMode="numeric"
                maxLength={6}
                required
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                placeholder="123456"
              />
              <Button type="submit" loading={loading} className="w-full">Verify email</Button>
            </form>
          )}

          {step === 3 && (
            <form onSubmit={submitStep3} className="space-y-4">
              <Input label="Gym name" required value={gymName} onChange={(e) => setGymName(e.target.value)} placeholder="Iron Pulse Boxing" />
              <Select label="Default currency" value={currency} onChange={(e) => setCurrency(e.target.value)}>
                <option value="USD">USD — US Dollar</option>
                <option value="EUR">EUR — Euro</option>
                <option value="GBP">GBP — British Pound</option>
                <option value="PKR">PKR — Pakistani Rupee</option>
              </Select>
              <div>
                <span className="mb-1.5 block text-sm font-medium">Plan tier</span>
                <div className="grid gap-2">
                  {TIERS.map((t) => (
                    <button
                      type="button"
                      key={t.id}
                      onClick={() => setTier(t.id)}
                      className={`flex items-center justify-between rounded-lg border px-4 py-3 text-left transition ${
                        tier === t.id ? "border-[var(--primary)] ring-2 ring-[var(--ring)]" : "border-[var(--border)] hover:bg-gray-50"
                      }`}
                    >
                      <div>
                        <div className="text-sm font-medium">{t.name}</div>
                        <div className="text-xs text-[var(--muted)]">{t.cap}</div>
                      </div>
                      <div className="text-sm font-semibold">{t.price}</div>
                    </button>
                  ))}
                </div>
              </div>
              <Button type="submit" loading={loading} className="w-full">Create gym & finish</Button>
            </form>
          )}

          <p className="mt-4 text-center text-sm text-[var(--muted)]">
            Already have an account?{" "}
            <Link href="/login" className="text-[var(--primary)] hover:underline">Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
