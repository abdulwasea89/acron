import { useState } from "react";
import { ScrollView, KeyboardAvoidingView, Platform } from "react-native";
import { View, Text, TextInput, Pressable } from "@/tw";
import { router } from "expo-router";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { api, ApiError } from "@/lib/api";
import { useJoinStore } from "@/stores/join-store";
import { signupStartSchema } from "@/lib/validations";
import type { SignupStartOut } from "@/types/api";

export default function OrgCodeScreen() {
  const { setOrg } = useJoinStore();
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
          Join a Gym
        </Text>
        <Text className="text-muted mb-8">
          Enter the gym code from your gym owner
        </Text>

        {error && (
          <View className="mb-4">
            <Alert type="error" message={error} onDismiss={() => setError(null)} />
          </View>
        )}

        <View className="gap-4">
          <View className="gap-1.5">
            <Text className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Gym Code
            </Text>
            <TextInput
              className="border border-border dark:border-border-dark bg-white dark:bg-bg-dark-secondary rounded-xl px-4 py-4 text-gray-900 dark:text-white text-xl text-center tracking-[4px]"
              placeholder="IRON-PULS-3K9"
              placeholderTextColor="#9ca3af"
              value={orgCode}
              onChangeText={(t) => { setOrgCode(t.toUpperCase()); setFieldError(""); }}
              autoCapitalize="characters"
            />
            {fieldError && (
              <Text className="text-sm text-danger">{fieldError}</Text>
            )}
          </View>

          <Button loading={loading} onPress={handleSubmit}>
            Find Gym
          </Button>
        </View>

        <View className="mt-auto pt-12 items-center">
          <Text className="text-sm text-muted">
            Have an invite code?{" "}
            <Text
              className="text-brand font-semibold"
              onPress={() => router.push("/(auth)/redeem")}
            >
              Redeem it
            </Text>
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
