import React from "react";
import { Pressable, View } from "react-native";
import { Text } from "heroui-native";
import { router } from "expo-router";

import { AppScreen } from "@/components/app-screen";
import { DashboardSkeleton } from "@/components/dashboard-skeleton";
import { DashboardError } from "@/components/dashboard-states";
import { SectionCard } from "@/components/section-card";
import { Icon } from "@/components/icon";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/empty-state";
import { Badge } from "@/components/ui/badge";
import { Stagger } from "@/components/motion";
import { useGet } from "@/hooks/use-api";
import { useOrgStore } from "@/stores/org-store";
import { formatDay, formatTime, firstName, greeting } from "@/lib/format";
import type {
  ClassSessionOut,
  MeResponse,
  OrganizationOut,
  ProfileOut,
} from "@/types/api";

type MemberStatus = string;

const STATUS_BANNER: Partial<
  Record<MemberStatus, { tone: "accent" | "success" | "warning" | "danger" | "neutral"; title: string; message: string }>
> = {
  active: { tone: "success", title: "Membership active", message: "You’re all set — see you at the gym." },
  grace: { tone: "warning", title: "Payment due", message: "Your membership is in its grace period. Renew now to keep your spot." },
  pending_payment: { tone: "accent", title: "Complete your payment", message: "Finish payment to activate your membership." },
  pending_approval: { tone: "neutral", title: "Membership under review", message: "The gym will notify you once it’s approved." },
  expired: { tone: "danger", title: "Membership expired", message: "Your access is paused. Renew to continue training." },
  frozen: { tone: "warning", title: "Membership frozen", message: "Your membership is temporarily frozen." },
  cancelled: { tone: "neutral", title: "Membership cancelled", message: "Your membership is no longer active." },
  banned: { tone: "danger", title: "Access blocked", message: "Please contact the gym for support." },
};

function upcoming(sessions: ClassSessionOut[]): ClassSessionOut[] {
  const now = Date.now();
  return sessions
    .filter((s) => !s.cancelled && new Date(s.starts_at).getTime() >= now)
    .sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime())
    .slice(0, 3);
}

export default function Screen_dashboard() {
  const activeOrg = useOrgStore((s) => s.activeOrg);

  const realtime = ["membership.changed", "payment.recorded", "plan.changed", "class.changed", "gym_status.changed"];

  const me = useGet<MeResponse>("/auth/me", realtime);
  const profile = useGet<ProfileOut>("/auth/me/profile", realtime);
  const org = useGet<OrganizationOut>("/organizations/me", realtime);
  const classes = useGet<ClassSessionOut[]>("/classes", ["class.changed"]);

  const loading = me.loading || profile.loading || org.loading || classes.loading;
  const error = me.error ?? profile.error ?? org.error ?? classes.error;

  const orgName = org.data?.name ?? activeOrg?.name ?? "";
  const status = me.data?.member_status ?? null;
  const banner = status ? STATUS_BANNER[status] : null;

  const sessions = upcoming(classes.data ?? []);
  const greetingName = firstName(profile.data?.full_name);

  const refresh = () => {
    me.refetch();
    profile.refetch();
    org.refetch();
    classes.refetch();
  };

  const goTo = (path: "/classes" | "/payments") => () => router.navigate(path);

  return (
    <AppScreen
      title={`${greeting()}, ${greetingName}`}
      subtitle={orgName || activeOrg?.org_code || "Your gym"}
    >
      {loading ? (
        <DashboardSkeleton />
      ) : error ? (
        <DashboardError message={error} onRetry={refresh} />
      ) : (
        <>
          <Stagger gap={80}>
            <View className="mb-6">
              <MembershipBanner status={status} banner={banner} />
            </View>

            <SectionCard title="Today’s schedule" action={<Pressable onPress={goTo("/classes")} hitSlop={8}><Text type="body-sm" className="text-accent">See all</Text></Pressable>}>
              {sessions.length === 0 ? (
                <EmptyState
                  title="No classes coming up"
                  message="Browse the schedule and book your next session."
                  action={<Button variant="secondary" onPress={goTo("/classes")}>Browse classes</Button>}
                />
              ) : (
                <View className="overflow-hidden rounded-2xl bg-surface">
                  {sessions.map((s, i) => (
                    <Pressable key={s.id} onPress={goTo("/classes")} className="active:opacity-70">
                      <View className="flex-row items-center py-3.5"
                        style={i > 0 ? { borderTopWidth: 0.5, borderTopColor: "rgba(128,128,128,0.25)" } : undefined}>
                        <View className="mr-3 h-10 w-10 items-center justify-center rounded-xl bg-surface-tertiary">
                          <Icon name="figure.strengthtraining.traditional" android="fitness_center" size={20} className="text-accent" />
                        </View>
                        <View className="flex-1">
                          <Text type="body" weight="medium" className="text-foreground">{s.title}</Text>
                          <Text type="body-sm" color="muted" className="mt-0.5">
                            {formatDay(s.starts_at)} · {formatTime(s.starts_at)} ·{" "}
                            {Math.max(s.capacity - s.booked_count, 0)} spots left
                          </Text>
                        </View>
                      </View>
                    </Pressable>
                  ))}
                </View>
              )}
            </SectionCard>

            <SectionCard title="Quick actions">
              <View className="gap-3">
                <Button variant="secondary" onPress={goTo("/classes")}>
                  Book a class
                </Button>
                <Button variant="secondary" onPress={goTo("/payments")}>
                  Payments & receipts
                </Button>
              </View>
            </SectionCard>
          </Stagger>
        </>
      )}
    </AppScreen>
  );
}

function MembershipBanner({
  status,
  banner,
}: {
  status: MemberStatus | null;
  banner: (typeof STATUS_BANNER)[MemberStatus] | undefined | null;
}) {
  if (!status) return null;

  const tone = banner?.tone ?? "neutral";
  const badgeTone: "success" | "warning" | "danger" | "info" | "neutral" =
    tone === "accent" ? "info" : tone;
  const tileClass = {
    accent: "bg-accent text-accent-foreground",
    success: "bg-success text-success-foreground",
    warning: "bg-warning text-warning-foreground",
    danger: "bg-danger text-danger-foreground",
    neutral: "bg-surface-tertiary text-foreground",
  }[tone];

  const needsAction = ["grace", "expired", "pending_payment"].includes(status);

  return (
    <View className="overflow-hidden rounded-3xl bg-surface">
      <View className="flex-row items-start gap-3 p-4">
        <View className={`h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${tileClass}`}>
          <Icon
            name={
              tone === "success"
                ? "checkmark.circle.fill"
                : tone === "warning"
                  ? "exclamationmark.triangle.fill"
                  : tone === "danger"
                    ? "exclamationmark.octagon.fill"
                    : "clock.fill"
            }
            android={tone === "success" ? "check_circle" : tone === "warning" ? "warning" : tone === "danger" ? "dangerous" : "schedule"}
            size={22}
            color="currentColor"
          />
        </View>
        <View className="flex-1 pt-0.5">
          <View className="flex-row items-center justify-between gap-2">
            <Text type="body" weight="semibold" className="text-foreground">
              {banner?.title ?? "Membership"}
            </Text>
            <Badge tone={badgeTone} label={status.replace(/_/g, " ")} />
          </View>
          <Text type="body-sm" color="muted" className="mt-1">
            {banner?.message}
          </Text>
          {needsAction ? (
            <View className="mt-3 flex-row gap-2">
              <Button size="sm" onPress={() => router.navigate("/payments")}>
                Pay now
              </Button>
              <Button size="sm" variant="secondary" onPress={() => router.navigate("/payments")}>
                Upload receipt
              </Button>
            </View>
          ) : null}
        </View>
      </View>
    </View>
  );
}