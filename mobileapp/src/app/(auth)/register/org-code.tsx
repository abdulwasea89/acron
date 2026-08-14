import { useState } from "react";
import { Pressable, View, useColorScheme } from "react-native";
import { Text } from "heroui-native";
import { router } from "expo-router";

import { AuthScreen } from "@/components/auth-screen";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { Field, FieldGroup } from "@/components/auth/field-group";
import { Icon } from "@/components/icon";
import { api, ApiError } from "@/lib/api";
import { useJoinStore } from "@/stores/join-store";
import { signupStartSchema } from "@/lib/validations";
import { getPalette } from "@/lib/theme";
import { JOIN_FLOW, flowPosition } from "@/lib/flow";
import type { SignupStartOut } from "@/types/api";

export default function OrgCodeScreen() {
  const { setOrg } = useJoinStore();
  const [orgCode, setOrgCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState("");
  const isDark = useColorScheme() === "dark";
  const p = getPalette(isDark);

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
        setError("This gym isn't accepting new members right now.");
        return;
      }

      setOrg(orgCode, res.organization_name, res.organization_id);
      router.push("/(auth)/join/verify-email");
    } catch (e) {
      if (e instanceof ApiError) {
        if (e.status === 404) setError("No gym found with that code. Check it and try again.");
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
      title="Find your gym"
      subtitle="Your gym gave you a code when you signed up."
      back
      progress={flowPosition(JOIN_FLOW, "/(auth)/register/org-code")}
      footer={
        <View className="gap-3">
          <Button loading={loading} onPress={handleSubmit}>
            Find gym
          </Button>
          <Pressable
            onPress={() => router.push("/(auth)/redeem")}
            hitSlop={8}
            className="items-center py-1 active:opacity-60"
          >
            <Text type="body-sm" color="muted">
              Got an invite instead? <Text className="font-semibold text-accent">Redeem it</Text>
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

      <View className="mb-6 items-center">
        <View
          className="h-14 w-14 items-center justify-center rounded-2xl"
          style={{ backgroundColor: `${p.accent}1f` }}
        >
          <Icon name="building.2.fill" android="storefront" size={24} color={p.accent} />
        </View>
      </View>

      <FieldGroup caption="It's on your welcome email or posted at the front desk — something like IRON-PULS-3K9.">
        <Field
          label="Gym code"
          placeholder="IRON-PULS-3K9"
          value={orgCode}
          onChangeText={(t) => {
            setOrgCode(t.toUpperCase());
            setFieldError("");
          }}
          autoCapitalize="characters"
          autoCorrect={false}
          autoFocus
          returnKeyType="go"
          onSubmitEditing={handleSubmit}
          error={fieldError}
        />
      </FieldGroup>
    </AuthScreen>
  );
}
