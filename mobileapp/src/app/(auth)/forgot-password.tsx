import { useState } from "react";
import { ScrollView, KeyboardAvoidingView, Platform } from "react-native";
import { View, Text, TextInput } from "@/tw";
import { router } from "expo-router";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { api, ApiError } from "@/lib/api";
import type { Message } from "@/types/api";

type Step = "email" | "code" | "reset";

export default function ForgotPassword() {
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleRequestReset = async () => {
    if (!email.includes("@")) { setError("Enter a valid email"); return; }
    setLoading(true);
    setError(null);
    try {
      await api.post<Message>("/auth/password-reset/request", { email });
      setStep("code");
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmReset = async () => {
    if (newPassword !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }
    if (newPassword.length < 12) {
      setError("Password must be at least 12 characters");
      return;
    }
    setLoading(true);
    setError(null);
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
          Reset Password
        </Text>

        {error && (
          <View className="mb-4">
            <Alert type="error" message={error} onDismiss={() => setError(null)} />
          </View>
        )}

        {step === "email" && (
          <View className="gap-4">
            <Text className="text-muted mb-4">
              Enter your email and we'll send you a reset code.
            </Text>
            <Input
              placeholder="you@example.com"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
            />
            <Button loading={loading} onPress={handleRequestReset}>
              Send Reset Code
            </Button>
          </View>
        )}

        {step === "code" && (
          <View className="gap-4">
            <Text className="text-muted mb-4">
              Enter the reset code from your email, then choose a new password.
            </Text>
            <Input
              label="Reset Code"
              placeholder="6-digit code"
              value={code}
              onChangeText={(t) => setCode(t.replace(/\D/g, "").slice(0, 6))}
              keyboardType="number-pad"
              maxLength={6}
            />
            <Input
              label="New Password"
              placeholder="At least 12 characters"
              value={newPassword}
              onChangeText={setNewPassword}
              secureTextEntry
            />
            <Input
              label="Confirm Password"
              placeholder="Repeat new password"
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry
            />
            <Button loading={loading} onPress={handleConfirmReset}>
              Reset Password
            </Button>
          </View>
        )}

        <Button
          variant="ghost"
          onPress={() => router.back()}
          className="mt-6"
        >
          Back to Login
        </Button>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
