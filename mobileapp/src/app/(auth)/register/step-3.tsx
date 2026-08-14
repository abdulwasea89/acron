import { useRef, useState } from "react";
import { TextInput, View } from "react-native";
import { router } from "expo-router";

import { AuthScreen } from "@/components/auth-screen";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { Field, FieldGroup } from "@/components/auth/field-group";
import { api, ApiError } from "@/lib/api";
import { useRegisterStore } from "@/stores/register-store";
import { ownerSchema } from "@/lib/validations";
import { OWNER_FLOW, flowPosition } from "@/lib/flow";
import type { Message } from "@/types/api";

/**
 * Step 3 of the owner form, and the one that submits.
 *
 * The two earlier screens validated their own fields, so a failure here is
 * almost always the server rejecting something it alone knows — a taken email,
 * a breached password. Any zod error that does surface gets routed back to the
 * step that owns the field rather than shown as an unexplainable message on a
 * screen with no such input.
 */
export default function RegisterStep3() {
  const { draft, patchDraft, setAccount } = useRegisterStore();
  const [form, setForm] = useState({
    occupation: draft.occupation,
    education: draft.education,
    address: draft.address,
    city: draft.city,
    emergency_contact: draft.emergency_contact,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const educationRef = useRef<TextInput>(null);
  const addressRef = useRef<TextInput>(null);
  const cityRef = useRef<TextInput>(null);
  const emergencyRef = useRef<TextInput>(null);

  /** Which screen each field lives on, for routing validation failures back. */
  const FIELD_STEP: Record<string, string> = {
    full_name: "/(auth)/register/step-1",
    email: "/(auth)/register/step-1",
    password: "/(auth)/register/step-1",
    confirm_password: "/(auth)/register/step-1",
    date_of_birth: "/(auth)/register/step-2",
    gender: "/(auth)/register/step-2",
    phone: "/(auth)/register/step-2",
    cnic: "/(auth)/register/step-2",
  };

  const update = (field: keyof typeof form, value: string) => {
    setForm((p) => ({ ...p, [field]: value }));
    setErrors((p) => ({ ...p, [field]: "" }));
  };

  const handleSubmit = async () => {
    setError(null);
    setErrors({});

    const merged = { ...draft, ...form };
    const parse = ownerSchema.safeParse(merged);

    if (!parse.success) {
      const mine: Record<string, string> = {};
      let elsewhere: string | null = null;

      for (const issue of parse.error.issues) {
        const field = issue.path.join(".");
        if (field in FIELD_STEP) elsewhere ??= FIELD_STEP[field];
        else mine[field] ??= issue.message;
      }

      setErrors(mine);
      if (elsewhere && Object.keys(mine).length === 0) {
        setError("Some earlier details need fixing — taking you back.");
        router.push(elsewhere as never);
      }
      return;
    }

    patchDraft(form);
    setLoading(true);
    try {
      await api.post<Message>("/auth/register", parse.data);
      setAccount(parse.data.email, parse.data.full_name);
      router.push("/(auth)/register/verify");
    } catch (e) {
      if (e instanceof ApiError) setError(e.message);
      else setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthScreen
      title="A few more details"
      subtitle="Last step before we set up your gym."
      back
      progress={flowPosition(OWNER_FLOW, "/(auth)/register/step-3")}
      footer={
        <Button loading={loading} onPress={handleSubmit}>
          Create account
        </Button>
      }
    >
      {error ? (
        <View className="mb-5">
          <Alert type="error" message={error} onDismiss={() => setError(null)} />
        </View>
      ) : null}

      <FieldGroup title="Background">
        <Field
          label="Occupation"
          placeholder="Gym owner"
          value={form.occupation}
          onChangeText={(t) => update("occupation", t)}
          returnKeyType="next"
          onSubmitEditing={() => educationRef.current?.focus()}
          submitBehavior="submit"
          error={errors.occupation}
        />
        <Field
          ref={educationRef}
          label="Education"
          placeholder="Bachelor's degree"
          value={form.education}
          onChangeText={(t) => update("education", t)}
          returnKeyType="next"
          onSubmitEditing={() => addressRef.current?.focus()}
          submitBehavior="submit"
          error={errors.education}
        />
      </FieldGroup>

      <View className="mt-6">
        <FieldGroup title="Where you are">
          <Field
            ref={addressRef}
            label="Address"
            placeholder="12 Gulberg Main Boulevard"
            value={form.address}
            onChangeText={(t) => update("address", t)}
            autoComplete="street-address"
            returnKeyType="next"
            onSubmitEditing={() => cityRef.current?.focus()}
            submitBehavior="submit"
            error={errors.address}
          />
          <Field
            ref={cityRef}
            label="City"
            placeholder="Lahore"
            value={form.city}
            onChangeText={(t) => update("city", t)}
            returnKeyType="next"
            onSubmitEditing={() => emergencyRef.current?.focus()}
            submitBehavior="submit"
            error={errors.city}
          />
        </FieldGroup>
      </View>

      <View className="mt-6">
        <FieldGroup
          title="Emergency contact"
          caption="Someone we can reach if you can't be. Name and phone number."
        >
          <Field
            ref={emergencyRef}
            label="Name and phone"
            placeholder="Sara Khan, +92 300 1234567"
            value={form.emergency_contact}
            onChangeText={(t) => update("emergency_contact", t)}
            returnKeyType="go"
            onSubmitEditing={handleSubmit}
            error={errors.emergency_contact}
          />
        </FieldGroup>
      </View>
    </AuthScreen>
  );
}
