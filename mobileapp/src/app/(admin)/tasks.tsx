import React, { useState } from "react";
import { Pressable, View } from "react-native";
import { Text, Label } from "heroui-native";

import { AppScreen } from "@/components/app-screen";
import { DashboardSkeleton } from "@/components/dashboard-skeleton";
import { DashboardError } from "@/components/dashboard-states";
import { SectionCard } from "@/components/section-card";
import { Icon } from "@/components/icon";
import { Alert } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { CalendarTimePicker } from "@/components/ui/calendar-time-picker";
import { Sheet, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Stagger, PressableScale } from "@/components/motion";
import { useGet } from "@/hooks/use-api";
import { api, ApiError } from "@/lib/api";
import { formatTime, relativeDeadline } from "@/lib/format";
import type { TaskOut } from "@/types/api";

function hasTime(iso: string): boolean {
  const d = new Date(iso);
  return d.getHours() !== 0 || d.getMinutes() !== 0;
}

function formatDeadline(date: Date): string {
  const day = date.toLocaleDateString(undefined, { day: "numeric", month: "short" });
  const time = date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  return `${day} · ${time}`;
}

function DeadlineButton({
  value,
  onPress,
  onClear,
}: {
  value: Date | null;
  onPress: () => void;
  onClear: () => void;
}) {
  return (
    <View>
      <Label>Deadline</Label>
      <Pressable onPress={onPress} className="mt-1.5" accessibilityRole="button">
        <View
          className="h-12 flex-row items-center justify-between rounded-xl bg-field px-4"
          style={{ borderWidth: 1, borderColor: "var(--color-border)" }}
        >
          <View className="flex-row items-center gap-2">
            <Icon name="calendar" android="calendar_month" size={18} className="text-muted" />
            <Text
              className="text-[15px]"
              style={{ color: value ? "var(--color-foreground)" : "var(--color-muted)" }}
            >
              {value ? formatDeadline(value) : "Set deadline"}
            </Text>
          </View>
          {value ? (
            <Pressable onPress={onClear} hitSlop={10} accessibilityLabel="Clear deadline">
              <Icon name="xmark.circle.fill" android="close" size={18} className="text-muted" />
            </Pressable>
          ) : (
            <Icon name="chevron.right" android="chevron_right" size={16} className="text-muted" />
          )}
        </View>
      </Pressable>
    </View>
  );
}

export default function Screen_tasks() {
  const tasks = useGet<TaskOut[]>("/staff/tasks", ["task.changed"]);
  const [filter, setFilter] = useState<"open" | "done">("open");
  const [createOpen, setCreateOpen] = useState(false);
  const [deadlineSheetOpen, setDeadlineSheetOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [deadline, setDeadline] = useState<Date | null>(null);
  const [creating, setCreating] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const list = tasks.data ?? [];
  const shown = list.filter((t) => (filter === "open" ? !t.done : t.done));

  const refresh = () => tasks.refetch();

  const createTask = async () => {
    if (!title.trim()) return;
    setCreating(true);
    setError(null);
    try {
      await api.post<TaskOut>(
        "/staff/tasks",
        {
          title: title.trim(),
          description: description.trim() || null,
          deadline: deadline?.toISOString() ?? null,
        },
        { idempotent: true },
      );
      setCreateOpen(false);
      setTitle("");
      setDescription("");
      setDeadline(null);
      refresh();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not create task.");
    } finally {
      setCreating(false);
    }
  };

  const toggle = async (t: TaskOut) => {
    setTogglingId(t.id);
    setError(null);
    try {
      if (t.done) {
        await api.patch<TaskOut>(`/staff/tasks/${t.id}`, { done: false });
      } else {
        await api.post<TaskOut>(`/staff/tasks/${t.id}/complete`, undefined, {
          idempotent: true,
        });
      }
      refresh();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not update task.");
    } finally {
      setTogglingId(null);
    }
  };

  const removeTask = async (t: TaskOut) => {
    setTogglingId(t.id);
    try {
      await api.del(`/staff/tasks/${t.id}`);
      refresh();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not delete task.");
    } finally {
      setTogglingId(null);
    }
  };

  return (
    <AppScreen
      title="Tasks"
      subtitle="Assign, track and clear work"
      fab={
        <PressableScale
          scale={0.88}
          style={{ borderRadius: 999 }}
          accessibilityRole="button"
          accessibilityLabel="New task"
          onPress={() => {
            setError(null);
            setCreateOpen(true);
          }}
        >
          <View
            className="h-14 w-14 items-center justify-center rounded-full bg-accent shadow-surface"
            style={{ elevation: 8 }}
          >
            <Icon
              name="plus"
              android="add"
              size={26}
              color="#ffffff"
              weight="semibold"
            />
          </View>
        </PressableScale>
      }
    >
      {tasks.loading && !tasks.data ? (
        <DashboardSkeleton />
      ) : tasks.error ? (
        <DashboardError message={tasks.error} onRetry={refresh} />
      ) : (
        <>
          <SectionCard
            title={`${filter === "open" ? "Open" : "Done"} · ${shown.length}`}
            action={
              <View className="flex-row gap-2">
                {(["open", "done"] as const).map((f) => (
                  <Pressable key={f} onPress={() => setFilter(f)} hitSlop={8}>
                    <Text
                      className={`text-[13px] font-semibold ${filter === f ? "text-accent" : "text-muted"}`}
                    >
                      {f === "open" ? "Open" : "Done"}
                    </Text>
                  </Pressable>
                ))}
              </View>
            }
          >
            {shown.length === 0 ? (
              <View className="rounded-2xl bg-surface p-5">
                <Text type="body" weight="semibold" className="text-foreground">
                  {filter === "open" ? "Nothing open" : "Nothing done yet"}
                </Text>
                <Text type="body-sm" color="muted" className="mt-1">
                  {filter === "open"
                    ? "Tap + to assign a task to your team."
                    : "Completed tasks will appear here."}
                </Text>
              </View>
            ) : (
              <Stagger gap={50}>
                {shown.map((t) => (
                  <View
                    key={t.id}
                    className="mb-2 flex-row items-center gap-3 rounded-2xl bg-surface p-4 shadow-surface"
                  >
                    <PressableScale
                      scale={0.85}
                      pop={!t.done && togglingId === t.id}
                    >
                      <Pressable
                        onPress={() => toggle(t)}
                        disabled={togglingId === t.id}
                      >
                        <View
                          className={`h-6 w-6 items-center justify-center rounded-full border-2 ${
                            t.done
                              ? "border-success bg-success"
                              : "border-border bg-transparent"
                          }`}
                        >
                          {t.done ? (
                            <Icon
                              name="checkmark"
                              android="check"
                              size={13}
                              color="#ffffff"
                              weight="bold"
                            />
                          ) : null}
                        </View>
                      </Pressable>
                    </PressableScale>
                    <View className="flex-1">
                      <Text
                        type="body"
                        weight="medium"
                        className={`text-foreground ${t.done ? "line-through opacity-50" : ""}`}
                      >
                        {t.title}
                      </Text>
                      {t.description ? (
                        <Text
                          type="body-sm"
                          color="muted"
                          className="mt-0.5"
                          numberOfLines={1}
                        >
                          {t.description}
                        </Text>
                      ) : null}
                      {t.deadline ? (
                        <Text type="body-xs" className="mt-1 text-muted">
                          Due {relativeDeadline(t.deadline)}
                          {hasTime(t.deadline) ? ` · ${formatTime(t.deadline)}` : ""}
                        </Text>
                      ) : null}
                    </View>
                    {t.done ? (
                      <Pressable onPress={() => removeTask(t)} hitSlop={8}>
                        <Icon
                          name="trash"
                          android="delete"
                          size={18}
                          className="text-muted"
                        />
                      </Pressable>
                    ) : null}
                  </View>
                ))}
              </Stagger>
            )}
          </SectionCard>
        </>
      )}

      {error ? (
        <View className="mb-4">
          <Alert
            type="error"
            message={error}
            onDismiss={() => setError(null)}
          />
        </View>
      ) : null}

      <Sheet isOpen={createOpen} onOpenChange={setCreateOpen}>
        <SheetTitle>New task</SheetTitle>
        <SheetDescription>
          Assign work to yourself or your team.
        </SheetDescription>
        <Input
          label="Title"
          value={title}
          onChangeText={setTitle}
          placeholder="e.g. Order replacement mats"
        />
        <Input
          label="Description (optional)"
          value={description}
          onChangeText={setDescription}
          placeholder="What needs to happen?"
        />
        <DeadlineButton
          value={deadline}
          onPress={() => {
            setError(null);
            setDeadlineSheetOpen(true);
          }}
          onClear={() => setDeadline(null)}
        />
        {error ? (
          <Alert
            type="error"
            message={error}
            onDismiss={() => setError(null)}
          />
        ) : null}
        <Button
          loading={creating}
          onPress={createTask}
          disabled={!title.trim()}
        >
          Create task
        </Button>
      </Sheet>

      <Sheet
        isOpen={deadlineSheetOpen}
        onOpenChange={setDeadlineSheetOpen}
        enableContentPanningGesture={false}
      >
        <SheetTitle>Set deadline</SheetTitle>
        <SheetDescription>
          Pick a date and time for this task.
        </SheetDescription>
        <CalendarTimePicker
          value={deadline}
          onChange={setDeadline}
          minimumDate={new Date()}
        />
        <Button onPress={() => setDeadlineSheetOpen(false)}>
          Done
        </Button>
      </Sheet>
    </AppScreen>
  );
}
