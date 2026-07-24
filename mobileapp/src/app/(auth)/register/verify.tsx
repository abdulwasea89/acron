import { useState, useRef } from "react";
import { TextInput as RNTextInput, useColorScheme } from "react-native";
import { View, Text, TextInput, Pressable } from "@/tw";
import { router } from "expo-router";
import { AuthScreen } from "@/components/auth-screen";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { api, ApiError } from "@/lib/api";
import { useRegisterStore } from "@/stores/register-store";
import type { Message } from "@/types/api";

export default function VerifyEmail() {
  const { email, setVerified } = useRegisterStore();
  const isDark = useColorScheme() === "dark";
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<RNTextInput>(null);

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
          <Text className="text-[13px] text-muted dark:text-muted-dark">Didn't receive it? </Text>
          <Pressable onPress={handleResend} disabled={resending} className="active:opacity-60">
            <Text className="text-[13px] font-bold text-ink dark:text-paper">
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
        <Text className="text-[13px] font-semibold text-ink dark:text-paper">Verification code</Text>
        <TextInput
          ref={inputRef}
          className="border border-border dark:border-border-dark bg-bg-secondary dark:bg-surface-dark-2
            rounded-xl px-4 py-5 text-ink dark:text-paper text-[26px] text-center tracking-[8px] font-semibold"
          placeholder="000000"
          placeholderTextColor={isDark ? "#6e6e6e" : "#94a3b8"}
          value={code}
          onChangeText={(t) => {
            const digits = t.replace(/\D/g, "").slice(0, 6);
            setCode(digits);
            if (digits.length === 6) handleVerify();
          }}
          keyboardType="number-pad"
          maxLength={6}
        />
      </View>

      <Button loading={loading} disabled={code.length !== 6} onPress={handleVerify} className="mt-6">
        Verify email
      </Button>
    </AuthScreen>
  );
}
