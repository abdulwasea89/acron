import { useState } from "react";
import { ScrollView, KeyboardAvoidingView, Platform } from "react-native";
import { View, Text } from "@/tw";
import { router } from "expo-router";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { api, ApiError } from "@/lib/api";
import type { Message } from "@/types/api";

export default function RecoverCodes() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!email.includes("@")) { setError("Enter a valid email"); return; }
    setLoading(true);
    setError(null);
    try {
      await api.post<Message>("/auth/recover-codes", { email });
      setSent(true);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (sent) {
    return (
      <View className="flex-1 items-center justify-center bg-white dark:bg-bg-dark p-6">
        <Text className="text-2xl font-bold text-gray-900 dark:text-white mb-2 text-center">
          Check your email
        </Text>
        <Text className="text-muted text-center mb-8">
          If an account exists with that email, your gym codes have been sent.
        </Text>
        <Button onPress={() => router.replace("/(auth)/login")}>
          Back to Login
        </Button>
      </View>
    );
  }

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
          Recover Gym Codes
        </Text>
        <Text className="text-muted mb-8">
          Enter your email and we'll send you a list of your gyms and codes.
        </Text>

        {error && (
          <View className="mb-4">
            <Alert type="error" message={error} onDismiss={() => setError(null)} />
          </View>
        )}

        <View className="gap-4">
          <Input
            placeholder="you@example.com"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
          />
          <Button loading={loading} onPress={handleSubmit}>
            Send Codes
          </Button>
        </View>

        <Button variant="ghost" onPress={() => router.back()} className="mt-6">
          Back to Login
        </Button>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
