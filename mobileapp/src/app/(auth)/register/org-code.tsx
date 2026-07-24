import { useState } from "react";
import { View, Text, TextInput, Pressable } from "@/tw";
import { useColorScheme } from "react-native";
import { router } from "expo-router";
import { AuthScreen } from "@/components/auth-screen";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { api, ApiError } from "@/lib/api";
import { useJoinStore } from "@/stores/join-store";
import { signupStartSchema } from "@/lib/validations";
import type { SignupStartOut } from "@/types/api";

export default function OrgCodeScreen() {
  const { setOrg } = useJoinStore();
  const isDark = useColorScheme() === "dark";
  const [orgCode, setOrgCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState("");

  const handleSubmit = async () => {
    setError(null);
    setFieldError("");

    const parse = signupStartSchema.safeParse({ org_code: orgCode });
    if (!parse.success) {
      setFieldError("Enter a valid gym code");
      return;
    }

    setLoading(true);
    try {
      const res = await api.post<SignupStartOut>("/memberships/signup/start", {
        org_code: orgCode,
      });

      if (!res.accepting_signups) {
        setError("This gym is not accepting new signups right now.");
        return;
      }

      setOrg(orgCode, res.organization_name, res.organization_id);
      router.push("/(auth)/join/verify-email");
    } catch (e) {
      if (e instanceof ApiError) {
        if (e.status === 404) setError("Gym not found. Check the code and try again.");
        else setError(e.message);
      } else {
        setError("Network error. Check your connection.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthScreen
      title="Enter your gym code"
      description="Ask your gym owner for the code — it looks like IRON-PULS-3K9."
      back
      footer={
        <View className="items-center">
          <Text className="text-[13px] text-muted dark:text-muted-dark">
            Have an invite code?{" "}
            <Text
              className="font-bold text-ink dark:text-paper"
              onPress={() => router.push("/(auth)/redeem")}
            >
              Redeem it
            </Text>
          </Text>
        </View>
      }
    >
      {error && (
        <View className="mb-5">
          <Alert type="error" message={error} onDismiss={() => setError(null)} />
        </View>
      )}

      <View className="gap-5">
        <View className="gap-2">
          <Text className="text-[13px] font-semibold text-ink dark:text-paper">Gym code</Text>
          <TextInput
            className="border border-border dark:border-border-dark bg-bg-secondary dark:bg-surface-dark-2
              rounded-xl px-4 py-5 text-ink dark:text-paper text-[22px] text-center tracking-[3px] font-semibold"
            placeholder="IRON-PULS-3K9"
            placeholderTextColor={isDark ? "#6e6e6e" : "#94a3b8"}
            value={orgCode}
            onChangeText={(t) => { setOrgCode(t.toUpperCase()); setFieldError(""); }}
            autoCapitalize="characters"
          />
          {fieldError ? (
            <Text className="text-[12px] text-danger dark:text-danger-dark">{fieldError}</Text>
          ) : null}
        </View>

        <Button loading={loading} onPress={handleSubmit}>
          Find gym
        </Button>
      </View>
    </AuthScreen>
  );
}
