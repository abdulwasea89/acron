import { useState } from "react";
import { View, Text } from "@/tw";
import { router } from "expo-router";
import { AuthScreen } from "@/components/auth-screen";
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
      router.replace("/(member)/dashboard");
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
    <AuthScreen
      title="Complete payment"
      description="One secure charge activates your membership immediately."
      back
      footer={
        <Button variant="secondary" onPress={() => router.back()}>
          Back to plans
        </Button>
      }
    >
      {error && (
        <View className="mb-5">
          <Alert type="error" message={error} onDismiss={() => setError(null)} />
        </View>
      )}

      <View className="bg-bg-secondary dark:bg-surface-dark-2 rounded-2xl p-5 mb-6 border border-border dark:border-border-dark">
        <Text className="font-semibold text-[15px] text-ink dark:text-paper mb-2">
          Your membership starts immediately after payment
        </Text>
        <Text className="text-[13px] leading-[19px] text-muted dark:text-muted-dark">
          Your card is charged once. Idempotency protection prevents double charges — tap Pay with confidence.
        </Text>
      </View>

      <Button loading={loading} onPress={handlePay}>
        Pay now
      </Button>
    </AuthScreen>
  );
}
