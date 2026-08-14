import React, { forwardRef } from "react";
import {
  Pressable,
  TextInput,
  View,
  useColorScheme,
  type TextInputProps,
} from "react-native";
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

/**
 * Grouped inset form fields, in the style of iOS Settings.
 *
 * The alternative — every input as its own floating rounded box — spends a lot
 * of vertical space to say nothing, and makes six unrelated fields look like
 * six unrelated screens. Grouping them into one card with hairline separators
 * says "these belong together", which is most of what a form layout has to
 * communicate.
 */

interface FieldGroupProps {
  /** Small heading above the card, for forms with more than one group. */
  title?: string;
  /** Muted explanatory line under the card (rules, formats, reassurance). */
  caption?: string;
  children: React.ReactNode;
}

export function FieldGroup({ title, caption, children }: FieldGroupProps) {
  const rows = React.Children.toArray(children).filter(Boolean);

  return (
    <View>
      {title ? (
        <Text
          type="body-xs"
          weight="semibold"
          color="muted"
          className="mb-2 ml-4 uppercase"
          style={{ letterSpacing: 0.5 }}
        >
          {title}
        </Text>
      ) : null}

      <View className="overflow-hidden rounded-2xl bg-surface">
        {rows.map((row, i) => (
          <View key={i}>
            {i > 0 ? <View className="ml-4 h-px bg-border" /> : null}
            {row}
          </View>
        ))}
      </View>

      {caption ? (
        <Text type="body-xs" color="muted" className="mt-2 ml-4">
          {caption}
        </Text>
      ) : null}
    </View>
  );
}

interface FieldProps extends Omit<TextInputProps, "style"> {
  label: string;
  error?: string;
  /** Toggles a show/hide control and starts the field masked. */
  secure?: boolean;
  /** Trailing content (a unit, a status tick, a picker chevron). */
  trailing?: React.ReactNode;
}

/**
 * One row of a `FieldGroup`: label above, input below, error in place of
 * nothing — the row grows to fit the message rather than shifting the fields
 * under it by a variable amount.
 */
export const Field = forwardRef<TextInput, FieldProps>(function Field(
  { label, error, secure = false, trailing, onFocus, onBlur, ...props },
  ref,
) {
  const isDark = useColorScheme() === "dark";
  const p = getPalette(isDark);
  const reducedMotion = useReducedMotion();

  const [masked, setMasked] = React.useState(secure);
  const focus = useSharedValue(0);

  const animate = (to: number) =>
    reducedMotion
      ? withTiming(to, { duration: 120 })
      : withSpring(to, spring.standard);

  /* The label brightens on focus. It's a small signal, but it's the one that
     tells you which row the keyboard is typing into when several are visible. */
  const labelStyle = useAnimatedStyle(() => ({
    color: error ? p.danger : focus.value > 0.5 ? p.accent : p.muted,
    opacity: 1,
  }));

  const railStyle = useAnimatedStyle(() => ({
    opacity: focus.value,
    transform: [{ scaleY: focus.value }],
  }));

  return (
    <View className="relative">
      {/* Accent rail on the leading edge, scaled in from nothing on focus —
          cheaper to read than recoloring the whole row's border. */}
      <Animated.View
        pointerEvents="none"
        style={[
          {
            position: "absolute",
            left: 0,
            top: 8,
            bottom: 8,
            width: 3,
            borderRadius: 3,
            backgroundColor: error ? p.danger : p.accent,
          },
          railStyle,
        ]}
      />

      <View className="flex-row items-center px-4 py-2.5">
        <View className="flex-1">
          <Animated.Text
            style={[{ fontSize: 12, fontWeight: "600", marginBottom: 1 }, labelStyle]}
          >
            {label}
          </Animated.Text>

          <TextInput
            ref={ref}
            placeholderTextColor={p.muted}
            selectionColor={p.accent}
            onFocus={(e) => {
              focus.value = animate(1);
              onFocus?.(e);
            }}
            onBlur={(e) => {
              focus.value = animate(0);
              onBlur?.(e);
            }}
            secureTextEntry={masked}
            style={{
              color: p.foreground,
              fontSize: 17,
              // A fixed height keeps every row the same regardless of platform
              // font metrics; without it iOS and Android rows differ by ~3px
              // and the separators stop looking evenly spaced.
              height: 26,
              padding: 0,
            }}
            {...props}
          />
        </View>

        {secure ? (
          <Pressable
            onPress={() => setMasked((v) => !v)}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel={masked ? "Show password" : "Hide password"}
            className="ml-3 active:opacity-50"
          >
            <Icon
              name={masked ? "eye" : "eye.slash"}
              android={masked ? "visibility" : "visibility_off"}
              size={19}
              color={p.muted}
            />
          </Pressable>
        ) : null}

        {trailing ? <View className="ml-3">{trailing}</View> : null}
      </View>

      {error ? (
        <View className="flex-row items-center gap-1.5 px-4 pb-2.5">
          <Icon name="exclamationmark.circle.fill" android="error" size={13} color={p.danger} />
          <Text type="body-xs" className="flex-1 text-danger">
            {error}
          </Text>
        </View>
      ) : null}
    </View>
  );
});

interface OptionRowProps {
  label: string;
  /** Current value shown on the trailing edge. */
  value?: string;
  selected?: boolean;
  onPress: () => void;
}

/** A `FieldGroup` row that opens a choice rather than accepting typing. */
export function OptionRow({ label, value, selected, onPress }: OptionRowProps) {
  const isDark = useColorScheme() === "dark";
  const p = getPalette(isDark);

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      className="flex-row items-center px-4 py-3.5 active:opacity-60"
    >
      <Text type="body" className="flex-1 text-foreground">
        {label}
      </Text>
      {value ? (
        <Text type="body" color="muted" className="mr-1.5">
          {value}
        </Text>
      ) : null}
      <Icon
        name={selected ? "checkmark" : "chevron.right"}
        android={selected ? "check" : "chevron_right"}
        size={selected ? 16 : 14}
        color={selected ? p.accent : p.muted}
      />
    </Pressable>
  );
}
