import React from "react";
import { Alert as HAlert, CloseButton } from "heroui-native";

type AlertType = "success" | "error" | "info" | "warning";

interface AlertProps {
  type?: AlertType;
  message: string;
  onDismiss?: () => void;
}

/** Our `error` is HeroUI's `danger`; `info` maps to its neutral `default`. */
const statusMap: Record<AlertType, "success" | "warning" | "danger" | "default"> = {
  success: "success",
  error: "danger",
  info: "default",
  warning: "warning",
};

/** Inline, optionally dismissible notice with a muted semantic tint. */
export function Alert({ type = "info", message, onDismiss }: AlertProps) {
  return (
    <HAlert status={statusMap[type]}>
      <HAlert.Indicator />
      <HAlert.Content>
        <HAlert.Description>{message}</HAlert.Description>
      </HAlert.Content>
      {onDismiss && <CloseButton onPress={onDismiss} />}
    </HAlert>
  );
}
