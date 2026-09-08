import React from "react";
import { Pressable, View, useColorScheme } from "react-native";
import { Text } from "heroui-native";
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";

import { Icon } from "@/components/icon";
import { getPalette, spring } from "@/lib/theme";
import { INDUSTRY_LIST, type IndustryKey } from "@/lib/industries";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

interface IndustryPickerProps {
  value: IndustryKey;
  onChange: (key: IndustryKey) => void;
}

/**
 * "What kind of venue is this?" — the registration step that picks the venue
 * vertical (gym | office | academy). Selection is carried by the card itself
 * (border, tint, filled tick) so the whole card is the target, matching the
 * tier `ChoiceCard`s. gym is the default, so the reference gym flow never has
 * to make a choice.
 */
export function IndustryPicker({ value, onChange }: IndustryPickerProps) {
  const isDark = useColorScheme() === "dark";
  const p = getPalette(isDark);
  const reducedMotion = useReducedMotion();

  return (
    <View className="gap-3">
      {INDUSTRY_LIST.map((meta) => (
        <IndustryCard
          key={meta.key}
          label={meta.label}
          tagline={meta.tagline}
          selected={value === meta.key}
          onPress={() => onChange(meta.key)}
          reducedMotion={reducedMotion}
          palette={p}
        />
      ))}
    </View>
  );
}

function IndustryCard({
  label,
  tagline,
  selected,
  onPress,
  reducedMotion,
  palette: p,
}: {
  label: string;
  tagline: string;
  selected: boolean;
  onPress: () => void;
  reducedMotion: boolean;
  palette: ReturnType<typeof getPalette>;
}) {
  const pressed = useSharedValue(0);
  const selection = useSharedValue(selected ? 1 : 0);

  React.useEffect(() => {
    selection.value = reducedMotion
      ? withTiming(selected ? 1 : 0, { duration: 140 })
      : withSpring(selected ? 1 : 0, spring.standard);
  }, [selected, reducedMotion, selection]);

  const cardStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 - 0.02 * pressed.value }],
    borderColor: selection.value > 0.5 ? p.accent : p.border,
    borderWidth: 1 + selection.value,
  }));

  const tickStyle = useAnimatedStyle(() => ({
    opacity: selection.value,
    transform: [{ scale: 0.6 + 0.4 * selection.value }],
  }));

  return (
    <AnimatedPressable
      onPress={onPress}
      onPressIn={() => {
        pressed.value = withSpring(1, spring.press);
      }}
      onPressOut={() => {
        pressed.value = withSpring(0, spring.press);
      }}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={label}
      style={[
        {
          borderRadius: 18,
          borderCurve: "continuous",
          paddingVertical: 14,
          paddingHorizontal: 16,
          backgroundColor: selected ? `${p.accent}12` : p.surface,
        },
        cardStyle,
      ]}
    >
      <View className="flex-row items-center gap-3">
        <View className="flex-1">
          <Text type="body" weight="semibold" className="text-foreground">
            {label}
          </Text>
          <Text type="body-xs" color="muted" className="mt-0.5">
            {tagline}
          </Text>
        </View>

        <View
          className="h-6 w-6 items-center justify-center rounded-full"
          style={{
            backgroundColor: selected ? p.accent : "transparent",
            borderWidth: selected ? 0 : 1.5,
            borderColor: p.separator,
          }}
        >
          <Animated.View style={tickStyle}>
            <Icon name="checkmark" android="check" size={13} weight="bold" color="#ffffff" />
          </Animated.View>
        </View>
      </View>
    </AnimatedPressable>
  );
}
