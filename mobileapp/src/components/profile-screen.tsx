import React, { useState } from "react";
import { Pressable, View } from "react-native";
import { Text } from "heroui-native";
import { router } from "expo-router";

import { AppScreen } from "@/components/app-screen";
import { DashboardSkeleton } from "@/components/dashboard-skeleton";
import { DashboardError } from "@/components/dashboard-states";
import { SectionCard } from "@/components/section-card";
import { ListRow } from "@/components/list-row";
import { StatusChip, memberStatusTone, humanize } from "@/components/status-chip";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { PressableScale } from "@/components/motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert } from "@/components/ui/alert";
import { useGet } from "@/hooks/use-api";
import { api, ApiError } from "@/lib/api";
import { useAuthStore } from "@/stores/auth-store";
import { useOrgStore } from "@/stores/org-store";
import { firstName } from "@/lib/format";
import { nameSchema, phoneSchema } from "@/lib/validations";
import type { MeResponse, OrganizationOut, ProfileOut, ProfileUpdateRequest } from "@/types/api";

/**
 * Shared in-app profile screen for all three roles. Shows identity + org
 * context, an editable contact form (PATCH /auth/me/profile) and sign out
 * (the one place the app lets you leave — admin by default for owners).
 */
export function ProfileScreen() {
  const { user, clearSession } = useAuthStore();
  const { activeOrg } = useOrgStore();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [signOutOpen, setSignOutOpen] = useState(false);

  const realtime = ["membership.changed", "gym_status.changed"];

  const me = useGet<MeResponse>("/auth/me", realtime);
  const profile = useGet<ProfileOut>("/auth/me/profile", realtime);
  const org = useGet<OrganizationOut>("/organizations/me", realtime);

  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [city, setCity] = useState("");
  const [occupation, setOccupation] = useState("");
  const [education, setEducation] = useState("");
  const [emergency, setEmergency] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const [prevProfile, setPrevProfile] = useState<ProfileOut | null | undefined>(profile.data);
  if (profile.data !== prevProfile) {
    setPrevProfile(profile.data);
    setFullName(profile.data?.full_name ?? "");
    setPhone(profile.data?.phone ?? "");
    setCity(profile.data?.city ?? "");
    setOccupation(profile.data?.occupation ?? "");
    setEducation(profile.data?.education ?? "");
    setEmergency(profile.data?.emergency_contact ?? "");
  }

  const openSignOut = () => {
    setError(null);
    setSignOutOpen(true);
  };

  const handleSignOut = () => {
    clearSession();
    router.replace("/");
  };

  const handleSave = async () => {
    setError(null);
    setSaved(false);
    const errs: Record<string, string> = {};
    if (!fullName.trim()) errs.full_name = "Name is required.";
    else if (!nameSchema.safeParse(fullName.trim()).success) errs.full_name = "Enter a valid name.";
    if (phone.trim() && !phoneSchema.safeParse(phone.trim()).success) errs.phone = "Enter a valid phone number.";

    if (Object.keys(errs).length) {
      setFieldErrors(errs);
      return;
    }
    setFieldErrors({});

    const body: ProfileUpdateRequest = {
      full_name: fullName.trim(),
      phone: phone.trim() || null,
      city: city.trim() || null,
      occupation: occupation.trim() || null,
      education: education.trim() || null,
      emergency_contact: emergency.trim() || null,
    };

    setSaving(true);
    try {
      await api.patch<ProfileOut>("/auth/me/profile", body);
      setSaved(true);
      profile.refetch();
      setTimeout(() => setSaved(false), 2500);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not save your profile.");
    } finally {
      setSaving(false);
    }
  };

  const loading = profile.loading;
  const loadFailed = !loading && (profile.error || me.error || org.error);

  return (
    <AppScreen
      title="Profile"
      subtitle={user?.role ? humanize(user.role) : undefined}
    >
      {loading && !profile.data && <DashboardSkeleton />}

      {loadFailed && <DashboardError message={profile.error ?? me.error ?? "Unable to load profile."} onRetry={() => { profile.refetch(); me.refetch(); org.refetch(); }} />}

      {!loadFailed && profile.data && (
        <>
          {/* Identity header */}
          <PressableScale style={{ borderRadius: 20 }}>
            <View className="mb-4 flex-row items-center gap-4 rounded-2xl bg-surface p-5 shadow-surface">
              <View className="h-14 w-14 items-center justify-center rounded-full bg-accent">
                <Text className="text-[22px] font-bold text-accent-foreground">
                  {firstName(fullName || user?.full_name || "?", "")?.charAt(0).toUpperCase() || "G"}
                </Text>
              </View>
              <View className="flex-1">
                <Text className="text-[18px] font-bold text-foreground">{fullName || user?.email}</Text>
                <Text className="text-[13px] text-muted">{profile.data.email}</Text>
                {me.data?.member_status && (
                  <View className="mt-1.5">
                    <StatusChip status={me.data.member_status} tone={memberStatusTone(me.data.member_status)} />
                  </View>
                )}
              </View>
            </View>
          </PressableScale>

          {/* Contact details */}
          <SectionCard title="Contact details">
            <View className="gap-4">
              <Input label="Full name" value={fullName} onChangeText={(t) => { setFullName(t); setFieldErrors((p) => ({ ...p, full_name: "" })); }} error={fieldErrors.full_name} />
              <View className="flex-row gap-3">
                <View className="flex-1">
                  <Input label="Phone" value={phone} onChangeText={(t) => { setPhone(t); setFieldErrors((p) => ({ ...p, phone: "" })); }} keyboardType="phone-pad" error={fieldErrors.phone} />
                </View>
                <View className="flex-1">
                  <Input label="City" value={city} onChangeText={setCity} />
                </View>
              </View>
              <Input label="Occupation" value={occupation} onChangeText={setOccupation} />
              <Input label="Education" value={education} onChangeText={setEducation} />
              <Input label="Emergency contact" value={emergency} onChangeText={setEmergency} />
            </View>

            {error && (
              <View className="mt-4">
                <Alert type="error" message={error} onDismiss={() => setError(null)} />
              </View>
            )}
            {saved && (
              <View className="mt-4">
                <Alert type="success" message="Profile saved." onDismiss={() => setSaved(false)} />
              </View>
            )}

            <Pressable
              onPress={handleSave}
              disabled={saving}
              className="mt-5 active:opacity-70"
              android_ripple={{ color: "rgba(128,128,128,0.15)" }}
            >
              <Button loading={saving}>Save changes</Button>
            </Pressable>
          </SectionCard>

          {/* Organization */}
          {org.data && (
            <SectionCard title="Your gym">
              <View className="rounded-2xl bg-surface p-5 shadow-surface">
                <View className="flex-row items-center justify-between">
                  <Text className="text-[16px] font-bold text-foreground">{org.data.name}</Text>
                  <StatusChip status={org.data.saas_status ?? undefined} />
                </View>
                {org.data.org_code && (
                  <Text className="mt-1 font-mono text-[13px] text-muted">{org.data.org_code}</Text>
                )}
                <View className="mt-3 flex-row gap-2">
                  <Text className="text-[12px] text-muted">
                    {humanize(org.data.enrollment_mode ?? "open")} enrollment
                  </Text>
                  <Text className="text-[12px] text-muted">·</Text>
                  <Text className="text-[12px] text-muted">
                    Stripe {humanize(org.data.stripe_connect_status ?? "disconnected")}
                  </Text>
                </View>
                <View className="mt-2 flex-row gap-2">
                  <Text className="text-[12px] text-muted">{org.data.saas_tier} plan</Text>
                  <Text className="text-[12px] text-muted">·</Text>
                  <Text className="text-[12px] text-muted">
                    {humanize(org.data.gym_status ?? "open")}
                  </Text>
                </View>
              </View>
            </SectionCard>
          )}

          {/* Session */}
          <SectionCard title="Session">
            <View className="overflow-hidden rounded-2xl bg-surface shadow-surface">
              <ListRow title="Sign out" icon="rectangle.portrait.and.arrow.right" android="logout" destructive onPress={openSignOut} divider={false} />
            </View>
          </SectionCard>
        </>
      )}

      <ConfirmDialog
        open={signOutOpen}
        title="Sign out"
        description={`You'll need to sign back in to use ${activeOrg?.name ?? "this gym"}.`}
        confirmLabel="Sign out"
        destructive
        onConfirm={handleSignOut}
        onOpenChange={setSignOutOpen}
      />
    </AppScreen>
  );
}