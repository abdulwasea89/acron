import { useState } from "react";
import { View, Text, Pressable } from "react-native";
import { router } from "expo-router";
import { AuthScreen } from "@/components/auth-screen";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { OtpInput } from "@/components/ui/otp-input";
import { api, ApiError } from "@/lib/api";
import { useRegisterStore } from "@/stores/register-store";
import type { Message } from "@/types/api";

export default function VerifyEmail() {
  const { email, setVerified } = useRegisterStore();
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!email) {
    router.replace("/(auth)/register/step-1");
    return null;
  }

  const handleVerify = async () => {
    if (code.length !== 6) return;
    setError(null);
    setLoading(true);
    try {
      await api.post<Message>("/auth/verify-email", { email, code });
      setVerified();
      router.push("/(auth)/register/gym-details");
    } catch (e) {
      if (e instanceof ApiError) setError(e.message);
      else setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setResending(true);
    try {
      await api.post<Message>("/auth/resend-code", { email });
    } catch {
      // Silent — backend returns the same message for security
    } finally {
      setResending(false);
    }
  };

  return (
    <AuthScreen
      title="Check your email"
      description={`We sent a 6-digit code to ${email}.`}
      back
      footer={
        <View className="flex-row justify-center items-center">
          <Text className="text-[13px] text-muted">Didn't receive it? </Text>
          <Pressable onPress={handleResend} disabled={resending} className="active:opacity-60">
            <Text className="text-[13px] font-bold text-foreground">
              {resending ? "Sending…" : "Resend code"}
            </Text>
          </Pressable>
        </View>
      }
    >
      {error && (
        <View className="mb-5">
          <Alert type="error" message={error} onDismiss={() => setError(null)} />
        </View>
      )}

      <View className="gap-2">
        <Text className="text-[13px] font-semibold text-foreground">Verification code</Text>
        <OtpInput
          value={code}
          onChange={setCode}
          onComplete={() => handleVerify()}
        />
      </View>

      <Button loading={loading} disabled={code.length !== 6} onPress={handleVerify} className="mt-6">
        Verify email
      </Button>
    </AuthScreen>
  );
}
