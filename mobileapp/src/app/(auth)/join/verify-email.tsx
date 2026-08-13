import { useState } from "react";
import { View, Text, Pressable } from "react-native";
import { router } from "expo-router";
import { AuthScreen } from "@/components/auth-screen";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { OtpInput } from "@/components/ui/otp-input";
import { api, ApiError } from "@/lib/api";
import { useJoinStore } from "@/stores/join-store";
import type { Message } from "@/types/api";

export default function JoinVerifyEmail() {
  const { orgCode, orgName, setEmail, setVerified } = useJoinStore();
  const [email, setEmailLocal] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"email" | "code">("email");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  if (!orgCode) {
    router.replace("/(auth)/register/org-code");
    return null;
  }

  const handleRequestCode = async () => {
    setError(null);
    setFieldErrors({});
    if (!email.includes("@")) {
      setFieldErrors({ email: "Enter a valid email" });
      return;
    }

    setLoading(true);
    try {
      await api.post<Message>("/memberships/signup/request-email", { org_code: orgCode, email });
      setEmail(email);
      setStep("code");
    } catch (e) {
      if (e instanceof ApiError) setError(e.message);
      else setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async () => {
    if (code.length !== 6) return;
    setError(null);
    setLoading(true);
    try {
      await api.post<Message>("/memberships/signup/verify-email", { org_code: orgCode, email, code });
      setVerified();
      router.push("/(auth)/join/set-password");
    } catch (e) {
      if (e instanceof ApiError) setError(e.message);
      else setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    try {
      await api.post<Message>("/memberships/signup/request-email", { org_code: orgCode, email });
    } catch {
      // Silent
    }
  };

  return (
    <AuthScreen
      title={step === "email" ? "Enter your email" : "Check your email"}
      description={
        step === "email"
          ? "We'll send a 6-digit code to verify it's really you."
          : `We sent a 6-digit code to ${email}.`
      }
      back
      onBack={() => (step === "code" ? setStep("email") : router.back())}
      footer={
        step === "code" ? (
          <View className="flex-row justify-center items-center">
            <Text className="text-[13px] text-muted">Didn&apos;t receive it? </Text>
            <Pressable onPress={handleResend} className="active:opacity-60">
              <Text className="text-[13px] font-bold text-foreground">Resend</Text>
            </Pressable>
          </View>
        ) : undefined
      }
    >
      {error && (
        <View className="mb-5">
          <Alert type="error" message={error} onDismiss={() => setError(null)} />
        </View>
      )}

      {step === "email" ? (
        <View className="gap-5">
          <Input
            label="Email"
            placeholder="you@example.com"
            value={email}
            onChangeText={(t) => { setEmailLocal(t); setFieldErrors({}); }}
            autoCapitalize="none"
            keyboardType="email-address"
            error={fieldErrors.email}
          />
          <Button loading={loading} onPress={handleRequestCode}>
            Send verification code
          </Button>
        </View>
      ) : (
        <View className="gap-5">
          <OtpInput
            value={code}
            onChange={setCode}
            onComplete={() => handleVerify()}
          />
          <Button loading={loading} disabled={code.length !== 6} onPress={handleVerify}>
            Verify email
          </Button>
        </View>
      )}
    </AuthScreen>
  );
}
