import { useEffect, useState } from "react";
import { Pressable, View, useColorScheme } from "react-native";
import * as Clipboard from "expo-clipboard";
import { Text } from "heroui-native";
import { router } from "expo-router";

import { AuthScreen } from "@/components/auth-screen";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { Field, FieldGroup } from "@/components/auth/field-group";
import { SentConfirmation } from "@/components/auth/sent-confirmation";
import { Spinner } from "@/components/ui/spinner";
import { Icon } from "@/components/icon";
import { api, ApiError } from "@/lib/api";
import { getPalette } from "@/lib/theme";
import type { MfaEnrollResponse, Message, MfaStatus } from "@/types/api";

/** One reason to turn MFA on, as a row rather than a paragraph. */
function Benefit({
  icon,
  android,
  title,
  detail,
}: {
  icon: Parameters<typeof Icon>[0]["name"];
  android: string;
  title: string;
  detail: string;
}) {
  const isDark = useColorScheme() === "dark";
  const p = getPalette(isDark);

  return (
    <View className="flex-row items-start gap-3.5 px-4 py-3.5">
      <View
        className="h-9 w-9 items-center justify-center rounded-xl"
        style={{ backgroundColor: `${p.accent}1f` }}
      >
        <Icon name={icon} android={android} size={18} color={p.accent} />
      </View>
      <View className="flex-1">
        <Text type="body-sm" weight="semibold" className="text-foreground">
          {title}
        </Text>
        <Text type="body-sm" color="muted" className="mt-0.5">
          {detail}
        </Text>
      </View>
    </View>
  );
}

export default function MfaEnroll() {
  const [status, setStatus] = useState<MfaStatus | null>(null);
  const [enrollData, setEnrollData] = useState<MfaEnrollResponse | null>(null);
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(true);
  const [confirming, setConfirming] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isDark = useColorScheme() === "dark";
  const p = getPalette(isDark);

  useEffect(() => {
    api
      .get<MfaStatus>("/auth/mfa")
      .then(setStatus)
      .catch(() => undefined)
      .finally(() => setLoading(false));
  }, []);

  const handleEnroll = async () => {
    setLoading(true);
    setError(null);
    try {
      setEnrollData(await api.post<MfaEnrollResponse>("/auth/mfa/enroll"));
    } catch (e) {
      if (e instanceof ApiError) setError(e.message);
      else setError("Network error.");
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = async () => {
    if (code.length !== 6) return;
    setConfirming(true);
    setError(null);
    try {
      await api.post<Message>("/auth/mfa/confirm", { code });
      router.back();
    } catch (e) {
      if (e instanceof ApiError) setError(e.message);
      else setError("Invalid code. Try again.");
      setCode("");
    } finally {
      setConfirming(false);
    }
  };

  const handleCopy = async () => {
    if (!enrollData) return;
    await Clipboard.setStringAsync(enrollData.secret);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <Spinner />
      </View>
    );
  }

  if (status?.mfa_enabled) {
    return (
      <AuthScreen title="Two-factor auth" back>
        <SentConfirmation
          title="Already protected"
          message="Two-factor authentication is active on this account."
          action={
            <Button variant="secondary" onPress={() => router.back()}>
              Go back
            </Button>
          }
        />
      </AuthScreen>
    );
  }

  if (enrollData) {
    return (
      <AuthScreen
        title="Add to your app"
        subtitle="Paste this key into Google Authenticator, 1Password, or any TOTP app."
        back
        onBack={() => setEnrollData(null)}
        footer={
          <Button loading={confirming} disabled={code.length !== 6} onPress={handleConfirm}>
            Enable two-factor
          </Button>
        }
      >
        {error ? (
          <View className="mb-5">
            <Alert type="error" message={error} onDismiss={() => setError(null)} />
          </View>
        ) : null}

        {/* Tap-to-copy: this key is long and case-sensitive, and typing it by
            hand off a phone screen is the step people get wrong. */}
        <Pressable
          onPress={handleCopy}
          accessibilityRole="button"
          accessibilityLabel="Copy setup key"
          className="rounded-2xl bg-surface p-4 active:opacity-70"
        >
          <View className="flex-row items-center justify-between">
            <Text type="body-xs" weight="semibold" color="muted" className="uppercase">
              Setup key
            </Text>
            <View className="flex-row items-center gap-1.5">
              <Icon
                name={copied ? "checkmark" : "doc.on.doc"}
                android={copied ? "check" : "content_copy"}
                size={13}
                color={copied ? p.success : p.accent}
              />
              <Text
                type="body-xs"
                weight="semibold"
                style={{ color: copied ? p.success : p.accent }}
              >
                {copied ? "Copied" : "Copy"}
              </Text>
            </View>
          </View>
          <Text type="code" className="mt-2.5">
            {enrollData.secret}
          </Text>
        </Pressable>

        <View className="mt-6">
          <FieldGroup caption="Your app shows a new code every 30 seconds.">
            <Field
              label="6-digit code from your app"
              placeholder="000000"
              value={code}
              onChangeText={(t) => setCode(t.replace(/\D/g, "").slice(0, 6))}
              keyboardType="number-pad"
              maxLength={6}
              returnKeyType="go"
              onSubmitEditing={handleConfirm}
            />
          </FieldGroup>
        </View>
      </AuthScreen>
    );
  }

  return (
    <AuthScreen
      title="Two-factor auth"
      subtitle="A second step at sign-in, so a stolen password isn't enough on its own."
      back
      footer={
        <View className="gap-3">
          <Button onPress={handleEnroll}>Set up two-factor</Button>
          <Pressable
            onPress={() => router.back()}
            hitSlop={8}
            className="items-center py-1 active:opacity-60"
          >
            <Text type="body-sm" color="muted">
              Maybe later
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

      <View className="overflow-hidden rounded-2xl bg-surface">
        <Benefit
          icon="lock.shield.fill"
          android="shield"
          title="Protects the money"
          detail="Payroll, refunds, and member records stay locked to you."
        />
        <View className="ml-4 h-px bg-border" />
        <Benefit
          icon="iphone"
          android="smartphone"
          title="Works offline"
          detail="Codes come from your phone's app — no signal required."
        />
        <View className="ml-4 h-px bg-border" />
        <Benefit
          icon="clock.fill"
          android="schedule"
          title="Takes a minute"
          detail="Scan once, and you're set on every device."
        />
      </View>
    </AuthScreen>
  );
}
