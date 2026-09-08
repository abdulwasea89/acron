import { useState } from "react";
import { View } from "react-native";
import { router } from "expo-router";

import { AuthScreen } from "@/components/auth-screen";
import { Button } from "@/components/ui/button";
import { ChoiceCard } from "@/components/auth/choice-card";
import { useRegisterStore } from "@/stores/register-store";
import { OWNER_FLOW, flowPosition } from "@/lib/flow";
import { getIndustry, pluralize, roleLabelOf, type IndustryMeta } from "@/lib/industries";

const cap = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);
const lower = (s: string) => (s ? s.charAt(0).toLowerCase() + s.slice(1) : s);

interface TierDef {
  id: "starter" | "pro" | "enterprise";
  name: string;
  price: string;
  period: string;
  cap: string;
  features: string[];
  featured?: boolean;
}

/**
 * Tier cards adapt their countable noun to the venue vertical so the caps read
 * "members" (gym), "seat-holders" (office) or "students" (academy). The gym
 * reference renders its original copy exactly.
 */
function tiersFor(ind: IndustryMeta): TierDef[] {
  const people = pluralize(ind.memberNoun); // members | seat-holders | students
  const management = `${cap(ind.memberNoun)} management`;
  const staffOne = `Single ${lower(roleLabelOf(ind, "trainer"))}`;
  return [
    {
      id: "starter",
      name: "Starter",
      price: "$29",
      period: "/month",
      cap: `Up to 25 ${people}`,
      features: [management, "Cash payment logging", staffOne],
    },
    {
      id: "pro",
      name: "Pro",
      price: "$79",
      period: "/month",
      cap: `Up to 100 ${people}`,
      features: [
        "Everything in Starter",
        "Payroll engine",
        "AI receipt verification",
        "Advanced analytics",
      ],
      featured: true,
    },
    {
      id: "enterprise",
      name: "Enterprise",
      price: "Custom",
      period: "",
      cap: `Unlimited ${people}`,
      features: ["Everything in Pro", "Mandatory MFA", "Dedicated support", "Custom SLA"],
    },
  ];
}

export default function TierScreen() {
  const { gymDetails, selectedTier, setTier } = useRegisterStore();
  const ind = getIndustry(gymDetails?.industry);
  const TIERS = tiersFor(ind);
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
