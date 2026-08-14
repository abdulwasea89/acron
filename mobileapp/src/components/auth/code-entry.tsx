import React from "react";
import { Pressable, View, useColorScheme } from "react-native";
import { Text } from "heroui-native";

import { OtpInput } from "@/components/ui/otp-input";
import { Icon } from "@/components/icon";
import { getPalette } from "@/lib/theme";

/** Seconds before "Resend code" becomes tappable again. */
const RESEND_COOLDOWN = 30;

interface CodeEntryProps {
  value: string;
  onChange: (value: string) => void;
  onComplete: (value: string) => void;
  /** Where the code went, echoed back so a typo'd address is obvious. */
  destination?: string;
  onResend?: () => void | Promise<void>;
  invalid?: boolean;
}

/**
 * Six-digit code entry with a mail glyph, the destination address, and a
 * rate-limited resend.
 *
 * The countdown is the point of the resend button. Without it people tap
 * repeatedly, trip the server's 3-per-hour cap, and end up locked out of the
 * flow they're trying to complete — so the button states its own cooldown
 * rather than silently failing.
 */
export function CodeEntry({
  value,
  onChange,
  onComplete,
  destination,
  onResend,
  invalid,
}: CodeEntryProps) {
  const isDark = useColorScheme() === "dark";
  const p = getPalette(isDark);
  const [remaining, setRemaining] = React.useState(RESEND_COOLDOWN);
  const [sending, setSending] = React.useState(false);

  React.useEffect(() => {
    if (remaining <= 0) return;
    const timer = setInterval(() => setRemaining((s) => (s <= 1 ? 0 : s - 1)), 1000);
    return () => clearInterval(timer);
  }, [remaining]);

  const handleResend = async () => {
    if (remaining > 0 || sending || !onResend) return;
    setSending(true);
    try {
      await onResend();
      setRemaining(RESEND_COOLDOWN);
    } finally {
      setSending(false);
    }
  };

  return (
    <View className="items-center">
      <View
        className="mb-5 h-14 w-14 items-center justify-center rounded-2xl"
        style={{ backgroundColor: `${p.accent}1f` }}
      >
        <Icon name="envelope.fill" android="mail" size={24} color={p.accent} />
      </View>

      {destination ? (
        <Text type="body-sm" color="muted" className="mb-6 text-center">
          Enter the code we sent to{"\n"}
          <Text className="font-semibold text-foreground">{destination}</Text>
        </Text>
      ) : null}

      <OtpInput value={value} onChange={onChange} onComplete={onComplete} isInvalid={invalid} />

      {onResend ? (
        <Pressable
          onPress={handleResend}
          disabled={remaining > 0 || sending}
          hitSlop={10}
          accessibilityRole="button"
          className="mt-7 active:opacity-60"
        >
          {remaining > 0 ? (
            <Text type="body-sm" color="muted" className="tabular-nums">
              Resend code in {remaining}s
            </Text>
          ) : (
            <Text type="body-sm" className="font-semibold text-accent">
              {sending ? "Sending…" : "Resend code"}
            </Text>
          )}
        </Pressable>
      ) : null}
    </View>
  );
}
