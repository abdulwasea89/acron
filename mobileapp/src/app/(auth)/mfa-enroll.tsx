import { useState, useEffect } from "react";
import { ScrollView } from "react-native";
import { View, Text } from "@/tw";
import { router } from "expo-router";
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
      <View className="flex-1 items-center justify-center bg-white dark:bg-bg-dark">
        <Spinner />
      </View>
    );
  }

  if (status?.mfa_enabled) {
    return (
      <View className="flex-1 items-center justify-center bg-white dark:bg-bg-dark p-6">
        <Text className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
          MFA Already Enabled
        </Text>
        <Text className="text-muted text-center mb-8">
          Two-factor authentication is already active on your account.
        </Text>
        <Button variant="secondary" onPress={() => router.back()}>
          Go Back
        </Button>
      </View>
    );
  }

  if (enrollData) {
    return (
      <ScrollView
        className="flex-1 bg-white dark:bg-bg-dark"
        contentContainerClassName="p-6 pt-20 pb-12"
      >
        <Text className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
          Setup MFA
        </Text>
        <Text className="text-muted mb-6">
          Scan this code in your authenticator app or enter it manually
        </Text>

        {error && (
          <View className="mb-4">
            <Alert type="error" message={error} onDismiss={() => setError(null)} />
          </View>
        )}

        <View className="bg-gray-50 dark:bg-bg-dark-secondary rounded-2xl p-5 mb-6">
          <Text className="text-xs font-mono text-gray-700 dark:text-gray-300 break-all mb-3">
            {enrollData.otpauth_uri}
          </Text>
          <Text className="text-sm font-mono text-gray-900 dark:text-white">
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

        <View className="flex-row gap-3 mt-6">
          <Button
            variant="secondary"
            className="flex-1"
            onPress={() => setEnrollData(null)}
          >
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
      </ScrollView>
    );
  }

  return (
    <ScrollView
      className="flex-1 bg-white dark:bg-bg-dark"
      contentContainerClassName="p-6 pt-20 pb-12"
    >
      <Text className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
        Two-Factor Authentication
      </Text>
      <Text className="text-muted mb-8">
        Add an extra layer of security to your account.
      </Text>

      {error && (
        <View className="mb-4">
          <Alert type="error" message={error} onDismiss={() => setError(null)} />
        </View>
      )}

      <Button onPress={handleEnroll}>
        Set Up MFA
      </Button>

      <Button variant="ghost" onPress={() => router.back()} className="mt-4">
        Maybe Later
      </Button>
    </ScrollView>
  );
}
