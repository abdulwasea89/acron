import { useState } from "react";
import { ScrollView, KeyboardAvoidingView, Platform } from "react-native";
import { View, Text } from "@/tw";
import { router } from "expo-router";
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
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      className="flex-1"
    >
      <ScrollView
        className="flex-1 bg-white dark:bg-bg-dark"
        contentContainerClassName="p-6 pt-20 flex-grow"
        keyboardShouldPersistTaps="handled"
      >
        <Text className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
          Create a password
        </Text>
        <Text className="text-muted mb-8">
          Must be at least 12 characters with mixed case, numbers, and symbols
        </Text>

        {error && (
          <View className="mb-4">
            <Alert type="error" message={error} onDismiss={() => setError(null)} />
          </View>
        )}

        <View className="gap-4">
          <Input
            label="Password"
            placeholder="At least 12 characters"
            value={password}
            onChangeText={(t) => { setPassword(t); setFieldErrors((p) => ({ ...p, password: "" })); }}
            secureTextEntry
            error={fieldErrors.password}
          />
          <Input
            label="Confirm Password"
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
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
