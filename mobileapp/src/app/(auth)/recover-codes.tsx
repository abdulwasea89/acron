import { useState } from "react";
import { View } from "react-native";
import { router } from "expo-router";
import { AuthScreen } from "@/components/auth-screen";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api";
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
      <AuthScreen
        title="Check your email"
        description="If an account exists with that email, your gym codes are on their way."
      >
        <Button onPress={() => router.replace("/(auth)/login")}>Back to sign in</Button>
      </AuthScreen>
    );
  }

  return (
    <AuthScreen
      title="Recover gym codes"
      description="Enter your email and we'll send you a list of your gyms and their codes."
      back
    >
      {error && (
        <View className="mb-5">
          <Alert type="error" message={error} onDismiss={() => setError(null)} />
        </View>
      )}

      <View className="gap-5">
        <Input
          label="Email"
          placeholder="you@example.com"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
        />
        <Button loading={loading} onPress={handleSubmit}>
          Send codes
        </Button>
      </View>
    </AuthScreen>
  );
}
