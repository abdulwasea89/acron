import { useEffect, useState } from "react";
import { View, useColorScheme } from "react-native";
import { Text } from "heroui-native";
import { router } from "expo-router";

import { AuthScreen } from "@/components/auth-screen";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { Icon } from "@/components/icon";
import { api, ApiError } from "@/lib/api";
import { useJoinStore } from "@/stores/join-store";
import { useAuthStore } from "@/stores/auth-store";
import { getPalette } from "@/lib/theme";
import { JOIN_FLOW, flowPosition } from "@/lib/flow";
import type { LoginResponse, PublicPlanOut } from "@/types/api";

export default function JoinPay() {
  const { orgCode, email, selectedPlanId, orgName, reset } = useJoinStore();
  const { setSession } = useAuthStore();
  const [plan, setPlan] = useState<PublicPlanOut | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isDark = useColorScheme() === "dark";
  const p = getPalette(isDark);

  /* Re-fetched rather than carried through the store: this is the last screen
     before a charge, and the amount shown here should come from the server that
     will actually bill it, not from a value cached three screens ago. */
  useEffect(() => {
    if (!orgCode || !selectedPlanId) return;
    api
      .get<PublicPlanOut[]>(`/memberships/signup/plans?org_code=${orgCode}`)
      .then((plans) => setPlan(plans.find((x) => x.id === selectedPlanId) ?? null))
      .catch(() => setPlan(null));
  }, [orgCode, selectedPlanId]);

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
        if (e.status === 409) setError("This payment is already going through. Give it a moment.");
        else setError(e.message);
      } else {
        setError("Payment failed. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  const amount = plan ? `${plan.currency} ${plan.price}` : null;

  return (
    <AuthScreen
      title="Confirm and join"
      subtitle="Your membership activates the moment this goes through."
      back
      progress={flowPosition(JOIN_FLOW, "/(auth)/join/pay")}
      footer={
        <Button loading={loading} onPress={handlePay}>
          {amount ? `Pay ${amount}` : "Pay now"}
        </Button>
      }
    >
      {error ? (
        <View className="mb-5">
          <Alert type="error" message={error} onDismiss={() => setError(null)} />
        </View>
      ) : null}

      <View className="gap-3 rounded-2xl bg-surface p-5">
        <View className="flex-row items-center justify-between">
          <Text type="body-sm" color="muted">
            Gym
          </Text>
          <Text type="body-sm" weight="medium" className="text-foreground">
            {orgName || orgCode}
          </Text>
        </View>
        <View className="flex-row items-center justify-between">
          <Text type="body-sm" color="muted">
            Plan
          </Text>
          <Text type="body-sm" weight="medium" className="text-foreground">
            {plan?.name ?? "—"}
          </Text>
        </View>
        <View className="my-1 h-px bg-border" />
        <View className="flex-row items-center justify-between">
          <Text type="body" className="text-foreground">
            Due now
          </Text>
          <Text type="body" weight="bold" className="text-foreground">
            {amount ?? "—"}
          </Text>
        </View>
      </View>

      <View className="mt-5 flex-row items-start gap-3 rounded-2xl bg-surface p-4">
        <Icon name="lock.fill" android="lock" size={17} color={p.muted} />
        <Text type="body-sm" color="muted" className="flex-1">
          Tapping twice can&rsquo;t charge you twice — each payment carries a one-time key that
          the server refuses to reuse.
        </Text>
      </View>
    </AuthScreen>
  );
}
