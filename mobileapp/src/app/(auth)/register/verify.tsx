import { useState } from "react";
import { View } from "react-native";
import { router } from "expo-router";

import { AuthScreen } from "@/components/auth-screen";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { CodeEntry } from "@/components/auth/code-entry";
import { api, ApiError } from "@/lib/api";
import { useRegisterStore } from "@/stores/register-store";
import { OWNER_FLOW, flowPosition } from "@/lib/flow";
import type { Message } from "@/types/api";

export default function VerifyEmail() {
  const { email, setVerified } = useRegisterStore();
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!email) {
    router.replace("/(auth)/register/step-1");
    return null;
  }

  const handleVerify = async (value: string = code) => {
    if (value.length !== 6) return;
    setError(null);
    setLoading(true);
    try {
      await api.post<Message>("/auth/verify-email", { email, code: value });
      setVerified();
      router.push("/(auth)/register/gym-details");
    } catch (e) {
      if (e instanceof ApiError) setError(e.message);
      else setError("Network error. Please try again.");
      // Clear on failure so the next attempt starts from an empty field rather
      // than requiring six backspaces first.
      setCode("");
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    try {
      await api.post<Message>("/auth/resend-code", { email });
    } catch {
      // Silent — the backend returns the same message either way, by design.
    }
  };

  return (
    <AuthScreen
      title="Check your email"
      subtitle="The code expires in 10 minutes."
      back
      progress={flowPosition(OWNER_FLOW, "/(auth)/register/verify")}
      footer={
        <Button loading={loading} disabled={code.length !== 6} onPress={() => handleVerify()}>
          Verify email
        </Button>
      }
    >
      {error ? (
        <View className="mb-5">
          <Alert type="error" message={error} onDismiss={() => setError(null)} />
        </View>
      ) : null}

      <CodeEntry
        value={code}
        onChange={setCode}
        onComplete={handleVerify}
        destination={email}
        onResend={handleResend}
        invalid={Boolean(error)}
      />
    </AuthScreen>
  );
}
