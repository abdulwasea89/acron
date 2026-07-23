import { useState, useRef } from "react";
import { ScrollView, KeyboardAvoidingView, Platform, TextInput as RNTextInput } from "react-native";
import { View, Text, TextInput } from "@/tw";
import { router } from "expo-router";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { api, ApiError } from "@/lib/api";
import { useRegisterStore } from "@/stores/register-store";
import type { Message } from "@/types/api";

export default function VerifyEmail() {
  const { email, setVerified } = useRegisterStore();
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
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      className="flex-1"
    >
      <ScrollView
        className="flex-1 bg-white dark:bg-bg-dark"
        contentContainerClassName="p-6 pt-20 flex-grow"
        keyboardShouldPersistTaps="handled"
      >
        <Text className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
          Check your email
        </Text>
        <Text className="text-muted mb-2">
          We sent a 6-digit code to
        </Text>
        <Text className="text-lg font-semibold text-gray-900 dark:text-white mb-8">
          {email}
        </Text>

        {error && (
          <View className="mb-4">
            <Alert type="error" message={error} onDismiss={() => setError(null)} />
          </View>
        )}

        <View className="gap-1.5">
          <Text className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Verification Code
          </Text>
          <TextInput
            ref={inputRef}
            className="border border-border dark:border-border-dark bg-white dark:bg-bg-dark-secondary rounded-xl px-4 py-4 text-gray-900 dark:text-white text-2xl text-center tracking-[8px]"
            placeholder="000000"
            placeholderTextColor="#9ca3af"
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

        <Button
          loading={loading}
          disabled={code.length !== 6}
          onPress={handleVerify}
          className="mt-6"
        >
          Verify Email
        </Button>

        <View className="flex-row justify-center mt-6">
          <Text className="text-sm text-muted">Didn't receive it? </Text>
          <Button variant="ghost" loading={resending} onPress={handleResend} className="p-0 h-auto">
            <Text className="text-brand text-sm font-semibold">Resend code</Text>
          </Button>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
