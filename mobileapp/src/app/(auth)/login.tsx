import { useState } from "react";
import { View, Text, Pressable } from "react-native";
import { router } from "expo-router";
import { AuthScreen } from "@/components/auth-screen";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { api, ApiError } from "@/lib/api";
import { useAuthStore } from "@/stores/auth-store";
import { memberLoginSchema } from "@/lib/validations";
import type { LoginResponse, MemberLoginRequest } from "@/types/api";

export default function LoginScreen() {
  const { setSession } = useAuthStore();
  const [orgCode, setOrgCode] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
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
      const body: MemberLoginRequest = { org_code: orgCode, email, password, remember };

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

      if (res.requires_mfa) {
        router.replace("/(auth)/mfa");
        return;
      }

      const role = res.user.role;
      if (role === "trainer" || role === "front_desk") router.replace("/(staff)/dashboard");
      else if (role === "owner" || role === "manager") router.replace("/(admin)/dashboard");
      else router.replace("/(member)/dashboard");
    } catch (e) {
      if (e instanceof ApiError) {
        if (e.status === 401) setError("Invalid credentials. Please try again.");
        else if (e.status === 428) {
          setError(null);
          router.replace("/(auth)/mfa");
        } else setError(e.message);
      } else {
        const cause = e instanceof Error ? e.message : String(e);
        setError(`Network error. Check your connection. (${cause})`);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthScreen
      title="Welcome back"
      description="Sign in to pick up where your gym left off."
      back
      onBack={() => router.push("/")}
      footer={
        <View className="items-center gap-4">
          <Pressable onPress={() => router.push("/(auth)/magic-link")} className="active:opacity-60">
            <Text className="text-[13px] font-semibold text-foreground">
              Send a secure sign-in link instead
            </Text>
          </Pressable>
          <Text className="text-[13px] text-muted">
            New to Gym Ops?{" "}
            <Text
              className="font-bold text-foreground"
              onPress={() => router.push("/(auth)/register/step-1")}
            >
              Create your gym
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
        <Input
          label="Work email"
          placeholder="you@yourgym.com"
          value={email}
          onChangeText={(t) => { setEmail(t); setFieldErrors((p) => ({ ...p, email: "" })); }}
          autoCapitalize="none"
          keyboardType="email-address"
          error={fieldErrors.email}
        />

        <View>
          <View className="relative">
            <Input
              label="Password"
              placeholder="Enter your password"
              value={password}
              onChangeText={(t) => { setPassword(t); setFieldErrors((p) => ({ ...p, password: "" })); }}
              secureTextEntry={!showPassword}
              error={fieldErrors.password}
            />
            <Pressable
              onPress={() => setShowPassword((v) => !v)}
              hitSlop={8}
              className="absolute right-3 top-[38px] px-1 active:opacity-60"
            >
              <Text className="text-[12px] font-bold text-muted">
                {showPassword ? "Hide" : "Show"}
              </Text>
            </Pressable>
          </View>
        </View>

        <Input
          label="Gym code"
          placeholder="IRON-PULS-3K9"
          hint="Leave blank to go to your last gym"
          value={orgCode}
          onChangeText={(t) => { setOrgCode(t.toUpperCase()); setFieldErrors((p) => ({ ...p, org_code: "" })); }}
          autoCapitalize="characters"
          error={fieldErrors.org_code}
        />

        <View className="flex-row items-center justify-between">
          <Pressable onPress={() => router.push("/(auth)/recover-codes")} className="active:opacity-60">
            <Text className="text-[13px] text-muted">
              Don&apos;t remember your gym code?
            </Text>
          </Pressable>
          <Pressable onPress={() => router.push("/(auth)/forgot-password")} className="active:opacity-60">
            <Text className="text-[13px] text-muted">Forgot password?</Text>
          </Pressable>
        </View>

        <Button loading={loading} onPress={handleLogin}>
          Sign in
        </Button>
      </View>

      {/* Divider */}
      <View className="flex-row items-center gap-3 mt-7">
        <View className="flex-1 h-px bg-border" />
        <Text className="text-[12px] text-muted">or</Text>
        <View className="flex-1 h-px bg-border" />
      </View>
    </AuthScreen>
  );
}
