import React, { useState } from "react";
import { View } from "react-native";
import { Text } from "heroui-native";
import * as WebBrowser from "expo-web-browser";

import { AppScreen } from "@/components/app-screen";
import { DashboardSkeleton } from "@/components/dashboard-skeleton";
import { DashboardError } from "@/components/dashboard-states";
import { SectionCard } from "@/components/section-card";
import { StatusChip } from "@/components/status-chip";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/icon";
import { useGet } from "@/hooks/use-api";
import { api, ApiError } from "@/lib/api";
import type { OrganizationOut } from "@/types/api";

const CONNECT_TONE: Record<string, "success" | "warning" | "danger" | "info" | "neutral"> = {
  none: "neutral",
  pending: "warning",
  active: "success",
  restricted: "danger",
};

export default function StripeSetup() {
  const org = useGet<OrganizationOut>("/organizations/me", ["gym_status.changed"]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const status = org.data?.stripe_connect_status ?? "none";
  const connected = status === "active";

  const connect = async () => {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const res = await api.post<{ onboarding_url: string }>("/organizations/me/connect");
      await WebBrowser.openBrowserAsync(res.onboarding_url);
      setNotice("Stripe onboarding opened in your browser. Come back when you're done.");
      org.refetch();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not start Stripe onboarding.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <AppScreen title="Stripe payments" subtitle="Get paid by members" showBackButton>
      {org.loading && !org.data ? (
        <DashboardSkeleton />
      ) : org.error ? (
        <DashboardError message={org.error} onRetry={() => org.refetch()} />
      ) : (
        <>
          <SectionCard title="Connection status">
            <View className="flex-row items-center justify-between rounded-2xl border border-border bg-surface px-4 py-4">
              <View className="flex-row items-center gap-3">
                <View className="h-10 w-10 items-center justify-center rounded-xl bg-surface-tertiary">
                  <Icon name="creditcard" android="credit_card" size={20} color={connected ? "#16a34a" : "#94a3b8"} />
                </View>
                <View>
                  <Text type="body" weight="semibold" className="text-foreground">
                    Stripe Connect
                  </Text>
                  <Text type="body-sm" color="muted">
                    {connected ? "Ready to accept member payments" : "Not connected yet"}
                  </Text>
                </View>
              </View>
              <StatusChip status={status} tone={CONNECT_TONE[status] ?? "neutral"} />
            </View>
          </SectionCard>

          <SectionCard title="How it works">
            <View className="gap-3">
              <Step index={1} text="Open the Stripe onboarding flow in your browser." />
              <Step index={2} text="Enter your business details, bank account and identity verification." />
              <Step index={3} text="Member payments land directly in your bank account — the platform never touches them." />
              <Step index={4} text="You're only billed for the platform subscription." />
            </View>
          </SectionCard>

          {error ? (
            <View className="mb-4">
              <Alert type="error" message={error} onDismiss={() => setError(null)} />
            </View>
          ) : null}
          {notice ? (
            <View className="mb-4">
              <Alert type="success" message={notice} onDismiss={() => setNotice(null)} />
            </View>
          ) : null}

          <View className="mb-6">
            <Button loading={busy} onPress={connect} className="w-full">
              {connected ? "Manage Stripe account" : "Set up Stripe"}
            </Button>
          </View>
        </>
      )}
    </AppScreen>
  );
}

function Step({ index, text }: { index: number; text: string }) {
  return (
    <View className="flex-row items-start gap-3">
      <View className="h-6 w-6 items-center justify-center rounded-full bg-surface-tertiary">
        <Text type="body-xs" weight="semibold" className="text-foreground">
          {index}
        </Text>
      </View>
      <Text type="body-sm" color="muted" className="flex-1 leading-5">
        {text}
      </Text>
    </View>
  );
}
