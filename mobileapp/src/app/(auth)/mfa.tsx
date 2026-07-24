import { useState } from "react";
import { View, TextInput } from "@/tw";
import { useColorScheme } from "react-native";
import { router } from "expo-router";
import { AuthScreen } from "@/components/auth-screen";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { api, ApiError } from "@/lib/api";

export default function MfaScreen() {
  const isDark = useColorScheme() === "dark";
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
      router.replace("/(auth)/login");
    } catch (e) {
      if (e instanceof ApiError) setError(e.message);
      else setError("Network error.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthScreen
      title="Two-factor auth"
      description="Enter the 6-digit code from your authenticator app to continue securely."
      back
      footer={
        <View className="items-center gap-3">
          <Button variant="ghost" onPress={() => router.replace("/(auth)/recover-codes")}>
            Use recovery code
          </Button>
        </View>
      }
    >
      {error && (
        <View className="mb-5">
          <Alert type="error" message={error} onDismiss={() => setError(null)} />
        </View>
      )}

      <View className="gap-5">
        <TextInput
          className="border border-border dark:border-border-dark bg-bg-secondary dark:bg-surface-dark-2
            rounded-xl px-4 py-5 text-ink dark:text-paper text-[26px] text-center tracking-[8px] font-semibold"
          placeholder="000000"
          placeholderTextColor={isDark ? "#6e6e6e" : "#94a3b8"}
          value={code}
          onChangeText={(t) => setCode(t.replace(/\D/g, "").slice(0, 6))}
          keyboardType="number-pad"
          maxLength={6}
        />
        <Button loading={loading} disabled={code.length !== 6} onPress={handleVerify}>
          Verify
        </Button>
      </View>
    </AuthScreen>
  );
}
