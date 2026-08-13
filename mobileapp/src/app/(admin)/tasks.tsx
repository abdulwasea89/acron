import React, { useState } from "react";
import { Pressable, RefreshControl, View } from "react-native";
import { Text } from "heroui-native";
import { BottomSheet } from "heroui-native/bottom-sheet";

import { AppScreen } from "@/components/app-screen";
import { DashboardSkeleton } from "@/components/dashboard-skeleton";
import { DashboardError } from "@/components/dashboard-states";
import { SectionCard } from "@/components/section-card";
import { Icon } from "@/components/icon";
import { Alert } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Stagger, PressableScale } from "@/components/motion";
import { useGet } from "@/hooks/use-api";
import { api, ApiError } from "@/lib/api";
import { relativeDeadline } from "@/lib/format";
import type { TaskOut } from "@/types/api";

export default function Screen_tasks() {
  const tasks = useGet<TaskOut[]>("/staff/tasks");
  const [filter, setFilter] = useState<"open" | "done">("open");
  const [createOpen, setCreateOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [deadline, setDeadline] = useState("");
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
          deadline: deadline.trim() ? new Date(deadline).toISOString() : null,
        },
        { idempotent: true },
      );
      setCreateOpen(false);
      setTitle("");
      setDescription("");
      setDeadline("");
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
        await api.post<TaskOut>(`/staff/tasks/${t.id}/complete`, undefined, { idempotent: true });
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
      headerRight={
        <PressableScale scale={0.9} style={{ borderRadius: 14 }}>
          <Pressable onPress={() => { setError(null); setCreateOpen(true); }}>
            <View className="h-9 w-9 items-center justify-center rounded-xl bg-accent">
              <Icon name="plus" android="add" size={18} color="#ffffff" weight="semibold" />
            </View>
          </Pressable>
        </PressableScale>
      }
      refreshControl={<RefreshControl refreshing={tasks.loading} onRefresh={refresh} />}
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
                    <Text className={`text-[13px] font-semibold ${filter === f ? "text-accent" : "text-muted"}`}>
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
                  <View key={t.id} className="mb-2 flex-row items-center gap-3 rounded-2xl bg-surface p-4 shadow-surface">
                    <PressableScale scale={0.85} pop={!t.done && togglingId === t.id}>
                      <Pressable onPress={() => toggle(t)} disabled={togglingId === t.id}>
                        <View
                          className={`h-6 w-6 items-center justify-center rounded-full border-2 ${
                            t.done ? "border-success bg-success" : "border-border bg-transparent"
                          }`}
                        >
                          {t.done ? <Icon name="checkmark" android="check" size={13} color="#ffffff" weight="bold" /> : null}
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
                        <Text type="body-sm" color="muted" className="mt-0.5" numberOfLines={1}>
                          {t.description}
                        </Text>
                      ) : null}
                      {t.deadline ? (
                        <Text type="body-xs" className="mt-1 text-muted">
                          Due {relativeDeadline(t.deadline)}
                        </Text>
                      ) : null}
                    </View>
                    {t.done ? (
                      <Pressable onPress={() => removeTask(t)} hitSlop={8}>
                        <Icon name="trash" android="delete" size={18} className="text-muted" />
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
          <Alert type="error" message={error} onDismiss={() => setError(null)} />
        </View>
      ) : null}

      <BottomSheet isOpen={createOpen} onOpenChange={setCreateOpen}>
        <BottomSheet.Portal>
          <BottomSheet.Overlay isCloseOnPress />
          <BottomSheet.Content className="gap-4 p-5 pb-8">
            <BottomSheet.Title className="text-[18px] font-bold text-foreground">
              New task
            </BottomSheet.Title>
            <BottomSheet.Description className="text-[13px] text-muted">
              Assign work to yourself or your team.
            </BottomSheet.Description>
            <Input label="Title" value={title} onChangeText={setTitle} placeholder="e.g. Order replacement mats" />
            <Input label="Description (optional)" value={description} onChangeText={setDescription} placeholder="What needs to happen?" />
            <Input label="Deadline (optional)" value={deadline} onChangeText={setDeadline} placeholder="YYYY-MM-DD" />
            <BottomSheet.Close>
              <View>
                <Button loading={creating} onPress={createTask} disabled={!title.trim()}>
                  Create task
                </Button>
              </View>
            </BottomSheet.Close>
          </BottomSheet.Content>
        </BottomSheet.Portal>
      </BottomSheet>
    </AppScreen>
  );
}