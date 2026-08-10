import { useState } from "react";
import { View } from "react-native";
import { router } from "expo-router";
import { AuthScreen } from "@/components/auth-screen";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { OtpInput } from "@/components/ui/otp-input";
import { api, ApiError } from "@/lib/api";

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
        <OtpInput
          value={code}
          onChange={(t) => setCode(t)}
          onComplete={() => handleVerify()}
        />
        <Button loading={loading} disabled={code.length !== 6} onPress={handleVerify}>
          Verify
        </Button>
      </View>
    </AuthScreen>
  );
}
