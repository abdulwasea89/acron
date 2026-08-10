import { useState } from "react";
import { View, Text } from "react-native";
import { router } from "expo-router";
import { AuthScreen } from "@/components/auth-screen";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { api, ApiError } from "@/lib/api";
import type { Message } from "@/types/api";

type Step = "email" | "code";

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
    if (newPassword !== confirmPassword) { setError("Passwords do not match"); return; }
    if (newPassword.length < 12) { setError("Password must be at least 12 characters"); return; }
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
    <AuthScreen
      title="Reset password"
      description={
        step === "email"
          ? "Enter your email and we'll send you a reset code."
          : "Enter the code from your email, then choose a new password."
      }
      back
      onBack={() => (step === "code" ? setStep("email") : router.back())}
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
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
          />
          <Button loading={loading} onPress={handleRequestReset}>
            Send reset code
          </Button>
        </View>
      ) : (
        <View className="gap-5">
          <Input
            label="Reset code"
            placeholder="6-digit code"
            value={code}
            onChangeText={(t) => setCode(t.replace(/\D/g, "").slice(0, 6))}
            keyboardType="number-pad"
            maxLength={6}
          />
          <Input
            label="New password"
            placeholder="At least 12 characters"
            value={newPassword}
            onChangeText={setNewPassword}
            secureTextEntry
          />
          <Input
            label="Confirm password"
            placeholder="Repeat new password"
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            secureTextEntry
          />
          <Button loading={loading} onPress={handleConfirmReset}>
            Reset password
          </Button>
        </View>
      )}
    </AuthScreen>
  );
}
