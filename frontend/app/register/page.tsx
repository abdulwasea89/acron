"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AuthShell } from "@/components/AuthShell";
import { Alert, Button, Input, Select } from "@/components/ui";
import { accountSchema, personalSchema, collectErrors } from "@/lib/validation/register";
import { checkPwned } from "@/lib/hibp";

const TIERS = [
  { id: "starter", name: "Starter", price: "$29", cap: "Up to 25 members" },
  { id: "pro", name: "Pro", price: "$79", cap: "Up to 100 members" },
  { id: "enterprise", name: "Enterprise", price: "Custom", cap: "Unlimited" },
];

const STEP_LABELS = ["Account", "About you", "Verify", "Your gym"];

function cx(...parts: (string | false | undefined | null)[]): string {
  return parts.filter(Boolean).join(" ");
}

function Steps({ current }: { current: number }) {
  return (
    <ol className="mb-8 flex items-center gap-2" aria-label={`Step ${current} of ${STEP_LABELS.length}`}>
      {STEP_LABELS.map((label, i) => {
        const n = i + 1;
        const done = n < current;
        const active = n === current;
        const reached = done || active;
        return (
          <li key={label} className="min-w-0 flex-1" aria-current={active ? "step" : undefined}>
            <span
              className={cx(
                "block h-1 rounded-full transition-colors duration-300",
                done ? "bg-[var(--foreground)]" : active ? "bg-[var(--foreground)]" : "bg-[var(--border)]",
              )}
            />
            <span
              className={cx(
                "mt-2 flex items-center gap-1.5 truncate text-[11px] font-semibold leading-tight transition-colors duration-300",
                reached ? "text-[var(--foreground)]" : "text-[var(--muted)]",
              )}
            >
              <span className="tabular-nums opacity-60">{n}</span>
              {label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

export default function RegisterPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [cnic, setCnic] = useState("");
  const [occupation, setOccupation] = useState("");
  const [education, setEducation] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [gender, setGender] = useState("");
  const [emergencyContact, setEmergencyContact] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [breached, setBreached] = useState<null | { count: number }>(null);
  const [checkingBreach, setCheckingBreach] = useState(false);
  const breachTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [code, setCode] = useState("");
  const [gymName, setGymName] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [tier, setTier] = useState("pro");

  const firstInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    firstInputRef.current?.focus();
  }, [step]);

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

  const clearField = (key: string) => setFieldErrors((p) => ({ ...p, [key]: "" }));

  const passwordRules = [
    { label: "12+ characters", met: password.length >= 12 },
    { label: "Uppercase", met: /[A-Z]/.test(password) },
    { label: "Lowercase", met: /[a-z]/.test(password) },
    { label: "Number", met: /[0-9]/.test(password) },
    { label: "Symbol", met: /[^A-Za-z0-9]/.test(password) },
  ];

  // 0–4 scale across 4 bars: all 5 rules met → 4 filled green bars.
  const metCount = passwordRules.filter((r) => r.met).length;
  const strength =
    !password ? 0
    : metCount <= 2 ? 1
    : metCount === 3 ? 2
    : metCount === 4 ? 3
    : 4;
  const strengthTone = ["weak", "weak", "fair", "good", "strong"][strength];
  const strengthLabel = ["", "Weak", "Fair", "Good", "Strong"][strength];

  // HIBP breach check via k-anonymity (Section 4.2 / Security Rule #5).
  // Only fires once all 5 complexity rules are met.
  const allRulesMet = metCount === 5;

  async function checkBreach() {
    if (!allRulesMet) { setBreached(null); return; }
    setCheckingBreach(true);
    try {
      const result = await checkPwned(password);
      setBreached(result.pwned ? { count: result.count } : null);
    } finally {
      setCheckingBreach(false);
    }
  }

  useEffect(() => {
    if (breachTimerRef.current) clearTimeout(breachTimerRef.current);
    if (!allRulesMet) { setBreached(null); return; }
    breachTimerRef.current = setTimeout(checkBreach, 700);
    return () => { if (breachTimerRef.current) clearTimeout(breachTimerRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [password]);

  function validateAccount(): boolean {
    const { success, errors } = collectErrors(accountSchema, { fullName, email, password, confirm });
    setFieldErrors(errors);
    return success;
  }

  function validatePersonal(): boolean {
    const { success, errors } = collectErrors(personalSchema, {
      phone, cnic, dateOfBirth, gender, occupation, education, address, city, emergencyContact,
    });
    setFieldErrors(errors);
    return success;
  }

  function goBack() {
    setError("");
    setFieldErrors({});
    setStep((s) => Math.max(1, s - 1));
  }

  function submitAccount(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!validateAccount()) return;
    if (breached) {
      setError("This password appears in a data breach. Choose a different one.");
      return;
    }
    setFieldErrors({});
    setStep(2);
  }

  async function submitPersonal(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!validatePersonal()) return;
    setLoading(true);
    try {
      await post("/api/auth/register", {
        full_name: fullName,
        email,
        phone,
        cnic,
        occupation,
        education,
        address,
        city,
        date_of_birth: dateOfBirth,
        gender,
        emergency_contact: emergencyContact,
        password,
        confirm_password: confirm,
      });
      setFieldErrors({});
      setStep(3);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function submitVerify(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setFieldErrors({});
    if (!code.trim()) { setFieldErrors({ code: "Required" }); return; }
    setLoading(true);
    try {
      await post("/api/auth/verify-email", { email, code });
      setStep(4);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function submitGym(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setFieldErrors({});
    if (!gymName.trim()) { setFieldErrors({ gymName: "Required" }); return; }
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

  const titles = ["Create your account", "Tell us about you", "Check your inbox", "Set up your gym"];
  const descriptions = [
    "Start with your name, email, and a strong password.",
    "A few details we need to set up your owner profile.",
    `We sent a 6-digit code to ${email}.`,
    "Name your gym, pick your currency, and choose a plan.",
  ];

  return (
    <AuthShell
      wide={step === 2}
      eyebrow={`Step ${step} of ${STEP_LABELS.length}`}
      title={titles[step - 1]}
      description={descriptions[step - 1]}
      footer={<>Already have an account? <Link href="/login" className="auth-link">Sign in</Link></>}
    >
      <div className="auth-form-card">
        <Steps current={step} />

        {error && (
          <div className="mb-5">
            <Alert onDismiss={() => setError("")}>{error}</Alert>
          </div>
        )}

        <div key={step} className="auth-step-panel">
        {/* Step 1 — Account */}
        {step === 1 && (
          <form onSubmit={submitAccount} className="space-y-4">
            <Input
              ref={firstInputRef}
              label="Full name"
              required
              value={fullName}
              onChange={(e) => { setFullName(e.target.value); clearField("fullName"); }}
              placeholder="Sarah Chen"
              error={fieldErrors.fullName}
            />

            <Input
              label="Work email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => { setEmail(e.target.value); clearField("email"); }}
              placeholder="owner@yourgym.com"
              error={fieldErrors.email}
            />

            <div className="password-field">
              <Input
                label="Password"
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
                required
                value={password}
                onChange={(e) => { setPassword(e.target.value); clearField("password"); }}
                placeholder="Create a strong password"
                error={fieldErrors.password}
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

            <div>
              <div className="password-strength">
                {[1, 2, 3, 4].map((i) => (
                  <div
                    key={i}
                    className={`password-strength-bar ${i <= strength ? `is-${strengthTone}` : ""}`}
                  />
                ))}
              </div>
              {password && (
                <p className={`password-strength-label is-${strengthTone}`}>
                  {strengthLabel} password
                </p>
              )}
            </div>

            <div className="password-rules" aria-label="Password requirements">
              {passwordRules.map((rule) => (
                <span key={rule.label} className={`password-rule ${rule.met ? "is-met" : ""}`}>{rule.label}</span>
              ))}
            </div>

            {breached && (
              <p className="mt-2 text-xs leading-relaxed text-[var(--danger)]">
                ⚠ This password appeared in <strong>{breached.count.toLocaleString()}</strong> data breach{breached.count === 1 ? "" : "es"}.
                Choose a different password.
              </p>
            )}
            {checkingBreach && allRulesMet && !breached && (
              <p className="mt-2 text-xs text-[var(--muted)]">Checking against known breaches…</p>
            )}

            <Input
              label="Confirm password"
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
              required
              value={confirm}
              onChange={(e) => { setConfirm(e.target.value); clearField("confirm"); }}
              placeholder="Re-enter your password"
              error={fieldErrors.confirm}
            />

            <Button type="submit" className="w-full">Continue</Button>
          </form>
        )}

        {/* Step 2 — About you */}
        {step === 2 && (
          <form onSubmit={submitPersonal} className="space-y-6">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Input
                ref={firstInputRef}
                label="Phone number"
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                required
                value={phone}
                onChange={(e) => { setPhone(e.target.value); clearField("phone"); }}
                placeholder="+1 (555) 123-4567"
                error={fieldErrors.phone}
              />

              <Input
                label="CNIC / National ID"
                inputMode="numeric"
                maxLength={15}
                required
                value={cnic}
                onChange={(e) => { setCnic(e.target.value.replace(/[^\d-]/g, "")); clearField("cnic"); }}
                placeholder="42101-1234567-8"
                error={fieldErrors.cnic}
              />

              <Input
                label="Date of birth"
                type="date"
                required
                max={new Date().toISOString().slice(0, 10)}
                value={dateOfBirth}
                onChange={(e) => { setDateOfBirth(e.target.value); clearField("dateOfBirth"); }}
                error={fieldErrors.dateOfBirth}
              />

              <Select
                label="Gender"
                required
                value={gender}
                onChange={(e) => { setGender(e.target.value); clearField("gender"); }}
                error={fieldErrors.gender}
              >
                <option value="" disabled>Select…</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="other">Other</option>
              </Select>

              <Input
                label="Occupation"
                required
                value={occupation}
                onChange={(e) => { setOccupation(e.target.value); clearField("occupation"); }}
                placeholder="Gym owner"
                error={fieldErrors.occupation}
              />

              <Input
                label="Education"
                required
                value={education}
                onChange={(e) => { setEducation(e.target.value); clearField("education"); }}
                placeholder="Bachelor's degree"
                error={fieldErrors.education}
              />

              <div className="sm:col-span-2">
                <Input
                  label="Address"
                  required
                  value={address}
                  onChange={(e) => { setAddress(e.target.value); clearField("address"); }}
                  placeholder="123 Main St"
                  error={fieldErrors.address}
                />
              </div>

              <Input
                label="City"
                required
                value={city}
                onChange={(e) => { setCity(e.target.value); clearField("city"); }}
                placeholder="Karachi"
                error={fieldErrors.city}
              />

              <Input
                label="Emergency contact"
                required
                value={emergencyContact}
                onChange={(e) => { setEmergencyContact(e.target.value); clearField("emergencyContact"); }}
                placeholder="+1 (555) 987-6543"
                error={fieldErrors.emergencyContact}
              />
            </div>

            <div className="flex items-center gap-3">
              <Button type="button" variant="secondary" onClick={goBack}>Back</Button>
              <Button type="submit" loading={loading} className="flex-1">Create account</Button>
            </div>
          </form>
        )}

        {/* Step 3 — Verify email */}
        {step === 3 && (
          <form onSubmit={submitVerify} className="space-y-5">
            <div className="rounded-xl bg-[var(--primary-light)] px-4 py-3.5 text-sm leading-relaxed text-[var(--primary)]">
              Enter the 6-digit code sent to <span className="font-semibold">{email}</span>.
            </div>

            <Input
              ref={firstInputRef}
              label="Verification code"
              inputMode="numeric"
              maxLength={6}
              required
              value={code}
              onChange={(e) => { setCode(e.target.value.replace(/\D/g, "")); setFieldErrors({}); }}
              placeholder="000000"
              autoComplete="one-time-code"
              error={fieldErrors.code}
            />

            <div className="flex items-center gap-3">
              <Button type="button" variant="secondary" onClick={goBack}>Back</Button>
              <Button type="submit" loading={loading} className="flex-1">Verify email</Button>
            </div>
          </form>
        )}

        {/* Step 4 — Gym setup */}
        {step === 4 && (
          <form onSubmit={submitGym} className="space-y-5">
            <Input
              ref={firstInputRef}
              label="Gym name"
              required
              value={gymName}
              onChange={(e) => { setGymName(e.target.value); clearField("gymName"); }}
              placeholder="Iron Pulse Boxing"
              error={fieldErrors.gymName}
            />

            <Select label="Default currency" value={currency} onChange={(e) => setCurrency(e.target.value)}>
              <option value="USD">USD — US Dollar</option>
              <option value="EUR">EUR — Euro</option>
              <option value="GBP">GBP — British Pound</option>
              <option value="PKR">PKR — Pakistani Rupee</option>
            </Select>

            <div>
              <span className="mb-2 block text-[13px] font-medium text-[var(--foreground)]">Plan tier</span>
              <div className="grid gap-2.5">
                {TIERS.map((t) => (
                  <button
                    type="button"
                    key={t.id}
                    onClick={() => setTier(t.id)}
                    className={`tier-option flex items-center justify-between rounded-xl border px-4 py-3.5 text-left transition duration-200 ${
                      tier === t.id
                        ? "border-[var(--primary)] bg-[var(--primary-light)] ring-2 ring-[var(--ring)]"
                        : "border-[var(--border)] hover:bg-gray-50"
                    }`}
                  >
                    <div>
                      <div className="text-sm font-semibold text-[var(--foreground)]">{t.name}</div>
                      <div className="mt-0.5 text-xs text-[var(--muted)]">{t.cap}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-bold text-[var(--foreground)]">{t.price}</div>
                      {t.id !== "enterprise" && <div className="text-[11px] text-[var(--muted)]">per month</div>}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Button type="button" variant="secondary" onClick={goBack}>Back</Button>
              <Button type="submit" loading={loading} className="flex-1">Create gym</Button>
            </div>
          </form>
        )}
        </div>
      </div>
    </AuthShell>
  );
}
