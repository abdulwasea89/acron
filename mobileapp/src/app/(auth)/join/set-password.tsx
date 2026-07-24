import { useState } from "react";
import { View } from "@/tw";
import { router } from "expo-router";
import { AuthScreen } from "@/components/auth-screen";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { api, ApiError } from "@/lib/api";
import { useJoinStore } from "@/stores/join-store";
import { signupPasswordSchema } from "@/lib/validations";
import type { SignupSetPasswordOut } from "@/types/api";

export default function SetPassword() {
  const { orgCode, email, setMemberId } = useJoinStore();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

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
      const res = await api.post<SignupSetPasswordOut>(
        "/memberships/signup/set-password",
        { org_code: orgCode, email, password: parse.data.password },
      );
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
      description="At least 12 characters with mixed case, numbers, and symbols."
      back
    >
      {error && (
        <View className="mb-5">
          <Alert type="error" message={error} onDismiss={() => setError(null)} />
        </View>
      )}

      <View className="gap-5">
        <Input
          label="Password"
          placeholder="At least 12 characters"
          value={password}
          onChangeText={(t) => { setPassword(t); setFieldErrors((p) => ({ ...p, password: "" })); }}
          secureTextEntry
          error={fieldErrors.password}
        />
        <Input
          label="Confirm password"
          placeholder="Repeat password"
          value={confirmPassword}
          onChangeText={(t) => { setConfirmPassword(t); setFieldErrors((p) => ({ ...p, confirm_password: "" })); }}
          secureTextEntry
          error={fieldErrors.confirm_password}
        />
        <Button loading={loading} onPress={handleSubmit}>
          Continue
        </Button>
      </View>
    </AuthScreen>
  );
}
