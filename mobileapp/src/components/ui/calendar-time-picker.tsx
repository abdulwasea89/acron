import React, { useMemo, useState } from "react";
import { StyleSheet, useColorScheme, View, Text } from "react-native";
import WheelPicker, {
  DatePicker,
} from "@quidone/react-native-wheel-picker";

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
 * The selected row is highlighted in neutral gray, nearby rows fade, and the
 * whole box gets a light hairline border. Colors come straight from the theme
 * palette so they never fall back to black/blue.
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

  const itemHeight = 42;
  const wheelTextStyle = { color: palette.foreground, fontSize: 18 };
  // Neutral highlight — never blue, unlike the theme's surface-secondary.
  const overlayStyle = {
    backgroundColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(15,23,42,0.06)",
  };
  const boxStyle = {
    borderColor: palette.border,
    borderWidth: 1,
    borderRadius: 14,
  };
  const captionStyle = { color: palette.muted, fontSize: 12 };

  return (
    <View>
      <Text style={[styles.label, { color: palette.foreground }]}>Deadline</Text>

      <View
        style={[
          styles.summary,
          boxStyle,
          { backgroundColor: palette.surface },
        ]}
      >
        <Text style={[styles.summaryText, { color: palette.foreground }]}>
          {formatDeadline(parseDate(dateStr), hour, minute, ampm)}
        </Text>
      </View>

      <View style={[styles.box, boxStyle, { backgroundColor: palette.surface }]}>
        <DatePicker
          date={dateStr}
          minDate={minDateStr}
          onDateChanged={onDateChanged}
          locale="en"
          itemHeight={itemHeight}
          visibleItemCount={5}
          itemTextStyle={wheelTextStyle}
          overlayItemStyle={overlayStyle}
        />
      </View>

      <View style={[styles.box, boxStyle, { backgroundColor: palette.surface }]}>
        <View style={styles.timeRow}>
          <TimeWheel
            data={hours}
            value={hour}
            onChange={onHourChanged}
            label="Hour"
            width={76}
            palette={palette}
            overlayStyle={overlayStyle}
          />
          <TimeWheel
            data={minutes}
            value={minute}
            onChange={onMinuteChanged}
            label="Minute"
            width={76}
            palette={palette}
            overlayStyle={overlayStyle}
          />
          <TimeWheel
            data={ampms}
            value={ampm}
            onChange={onAmpmChanged}
            label="Period"
            width={76}
            palette={palette}
            overlayStyle={overlayStyle}
          />
        </View>
      </View>

      <Text style={[styles.caption, captionStyle]}>
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
  overlayStyle,
}: {
  data: { value: T }[];
  value: T;
  onChange: (e: { item: { value: T } }) => void;
  label: string;
  width: number;
  palette: ReturnType<typeof getPalette>;
  overlayStyle: { backgroundColor: string };
}) {
  return (
    <View style={styles.timeColumn}>
      <WheelPicker
        data={data}
        value={value}
        width={width}
        itemHeight={42}
        visibleItemCount={5}
        enableScrollByTapOnItem
        onValueChanged={onChange as never}
        itemTextStyle={{ color: palette.foreground, fontSize: 18 }}
        overlayItemStyle={overlayStyle}
      />
      <Text style={[styles.caption, { color: palette.muted }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  label: {
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 6,
  },
  summary: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  summaryText: {
    fontSize: 17,
    fontWeight: "600",
  },
  box: {
    borderRadius: 14,
    overflow: "hidden",
    paddingVertical: 10,
    marginBottom: 12,
  },
  timeRow: {
    flexDirection: "row",
    justifyContent: "center",
  },
  timeColumn: {
    alignItems: "center",
  },
  caption: {
    textAlign: "center",
    marginTop: 8,
    marginBottom: 2,
  },
});

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
