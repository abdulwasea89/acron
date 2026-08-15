import React, { forwardRef } from "react";
import { StyleSheet, Text, TextInput, View, useColorScheme } from "react-native";
import type { TextInputProps } from "react-native";

import { getPalette } from "@/lib/theme";

export interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
  hint?: string;
}

/*
  Filled, low-contrast input matching the web portal: a soft gray fill with a
  hairline border.

  Every color is sourced from `getPalette()` as explicit hex rather than
  Uniwind CSS-variable utilities. CSS variables (Uniwind `field`, `foreground`,
  `border` tokens) do not resolve inside bottom-sheet portals, so class-based
  styling renders black there; hex values render correctly everywhere.

  `error` doubles as the invalid flag: passing a message turns the field red
  and renders it, which is how every calling screen already uses this.
*/
export const Input = forwardRef<TextInput, InputProps>(
  ({ label, error, hint, style, placeholderTextColor, ...props }, ref) => {
    const isDark = useColorScheme() === "dark";
    const palette = getPalette(isDark);
    const isInvalid = Boolean(error);

    return (
      <View style={styles.wrap}>
        {label ? (
          <Text style={[styles.label, { color: palette.foreground }]}>{label}</Text>
        ) : null}
        <View
          style={[
            styles.box,
            {
              backgroundColor: isDark ? "#1b1d21" : "#f6f7f9",
              borderColor: isInvalid ? palette.danger : palette.border,
            },
          ]}
        >
          <TextInput
            ref={ref}
            placeholderTextColor={placeholderTextColor ?? palette.muted}
            selectionColor={palette.accent}
            style={[styles.input, { color: palette.foreground }, style]}
            {...props}
          />
        </View>
        {error ? (
          <Text style={[styles.feedback, { color: palette.danger }]}>{error}</Text>
        ) : hint ? (
          <Text style={[styles.feedback, { color: palette.muted }]}>{hint}</Text>
        ) : null}
      </View>
    );
  },
);

Input.displayName = "Input";

const styles = StyleSheet.create({
  wrap: { gap: 6 },
  label: { fontSize: 14, fontWeight: "600" },
  box: {
    borderWidth: 1,
    borderRadius: 12,
  },
  input: {
    fontSize: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  feedback: { fontSize: 13, marginTop: 2 },
});
