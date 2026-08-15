import React, { useMemo, useState } from "react";
import { useColorScheme, View } from "react-native";
import WheelPicker, {
  DatePicker,
} from "@quidone/react-native-wheel-picker";
import { Text, Label } from "heroui-native";

import { getPalette } from "@/lib/theme";

interface CalendarTimePickerProps {
  value: Date | null;
  onChange: (date: Date) => void;
  minimumDate?: Date;
}

/**
 * Inline scroll-wheel date + time picker for task deadlines.
 *
 * Pure-JS wheels (no native modal), so it works identically inside the bottom
 * sheet on iOS and Android:
 *
 *   - Day / Month / Year wheels scroll by hand, honoring the real month length
 *     (30/31/28/29) and blocking dates before `minimumDate`.
 *   - Hour / Minute / AM-PM wheels set the time of day.
 *
 * The selected row is highlighted in gray and nearby rows fade out, matching
 * a native wheel. The resolved value is always a full `Date` carrying the
 * chosen day and time.
 */
export function CalendarTimePicker({
  value,
  onChange,
  minimumDate,
}: CalendarTimePickerProps) {
  const isDark = useColorScheme() === "dark";
  const palette = getPalette(isDark);

  const base = value ?? new Date();
  const [dateStr, setDateStr] = useState(formatDate(base));
  const [hour, setHour] = useState(hourOf(base));
  const [minute, setMinute] = useState(minuteOf(base));
  const [ampm, setAmpm] = useState<"AM" | "PM">(ampmOf(base));
  const minDateStr = minimumDate ? formatDate(minimumDate) : undefined;

  const commit = (d: string, h: number, m: number, ap: "AM" | "PM") => {
    const date = parseDate(d);
    date.setHours(ap === "AM" ? h % 12 : (h % 12) + 12, m, 0, 0);
    onChange(date);
  };

  const onDateChanged = ({ date }: { date: string }) => {
    setDateStr(date);
    commit(date, hour, minute, ampm);
  };
  const onHourChanged = ({ item }: { item: { value: number } }) => {
    setHour(item.value);
    commit(dateStr, item.value, minute, ampm);
  };
  const onMinuteChanged = ({ item }: { item: { value: number } }) => {
    setMinute(item.value);
    commit(dateStr, hour, item.value, ampm);
  };
  const onAmpmChanged = ({ item }: { item: { value: "AM" | "PM" } }) => {
    setAmpm(item.value);
    commit(dateStr, hour, minute, item.value);
  };

  const hours = useMemo(
    () => Array.from({ length: 12 }, (_, i) => ({ value: i + 1 })),
    [],
  );
  const minutes = useMemo(
    () => Array.from({ length: 12 }, (_, i) => ({ value: i * 5 })),
    [],
  );
  const ampms = useMemo(
    () => [{ value: "AM" as const }, { value: "PM" as const }],
    [],
  );

  const wheelTextStyle = { color: palette.foreground, fontSize: 18 };
  const overlayStyle = {
    backgroundColor: palette.surfaceSecondary,
    borderRadius: 12,
  };

  return (
    <View>
      <Label>Deadline</Label>

      <View className="mt-1.5 flex-row items-center justify-between rounded-xl bg-surface-secondary px-4 py-3">
        <Text type="body" weight="semibold" className="text-foreground">
          {formatDeadline(parseDate(dateStr), hour, minute, ampm)}
        </Text>
      </View>

      <View className="mt-3 rounded-2xl bg-surface py-3">
        <DatePicker
          date={dateStr}
          minDate={minDateStr}
          onDateChanged={onDateChanged}
          locale="en"
          itemHeight={40}
          visibleItemCount={5}
          itemTextStyle={wheelTextStyle}
          overlayItemStyle={overlayStyle}
        />
      </View>

      <View className="mt-3 rounded-2xl bg-surface py-3">
        <View className="flex-row justify-center">
          <TimeWheel
            data={hours}
            value={hour}
            onChange={onHourChanged}
            label="Hour"
            width={80}
            palette={palette}
          />
          <TimeWheel
            data={minutes}
            value={minute}
            onChange={onMinuteChanged}
            label="Minute"
            width={80}
            palette={palette}
          />
          <TimeWheel
            data={ampms}
            value={ampm}
            onChange={onAmpmChanged}
            label="Period"
            width={80}
            palette={palette}
          />
        </View>
      </View>

      <Text type="body-sm" className="mt-2 text-center text-muted">
        Scroll to choose. Past dates are blocked.
      </Text>
    </View>
  );
}

function TimeWheel<T extends string | number>({
  data,
  value,
  onChange,
  label,
  width,
  palette,
}: {
  data: { value: T }[];
  value: T;
  onChange: (e: { item: { value: T } }) => void;
  label: string;
  width: number;
  palette: ReturnType<typeof getPalette>;
}) {
  return (
    <View className="items-center">
      <WheelPicker
        data={data}
        value={value}
        width={width}
        itemHeight={40}
        visibleItemCount={5}
        enableScrollByTapOnItem
        onValueChanged={onChange as never}
        itemTextStyle={{ color: palette.foreground, fontSize: 18 }}
        overlayItemStyle={{
          backgroundColor: palette.surfaceSecondary,
          borderRadius: 12,
        }}
      />
      <Text type="body-xs" className="text-muted">
        {label}
      </Text>
    </View>
  );
}

/** Format a `Date` as `YYYY-MM-DD` (the DatePicker contract). */
function formatDate(d: Date): string {
  const y = d.getFullYear();
  const m = `${d.getMonth() + 1}`.padStart(2, "0");
  const day = `${d.getDate()}`.padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Parse `YYYY-MM-DD` into a local `Date` at midnight. */
function parseDate(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}

/** Compact label, e.g. `26 Aug · 6:00 PM`. */
function formatDeadline(
  date: Date,
  hour: number,
  minute: number,
  ampm: "AM" | "PM",
): string {
  const day = date.getDate();
  const month = date.toLocaleString("en-US", { month: "short" });
  const h = hour % 12 === 0 ? 12 : hour % 12;
  const m = `${minute}`.padStart(2, "0");
  return `${day} ${month} · ${h}:${m} ${ampm}`;
}

function hourOf(d: Date): number {
  const h = d.getHours() % 12;
  return h === 0 ? 12 : h;
}

function minuteOf(d: Date): number {
  return Math.round(d.getMinutes() / 5) * 5;
}

function ampmOf(d: Date): "AM" | "PM" {
  return d.getHours() >= 12 ? "PM" : "AM";
}
