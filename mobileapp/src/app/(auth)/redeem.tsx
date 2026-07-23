import { useState } from "react";
import { ScrollView, KeyboardAvoidingView, Platform } from "react-native";
import { View, Text } from "@/tw";
import { router } from "expo-router";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { api, ApiError } from "@/lib/api";
import { redeemSchema } from "@/lib/validations";
import type { SignupSetPasswordOut } from "@/types/api";

export default function RedeemInvite() {
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

  const update = (field: string, value: string) => {
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
        contentContainerClassName="p-6 pt-16 pb-12"
        keyboardShouldPersistTaps="handled"
      >
        <Text className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
          Redeem Invite
        </Text>
        <Text className="text-muted mb-8">
          Enter your invite code, gym code, and set a password.
        </Text>

        {error && (
          <View className="mb-4">
            <Alert type="error" message={error} onDismiss={() => setError(null)} />
          </View>
        )}

        <View className="gap-4">
          <Input
            label="Gym Code"
            placeholder="IRON-PULS-3K9"
            value={form.org_code}
            onChangeText={(t) => update("org_code", t.toUpperCase())}
            autoCapitalize="characters"
            error={fieldErrors.org_code}
          />
          <Input
            label="Email"
            placeholder="you@example.com"
            value={form.email}
            onChangeText={(t) => update("email", t)}
            autoCapitalize="none"
            keyboardType="email-address"
            error={fieldErrors.email}
          />
          <Input
            label="Invite Code"
            placeholder="Enter your invite code"
            value={form.code}
            onChangeText={(t) => update("code", t)}
            error={fieldErrors.code}
          />
          <Input
            label="Password"
            placeholder="At least 12 characters"
            value={form.password}
            onChangeText={(t) => update("password", t)}
            secureTextEntry
            error={fieldErrors.password}
          />
          <Input
            label="Confirm Password"
            placeholder="Repeat password"
            value={form.confirm_password}
            onChangeText={(t) => update("confirm_password", t)}
            secureTextEntry
            error={fieldErrors.confirm_password}
          />
          <Button loading={loading} onPress={handleSubmit}>
            Redeem Invite
          </Button>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
