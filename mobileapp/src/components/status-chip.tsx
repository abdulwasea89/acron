import React from "react";
import { Chip } from "heroui-native";
import { Badge } from "@/components/ui/badge";

type Tone = "success" | "warning" | "danger" | "info" | "neutral";

/** Humanize snake_case statuses into display labels. */
export function humanize(value: string): string {
  return value
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

const MEMBER_STATUS_TONE: Record<string, Tone> = {
  active: "success",
  grace: "warning",
  expired: "danger",
  frozen: "warning",
  cancelled: "neutral",
  banned: "danger",
  pending_payment: "warning",
  pending_approval: "info",
  prospect: "neutral",
};

const RECEIPT_STATUS_TONE: Record<string, Tone> = {
  auto_approved: "success",
  approved: "success",
  pending_review: "warning",
  uploaded: "info",
  processing: "info",
  rejected: "danger",
  reversed: "neutral",
};

export function memberStatusTone(status?: string | null): Tone {
  return MEMBER_STATUS_TONE[status ?? ""] ?? "neutral";
}

export function receiptStatusTone(status?: string | null): Tone {
  return RECEIPT_STATUS_TONE[status ?? ""] ?? "neutral";
}

interface StatusChipProps {
  status: string | null | undefined;
  tone?: Tone;
}

/** Small status pill driven by a raw backend status string. */
export function StatusChip({ status, tone }: StatusChipProps) {
  if (!status) return null;
  return <Badge tone={tone ?? "neutral"} label={humanize(status)} />;
}
