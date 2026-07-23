import { useState } from "react";
import { ScrollView, KeyboardAvoidingView, Platform } from "react-native";
import { View, Text, TextInput } from "@/tw";
import { router } from "expo-router";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { api, ApiError } from "@/lib/api";
import type { LoginResponse } from "@/types/api";

export default function MfaScreen() {
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleVerify = async () => {
    if (code.length !== 6) return;
    setLoading(true);
    setError(null);
    try {
      // MFA code is sent along with the login request
      // (this screen is shown when login returned requires_mfa=true)
      // The user needs to re-submit login with the mfa_code
      router.replace("/(auth)/login");
    } catch (e) {
      if (e instanceof ApiError) setError(e.message);
      else setError("Network error.");
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
          Two-Factor Auth
        </Text>
        <Text className="text-muted mb-8">
          Enter the 6-digit code from your authenticator app.
        </Text>

        {error && (
          <View className="mb-4">
            <Alert type="error" message={error} onDismiss={() => setError(null)} />
          </View>
        )}

        <View className="gap-4">
          <TextInput
            className="border border-border dark:border-border-dark bg-white dark:bg-bg-dark-secondary rounded-xl px-4 py-4 text-gray-900 dark:text-white text-2xl text-center tracking-[8px]"
            placeholder="000000"
            placeholderTextColor="#9ca3af"
            value={code}
            onChangeText={(t) => setCode(t.replace(/\D/g, "").slice(0, 6))}
            keyboardType="number-pad"
            maxLength={6}
          />
          <Button
            loading={loading}
            disabled={code.length !== 6}
            onPress={handleVerify}
          >
            Verify
          </Button>
        </View>

        <View className="mt-8 items-center gap-4">
          <Button variant="ghost" onPress={() => router.replace("/(auth)/recover-codes")}>
            Use recovery code
          </Button>
          <Button variant="ghost" onPress={() => router.back()}>
            Back
          </Button>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
