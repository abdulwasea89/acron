import { useState } from "react";
import { View, useColorScheme } from "react-native";
import { Text } from "heroui-native";
import { router } from "expo-router";

import { AuthScreen } from "@/components/auth-screen";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { Icon } from "@/components/icon";
import { api, ApiError } from "@/lib/api";
import { useRegisterStore } from "@/stores/register-store";
import { useAuthStore } from "@/stores/auth-store";
import { getPalette } from "@/lib/theme";
import { OWNER_FLOW, flowPosition } from "@/lib/flow";
import type { RegisterGymResponse } from "@/types/api";

const TIER_PRICES: Record<string, string> = {
  starter: "$29",
  pro: "$79",
  enterprise: "Custom",
};

/** One line of the order summary. */
function SummaryRow({
  label,
  value,
  emphasis,
}: {
  label: string;
  value: string;
  emphasis?: boolean;
}) {
  return (
    <View className="flex-row items-center justify-between">
      <Text type={emphasis ? "body" : "body-sm"} color={emphasis ? "default" : "muted"}>
        {label}
      </Text>
      <Text
        type={emphasis ? "body" : "body-sm"}
        weight={emphasis ? "bold" : "medium"}
        className="text-foreground"
      >
        {value}
      </Text>
    </View>
  );
}

export default function PaymentScreen() {
  const { email, gymDetails, selectedTier, reset } = useRegisterStore();
  const { setSession } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isDark = useColorScheme() === "dark";
  const p = getPalette(isDark);

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
          // The card itself is collected by Stripe, not by this screen. Until
          // that handoff exists the backend accepts its stub token.
          payment_token: "tok_stub",
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

  const price = TIER_PRICES[selectedTier];

  return (
    <AuthScreen
      title="Confirm and start"
      subtitle="Your first month is charged today. Cancel anytime."
      back
      progress={flowPosition(OWNER_FLOW, "/(auth)/register/payment")}
      footer={
        <Button loading={loading} onPress={handlePay}>
          {`Start subscription · ${price}`}
        </Button>
      }
    >
      {error ? (
        <View className="mb-5">
          <Alert type="error" message={error} onDismiss={() => setError(null)} />
        </View>
      ) : null}

      <View className="gap-3 rounded-2xl bg-surface p-5">
        <SummaryRow label="Gym" value={gymDetails.name} />
        <SummaryRow
          label="Plan"
          value={selectedTier.charAt(0).toUpperCase() + selectedTier.slice(1)}
        />
        <SummaryRow label="Billing" value="Monthly" />
        <View className="my-1 h-px bg-border" />
        <SummaryRow label="Due today" value={price} emphasis />
      </View>

      <View className="mt-5 flex-row items-start gap-3 rounded-2xl bg-surface p-4">
        <Icon name="lock.fill" android="lock" size={17} color={p.muted} />
        <Text type="body-sm" color="muted" className="flex-1">
          Card details are entered on Stripe's secure page — this app never sees or stores your
          card number.
        </Text>
      </View>

      <Text type="body-xs" color="muted" className="mt-5 px-1 text-center">
        By continuing you agree to be charged {price} today and every month until you cancel.
      </Text>
    </AuthScreen>
  );
}
