import { useRef, useState } from "react";
import { TextInput, View } from "react-native";
import { router } from "expo-router";

import { AuthScreen } from "@/components/auth-screen";
import { Button } from "@/components/ui/button";
import { Field, FieldGroup } from "@/components/auth/field-group";
import { Segmented } from "@/components/auth/segmented";
import { useRegisterStore } from "@/stores/register-store";
import { cnicSchema, phoneSchema } from "@/lib/validations";
import { maskCnic, maskDate, maskPhone } from "@/lib/masks";
import { OWNER_FLOW, flowPosition } from "@/lib/flow";

const GENDER_OPTIONS = [
  { label: "Male", value: "male" },
  { label: "Female", value: "female" },
  { label: "Other", value: "other" },
] as const;

const MIN_OWNER_AGE = 16;

/** Mirrors the backend's `_valid_dob` so the rejection happens before the request. */
function validateDob(value: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return "Use the format YYYY-MM-DD";

  const parsed = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return "Enter a real date";

  const today = new Date();
  if (parsed > today) return "Date of birth cannot be in the future";

  const age =
    today.getUTCFullYear() -
    parsed.getUTCFullYear() -
    (today.getUTCMonth() < parsed.getUTCMonth() ||
    (today.getUTCMonth() === parsed.getUTCMonth() && today.getUTCDate() < parsed.getUTCDate())
      ? 1
      : 0);

  if (age < MIN_OWNER_AGE) return `You must be at least ${MIN_OWNER_AGE} years old`;
  if (age > 120) return "Enter a valid date of birth";
  return null;
}

/** Step 2 of the owner form: who you are, as the gym's legal operator. */
export default function RegisterStep2() {
  const { draft, patchDraft } = useRegisterStore();
  const [form, setForm] = useState({
    date_of_birth: draft.date_of_birth,
    gender: draft.gender,
    phone: draft.phone,
    cnic: draft.cnic,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const phoneRef = useRef<TextInput>(null);
  const cnicRef = useRef<TextInput>(null);

  const update = (field: keyof typeof form, value: string) => {
    setForm((p) => ({ ...p, [field]: value }));
    setErrors((p) => ({ ...p, [field]: "" }));
  };

  const handleContinue = () => {
    const next: Record<string, string> = {};

    const dob = validateDob(form.date_of_birth);
    if (dob) next.date_of_birth = dob;

    if (!form.gender) next.gender = "Select an option";

    const phone = phoneSchema.safeParse(form.phone);
    if (!phone.success) next.phone = phone.error.issues[0].message;

    const cnic = cnicSchema.safeParse(form.cnic);
    if (!cnic.success) next.cnic = cnic.error.issues[0].message;

    if (Object.keys(next).length > 0) {
      setErrors(next);
      return;
    }

    patchDraft(form);
    router.push("/(auth)/register/step-3");
  };

  return (
    <AuthScreen
      title="About you"
      subtitle="Gyms handle money and member records, so we verify who runs them."
      back
      progress={flowPosition(OWNER_FLOW, "/(auth)/register/step-2")}
      footer={<Button onPress={handleContinue}>Continue</Button>}
    >
      <FieldGroup>
        <Field
          label="Date of birth"
          placeholder="YYYY-MM-DD"
          value={form.date_of_birth}
          onChangeText={(t) => update("date_of_birth", maskDate(t))}
          keyboardType="number-pad"
          maxLength={10}
          returnKeyType="next"
          error={errors.date_of_birth}
        />
      </FieldGroup>

      <View className="mt-6">
        <Segmented
          label="Gender"
          options={GENDER_OPTIONS}
          value={form.gender}
          onChange={(v) => update("gender", v)}
          error={errors.gender}
        />
      </View>

      <View className="mt-6">
        <FieldGroup caption="We use your phone for payment alerts and account recovery.">
          <Field
            ref={phoneRef}
            label="Phone"
            placeholder="+92 300 1234567"
            value={form.phone}
            onChangeText={(t) => update("phone", maskPhone(t))}
            keyboardType="phone-pad"
            autoComplete="tel"
            returnKeyType="next"
            onSubmitEditing={() => cnicRef.current?.focus()}
            submitBehavior="submit"
            error={errors.phone}
          />
          <Field
            ref={cnicRef}
            label="CNIC"
            placeholder="42101-1234567-8"
            value={form.cnic}
            onChangeText={(t) => update("cnic", maskCnic(t))}
            keyboardType="number-pad"
            maxLength={15}
            returnKeyType="go"
            onSubmitEditing={handleContinue}
            error={errors.cnic}
          />
        </FieldGroup>
      </View>
    </AuthScreen>
  );
}
