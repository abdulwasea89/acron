import { useRef, useState } from "react";
import { TextInput, View } from "react-native";
import { router } from "expo-router";

import { AuthScreen } from "@/components/auth-screen";
import { Button } from "@/components/ui/button";
import { Field, FieldGroup } from "@/components/auth/field-group";
import { AccentPicker, DEFAULT_ACCENT } from "@/components/auth/accent-picker";
import { useRegisterStore } from "@/stores/register-store";
import { gymDetailsSchema } from "@/lib/validations";
import { OWNER_FLOW, flowPosition } from "@/lib/flow";
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
    accent_color: gymDetails?.accent_color ?? DEFAULT_ACCENT,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const addressRef = useRef<TextInput>(null);
  const hoursRef = useRef<TextInput>(null);
  const countryRef = useRef<TextInput>(null);
  const currencyRef = useRef<TextInput>(null);

  const update = (field: keyof typeof form, value: string) => {
    setForm((p) => ({ ...p, [field]: value }));
    setErrors((p) => ({ ...p, [field]: "" }));
  };

  const handleContinue = () => {
    const data = {
      ...form,
      address: form.address || null,
      working_hours: form.working_hours || null,
      accent_color: form.accent_color || null,
    };

    const parse = gymDetailsSchema.safeParse(data);
    if (!parse.success) {
      const next: Record<string, string> = {};
      for (const issue of parse.error.issues) {
        const field = issue.path.join(".");
        if (!next[field]) next[field] = issue.message;
      }
      setErrors(next);
      return;
    }

    setGymDetails(data as GymDetails);
    router.push("/(auth)/register/tier");
  };

  return (
    <AuthScreen
      title="About your gym"
      subtitle="Members see this name and these hours. You can change it all later."
      back
      progress={flowPosition(OWNER_FLOW, "/(auth)/register/gym-details")}
      footer={<Button onPress={handleContinue}>Continue</Button>}
    >
      <FieldGroup title="The basics">
        <Field
          label="Gym name"
          placeholder="Iron Pulse Boxing"
          value={form.name}
          onChangeText={(t) => update("name", t)}
          returnKeyType="next"
          onSubmitEditing={() => addressRef.current?.focus()}
          submitBehavior="submit"
          error={errors.name}
        />
        <Field
          ref={addressRef}
          label="Address"
          placeholder="12 Gulberg Main Boulevard"
          value={form.address}
          onChangeText={(t) => update("address", t)}
          autoComplete="street-address"
          returnKeyType="next"
          onSubmitEditing={() => hoursRef.current?.focus()}
          submitBehavior="submit"
          error={errors.address}
        />
        <Field
          ref={hoursRef}
          label="Working hours"
          placeholder="Mon–Sat, 5AM–10PM"
          value={form.working_hours}
          onChangeText={(t) => update("working_hours", t)}
          returnKeyType="next"
          onSubmitEditing={() => countryRef.current?.focus()}
          submitBehavior="submit"
          error={errors.working_hours}
        />
      </FieldGroup>

      <View className="mt-6">
        <FieldGroup
          title="Region"
          caption="Sets your billing currency and how dates and times are shown."
        >
          <Field
            ref={countryRef}
            label="Country"
            placeholder="PK"
            value={form.country}
            onChangeText={(t) => update("country", t.toUpperCase())}
            autoCapitalize="characters"
            autoCorrect={false}
            maxLength={2}
            returnKeyType="next"
            onSubmitEditing={() => currencyRef.current?.focus()}
            submitBehavior="submit"
            error={errors.country}
          />
          <Field
            ref={currencyRef}
            label="Currency"
            placeholder="USD"
            value={form.default_currency}
            onChangeText={(t) => update("default_currency", t.toUpperCase())}
            autoCapitalize="characters"
            autoCorrect={false}
            maxLength={3}
            returnKeyType="next"
            error={errors.default_currency}
          />
          <Field
            label="Timezone"
            placeholder="UTC"
            value={form.timezone}
            onChangeText={(t) => update("timezone", t)}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="go"
            onSubmitEditing={handleContinue}
            error={errors.timezone}
          />
        </FieldGroup>
      </View>

      <View className="mt-6">
        <AccentPicker
          value={form.accent_color}
          onChange={(v) => update("accent_color", v)}
        />
      </View>
    </AuthScreen>
  );
}
