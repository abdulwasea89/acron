import { useState } from "react";
import { ScrollView } from "react-native";
import { View, Text } from "@/tw";
import { router } from "expo-router";
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
      router.replace("/(admin)");
    } catch (e) {
      if (e instanceof ApiError) setError(e.message);
      else setError("Payment failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView
      className="flex-1 bg-white dark:bg-bg-dark"
      contentContainerClassName="p-6 pt-16 pb-12"
    >
      <Text className="text-3xl font-bold text-gray-900 dark:text-white mb-1">
        Payment
      </Text>
      <Text className="text-muted mb-6">Step 4 of 5 — Start your subscription</Text>

      {error && (
        <View className="mb-4">
          <Alert type="error" message={error} onDismiss={() => setError(null)} />
        </View>
      )}

      <View className="bg-gray-50 dark:bg-bg-dark-secondary rounded-2xl p-5 mb-6 gap-2">
        <View className="flex-row justify-between">
          <Text className="text-gray-700 dark:text-gray-300">Gym</Text>
          <Text className="font-semibold text-gray-900 dark:text-white">{gymDetails.name}</Text>
        </View>
        <View className="flex-row justify-between">
          <Text className="text-gray-700 dark:text-gray-300">Plan</Text>
          <Text className="font-semibold text-gray-900 dark:text-white capitalize">{selectedTier}</Text>
        </View>
        <View className="border-t border-border dark:border-border-dark my-2" />
        <View className="flex-row justify-between">
          <Text className="text-lg font-bold text-gray-900 dark:text-white">Total</Text>
          <Text className="text-lg font-bold text-gray-900 dark:text-white">
            {TIER_PRICES[selectedTier]}
          </Text>
        </View>
      </View>

      <View className="gap-4">
        <Input
          label="Card Number (stub)"
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

      <Text className="text-xs text-muted mt-4 text-center">
        Your first month will be charged immediately. You can cancel anytime.
      </Text>

      <View className="flex-row gap-3 mt-8">
        <Button
          variant="secondary"
          className="flex-1"
          onPress={() => router.back()}
        >
          Back
        </Button>
        <Button
          className="flex-1"
          loading={loading}
          onPress={handlePay}
        >
          Pay {TIER_PRICES[selectedTier]}
        </Button>
      </View>
    </ScrollView>
  );
}
