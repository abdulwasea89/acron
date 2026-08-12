import React from "react";
import { useColorScheme } from "react-native";
import { Button as HButton, Spinner } from "heroui-native";

type ButtonVariant = "primary" | "secondary" | "danger" | "ghost";

type HButtonProps = React.ComponentProps<typeof HButton>;

/*
  HeroUI's Button is a discriminated union on `feedbackVariant`. We always
  render the default `scale-highlight` branch, so narrow the props to exactly
  that branch to keep the spread type-safe.
*/
type ScaleHighlightButtonProps = Extract<HButtonProps, {
  feedbackVariant?: "scale-highlight";
}>;

interface ButtonProps
  extends Omit<ScaleHighlightButtonProps, "variant" | "children"> {
  variant?: ButtonVariant;
  loading?: boolean;
  disabled?: boolean;
  children?: React.ReactNode;
}

/*
  The primary action is the violet HeroUI default — `variant="primary"` needs
  no per-theme branching.

  Our `secondary` has always been a bordered transparent button, which is
  HeroUI's `outline` rather than its `secondary` (a filled surface).
*/
const variantMap: Record<ButtonVariant, NonNullable<HButtonProps["variant"]>> = {
  primary: "primary",
  secondary: "outline",
  danger: "danger",
  ghost: "ghost",
};

export function Button({
  variant = "primary",
  loading = false,
  disabled = false,
  children,
  ...props
}: ButtonProps) {
  const scheme = useColorScheme();
  const isDark = scheme === "dark";

  /* Spinner tint per variant — filled buttons need the inverted (light) tint.
     Uses concrete hex values: CSS token names like "accent-foreground" are not
     valid SVG stopColors and break the HeroUI color parser. */
  const spinnerColorMap: Record<ButtonVariant, string> = {
    primary: "#ffffff",
    secondary: isDark ? "#ffffff" : "#111111",
    danger: "#ffffff",
    ghost: isDark ? "#ffffff" : "#111111",
  };
  return (
    <HButton
      variant={variantMap[variant]}
      feedbackVariant="scale-highlight"
      isDisabled={disabled || loading}
      {...props}
    >
      {loading ? (
        <Spinner color={spinnerColorMap[variant]} />
      ) : typeof children === "string" ? (
        <HButton.Label>{children}</HButton.Label>
      ) : (
        children
      )}
    </HButton>
  );
}
