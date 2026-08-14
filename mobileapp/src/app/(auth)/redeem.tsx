import { useRef, useState } from "react";
import { TextInput, View } from "react-native";
import { router } from "expo-router";

import { AuthScreen } from "@/components/auth-screen";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { Field, FieldGroup } from "@/components/auth/field-group";
import { PasswordStrength } from "@/components/auth/password-strength";
import { api, ApiError } from "@/lib/api";
import { useJoinStore } from "@/stores/join-store";
import { redeemSchema } from "@/lib/validations";
import type { SignupSetPasswordOut } from "@/types/api";

export default function RedeemInvite() {
  const { setOrg, setEmail: setJoinEmail } = useJoinStore();
  const [form, setForm] = useState({
    org_code: "",
    email: "",
    code: "",
    password: "",
    confirm_password: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const emailRef = useRef<TextInput>(null);
  const codeRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);
  const confirmRef = useRef<TextInput>(null);

  const update = (field: keyof typeof form, value: string) => {
    setForm((p) => ({ ...p, [field]: value }));
    setFieldErrors((p) => ({ ...p, [field]: "" }));
  };

  const handleSubmit = async () => {
    setError(null);
    setFieldErrors({});

    const parse = redeemSchema.safeParse(form);
    if (!parse.success) {
      const errs: Record<string, string> = {};
      for (const issue of parse.error.issues) {
        const field = issue.path.join(".");
        if (!errs[field]) errs[field] = issue.message;
      }
      setFieldErrors(errs);
      return;
    }

    setLoading(true);
    try {
      await api.post<SignupSetPasswordOut>("/memberships/invite/redeem", {
        org_code: parse.data.org_code,
        email: parse.data.email,
        code: parse.data.code,
        password: parse.data.password,
      });

      /* Plan selection reads the join store, so seed it here — without this the
         next screen finds no org code and bounces back to the start. */
      setOrg(parse.data.org_code, "", "");
      setJoinEmail(parse.data.email);
      router.push("/(auth)/join/pick-plan");
    } catch (e) {
      if (e instanceof ApiError) setError(e.message);
      else setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthScreen
      title="Redeem your invite"
      subtitle="Your gym emailed you a code that's tied to your address."
      back
      footer={
        <Button loading={loading} onPress={handleSubmit}>
          Redeem invite
        </Button>
      }
    >
      {error ? (
        <View className="mb-5">
          <Alert type="error" message={error} onDismiss={() => setError(null)} />
        </View>
      ) : null}

      <FieldGroup title="Your invite">
        <Field
          label="Gym code"
          placeholder="IRON-PULS-3K9"
          value={form.org_code}
          onChangeText={(t) => update("org_code", t.toUpperCase())}
          autoCapitalize="characters"
          autoCorrect={false}
          autoFocus
          returnKeyType="next"
          onSubmitEditing={() => emailRef.current?.focus()}
          submitBehavior="submit"
          error={fieldErrors.org_code}
        />
        <Field
          ref={emailRef}
          label="Email"
          placeholder="you@example.com"
          value={form.email}
          onChangeText={(t) => update("email", t)}
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          returnKeyType="next"
          onSubmitEditing={() => codeRef.current?.focus()}
          submitBehavior="submit"
          error={fieldErrors.email}
        />
        <Field
          ref={codeRef}
          label="Invite code"
          placeholder="From your invite email"
          value={form.code}
          onChangeText={(t) => update("code", t)}
          autoCapitalize="characters"
          autoCorrect={false}
          returnKeyType="next"
          onSubmitEditing={() => passwordRef.current?.focus()}
          submitBehavior="submit"
          error={fieldErrors.code}
        />
      </FieldGroup>

      <View className="mt-6">
        <FieldGroup title="Set a password">
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
            error={fieldErrors.password}
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
            onSubmitEditing={handleSubmit}
            error={fieldErrors.confirm_password}
          />
        </FieldGroup>

        <PasswordStrength value={form.password} />
      </View>
    </AuthScreen>
  );
}
