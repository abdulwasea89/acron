import React, { useState } from "react";
import { Platform, Pressable, View } from "react-native";
import DateTimePicker, { type DateTimePickerEvent } from "@react-native-community/datetimepicker";
import { Text, Label } from "heroui-native";
import { Icon } from "@/components/icon";

interface DatePickerFieldProps {
  label: string;
  value: Date | null;
  onChange: (date: Date | null) => void;
  placeholder?: string;
  minimumDate?: Date;
}

/**
 * Tappable field that opens the native date picker.
 *
 * iOS: renders an inline calendar below the field (spans the sheet width,
 * matches the sheet's scroll — no extra modal).  On Android the native
 * date dialog opens as a modal automatically.
 *
 * Displays the selected date in "Mon, Jan 15, 2026" format, or the
 * placeholder + calendar icon when empty.
 */
export function DatePickerField({
  label,
  value,
  onChange,
  placeholder = "Pick a date",
  minimumDate,
}: DatePickerFieldProps) {
  const [open, setOpen] = useState(false);

  const handle = (e: DateTimePickerEvent) => {
    if (Platform.OS === "android") setOpen(false);
    if (e.type === "set" && e.nativeEvent.timestamp) {
      onChange(new Date(e.nativeEvent.timestamp));
    } else if (e.type === "dismissed" && Platform.OS === "ios") {
      setOpen(false);
    }
  };

  const formatted = value
    ? value.toLocaleDateString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : null;

  return (
    <View>
      <Label>{label}</Label>
      <Pressable onPress={() => setOpen((o) => !o)} className="mt-1.5">
        <View
          className="h-12 flex-row items-center justify-between rounded-xl bg-field px-4"
          style={{ borderWidth: 1, borderColor: "var(--color-border)" }}
        >
          <Text
            className="text-[16px] text-foreground"
            style={{ opacity: formatted ? 1 : 0.4 }}
          >
            {formatted ?? placeholder}
          </Text>
          <Icon
            name="calendar"
            android="calendar_month"
            size={18}
            className="text-muted"
          />
        </View>
      </Pressable>

      {open && (
        <DateTimePicker
          value={value ?? new Date()}
          mode="date"
          display="inline"
          onChange={handle}
          minimumDate={minimumDate}
          textColor="var(--color-foreground)"
        />
      )}
    </View>
  );
}
