import React, { useState } from "react";
import { View } from "react-native";
import { Text } from "heroui-native";
import { router } from "expo-router";
import Animated, { ZoomIn, useReducedMotion } from "react-native-reanimated";

import { AppScreen } from "@/components/app-screen";
import { ProfileHero } from "@/components/profile-hero";
import { DashboardSkeleton } from "@/components/dashboard-skeleton";
import { DashboardError } from "@/components/dashboard-states";
import { SectionCard } from "@/components/section-card";
import { ListRow } from "@/components/list-row";
import { Badge } from "@/components/ui/badge";
import { StatusChip, humanize } from "@/components/status-chip";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Stagger } from "@/components/motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert } from "@/components/ui/alert";
import { Icon } from "@/components/icon";
import { useGet } from "@/hooks/use-api";
import { api, ApiError } from "@/lib/api";
import { useAuthStore } from "@/stores/auth-store";
import { useOrgStore } from "@/stores/org-store";
import { nameSchema, phoneSchema } from "@/lib/validations";
import type { MeResponse, MfaStatus, OrganizationOut, ProfileOut, ProfileUpdateRequest } from "@/types/api";

/**
 * Shared in-app profile screen for all three roles. Identity hero, grouped
 * editable contact sections, your gym + security rows, and sign out (the one
 * place the app lets you leave — admin by default for owners).
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
  const mfa = useGet<MfaStatus>("/auth/mfa");

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

  const pristine =
    profile.data != null &&
    fullName === (profile.data.full_name ?? "") &&
    phone === (profile.data.phone ?? "") &&
    city === (profile.data.city ?? "") &&
    occupation === (profile.data.occupation ?? "") &&
    education === (profile.data.education ?? "") &&
    emergency === (profile.data.emergency_contact ?? "");

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
  const reduceMotion = useReducedMotion();

  const sections = profile.data && (
    <>
      <ProfileHero
        name={fullName || user?.full_name}
        email={profile.data.email}
        role={user?.role}
        memberStatus={me.data?.member_status}
        photoUrl={profile.data.photo_url}
      />

      <SectionCard title="Personal details">
        <View className="gap-3 rounded-2xl bg-surface p-4">
          <Input
            label="Full name"
            value={fullName}
            onChangeText={(t) => {
              setFullName(t);
              setFieldErrors((p) => ({ ...p, full_name: "" }));
            }}
            error={fieldErrors.full_name}
          />
          <View className="flex-row gap-3">
            <View className="flex-1">
              <Input
                label="Phone"
                value={phone}
                onChangeText={(t) => {
                  setPhone(t);
                  setFieldErrors((p) => ({ ...p, phone: "" }));
                }}
                keyboardType="phone-pad"
                error={fieldErrors.phone}
              />
            </View>
            <View className="flex-1">
              <Input label="City" value={city} onChangeText={setCity} />
            </View>
          </View>
        </View>
      </SectionCard>

      <SectionCard title="Work">
        <View className="gap-3 rounded-2xl bg-surface p-4">
          <Input label="Occupation" value={occupation} onChangeText={setOccupation} />
          <Input label="Education" value={education} onChangeText={setEducation} />
        </View>
      </SectionCard>

      <SectionCard title="Emergency contact">
        <View className="rounded-2xl bg-surface p-4">
          <Input label="Emergency contact" value={emergency} onChangeText={setEmergency} />
        </View>
      </SectionCard>

      {error && (
        <View className="mb-4">
          <Alert type="error" message={error} onDismiss={() => setError(null)} />
        </View>
      )}

      <Button onPress={handleSave} loading={saving} disabled={saving || pristine} className="w-full">
        {saved ? (
          <Animated.View
            entering={ZoomIn.springify().damping(14).stiffness(200)}
            className="flex-row items-center gap-1.5"
          >
            <Icon name="checkmark.circle.fill" android="check_circle" size={17} color="#ffffff" />
            <Text className="text-white" style={{ fontWeight: "600" }}>
              Saved
            </Text>
          </Animated.View>
        ) : (
          "Save changes"
        )}
      </Button>

      {org.data && (
        <SectionCard title="Your gym">
          <View className="overflow-hidden rounded-2xl bg-surface">
            <ListRow
              title={org.data.name}
              icon="building.2"
              android="storefront"
              trailing={<StatusChip status={org.data.saas_status} />}
              divider
            />
            <ListRow title="Org code" subtitle={org.data.org_code} icon="number" android="lock" divider />
            <ListRow
              title="Enrollment"
              subtitle={humanize(org.data.enrollment_mode ?? "open")}
              icon="person.3"
              android="group"
              divider
            />
            <ListRow
              title="Stripe"
              subtitle={humanize(org.data.stripe_connect_status ?? "disconnected")}
              icon="creditcard"
              android="credit_card"
              divider={false}
            />
          </View>
        </SectionCard>
      )}

      <SectionCard title="Security">
        <View className="overflow-hidden rounded-2xl bg-surface">
          <ListRow
            title="Password"
            subtitle="Reset via email"
            icon="lock"
            android="lock"
            chevron
            onPress={() => router.navigate("/forgot-password")}
            divider
          />
          <ListRow
            title="Multi-factor authentication"
            subtitle="Protect your account with an authenticator app"
            icon="shield"
            android="shield"
            chevron
            onPress={() => router.navigate("/mfa-enroll")}
            divider={false}
            trailing={
              mfa.data ? (
                <Badge tone={mfa.data.mfa_enabled ? "success" : "neutral"} label={mfa.data.mfa_enabled ? "On" : "Off"} />
              ) : undefined
            }
          />
        </View>
      </SectionCard>

      <SectionCard title="Session">
        <View className="overflow-hidden rounded-2xl bg-surface">
          <ListRow
            title="Sign out"
            icon="rectangle.portrait.and.arrow.right"
            android="logout"
            destructive
            onPress={openSignOut}
            divider={false}
          />
        </View>
      </SectionCard>
    </>
  );

  return (
    <AppScreen title="Profile">
      {loading && !profile.data && <DashboardSkeleton />}

      {loadFailed && (
        <DashboardError
          message={profile.error ?? me.error ?? "Unable to load profile."}
          onRetry={() => {
            profile.refetch();
            me.refetch();
            org.refetch();
          }}
        />
      )}

      {!loadFailed && profile.data && (
        <>
          {reduceMotion ? sections : <Stagger gap={64}>{sections}</Stagger>}

          <ConfirmDialog
            open={signOutOpen}
            title="Sign out"
            description={`You'll need to sign back in to use ${activeOrg?.name ?? "this gym"}.`}
            confirmLabel="Sign out"
            destructive
            onConfirm={handleSignOut}
            onOpenChange={setSignOutOpen}
          />
        </>
      )}
    </AppScreen>
  );
}