import { useState } from "react";
import { View, Text } from "@/tw";
import { router } from "expo-router";
import { AuthScreen } from "@/components/auth-screen";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { api, ApiError } from "@/lib/api";
import { useRegisterStore } from "@/stores/register-store";
import { useAuthStore } from "@/stores/auth-store";
import type { RegisterGymResponse } from "@/types/api";

const TIER_PRICES: Record<string, string> = {
  starter: "$29",
  pro: "$79",
  enterprise: "Custom",
};

export default function PaymentScreen() {
  const { email, gymDetails, selectedTier, reset } = useRegisterStore();
  const { setSession } = useAuthStore();
  const [paymentToken, setPaymentToken] = useState("tok_stub");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!email || !gymDetails || !selectedTier) {
    router.replace("/(auth)/register/step-1");
    return null;
  }

  const handlePay = async () => {
    setError(null);
    setLoading(true);
    try {
      const res = await api.post<RegisterGymResponse>(
        "/organizations/register",
        {
          owner_email: email,
          details: gymDetails,
          tier: selectedTier,
          payment_token: paymentToken,
        },
        { idempotent: true },
      );

      setSession(
        { accessToken: res.access_token, refreshToken: res.refresh_token },
        {
          user_id: res.organization.id,
          email,
          role: "owner",
          org_id: res.organization.id,
        },
      );

      reset();
      router.replace("/(admin)/dashboard");
    } catch (e) {
      if (e instanceof ApiError) setError(e.message);
      else setError("Payment failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthScreen
      title="Start your subscription"
      description="Your first month is charged immediately. Cancel anytime."
      back
      footer={
        <View className="flex-row gap-3">
          <Button variant="secondary" className="flex-1" onPress={() => router.back()}>
            Back
          </Button>
          <Button className="flex-1" loading={loading} onPress={handlePay}>
            Pay {TIER_PRICES[selectedTier]}
          </Button>
        </View>
      }
    >
      {error && (
        <View className="mb-5">
          <Alert type="error" message={error} onDismiss={() => setError(null)} />
        </View>
      )}

      <View className="bg-bg-secondary dark:bg-surface-dark-2 rounded-2xl p-5 mb-6 gap-2 border border-border dark:border-border-dark">
        <View className="flex-row justify-between">
          <Text className="text-[14px] text-muted dark:text-muted-dark">Gym</Text>
          <Text className="text-[14px] font-semibold text-ink dark:text-paper">{gymDetails.name}</Text>
        </View>
        <View className="flex-row justify-between">
          <Text className="text-[14px] text-muted dark:text-muted-dark">Plan</Text>
          <Text className="text-[14px] font-semibold text-ink dark:text-paper capitalize">{selectedTier}</Text>
        </View>
        <View className="border-t border-border dark:border-border-dark my-2" />
        <View className="flex-row justify-between">
          <Text className="text-[16px] font-bold text-ink dark:text-paper">Total</Text>
          <Text className="text-[16px] font-bold text-ink dark:text-paper">
            {TIER_PRICES[selectedTier]}
          </Text>
        </View>
      </View>

      <View className="gap-4">
        <Input
          label="Card number (stub)"
          placeholder="4242 4242 4242 4242"
          value={paymentToken}
          onChangeText={setPaymentToken}
          keyboardType="default"
        />
        <View className="flex-row gap-3">
          <View className="flex-1">
            <Input label="Expiry" placeholder="MM/YY" />
          </View>
          <View className="flex-1">
            <Input label="CVC" placeholder="123" />
          </View>
        </View>
      </View>

      <Text className="text-[12px] text-muted dark:text-muted-dark mt-4 text-center">
        Your first month will be charged immediately. You can cancel anytime.
      </Text>
    </AuthScreen>
  );
}
