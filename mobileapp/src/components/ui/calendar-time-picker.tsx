import React, { useState } from "react";
import { Platform, Pressable, View } from "react-native";
import DateTimePicker, {
  type DateTimePickerEvent,
} from "@react-native-community/datetimepicker";
import { Text, Label } from "heroui-native";

import { Icon, type IconName } from "@/components/icon";

interface CalendarTimePickerProps {
  value: Date | null;
  onChange: (date: Date) => void;
  minimumDate?: Date;
}

type Tab = "date" | "time";

/**
 * Native scroll-wheel date + time picker used for task deadlines.
 *
 * A Date / Time toggle shows one native spinner wheel at a time, so you scroll
 * by hand through every day of the month, the month, the year, and the time.
 *
 * - iOS: the wheel renders inline inside the sheet.
 * - Android: each wheel opens as its own native scroll dialog.
 *
 * The resolved value is always a full `Date` carrying the chosen day and time.
 */
export function CalendarTimePicker({
  value,
  onChange,
  minimumDate,
}: CalendarTimePickerProps) {
  const [tab, setTab] = useState<Tab>("date");
  const base = value ?? defaultTime(new Date());

  const handleDate = (e: DateTimePickerEvent) => {
    if (e.type === "set" && e.nativeEvent.timestamp) {
      const next = new Date(e.nativeEvent.timestamp);
      const merged = new Date(base);
      merged.setFullYear(next.getFullYear(), next.getMonth(), next.getDate());
      onChange(merged);
    }
    if (Platform.OS === "android") setTab("time");
  };

  const handleTime = (e: DateTimePickerEvent) => {
    if (e.type === "set" && e.nativeEvent.timestamp) {
      const next = new Date(e.nativeEvent.timestamp);
      const merged = new Date(base);
      merged.setHours(next.getHours(), next.getMinutes(), 0, 0);
      onChange(merged);
    }
    if (Platform.OS === "android") setTab("date");
  };

  return (
    <View>
      <Label>Deadline</Label>

      <View className="mt-1.5 flex-row rounded-xl bg-surface-secondary p-1">
        <TabButton
          active={tab === "date"}
          label="Date"
          icon="calendar"
          android="calendar_month"
          onPress={() => setTab("date")}
        />
        <TabButton
          active={tab === "time"}
          label="Time"
          icon="clock"
          android="access_time"
          onPress={() => setTab("time")}
        />
      </View>

      <View className="mt-3 overflow-hidden rounded-2xl bg-surface">
        {tab === "date" ? (
          <DateTimePicker
            value={base}
            mode="date"
            display="spinner"
            onChange={handleDate}
            minimumDate={minimumDate}
            textColor="var(--color-foreground)"
          />
        ) : (
          <DateTimePicker
            value={base}
            mode="time"
            display="spinner"
            onChange={handleTime}
            textColor="var(--color-foreground)"
          />
        )}
      </View>
    </View>
  );
}

function TabButton({
  active,
  label,
  icon,
  android,
  onPress,
}: {
  active: boolean;
  label: string;
  icon: IconName;
  android: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      className={`flex-1 flex-row items-center justify-center gap-1.5 rounded-lg py-2 ${
        active ? "bg-surface" : ""
      }`}
      accessibilityRole="button"
    >
      <Icon
        name={icon}
        android={android}
        size={16}
        className={active ? "text-accent" : "text-muted"}
      />
      <Text
        type="body-sm"
        weight={active ? "semibold" : "medium"}
        className={active ? "text-foreground" : "text-muted"}
      >
        {label}
      </Text>
    </Pressable>
  );
}

/** A sensible default time when the user hasn't picked one yet: 6 PM. */
function defaultTime(base: Date): Date {
  const d = new Date(base);
  d.setHours(18, 0, 0, 0);
  return d;
}
