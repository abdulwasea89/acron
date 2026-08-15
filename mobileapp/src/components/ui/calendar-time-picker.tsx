import React, { useMemo, useState } from "react";
import { Pressable, View } from "react-native";
import { Text, Label } from "heroui-native";

import { Icon } from "@/components/icon";

const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

interface CalendarTimePickerProps {
  value: Date | null;
  onChange: (date: Date) => void;
  minimumDate?: Date;
}

/**
 * Inline month-grid calendar + time selector, used for task deadlines.
 *
 * Renders directly inside a bottom sheet (no modal). Tap a day to pick the
 * date, then use the hour/minute steppers to set a time. The resolved value
 * stays a full `Date`, so the deadline carries both the day and the time.
 *
 * The selected day is highlighted with the accent; today gets a subtle ring.
 * Days before `minimumDate` are disabled. Time changes preserve the chosen day.
 */
export function CalendarTimePicker({
  value,
  onChange,
  minimumDate,
}: CalendarTimePickerProps) {
  const selected = value ?? new Date();
  const [month, setMonth] = useState(
    () => new Date(selected.getFullYear(), selected.getMonth(), 1),
  );

  const grid = useMemo(() => buildGrid(month.getFullYear(), month.getMonth()), [month]);

  const minMs = minimumDate ? startOfDay(minimumDate).getTime() : Number.NEGATIVE_INFINITY;

  const selectDay = (day: number) => {
    const date = new Date(month.getFullYear(), month.getMonth(), day);
    if (date.getTime() < minMs) return;
    const next = value ? new Date(value) : new Date();
    next.setFullYear(date.getFullYear(), date.getMonth(), day);
    onChange(next);
  };

  const shiftHour = (delta: number) => {
    const next = value ? new Date(value) : new Date();
    next.setHours((next.getHours() + delta + 24) % 24);
    onChange(next);
  };

  const shiftMinute = (delta: number) => {
    const next = value ? new Date(value) : new Date();
    next.setMinutes((next.getMinutes() + delta + 60) % 60);
    onChange(next);
  };

  const isSelectedDay = (day: number) =>
    value != null &&
    value.getFullYear() === month.getFullYear() &&
    value.getMonth() === month.getMonth() &&
    value.getDate() === day;

  const isToday = (day: number) => {
    const now = new Date();
    return (
      now.getFullYear() === month.getFullYear() &&
      now.getMonth() === month.getMonth() &&
      now.getDate() === day
    );
  };

  const displayTime = value
    ? value.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })
    : "";

  return (
    <View>
      <Label>Deadline</Label>

      {/* Calendar */}
      <View
        className="mt-1.5 rounded-2xl bg-surface p-3"
        style={{ borderWidth: 1, borderColor: "var(--color-border)" }}
      >
        <View className="mb-2 flex-row items-center justify-between px-1">
          <Pressable
            onPress={() => setMonth((m) => new Date(m.getFullYear(), m.getMonth() - 1, 1))}
            hitSlop={10}
            accessibilityLabel="Previous month"
          >
            <Icon name="chevron.left" android="chevron_left" size={18} className="text-muted" />
          </Pressable>
          <Text type="body" weight="semibold" className="text-foreground">
            {month.toLocaleDateString(undefined, { month: "long", year: "numeric" })}
          </Text>
          <Pressable
            onPress={() => setMonth((m) => new Date(m.getFullYear(), m.getMonth() + 1, 1))}
            hitSlop={10}
            accessibilityLabel="Next month"
          >
            <Icon name="chevron.right" android="chevron_right" size={18} className="text-muted" />
          </Pressable>
        </View>

        <View className="flex-row">
          {WEEKDAYS.map((d) => (
            <View key={d} className="flex-1 items-center py-1">
              <Text type="body-xs" color="muted">
                {d}
              </Text>
            </View>
          ))}
        </View>

        <View className="flex-row flex-wrap">
          {grid.map((cell, i) => {
            if (cell === 0) {
              return <View key={`blank-${i}`} className="aspect-square flex-1" />;
            }
            const disabled = new Date(month.getFullYear(), month.getMonth(), cell).getTime() < minMs;
            const selectedDay = isSelectedDay(cell);
            const today = isToday(cell);
            return (
              <View key={cell} className="aspect-square flex-1 p-0.5">
                <Pressable
                  onPress={() => selectDay(cell)}
                  disabled={disabled}
                  className="flex-1 items-center justify-center rounded-full"
                  style={
                    selectedDay
                      ? { backgroundColor: "var(--color-accent)" }
                      : today
                        ? { borderWidth: 1, borderColor: "var(--color-accent)" }
                        : undefined
                  }
                >
                  <Text
                    type="body-sm"
                    className={selectedDay ? "font-semibold text-accent-foreground" : "text-foreground"}
                    style={disabled ? { opacity: 0.3 } : undefined}
                  >
                    {cell}
                  </Text>
                </Pressable>
              </View>
            );
          })}
        </View>
      </View>

      {/* Time */}
      <View
        className="mt-3 flex-row items-center justify-between rounded-2xl bg-surface px-4 py-3"
        style={{ borderWidth: 1, borderColor: "var(--color-border)" }}
      >
        <View className="flex-row items-center gap-2">
          <Icon name="clock" android="access_time" size={18} className="text-muted" />
          <Text type="body" weight="medium" className="text-foreground">
            {displayTime || "Set time"}
          </Text>
        </View>
        <View className="flex-row items-center gap-1">
          <Stepper onPress={() => shiftHour(-1)} label="−1h" />
          <Stepper onPress={() => shiftMinute(-15)} label="−15m" />
          <Stepper onPress={() => shiftMinute(15)} label="+15m" />
          <Stepper onPress={() => shiftHour(1)} label="+1h" />
        </View>
      </View>
    </View>
  );
}

function Stepper({ onPress, label }: { onPress: () => void; label: string }) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={6}
      className="rounded-lg bg-surface-secondary px-2 py-1.5"
      accessibilityRole="button"
    >
      <Text type="body-xs" weight="semibold" className="text-accent">
        {label}
      </Text>
    </Pressable>
  );
}

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/** 6×7 grid (0 = leading blank) for the given month. */
function buildGrid(year: number, month: number): number[] {
  const first = new Date(year, month, 1).getDay();
  const days = new Date(year, month + 1, 0).getDate();
  const cells: number[] = [];
  for (let i = 0; i < first; i++) cells.push(0);
  for (let d = 1; d <= days; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(0);
  return cells;
}
