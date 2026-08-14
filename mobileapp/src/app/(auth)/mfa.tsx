import { useState } from "react";
import { Pressable, View, useColorScheme } from "react-native";
import { Text } from "heroui-native";
import { router } from "expo-router";

import { AuthScreen } from "@/components/auth-screen";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { OtpInput } from "@/components/ui/otp-input";
import { Icon } from "@/components/icon";
import { api, ApiError } from "@/lib/api";
import { getPalette } from "@/lib/theme";

export default function MfaScreen() {
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isDark = useColorScheme() === "dark";
  const p = getPalette(isDark);

  const handleVerify = async (value: string = code) => {
    if (value.length !== 6) return;
    setLoading(true);
    setError(null);
    try {
      // The code is submitted with the login request; this screen appears when
      // login came back with requires_mfa, so it returns there to retry.
      router.replace("/(auth)/login");
    } catch (e) {
      if (e instanceof ApiError) setError(e.message);
      else setError("Network error.");
      setCode("");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthScreen
      title="Two-factor code"
      subtitle="Open your authenticator app and enter the current 6-digit code."
      back
      footer={
        <View className="gap-3">
          <Button loading={loading} disabled={code.length !== 6} onPress={() => handleVerify()}>
            Verify
          </Button>
          <Pressable
            onPress={() => router.replace("/(auth)/recover-codes")}
            hitSlop={8}
            className="items-center py-1 active:opacity-60"
          >
            <Text type="body-sm" className="text-accent">
              Use a recovery code instead
            </Text>
          </Pressable>
        </View>
      }
    >
      {error ? (
        <View className="mb-5">
          <Alert type="error" message={error} onDismiss={() => setError(null)} />
        </View>
      ) : null}

      <View className="items-center">
        <View
          className="mb-6 h-14 w-14 items-center justify-center rounded-2xl"
          style={{ backgroundColor: `${p.accent}1f` }}
        >
          <Icon name="lock.shield.fill" android="shield" size={24} color={p.accent} />
        </View>

        <OtpInput
          value={code}
          onChange={setCode}
          onComplete={handleVerify}
          isInvalid={Boolean(error)}
        />
      </View>
    </AuthScreen>
  );
}
