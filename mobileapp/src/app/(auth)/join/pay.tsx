import { useState } from "react";
import { ScrollView } from "react-native";
import { View, Text } from "@/tw";
import { router } from "expo-router";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { api, ApiError } from "@/lib/api";
import { useJoinStore } from "@/stores/join-store";
import { useAuthStore } from "@/stores/auth-store";
import type { LoginResponse } from "@/types/api";

export default function JoinPay() {
  const { orgCode, email, selectedPlanId, orgName, reset } = useJoinStore();
  const { setSession } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!orgCode || !email || !selectedPlanId) {
    router.replace("/(auth)/register/org-code");
    return null;
  }

  const handlePay = async () => {
    setError(null);
    setLoading(true);
    try {
      const res = await api.post<LoginResponse>(
        "/memberships/signup/pay",
        {
          org_code: orgCode,
          email,
          plan_id: selectedPlanId,
          payment_token: "tok_stub",
        },
        { idempotent: true },
      );

      setSession(
        { accessToken: res.access_token, refreshToken: res.refresh_token },
        {
          user_id: res.user.user_id,
          email,
          role: "member",
          org_id: res.user.org_id,
          member_id: res.user.member_id,
          member_status: res.user.member_status,
        },
      );

      reset();
      router.replace("/(member)");
    } catch (e) {
      if (e instanceof ApiError) {
        if (e.status === 409) setError("This payment is being processed. Please wait.");
        else setError(e.message);
      } else {
        setError("Payment failed. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView
      className="flex-1 bg-white dark:bg-bg-dark"
      contentContainerClassName="p-6 pt-20 flex-grow"
    >
      <Text className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
        Complete Payment
      </Text>
      <Text className="text-muted mb-2">{orgName}</Text>

      {error && (
        <View className="mb-4">
          <Alert type="error" message={error} onDismiss={() => setError(null)} />
        </View>
      )}

      <View className="bg-gray-50 dark:bg-bg-dark-secondary rounded-2xl p-5 mb-6">
        <Text className="font-semibold text-gray-900 dark:text-white mb-3">
          Your membership will start immediately after payment
        </Text>
        <Text className="text-sm text-muted">
          Your card will be charged once. Idempotency protection prevents double charges.
        </Text>
      </View>

      <View className="gap-4">
        <Button loading={loading} onPress={handlePay}>
          Pay Now
        </Button>
        <Button variant="secondary" onPress={() => router.back()}>
          Back to Plans
        </Button>
      </View>
    </ScrollView>
  );
}
