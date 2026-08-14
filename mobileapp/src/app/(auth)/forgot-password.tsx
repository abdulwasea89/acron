import { useRef, useState } from "react";
import { TextInput, View } from "react-native";
import { router } from "expo-router";

import { AuthScreen } from "@/components/auth-screen";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { Field, FieldGroup } from "@/components/auth/field-group";
import { PasswordStrength } from "@/components/auth/password-strength";
import { api, ApiError } from "@/lib/api";
import { emailSchema, passwordSchema } from "@/lib/validations";
import type { Message } from "@/types/api";

type Step = "email" | "reset";

export default function ForgotPassword() {
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const passwordRef = useRef<TextInput>(null);
  const confirmRef = useRef<TextInput>(null);

  const handleRequestReset = async () => {
    const parsed = emailSchema.safeParse(email);
    if (!parsed.success) {
      setFieldErrors({ email: parsed.error.issues[0].message });
      return;
    }

    setLoading(true);
    setError(null);
    setFieldErrors({});
    try {
      await api.post<Message>("/auth/password-reset/request", { email });
      setStep("reset");
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmReset = async () => {
    const next: Record<string, string> = {};

    if (code.length !== 6) next.code = "Enter the 6-digit code from your email";

    const pass = passwordSchema.safeParse(newPassword);
    if (!pass.success) next.password = pass.error.issues[0].message;
    else if (newPassword !== confirmPassword) next.confirm = "Passwords do not match";

    if (Object.keys(next).length > 0) {
      setFieldErrors(next);
      return;
    }

    setLoading(true);
    setError(null);
    setFieldErrors({});
    try {
      await api.post<Message>("/auth/password-reset/confirm", {
        email,
        token: code,
        new_password: newPassword,
      });
      router.replace("/(auth)/login");
    } catch (e) {
      if (e instanceof ApiError) setError(e.message);
      else setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const onEmailStep = step === "email";

  return (
    <AuthScreen
      title={onEmailStep ? "Reset password" : "Choose a new password"}
      subtitle={
        onEmailStep
          ? "We'll email you a code to confirm it's your account."
          : `Enter the code sent to ${email}, then pick a new password.`
      }
      back
      onBack={() => (onEmailStep ? router.back() : setStep("email"))}
      footer={
        onEmailStep ? (
          <Button loading={loading} onPress={handleRequestReset}>
            Send reset code
          </Button>
        ) : (
          <Button loading={loading} onPress={handleConfirmReset}>
            Reset password
          </Button>
        )
      }
    >
      {error ? (
        <View className="mb-5">
          <Alert type="error" message={error} onDismiss={() => setError(null)} />
        </View>
      ) : null}

      {onEmailStep ? (
        <FieldGroup caption="If an account exists for that address, a code is on its way.">
          <Field
            label="Email"
            placeholder="you@example.com"
            value={email}
            onChangeText={(t) => {
              setEmail(t);
              setFieldErrors({});
            }}
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            autoFocus
            returnKeyType="go"
            onSubmitEditing={handleRequestReset}
            error={fieldErrors.email}
          />
        </FieldGroup>
      ) : (
        <>
          <FieldGroup>
            <Field
              label="Reset code"
              placeholder="6-digit code"
              value={code}
              onChangeText={(t) => {
                setCode(t.replace(/\D/g, "").slice(0, 6));
                setFieldErrors((p) => ({ ...p, code: "" }));
              }}
              keyboardType="number-pad"
              maxLength={6}
              autoFocus
              returnKeyType="next"
              onSubmitEditing={() => passwordRef.current?.focus()}
              submitBehavior="submit"
              error={fieldErrors.code}
            />
          </FieldGroup>

          <View className="mt-6">
            <FieldGroup>
              <Field
                ref={passwordRef}
                label="New password"
                placeholder="At least 12 characters"
                value={newPassword}
                onChangeText={(t) => {
                  setNewPassword(t);
                  setFieldErrors((p) => ({ ...p, password: "" }));
                }}
                autoComplete="new-password"
                secure
                returnKeyType="next"
                onSubmitEditing={() => confirmRef.current?.focus()}
                submitBehavior="submit"
                error={fieldErrors.password}
              />
              <Field
                ref={confirmRef}
                label="Confirm password"
                placeholder="Type it again"
                value={confirmPassword}
                onChangeText={(t) => {
                  setConfirmPassword(t);
                  setFieldErrors((p) => ({ ...p, confirm: "" }));
                }}
                autoComplete="new-password"
                secure
                returnKeyType="go"
                onSubmitEditing={handleConfirmReset}
                error={fieldErrors.confirm}
              />
            </FieldGroup>

            <PasswordStrength value={newPassword} />
          </View>
        </>
      )}
    </AuthScreen>
  );
}
