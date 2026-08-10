import { useState, useEffect } from "react";
import { View, Text } from "react-native";
import { router } from "expo-router";
import { AuthScreen } from "@/components/auth-screen";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { api, ApiError } from "@/lib/api";
import type { MfaEnrollResponse, Message, MfaStatus } from "@/types/api";

export default function MfaEnroll() {
  const [status, setStatus] = useState<MfaStatus | null>(null);
  const [enrollData, setEnrollData] = useState<MfaEnrollResponse | null>(null);
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(true);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetch = async () => {
      try {
        const s = await api.get<MfaStatus>("/auth/mfa");
        setStatus(s);
      } catch {
        // Assume not enrolled
      } finally {
        setLoading(false);
      }
    };
    fetch();
  }, []);

  const handleEnroll = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.post<MfaEnrollResponse>("/auth/mfa/enroll");
      setEnrollData(res);
    } catch (e) {
      if (e instanceof ApiError) setError(e.message);
      else setError("Network error.");
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = async () => {
    if (code.length !== 6) return;
    setConfirming(true);
    setError(null);
    try {
      await api.post<Message>("/auth/mfa/confirm", { code });
      router.back();
    } catch (e) {
      if (e instanceof ApiError) setError(e.message);
      else setError("Invalid code. Try again.");
    } finally {
      setConfirming(false);
    }
  };

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <Spinner />
      </View>
    );
  }

  if (status?.mfa_enabled) {
    return (
      <AuthScreen
        title="MFA already enabled"
        description="Two-factor authentication is already active on your account."
        back
      >
        <Button variant="secondary" onPress={() => router.back()}>
          Go back
        </Button>
      </AuthScreen>
    );
  }

  if (enrollData) {
    return (
      <AuthScreen
        title="Scan or enter the code"
        description="Add this to your authenticator app, then enter the 6-digit code to confirm."
        back
        onBack={() => setEnrollData(null)}
        footer={
          <View className="flex-row gap-3">
            <Button variant="secondary" className="flex-1" onPress={() => setEnrollData(null)}>
              Back
            </Button>
            <Button
              className="flex-1"
              loading={confirming}
              disabled={code.length !== 6}
              onPress={handleConfirm}
            >
              Enable MFA
            </Button>
          </View>
        }
      >
        {error && (
          <View className="mb-5">
            <Alert type="error" message={error} onDismiss={() => setError(null)} />
          </View>
        )}

        <View className="bg-surface-secondary rounded-2xl p-5 mb-6 border border-border">
          <Text className="text-[12px] font-mono text-muted mb-3">
            {enrollData.otpauth_uri}
          </Text>
          <Text className="text-[13px] font-mono text-foreground">
            Secret: {enrollData.secret}
          </Text>
        </View>

        <Input
          label="Verify with a 6-digit code"
          placeholder="000000"
          value={code}
          onChangeText={(t) => setCode(t.replace(/\D/g, "").slice(0, 6))}
          keyboardType="number-pad"
          maxLength={6}
        />
      </AuthScreen>
    );
  }

  return (
    <AuthScreen
      title="Two-factor auth"
      description="Add an extra layer of security to your account."
      back
      footer={
        <Button variant="ghost" onPress={() => router.back()}>
          Maybe later
        </Button>
      }
    >
      {error && (
        <View className="mb-5">
          <Alert type="error" message={error} onDismiss={() => setError(null)} />
        </View>
      )}

      <Button onPress={handleEnroll}>Set up MFA</Button>
    </AuthScreen>
  );
}
