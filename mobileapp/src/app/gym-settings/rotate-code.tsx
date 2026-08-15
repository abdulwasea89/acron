import React, { useState } from "react";
import { View, useColorScheme } from "react-native";
import { Text } from "heroui-native";
import * as Clipboard from "expo-clipboard";

import { AppScreen } from "@/components/app-screen";
import { DashboardSkeleton } from "@/components/dashboard-skeleton";
import { DashboardError } from "@/components/dashboard-states";
import { SectionCard } from "@/components/section-card";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/icon";
import { useGet } from "@/hooks/use-api";
import { api, ApiError } from "@/lib/api";
import { getPalette } from "@/lib/theme";
import type { OrganizationOut } from "@/types/api";

export default function RotateCode() {
  const org = useGet<OrganizationOut>("/organizations/me", ["gym_status.changed"]);
  const isDark = useColorScheme() === "dark";
  const p = getPalette(isDark);

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [newCode, setNewCode] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const current = org.data?.org_code;

  const rotate = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await api.post<{ org_code: string }>("/organizations/me/rotate-code");
      setNewCode(res.org_code);
      setCopied(false);
      org.refetch();
      setConfirmOpen(false);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not rotate the join code.");
      setConfirmOpen(false);
    } finally {
      setBusy(false);
    }
  };

  const copyNewCode = async () => {
    if (!newCode) return;
    await Clipboard.setStringAsync(newCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <AppScreen title="Rotate join code" subtitle="A fresh code for new members" showBackButton>
      {org.loading && !org.data ? (
        <DashboardSkeleton />
      ) : org.error ? (
        <DashboardError message={org.error} onRetry={() => org.refetch()} />
      ) : (
        <>
          <SectionCard title="Current code">
            <View
              className="flex-row items-center justify-between rounded-2xl border border-border bg-surface px-4 py-4"
            >
              <Text className="text-foreground" style={{ fontSize: 22, fontWeight: "700", letterSpacing: 1.2 }}>
                {current}
              </Text>
              <View className="h-8 items-center justify-center rounded-full px-3" style={{ backgroundColor: `${p.accent}1a` }}>
                <Text type="body-sm" weight="semibold" style={{ color: p.accent }}>
                  Active
                </Text>
              </View>
            </View>
          </SectionCard>

          <SectionCard title="What happens">
            <View className="gap-3">
              <Text type="body-sm" color="muted">
                A new join code replaces the current one. Old codes stop working immediately.
              </Text>
              <Text type="body-sm" color="muted">
                Member sessions are revoked, so existing members sign back in with the new code. Your access stays intact.
              </Text>
              <Text type="body-sm" color="muted">
                Any signup-abuse freeze on the gym is cleared automatically.
              </Text>
            </View>
          </SectionCard>

          {error ? (
            <View className="mb-4">
              <Alert type="error" message={error} onDismiss={() => setError(null)} />
            </View>
          ) : null}

          {newCode ? (
            <View className="mb-6">
              <SectionCard title="Your new code">
                <View className="items-center">
                  <Text
                    className="text-foreground"
                    style={{ fontSize: 28, fontWeight: "800", letterSpacing: 2 }}
                  >
                    {newCode}
                  </Text>
                  <Text type="body-sm" color="muted" className="mt-2 text-center">
                    Share this with new members. Existing members must sign in again.
                  </Text>
                </View>
              </SectionCard>

              <View className="mt-4">
                <Button variant="secondary" onPress={copyNewCode} className="w-full">
                  <View className="flex-row items-center justify-center gap-2">
                    <Icon
                      name="doc.on.doc"
                      android="content_copy"
                      size={17}
                      color={copied ? p.accent : (isDark ? "#ffffff" : "#111111")}
                    />
                    <Text
                      className={copied ? "" : "text-foreground"}
                      style={{ fontWeight: "600", color: copied ? p.accent : undefined }}
                    >
                      {copied ? "Copied" : "Copy new code"}
                    </Text>
                  </View>
                </Button>
              </View>
            </View>
          ) : (
            <View className="mb-6">
              <Button variant="danger" onPress={() => setConfirmOpen(true)} className="w-full">
                Rotate join code
              </Button>
            </View>
          )}
        </>
      )}

      <ConfirmDialog
        open={confirmOpen}
        title="Rotate join code?"
        description="The current code stops working and member sessions are revoked. This cannot be undone."
        confirmLabel="Rotate"
        cancelLabel="Cancel"
        destructive
        loading={busy}
        onConfirm={rotate}
        onOpenChange={setConfirmOpen}
      />
    </AppScreen>
  );
}
