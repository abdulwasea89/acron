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
import { signupPasswordSchema } from "@/lib/validations";
import { JOIN_FLOW, flowPosition } from "@/lib/flow";
import type { SignupSetPasswordOut } from "@/types/api";

export default function SetPassword() {
  const { orgCode, email, setMemberId } = useJoinStore();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const confirmRef = useRef<TextInput>(null);

  if (!email) {
    router.replace("/(auth)/register/org-code");
    return null;
  }

  const handleSubmit = async () => {
    setError(null);
    setFieldErrors({});

    const parse = signupPasswordSchema.safeParse({
      password,
      confirm_password: confirmPassword,
    });

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
      const res = await api.post<SignupSetPasswordOut>("/memberships/signup/set-password", {
        org_code: orgCode,
        email,
        password: parse.data.password,
      });
      setMemberId(res.member_id);
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
      title="Create a password"
      subtitle="You'll use this with your email and gym code to sign in."
      back
      progress={flowPosition(JOIN_FLOW, "/(auth)/join/set-password")}
      footer={
        <Button loading={loading} onPress={handleSubmit}>
          Continue
        </Button>
      }
    >
      {error ? (
        <View className="mb-5">
          <Alert type="error" message={error} onDismiss={() => setError(null)} />
        </View>
      ) : null}

      <FieldGroup>
        <Field
          label="Password"
          placeholder="At least 12 characters"
          value={password}
          onChangeText={(t) => {
            setPassword(t);
            setFieldErrors((p) => ({ ...p, password: "" }));
          }}
          autoComplete="new-password"
          secure
          autoFocus
          returnKeyType="next"
          onSubmitEditing={() => confirmRef.current?.focus()}
          submitBehavior="submit"
          error={fieldErrors.password}
        />
        <Field
          ref={confirmRef}
          label="Confirm password"
          placeholder="Type it again"
          value={confirmPassword}
          onChangeText={(t) => {
            setConfirmPassword(t);
            setFieldErrors((p) => ({ ...p, confirm_password: "" }));
          }}
          autoComplete="new-password"
          secure
          returnKeyType="go"
          onSubmitEditing={handleSubmit}
          error={fieldErrors.confirm_password}
        />
      </FieldGroup>

      <PasswordStrength value={password} />
    </AuthScreen>
  );
}
