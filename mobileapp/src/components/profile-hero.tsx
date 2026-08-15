import React from "react";
import { StyleSheet, View, useColorScheme } from "react-native";
import { Text } from "heroui-native";
import { Image } from "expo-image";
import { BlurView } from "expo-blur";
import { GlassView, isLiquidGlassAvailable } from "expo-glass-effect";

import { Badge } from "@/components/ui/badge";
import { StatusChip, memberStatusTone, humanize } from "@/components/status-chip";
import { ANDROID_BLUR } from "@/components/blur-target";
import { useReduceTransparency } from "@/lib/accessibility";
import { getPalette } from "@/lib/theme";

interface ProfileHeroProps {
  name?: string | null;
  email?: string | null;
  role?: string | null;
  memberStatus?: string | null;
  photoUrl?: string | null;
}

/**
 * Identity hero — a frosted panel that floats over the screen background, the
 * same material recipe the tab bar uses (Liquid Glass when available, else a
 * veil-tinted BlurView, else a solid fill when Reduce Transparency is on or
 * on Android where blur is unreliable).
 *
 * Two soft accent glows sit *behind* the material so the glass has something
 * to refract; the avatar becomes the focal point and the name reads in the
 * Georgia serif display face, mirroring the web portal's headings.
 */
export function ProfileHero({ name, email, role, memberStatus, photoUrl }: ProfileHeroProps) {
  const isDark = useColorScheme() === "dark";
  const p = getPalette(isDark);
  const reduceTransparency = useReduceTransparency();

  const initials =
    (name ?? "")
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((w) => w.charAt(0).toUpperCase())
      .join("") || (email ?? "?").charAt(0).toUpperCase();

  const frosted = !reduceTransparency && !ANDROID_BLUR;
  const veil = isDark ? "rgba(30,30,34,0.55)" : "rgba(255,255,255,0.55)";
  const solid = isDark ? "rgba(32,32,36,0.98)" : "rgba(252,252,252,0.98)";
  const rim = isDark ? "rgba(255,255,255,0.14)" : "rgba(255,255,255,0.65)";

  return (
    <View className="mb-4 overflow-hidden rounded-3xl" style={[styles.shadow, { shadowOpacity: isDark ? 0.45 : 0.16 }]}>
      {/* Accent glows behind the material — the blur samples these. */}
      {frosted && (
        <View pointerEvents="none" className="absolute" style={styles.glowTop}>
          <View style={[styles.glow, { backgroundColor: `${p.accent}${isDark ? "33" : "24"}` }]} />
        </View>
      )}
      {frosted && (
        <View pointerEvents="none" className="absolute" style={styles.glowSide}>
          <View style={[styles.glow, { backgroundColor: `${p.accent}${isDark ? "1f" : "12"}` }]} />
        </View>
      )}

      {/* Frosted material. */}
      {reduceTransparency || ANDROID_BLUR ? (
        <View style={[StyleSheet.absoluteFill, { backgroundColor: ANDROID_BLUR ? veil : solid }]} />
      ) : isLiquidGlassAvailable() ? (
        <GlassView style={StyleSheet.absoluteFill} glassEffectStyle="regular" />
      ) : (
        <>
          <BlurView
            style={StyleSheet.absoluteFill}
            tint={isDark ? "systemChromeMaterialDark" : "systemChromeMaterialLight"}
            intensity={70}
          />
          <View style={[StyleSheet.absoluteFill, { backgroundColor: veil }]} />
        </>
      )}

      {/* Content */}
      <View className="p-5">
        <View className="flex-row items-center gap-4">
          <View className="h-20 w-20 shrink-0 overflow-hidden rounded-2xl" style={{ backgroundColor: p.accent }}>
            {photoUrl ? (
              <Image
                source={{ uri: photoUrl }}
                style={StyleSheet.absoluteFill}
                contentFit="cover"
                transition={200}
                accessibilityLabel={name ?? "Profile photo"}
              />
            ) : (
              <View className="h-full w-full items-center justify-center">
                <Text className="font-serif text-white" style={styles.initials}>
                  {initials}
                </Text>
              </View>
            )}
          </View>

          <View className="min-w-0 flex-1">
            <Text className="font-serif text-foreground" numberOfLines={1} style={styles.name}>
              {name || email || "Member"}
            </Text>
            {email ? (
              <Text className="text-muted" numberOfLines={1} style={styles.email}>
                {email}
              </Text>
            ) : null}
            {role || memberStatus ? (
              <View className="mt-2.5 flex-row flex-wrap items-center gap-1.5">
                {role ? <Badge tone="neutral" label={humanize(role)} /> : null}
                {memberStatus ? <StatusChip status={memberStatus} tone={memberStatusTone(memberStatus)} /> : null}
              </View>
            ) : null}
          </View>
        </View>
      </View>

      {/* Bright rim — light catching the edge of the material. */}
      <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.rim, { borderColor: rim }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  shadow: {
    shadowColor: "#000",
    shadowOpacity: 0.16,
    shadowRadius: 28,
    shadowOffset: { width: 0, height: 12 },
    elevation: 14,
  },
  glow: { width: 180, height: 180, borderRadius: 90 },
  glowTop: { top: -36, left: -20 },
  glowSide: { top: -64, right: -44 },
  name: { fontSize: 30, lineHeight: 36, letterSpacing: -0.6, fontWeight: "600" },
  email: { fontSize: 14, marginTop: 2 },
  initials: { fontSize: 32, lineHeight: 36, letterSpacing: -0.5, fontWeight: "700" },
  rim: { borderRadius: 24, borderWidth: 1 },
});