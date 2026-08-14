import { useState } from "react";
import { View } from "react-native";
import { router } from "expo-router";

import { AuthScreen } from "@/components/auth-screen";
import { Button } from "@/components/ui/button";
import { ChoiceCard } from "@/components/auth/choice-card";
import { useRegisterStore } from "@/stores/register-store";
import { OWNER_FLOW, flowPosition } from "@/lib/flow";

const TIERS = [
  {
    id: "starter" as const,
    name: "Starter",
    price: "$29",
    period: "/month",
    cap: "Up to 25 members",
    features: ["Member management", "Cash payment logging", "Single trainer"],
  },
  {
    id: "pro" as const,
    name: "Pro",
    price: "$79",
    period: "/month",
    cap: "Up to 100 members",
    features: [
      "Everything in Starter",
      "Payroll engine",
      "AI receipt verification",
      "Advanced analytics",
    ],
    featured: true,
  },
  {
    id: "enterprise" as const,
    name: "Enterprise",
    price: "Custom",
    period: "",
    cap: "Unlimited members",
    features: ["Everything in Pro", "Mandatory MFA", "Dedicated support", "Custom SLA"],
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
      title="Choose your plan"
      subtitle="Upgrade or downgrade anytime from the web portal."
      back
      progress={flowPosition(OWNER_FLOW, "/(auth)/register/tier")}
      footer={<Button onPress={handleContinue}>Continue</Button>}
    >
      <View className="gap-3">
        {TIERS.map((tier) => (
          <ChoiceCard
            key={tier.id}
            price={tier.price}
            period={tier.period}
            name={tier.name}
            detail={tier.cap}
            features={tier.features}
            featured={tier.featured}
            selected={selected === tier.id}
            onPress={() => setSelected(tier.id)}
          />
        ))}
      </View>
    </AuthScreen>
  );
}
