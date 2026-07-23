import { useState, useEffect } from "react";
import { ScrollView } from "react-native";
import { View, Text, Pressable } from "@/tw";
import { router } from "expo-router";
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
      <View className="flex-1 items-center justify-center bg-white dark:bg-bg-dark">
        <Spinner />
      </View>
    );
  }

  return (
    <ScrollView
      className="flex-1 bg-white dark:bg-bg-dark"
      contentContainerClassName="p-6 pt-16 pb-12"
    >
      <Text className="text-3xl font-bold text-gray-900 dark:text-white mb-1">
        Choose a plan
      </Text>
      <Text className="text-muted mb-2">{orgName}</Text>

      <View className="gap-4 mt-6">
        {plans.map((plan) => {
          const isSelected = selected === plan.id;
          return (
            <Pressable
              key={plan.id}
              className={`rounded-2xl p-5 border-2
                ${isSelected
                  ? "border-brand bg-blue-50 dark:bg-blue-900/10"
                  : "border-border dark:border-border-dark"
                }
                ${plan.featured ? "shadow-md" : ""}`}
              onPress={() => setSelected(plan.id)}
            >
              {plan.featured && (
                <View className="bg-brand self-start px-3 py-1 rounded-full mb-2">
                  <Text className="text-white text-xs font-bold">POPULAR</Text>
                </View>
              )}
              <View className="flex-row items-baseline gap-1">
                <Text className="text-3xl font-bold text-gray-900 dark:text-white">
                  {plan.currency} {plan.price}
                </Text>
                <Text className="text-muted text-sm">
                  {plan.billing_type === "recurring" ? "/month" : ""}
                </Text>
              </View>
              <Text className="text-lg font-semibold text-gray-900 dark:text-white mt-2">
                {plan.name}
              </Text>
              {plan.public_description && (
                <Text className="text-sm text-muted mt-1">{plan.public_description}</Text>
              )}
            </Pressable>
          );
        })}

        {plans.length === 0 && !loading && (
          <Text className="text-center text-muted">No plans available yet.</Text>
        )}
      </View>

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
          disabled={!selected}
          onPress={handleContinue}
        >
          Continue
        </Button>
      </View>
    </ScrollView>
  );
}
