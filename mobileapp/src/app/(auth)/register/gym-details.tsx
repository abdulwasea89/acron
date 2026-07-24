import { useState } from "react";
import { View, Text } from "@/tw";
import { router } from "expo-router";
import { AuthScreen } from "@/components/auth-screen";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useRegisterStore } from "@/stores/register-store";
import { gymDetailsSchema } from "@/lib/validations";
import type { GymDetails } from "@/types/api";

export default function GymDetailsScreen() {
  const { gymDetails, setGymDetails } = useRegisterStore();
  const [form, setForm] = useState({
    name: gymDetails?.name ?? "",
    country: gymDetails?.country ?? "US",
    timezone: gymDetails?.timezone ?? "UTC",
    default_currency: gymDetails?.default_currency ?? "USD",
    address: gymDetails?.address ?? "",
    working_hours: gymDetails?.working_hours ?? "",
    accent_color: gymDetails?.accent_color ?? "#0a0a0a",
  });
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const update = (field: string, value: string) => {
    setForm((p) => ({ ...p, [field]: value }));
    setFieldErrors((p) => ({ ...p, [field]: "" }));
  };

  const handleContinue = () => {
    const data = {
      ...form,
      address: form.address || null,
      accent_color: form.accent_color || null,
      working_hours: form.working_hours || null,
    };
    const parse = gymDetailsSchema.safeParse(data);
    if (!parse.success) {
      const errs: Record<string, string> = {};
      for (const issue of parse.error.issues) {
        const field = issue.path.join(".");
        if (!errs[field]) errs[field] = issue.message;
      }
      setFieldErrors(errs);
      return;
    }
    setGymDetails(data as GymDetails);
    router.push("/(auth)/register/tier");
  };

  return (
    <AuthScreen
      title="About your gym"
      description="This sets your members' branding and billing defaults."
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
        <Input
          label="Gym name"
          placeholder="Iron Pulse Boxing"
          value={form.name}
          onChangeText={(t) => update("name", t)}
          error={fieldErrors.name}
        />
        <Input
          label="Address"
          placeholder="Street, city, state"
          value={form.address}
          onChangeText={(t) => update("address", t)}
          error={fieldErrors.address}
        />
        <Input
          label="Country"
          placeholder="US"
          value={form.country}
          onChangeText={(t) => update("country", t.toUpperCase())}
          autoCapitalize="characters"
          maxLength={2}
          error={fieldErrors.country}
        />
        <Input
          label="Timezone"
          placeholder="UTC"
          value={form.timezone}
          onChangeText={(t) => update("timezone", t)}
          error={fieldErrors.timezone}
        />
        <Input
          label="Currency"
          placeholder="USD"
          value={form.default_currency}
          onChangeText={(t) => update("default_currency", t.toUpperCase())}
          autoCapitalize="characters"
          maxLength={3}
          error={fieldErrors.default_currency}
        />
        <Input
          label="Working hours"
          placeholder="e.g. Mon-Fri 5AM-10PM"
          value={form.working_hours}
          onChangeText={(t) => update("working_hours", t)}
        />

        <View className="gap-2">
          <Text className="text-[13px] font-semibold text-ink dark:text-paper">Accent color</Text>
          <View className="flex-row items-center gap-3">
            <View
              className="w-11 h-11 rounded-xl border border-border dark:border-border-dark"
              style={{ backgroundColor: form.accent_color }}
            />
            <Input
              placeholder="#0a0a0a"
              value={form.accent_color}
              onChangeText={(t) => update("accent_color", t)}
              className="flex-1"
              autoCapitalize="none"
            />
          </View>
        </View>
      </View>
    </AuthScreen>
  );
}
