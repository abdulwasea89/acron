import { useState, useRef } from "react";
import { ScrollView, KeyboardAvoidingView, Platform, TextInput as RNTextInput } from "react-native";
import { View, Text, TextInput, Pressable } from "@/tw";
import { router } from "expo-router";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { api, ApiError } from "@/lib/api";
import { useJoinStore } from "@/stores/join-store";
import type { SignupStartOut, Message } from "@/types/api";

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
      await api.post<Message>("/memberships/signup/request-email", {
        org_code: orgCode,
        email,
      });
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
      await api.post<Message>("/memberships/signup/verify-email", {
        org_code: orgCode,
        email,
        code,
      });
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
      await api.post<Message>("/memberships/signup/request-email", {
        org_code: orgCode,
        email,
      });
    } catch {
      // Silent
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
        <View className="items-center mb-6">
          <Text className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
            {orgName}
          </Text>
          <Text className="text-sm text-muted">Code: {orgCode}</Text>
        </View>

        {error && (
          <View className="mb-4">
            <Alert type="error" message={error} onDismiss={() => setError(null)} />
          </View>
        )}

        {step === "email" ? (
          <View className="gap-4">
            <Text className="text-xl font-semibold text-gray-900 dark:text-white">
              Enter your email
            </Text>
            <Input
              placeholder="you@example.com"
              value={email}
              onChangeText={(t) => { setEmailLocal(t); setFieldErrors({}); }}
              autoCapitalize="none"
              keyboardType="email-address"
              error={fieldErrors.email}
            />
            <Button loading={loading} onPress={handleRequestCode}>
              Send Verification Code
            </Button>
          </View>
        ) : (
          <View className="gap-4">
            <Text className="text-xl font-semibold text-gray-900 dark:text-white">
              Check your email
            </Text>
            <Text className="text-muted">
              We sent a 6-digit code to {email}
            </Text>

            <TextInput
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

            <Button
              loading={loading}
              disabled={code.length !== 6}
              onPress={handleVerify}
            >
              Verify Email
            </Button>

            <View className="flex-row justify-center">
              <Text className="text-sm text-muted">Didn't receive it? </Text>
              <Pressable onPress={handleResend}>
                <Text className="text-brand text-sm font-semibold">Resend</Text>
              </Pressable>
            </View>
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
