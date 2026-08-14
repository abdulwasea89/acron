import { useRef, useState } from "react";
import { Pressable, TextInput, View } from "react-native";
import { Text } from "heroui-native";
import { Redirect, router } from "expo-router";

import { AuthScreen } from "@/components/auth-screen";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { Field, FieldGroup } from "@/components/auth/field-group";
import { api, ApiError } from "@/lib/api";
import { useAuthStore } from "@/stores/auth-store";
import { routeForRole } from "@/components/auth-guard";
import { memberLoginSchema } from "@/lib/validations";
import type { LoginResponse, MemberLoginRequest } from "@/types/api";

export default function LoginScreen() {
  const { setSession, user, accessToken, isHydrated } = useAuthStore();
  const [orgCode, setOrgCode] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const remember = false;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  // Return advances to the next field rather than dismissing the keyboard.
  const passwordRef = useRef<TextInput>(null);
  const orgCodeRef = useRef<TextInput>(null);

  if (isHydrated && accessToken && user) {
    return <Redirect href={routeForRole(user.role)} />;
  }

  const clearError = (field: string) => setFieldErrors((p) => ({ ...p, [field]: "" }));

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
      subtitle="Sign in with your email, password, and gym code."
      back
      onBack={() => router.push("/")}
      footer={
        <View className="gap-3">
          <Button loading={loading} onPress={handleLogin}>
            Sign in
          </Button>
          <Pressable
            onPress={() => router.push("/(auth)/register/step-1")}
            hitSlop={8}
            className="items-center py-1 active:opacity-60"
          >
            <Text type="body-sm" color="muted">
              New here? <Text className="font-semibold text-accent">Register your gym</Text>
            </Text>
          </Pressable>
        </View>
      }
    >
      {error ? (
        <View className="mb-5">
          <Alert type="error" message={error} onDismiss={() => setError(null)} />
        </View>
      ) : null}

      <FieldGroup caption="Your gym code is on your welcome email — it looks like IRON-PULS-3K9.">
        <Field
          label="Email"
          placeholder="you@yourgym.com"
          value={email}
          onChangeText={(t) => {
            setEmail(t);
            clearError("email");
          }}
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          returnKeyType="next"
          onSubmitEditing={() => passwordRef.current?.focus()}
          submitBehavior="submit"
          error={fieldErrors.email}
        />

        <Field
          ref={passwordRef}
          label="Password"
          placeholder="Your password"
          value={password}
          onChangeText={(t) => {
            setPassword(t);
            clearError("password");
          }}
          autoComplete="current-password"
          secure
          returnKeyType="next"
          onSubmitEditing={() => orgCodeRef.current?.focus()}
          submitBehavior="submit"
          error={fieldErrors.password}
        />

        <Field
          ref={orgCodeRef}
          label="Gym code"
          placeholder="IRON-PULS-3K9"
          value={orgCode}
          onChangeText={(t) => {
            setOrgCode(t.toUpperCase());
            clearError("org_code");
          }}
          autoCapitalize="characters"
          autoCorrect={false}
          returnKeyType="go"
          onSubmitEditing={handleLogin}
          error={fieldErrors.org_code}
        />
      </FieldGroup>

      <View className="mt-6 gap-4 px-1">
        <Pressable
          onPress={() => router.push("/(auth)/forgot-password")}
          hitSlop={6}
          className="active:opacity-60"
        >
          <Text type="body-sm" className="text-accent">
            Forgot your password?
          </Text>
        </Pressable>

        <Pressable
          onPress={() => router.push("/(auth)/recover-codes")}
          hitSlop={6}
          className="active:opacity-60"
        >
          <Text type="body-sm" className="text-accent">
            Forgot your gym code?
          </Text>
        </Pressable>

        <Pressable
          onPress={() => router.push("/(auth)/magic-link")}
          hitSlop={6}
          className="active:opacity-60"
        >
          <Text type="body-sm" className="text-accent">
            Email me a sign-in link instead
          </Text>
        </Pressable>
      </View>
    </AuthScreen>
  );
}
