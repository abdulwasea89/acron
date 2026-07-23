import { useState } from "react";
import { ScrollView, KeyboardAvoidingView, Platform } from "react-native";
import { View, Text, TextInput, Pressable } from "@/tw";
import { router } from "expo-router";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { api, ApiError } from "@/lib/api";
import { useAuthStore } from "@/stores/auth-store";
import { memberLoginSchema } from "@/lib/validations";
import type { LoginResponse, MemberLoginRequest } from "@/types/api";

export default function LoginScreen() {
  const { setSession } = useAuthStore();
  const [orgCode, setOrgCode] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const handleLogin = async () => {
    setError(null);
    setFieldErrors({});

    const parse = memberLoginSchema.safeParse({
      org_code: orgCode,
      email,
      password,
      remember,
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
      const body: MemberLoginRequest = {
        org_code: orgCode,
        email,
        password,
        remember,
      };

      const res = orgCode
        ? await api.post<LoginResponse>("/auth/member-login", body)
        : await api.post<LoginResponse>("/auth/login", body);

      setSession(
        { accessToken: res.access_token, refreshToken: res.refresh_token },
        {
          user_id: res.user.user_id,
          email: res.user.email,
          role: res.user.role as any,
          org_id: res.user.org_id,
          member_id: res.user.member_id,
          member_status: res.user.member_status,
        },
      );

      if (res.mfa_required) {
        router.replace("/(auth)/mfa");
        return;
      }

      const role = res.user.role;
      if (role === "member") router.replace("/(member)");
      else if (role === "trainer" || role === "front_desk") router.replace("/(staff)");
      else if (role === "owner" || role === "manager") router.replace("/(admin)");
      else router.replace("/(member)");
    } catch (e) {
      if (e instanceof ApiError) {
        if (e.status === 401) setError("Invalid credentials. Please try again.");
        else if (e.status === 428) {
          setError(null);
          router.replace("/(auth)/mfa");
        } else setError(e.message);
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
          Welcome back
        </Text>
        <Text className="text-muted mb-8">
          Sign in to manage your gym
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
              className="border border-border dark:border-border-dark bg-white dark:bg-bg-dark-secondary rounded-xl px-4 py-3.5 text-gray-900 dark:text-white text-base"
              placeholder="e.g. IRON-PULS-3K9"
              placeholderTextColor="#9ca3af"
              value={orgCode}
              onChangeText={(t) => { setOrgCode(t.toUpperCase()); setFieldErrors((p) => ({ ...p, org_code: "" })); }}
              autoCapitalize="characters"
            />
          </View>

          <View className="gap-1.5">
            <Text className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Email
            </Text>
            <TextInput
              className="border border-border dark:border-border-dark bg-white dark:bg-bg-dark-secondary rounded-xl px-4 py-3.5 text-gray-900 dark:text-white text-base"
              placeholder="you@example.com"
              placeholderTextColor="#9ca3af"
              value={email}
              onChangeText={(t) => { setEmail(t); setFieldErrors((p) => ({ ...p, email: "" })); }}
              autoCapitalize="none"
              keyboardType="email-address"
            />
            {fieldErrors.email && (
              <Text className="text-sm text-danger">{fieldErrors.email}</Text>
            )}
          </View>

          <View className="gap-1.5">
            <Text className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Password
            </Text>
            <TextInput
              className="border border-border dark:border-border-dark bg-white dark:bg-bg-dark-secondary rounded-xl px-4 py-3.5 text-gray-900 dark:text-white text-base"
              placeholder="Your password"
              placeholderTextColor="#9ca3af"
              value={password}
              onChangeText={(t) => { setPassword(t); setFieldErrors((p) => ({ ...p, password: "" })); }}
              secureTextEntry
            />
            {fieldErrors.password && (
              <Text className="text-sm text-danger">{fieldErrors.password}</Text>
            )}
          </View>

          <View className="flex-row items-center justify-between">
            <Pressable
              className="flex-row items-center gap-2"
              onPress={() => setRemember(!remember)}
            >
              <View
                className={`w-5 h-5 rounded border-2 items-center justify-center
                  ${remember ? "bg-brand border-brand" : "border-gray-300 dark:border-gray-600"}`}
              >
                {remember && <Text className="text-white text-xs">✓</Text>}
              </View>
              <Text className="text-sm text-gray-600 dark:text-gray-400">Remember me</Text>
            </Pressable>

            <Pressable onPress={() => router.push("/(auth)/forgot-password")}>
              <Text className="text-sm text-brand">Forgot password?</Text>
            </Pressable>
          </View>

          <Button loading={loading} onPress={handleLogin}>
            Sign In
          </Button>
        </View>

        <View className="mt-auto pt-8 items-center gap-3">
          <Pressable onPress={() => router.push("/(auth)/magic-link")}>
            <Text className="text-brand text-sm">Sign in with magic link</Text>
          </Pressable>
          <Pressable onPress={() => router.push("/(auth)/recover-codes")}>
            <Text className="text-brand text-sm">Forgot your gym code?</Text>
          </Pressable>
          <Text className="text-sm text-muted">
            Don't have an account?{" "}
            <Text
              className="text-brand font-semibold"
              onPress={() => router.push("/")}
            >
              Go back
            </Text>
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
