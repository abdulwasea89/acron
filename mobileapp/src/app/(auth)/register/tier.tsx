import { useState } from "react";
import { ScrollView } from "react-native";
import { View, Text, Pressable } from "@/tw";
import { router } from "expo-router";
import { Button } from "@/components/ui/button";
import { useRegisterStore } from "@/stores/register-store";

const TIERS = [
  {
    id: "starter" as const,
    name: "Starter",
    price: "$29",
    period: "/month",
    cap: "Up to 25 members",
    features: ["Basic operations", "Single trainer", "Member management"],
    color: "border-gray-300 dark:border-gray-600",
  },
  {
    id: "pro" as const,
    name: "Pro",
    price: "$79",
    period: "/month",
    cap: "Up to 100 members",
    features: [
      "Payroll engine",
      "Advanced analytics",
      "Multiple trainers",
      "AI receipt verification",
    ],
    featured: true,
    color: "border-brand",
  },
  {
    id: "enterprise" as const,
    name: "Enterprise",
    price: "Custom",
    period: "",
    cap: "Unlimited members",
    features: [
      "Everything in Pro",
      "Mandatory MFA",
      "Dedicated support",
      "Custom SLA",
    ],
    color: "border-gray-300 dark:border-gray-600",
  },
];

export default function TierScreen() {
  const { selectedTier, setTier } = useRegisterStore();
  const [selected, setSelected] = useState(selectedTier ?? "pro");

  const handleContinue = () => {
    setTier(selected);
    router.push("/(auth)/register/payment");
  };

  return (
    <ScrollView
      className="flex-1 bg-white dark:bg-bg-dark"
      contentContainerClassName="p-6 pt-16 pb-12"
    >
      <Text className="text-3xl font-bold text-gray-900 dark:text-white mb-1">
        Choose your plan
      </Text>
      <Text className="text-muted mb-6">Step 3 of 5 — Pick a SaaS tier</Text>

      <View className="gap-4">
        {TIERS.map((tier) => {
          const isSelected = selected === tier.id;
          return (
            <Pressable
              key={tier.id}
              className={`rounded-2xl p-5 border-2
                ${isSelected ? `border-brand bg-blue-50 dark:bg-blue-900/10` : tier.color}
                ${tier.featured ? "shadow-md" : ""}`}
              onPress={() => setSelected(tier.id)}
            >
              {tier.featured && (
                <View className="bg-brand self-start px-3 py-1 rounded-full mb-2">
                  <Text className="text-white text-xs font-bold">POPULAR</Text>
                </View>
              )}
              <View className="flex-row items-baseline gap-1">
                <Text className="text-3xl font-bold text-gray-900 dark:text-white">
                  {tier.price}
                </Text>
                <Text className="text-muted text-sm">{tier.period}</Text>
              </View>
              <Text className="text-lg font-semibold text-gray-900 dark:text-white mt-1">
                {tier.name}
              </Text>
              <Text className="text-sm text-muted mt-1">{tier.cap}</Text>
              <View className="mt-3 gap-2">
                {tier.features.map((f) => (
                  <View key={f} className="flex-row items-center gap-2">
                    <Text className="text-brand">✓</Text>
                    <Text className="text-sm text-gray-700 dark:text-gray-300">{f}</Text>
                  </View>
                ))}
              </View>
            </Pressable>
          );
        })}
      </View>

      <View className="flex-row gap-3 mt-8">
        <Button
          variant="secondary"
          className="flex-1"
          onPress={() => router.back()}
        >
          Back
        </Button>
        <Button className="flex-1" onPress={handleContinue}>
          Continue
        </Button>
      </View>
    </ScrollView>
  );
}
