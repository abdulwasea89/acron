import { useState } from "react";
import { View, Text, Pressable } from "@/tw";
import { router } from "expo-router";
import { AuthScreen } from "@/components/auth-screen";
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
    <AuthScreen
      title="Pick your tier"
      description="You can upgrade or downgrade anytime from the web portal."
      back
      footer={
        <View className="flex-row gap-3">
          <Button variant="secondary" className="flex-1" onPress={() => router.back()}>
            Back
          </Button>
          <Button className="flex-1" onPress={handleContinue}>
            Continue
          </Button>
        </View>
      }
    >
      <View className="gap-4">
        {TIERS.map((tier) => {
          const isSelected = selected === tier.id;
          return (
            <Pressable
              key={tier.id}
              className={`rounded-2xl p-5 border
                ${isSelected
                  ? "border-ink dark:border-paper bg-ink/[0.03] dark:bg-paper/[0.05]"
                  : "border-border dark:border-border-dark bg-bg dark:bg-bg-dark-secondary"}`}
              onPress={() => setSelected(tier.id)}
            >
              <View className="flex-row items-center justify-between">
                {tier.featured ? (
                  <View className="bg-ink dark:bg-paper self-start px-2.5 py-1 rounded-full">
                    <Text className="text-paper dark:text-ink text-[10px] font-bold tracking-wide">
                      POPULAR
                    </Text>
                  </View>
                ) : (
                  <View />
                )}
                {/* Radio indicator */}
                <View
                  className={`w-5 h-5 rounded-full border-2 items-center justify-center
                    ${isSelected ? "border-ink dark:border-paper" : "border-border-strong dark:border-border-strong-dark"}`}
                >
                  {isSelected && <View className="w-2.5 h-2.5 rounded-full bg-ink dark:bg-paper" />}
                </View>
              </View>

              <View className="flex-row items-baseline gap-1 mt-3">
                <Text className="text-[30px] font-bold text-ink dark:text-paper">{tier.price}</Text>
                <Text className="text-muted dark:text-muted-dark text-[13px]">{tier.period}</Text>
              </View>
              <Text className="text-[16px] font-semibold text-ink dark:text-paper mt-1">
                {tier.name}
              </Text>
              <Text className="text-[13px] text-muted dark:text-muted-dark mt-1">{tier.cap}</Text>
              <View className="mt-3 gap-2">
                {tier.features.map((f) => (
                  <View key={f} className="flex-row items-center gap-2">
                    <Text className="text-ink dark:text-paper text-[13px]">✓</Text>
                    <Text className="text-[13px] text-muted dark:text-muted-dark">{f}</Text>
                  </View>
                ))}
              </View>
            </Pressable>
          );
        })}
      </View>
    </AuthScreen>
  );
}
