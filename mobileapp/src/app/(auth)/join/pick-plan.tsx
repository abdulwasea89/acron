import { useState, useEffect } from "react";
import { View, Text, Pressable } from "@/tw";
import { router } from "expo-router";
import { AuthScreen } from "@/components/auth-screen";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { api } from "@/lib/api";
import { useJoinStore } from "@/stores/join-store";
import type { PublicPlanOut } from "@/types/api";

export default function PickPlan() {
  const { orgCode, orgName, selectedPlanId, setSelectedPlan } = useJoinStore();
  const [plans, setPlans] = useState<PublicPlanOut[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(selectedPlanId ?? "");

  useEffect(() => {
    const fetch = async () => {
      try {
        const data = await api.get<PublicPlanOut[]>(
          `/memberships/signup/plans?org_code=${orgCode}`,
        );
        setPlans(data);
        if (data.length > 0 && !selected) setSelected(data[0].id);
      } catch {
        // Error state
      } finally {
        setLoading(false);
      }
    };
    fetch();
  }, []);

  if (!orgCode) {
    router.replace("/(auth)/register/org-code");
    return null;
  }

  const handleContinue = () => {
    if (!selected) return;
    setSelectedPlan(selected);
    router.push("/(auth)/join/pay");
  };

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-bg dark:bg-bg-dark">
        <Spinner />
      </View>
    );
  }

  return (
    <AuthScreen
      title="Choose a plan"
      description="Pick the membership that fits you. You can change it later."
      back
      footer={
        <View className="flex-row gap-3">
          <Button variant="secondary" className="flex-1" onPress={() => router.back()}>
            Back
          </Button>
          <Button className="flex-1" disabled={!selected} onPress={handleContinue}>
            Continue
          </Button>
        </View>
      }
    >
      <View className="gap-4">
        {plans.map((plan) => {
          const isSelected = selected === plan.id;
          return (
            <Pressable
              key={plan.id}
              className={`rounded-2xl p-5 border
                ${isSelected
                  ? "border-ink dark:border-paper bg-ink/[0.03] dark:bg-paper/[0.05]"
                  : "border-border dark:border-border-dark bg-bg dark:bg-bg-dark-secondary"}`}
              onPress={() => setSelected(plan.id)}
            >
              <View className="flex-row items-center justify-between">
                {plan.featured ? (
                  <View className="bg-ink dark:bg-paper self-start px-2.5 py-1 rounded-full">
                    <Text className="text-paper dark:text-ink text-[10px] font-bold tracking-wide">
                      POPULAR
                    </Text>
                  </View>
                ) : (
                  <View />
                )}
                <View
                  className={`w-5 h-5 rounded-full border-2 items-center justify-center
                    ${isSelected ? "border-ink dark:border-paper" : "border-border-strong dark:border-border-strong-dark"}`}
                >
                  {isSelected && <View className="w-2.5 h-2.5 rounded-full bg-ink dark:bg-paper" />}
                </View>
              </View>

              <View className="flex-row items-baseline gap-1 mt-3">
                <Text className="text-[30px] font-bold text-ink dark:text-paper">
                  {plan.currency} {plan.price}
                </Text>
                <Text className="text-muted dark:text-muted-dark text-[13px]">
                  {plan.billing_type === "recurring" ? "/month" : ""}
                </Text>
              </View>
              <Text className="text-[16px] font-semibold text-ink dark:text-paper mt-2">
                {plan.name}
              </Text>
              {plan.public_description && (
                <Text className="text-[13px] text-muted dark:text-muted-dark mt-1">
                  {plan.public_description}
                </Text>
              )}
            </Pressable>
          );
        })}

        {plans.length === 0 && !loading && (
          <Text className="text-center text-muted dark:text-muted-dark">No plans available yet.</Text>
        )}
      </View>
    </AuthScreen>
  );
}
