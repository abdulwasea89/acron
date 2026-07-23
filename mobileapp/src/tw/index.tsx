import { useCssElement, useNativeVariable as useFunctionalVariable } from "react-native-css";
import { Link as RouterLink } from "expo-router";
import Animated from "react-native-reanimated";
import React from "react";
import {
  View as RNView,
  Text as RNText,
  Pressable as RNPressable,
  ScrollView as RNScrollView,
  TouchableHighlight as RNTouchableHighlight,
  TextInput as RNTextInput,
  StyleSheet,
} from "react-native";

export const Link = (props: React.ComponentProps<typeof RouterLink> & { className?: string }) =>
  useCssElement(RouterLink, props, { className: "style" });

export const useCSSVariable = process.env.EXPO_OS !== "web"
  ? useFunctionalVariable
  : (variable: string) => `var(${variable})`;

export type ViewProps = React.ComponentProps<typeof RNView> & { className?: string };
export const View = (props: ViewProps) => useCssElement(RNView, props, { className: "style" });

export type TextProps = React.ComponentProps<typeof RNText> & { className?: string };
export const Text = (props: TextProps) => useCssElement(RNText, props, { className: "style" });

export type ScrollViewProps = React.ComponentProps<typeof RNScrollView> & {
  className?: string;
  contentContainerClassName?: string;
};
export const ScrollView = (props: ScrollViewProps) =>
  useCssElement(RNScrollView, props, {
    className: "style",
    contentContainerClassName: "contentContainerStyle",
  });

export type PressableProps = React.ComponentProps<typeof RNPressable> & { className?: string };
export const Pressable = (props: PressableProps) =>
  useCssElement(RNPressable, props, { className: "style" });

export type TextInputProps = React.ComponentProps<typeof RNTextInput> & { className?: string };
export const TextInput = (props: TextInputProps) =>
  useCssElement(RNTextInput, props, { className: "style" });

function XXTouchableHighlight(props: React.ComponentProps<typeof RNTouchableHighlight>) {
  const { underlayColor, ...style } = StyleSheet.flatten(props.style) || {};
  return <RNTouchableHighlight underlayColor={underlayColor} {...props} style={style} />;
}

export const TouchableHighlight = (props: React.ComponentProps<typeof RNTouchableHighlight> & { className?: string }) =>
  useCssElement(XXTouchableHighlight, props, { className: "style" });

export const AnimatedScrollView = (props: React.ComponentProps<typeof Animated.ScrollView> & {
  className?: string;
  contentContainerClassName?: string;
}) =>
  useCssElement(Animated.ScrollView, props, {
    className: "style",
    contentContainerClassName: "contentContainerStyle",
  });
