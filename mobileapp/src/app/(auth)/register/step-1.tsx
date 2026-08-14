import { useRef, useState } from "react";
import { TextInput, View } from "react-native";
import { router } from "expo-router";

import { AuthScreen } from "@/components/auth-screen";
import { Button } from "@/components/ui/button";
import { Field, FieldGroup } from "@/components/auth/field-group";
import { PasswordStrength } from "@/components/auth/password-strength";
import { useRegisterStore } from "@/stores/register-store";
import { emailSchema, nameSchema, passwordSchema } from "@/lib/validations";
import { OWNER_FLOW, flowPosition } from "@/lib/flow";

/**
 * Step 1 of the owner form: the credentials.
 *
 * Validated on this screen rather than at the end of the flow — learning on
 * step 3 that your password was rejected on step 1 is what makes a long signup
 * feel hostile.
 */
export default function RegisterStep1() {
  const { draft, patchDraft } = useRegisterStore();
  const [form, setForm] = useState({
    full_name: draft.full_name,
    email: draft.email,
    password: draft.password,
    confirm_password: draft.confirm_password,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const emailRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);
  const confirmRef = useRef<TextInput>(null);

  const update = (field: keyof typeof form, value: string) => {
    setForm((p) => ({ ...p, [field]: value }));
    setErrors((p) => ({ ...p, [field]: "" }));
  };

  const handleContinue = () => {
    const next: Record<string, string> = {};

    const name = nameSchema.safeParse(form.full_name);
    if (!name.success) next.full_name = name.error.issues[0].message;

    const mail = emailSchema.safeParse(form.email);
    if (!mail.success) next.email = mail.error.issues[0].message;

    const pass = passwordSchema.safeParse(form.password);
    if (!pass.success) next.password = pass.error.issues[0].message;
    else if (form.password !== form.confirm_password) {
      next.confirm_password = "Passwords do not match";
    }

    if (Object.keys(next).length > 0) {
      setErrors(next);
      return;
    }

    patchDraft(form);
    router.push("/(auth)/register/step-2");
  };

  return (
    <AuthScreen
      title="Create your account"
      subtitle="This is how you'll sign in to manage your gym."
      back
      progress={flowPosition(OWNER_FLOW, "/(auth)/register/step-1")}
      footer={<Button onPress={handleContinue}>Continue</Button>}
    >
      <FieldGroup>
        <Field
          label="Full name"
          placeholder="Alex Morgan"
          value={form.full_name}
          onChangeText={(t) => update("full_name", t)}
          autoComplete="name"
          returnKeyType="next"
          onSubmitEditing={() => emailRef.current?.focus()}
          submitBehavior="submit"
          error={errors.full_name}
        />
        <Field
          ref={emailRef}
          label="Email"
          placeholder="you@yourgym.com"
          value={form.email}
          onChangeText={(t) => update("email", t)}
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          returnKeyType="next"
          onSubmitEditing={() => passwordRef.current?.focus()}
          submitBehavior="submit"
          error={errors.email}
        />
      </FieldGroup>

      <View className="mt-6">
        <FieldGroup>
          <Field
            ref={passwordRef}
            label="Password"
            placeholder="At least 12 characters"
            value={form.password}
            onChangeText={(t) => update("password", t)}
            autoComplete="new-password"
            secure
            returnKeyType="next"
            onSubmitEditing={() => confirmRef.current?.focus()}
            submitBehavior="submit"
            error={errors.password}
          />
          <Field
            ref={confirmRef}
            label="Confirm password"
            placeholder="Type it again"
            value={form.confirm_password}
            onChangeText={(t) => update("confirm_password", t)}
            autoComplete="new-password"
            secure
            returnKeyType="go"
            onSubmitEditing={handleContinue}
            error={errors.confirm_password}
          />
        </FieldGroup>

        <PasswordStrength value={form.password} />
      </View>
    </AuthScreen>
  );
}
