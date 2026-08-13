import React, { useState } from "react";
import { Pressable, RefreshControl, TextInput, View } from "react-native";
import { Text } from "heroui-native";
import { BottomSheet } from "heroui-native/bottom-sheet";

import { AppScreen } from "@/components/app-screen";
import { SectionCard } from "@/components/section-card";
import { Icon } from "@/components/icon";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { StatusChip, humanize, memberStatusTone } from "@/components/status-chip";
import { Stagger, PressableScale } from "@/components/motion";
import { useGet } from "@/hooks/use-api";
import { api, ApiError } from "@/lib/api";
import { money, formatDay } from "@/lib/format";
import type {
  CashMemberOut,
  CashPaymentOut,
  OrganizationOut,
  PlanOut,
  ReconciliationOut,
} from "@/types/api";

const METHOD_OPTIONS = [
  { value: "cash", label: "Cash" },
  { value: "bank_transfer", label: "Bank" },
  { value: "mobile_wallet", label: "Wallet" },
] as const;

export default function Screen_cash_log() {
  const org = useGet<OrganizationOut>("/organizations/me");
  const plans = useGet<PlanOut[]>("/plans");
  const [q, setQ] = useState("");
  const [results, setResults] = useState<CashMemberOut[]>([]);
  const [searching, setSearching] = useState(false);
  const [logSheetOpen, setLogSheetOpen] = useState(false);
  const [selected, setSelected] = useState<CashMemberOut | null>(null);
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<(typeof METHOD_OPTIONS)[number]["value"]>("cash");
  const [note, setNote] = useState("");
  const [logging, setLogging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastPayment, setLastPayment] = useState<CashPaymentOut | null>(null);

  // Reconciliation state
  const [reconOpen, setReconOpen] = useState(false);
  const [counted, setCounted] = useState("");
  const [reconResult, setReconResult] = useState<ReconciliationOut | null>(null);

  const currency = org.data?.currency || "USD";

  const search = async (raw: string) => {
    const term = raw.trim();
    setQ(raw);
    if (!term) {
      setResults([]);
      return;
    }
    setSearching(true);
    try {
      const res = await api.get<CashMemberOut[]>(`/cash/members?q=${encodeURIComponent(term)}`);
      setResults(res);
    } catch {
      setResults([]);
    } finally {
      setSearching(false);
    }
  };

  const openLog = (m: CashMemberOut) => {
    setSelected(m);
    setSelectedPlan(plans.data?.[0]?.id ?? null);
    setAmount("");
    setNote("");
    setError(null);
    setLogSheetOpen(true);
  };

  const submitLog = async () => {
    if (!selected) return;
    const amt = parseFloat(amount);
    if (!amount || isNaN(amt) || amt <= 0) {
      setError("Enter a valid amount.");
      return;
    }
    setLogging(true);
    setError(null);
    try {
      const res = await api.post<CashPaymentOut>(
        "/cash/log",
        {
          member_id: selected.member_id,
          plan_id: selectedPlan,
          amount: amt,
          method,
          notes: note.trim() || undefined,
        },
        { idempotent: true },
      );
      setLastPayment(res);
      setLogSheetOpen(false);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not log payment.");
    } finally {
      setLogging(false);
    }
  };

  const runRecon = async () => {
    const countedTotal = parseFloat(counted);
    if (isNaN(countedTotal) || countedTotal < 0) {
      setError("Enter the counted total.");
      return;
    }
    setError(null);
    try {
      const res = await api.post<ReconciliationOut>(
        "/cash/reconcile",
        {
          business_date: new Date().toISOString().slice(0, 10),
          counted_total: countedTotal,
        },
        { idempotent: true },
      );
      setReconResult(res);
      setReconOpen(false);
      setCounted("");
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not run reconciliation.");
    }
  };

  return (
    <AppScreen
      title="Cash log"
      subtitle="Record offline payments & reconcile"
      refreshControl={
        <RefreshControl refreshing={org.loading} onRefresh={() => { org.refetch(); plans.refetch(); }} />
      }
    >
      {/* Search + new log */}
      <SectionCard title="Log a payment">
        <View className="mb-4 flex-row items-center rounded-2xl bg-surface px-3" style={{ borderWidth: 1, borderColor: "rgba(128,128,128,0.2)" }}>
          <Icon name="magnifyingglass" android="search" size={18} className="text-muted" />
          <TextInput
            className="ml-2 flex-1 py-3 text-[15px] text-foreground"
            placeholder="Search member by name, email or phone"
            placeholderTextColor="#9ca3af"
            value={q}
            onChangeText={search}
            autoCapitalize="none"
          />
          {searching ? <Text type="body-xs" color="muted">…</Text> : null}
        </View>

        {results.length === 0 && q.trim().length > 0 && !searching ? (
          <Text type="body-sm" color="muted" className="px-1 pb-1">No members found.</Text>
        ) : null}

        {results.length > 0 ? (
          <Stagger gap={40}>
            {results.map((m) => (
              <Pressable key={m.member_id} onPress={() => openLog(m)} className="active:opacity-80">
                <View className="rounded-2xl bg-surface p-4 shadow-surface">
                  <View className="flex-row items-center gap-3">
                    <View className="h-10 w-10 items-center justify-center rounded-xl bg-surface-tertiary">
                      <Text className="text-[15px] font-bold text-accent">
                        {(m.full_name || "?").charAt(0).toUpperCase()}
                      </Text>
                    </View>
                    <View className="flex-1">
                      <Text type="body" weight="semibold" className="text-foreground">
                        {m.full_name || "Unnamed member"}
                      </Text>
                      <Text type="body-sm" color="muted">{m.email}</Text>
                    </View>
                    <View>
                      <StatusChip status={m.member_status} tone={memberStatusTone(m.member_status)} />
                    </View>
                  </View>
                  <View className="mt-3">
                    <Button size="sm" variant="secondary" onPress={() => openLog(m)}>
                      Log payment
                    </Button>
                  </View>
                </View>
              </Pressable>
            ))}
          </Stagger>
        ) : (
          <EmptyState
            title="Search to log"
            message="Find a member, then record their cash, bank or mobile-wallet payment."
            icon="banknote"
          />
        )}
      </SectionCard>

      {lastPayment ? (
        <SectionCard title="Last recorded">
          <View className="rounded-2xl bg-surface p-4 shadow-surface">
            <View className="flex-row items-center justify-between">
              <View>
                <Text type="body" weight="semibold" className="text-foreground">
                  {money(lastPayment.amount, currency)} · {humanize(lastPayment.method)}
                </Text>
                <Text type="body-sm" color="muted" className="mt-0.5">
                  Member now {humanize(lastPayment.member_status)}
                </Text>
              </View>
              {lastPayment.receipt_pdf_url ? (
                <Badge tone="success" label="receipt" />
              ) : null}
            </View>
          </View>
        </SectionCard>
      ) : null}

      {/* Reconciliation */}
      <SectionCard
        title="End-of-day reconciliation"
        action={
          reconResult ? (
            <Pressable onPress={() => { setReconResult(null); setReconOpen(true); }} hitSlop={8}>
              <Text type="body-sm" className="text-accent">Run again</Text>
            </Pressable>
          ) : undefined
        }
      >
        {reconResult ? (
          <View className="rounded-2xl bg-surface p-5 shadow-surface">
            <Text type="body" weight="semibold" className="text-foreground">
              {formatDay(reconResult.business_date)}
            </Text>
            <View className="mt-3 flex-row justify-between">
              <Text type="body-sm" color="muted">System total</Text>
              <Text type="body" className="text-foreground">{money(reconResult.system_total, currency)}</Text>
            </View>
            <View className="mt-1 flex-row justify-between">
              <Text type="body-sm" color="muted">Counted</Text>
              <Text type="body" className="text-foreground">{money(reconResult.counted_total, currency)}</Text>
            </View>
            <View className="mt-3 h-px bg-border" />
            <View className="mt-3 flex-row justify-between">
              <Text type="body-sm" color="muted">Discrepancy</Text>
              <Badge
                tone={reconResult.discrepancy === 0 ? "success" : "danger"}
                label={reconResult.discrepancy === 0 ? "Balanced" : `${money(Math.abs(reconResult.discrepancy), currency)}`}
              />
            </View>
            {reconResult.alert_triggered ? (
              <Text type="body-xs" className="mt-3 text-danger">Alert sent to the owner.</Text>
            ) : null}
          </View>
        ) : (
          <View className="rounded-2xl bg-surface p-5 shadow-surface">
            <Text type="body-sm" color="muted">
              Compare today&apos;s counted cash against what the system logged.
            </Text>
            <View className="mt-4">
              <Button variant="secondary" onPress={() => { setReconOpen(true); setError(null); }}>
                Start reconciliation
              </Button>
            </View>
          </View>
        )}
      </SectionCard>

      {error ? (
        <View className="mb-4">
          <Alert type="error" message={error} onDismiss={() => setError(null)} />
        </View>
      ) : null}

      {/* Log payment sheet */}
      <BottomSheet isOpen={logSheetOpen} onOpenChange={setLogSheetOpen}>
        <BottomSheet.Portal>
          <BottomSheet.Overlay isCloseOnPress />
          <BottomSheet.Content className="gap-4 p-5 pb-8">
            <BottomSheet.Title className="text-[18px] font-bold text-foreground">
              Log payment
            </BottomSheet.Title>
            {selected && (
              <Text type="body-sm" color="muted">
                {selected.full_name || selected.email}
              </Text>
            )}

            <Input
              label="Amount"
              value={amount}
              onChangeText={setAmount}
              keyboardType="decimal-pad"
              placeholder="0.00"
            />

            <View className="gap-2">
              <Text type="body-sm" className="text-muted">Method</Text>
              <View className="flex-row gap-2">
                {METHOD_OPTIONS.map((m) => {
                  const active = method === m.value;
                  return (
                    <PressableScale key={m.value} style={{ flex: 1 }}>
                      <Pressable onPress={() => setMethod(m.value)}>
                        <View
                          className={`items-center rounded-xl py-2.5 ${active ? "bg-accent" : "bg-surface-secondary"}`}
                        >
                          <Text className={`text-[13px] font-semibold ${active ? "text-accent-foreground" : "text-foreground"}`}>
                            {m.label}
                          </Text>
                        </View>
                      </Pressable>
                    </PressableScale>
                  );
                })}
              </View>
            </View>

            <View className="gap-1">
              <Text type="body-sm" className="text-muted">Plan</Text>
              <View className="flex-row flex-wrap gap-2">
                {(plans.data ?? []).map((p) => {
                  const active = selectedPlan === p.id;
                  return (
                    <Pressable key={p.id} onPress={() => setSelectedPlan(p.id)}>
                      <Badge
                        tone={active ? "info" : "neutral"}
                        label={p.name}
                      />
                    </Pressable>
                  );
                })}
                {!(plans.data ?? []).length ? (
                  <Text type="body-xs" color="muted">No published plans.</Text>
                ) : null}
              </View>
            </View>

            <Input
              label="Note (optional)"
              value={note}
              onChangeText={setNote}
              placeholder="e.g. Paid at front desk"
            />

            <BottomSheet.Close>
              <View>
                <Button loading={logging} onPress={submitLog}>
                  {money(parseFloat(amount) || 0, currency)} — record
                </Button>
              </View>
            </BottomSheet.Close>
          </BottomSheet.Content>
        </BottomSheet.Portal>
      </BottomSheet>

      {/* Reconciliation sheet */}
      <BottomSheet isOpen={reconOpen} onOpenChange={setReconOpen}>
        <BottomSheet.Portal>
          <BottomSheet.Overlay isCloseOnPress />
          <BottomSheet.Content className="gap-4 p-5 pb-8">
            <BottomSheet.Title className="text-[18px] font-bold text-foreground">
              Cash reconciliation
            </BottomSheet.Title>
            <BottomSheet.Description className="text-[13px] text-muted">
              Enter the cash you actually counted for today.
            </BottomSheet.Description>
            <Input
              label="Counted total"
              value={counted}
              onChangeText={setCounted}
              keyboardType="decimal-pad"
              placeholder="0.00"
            />
            <BottomSheet.Close>
              <View>
                <Button onPress={runRecon}>Submit count</Button>
              </View>
            </BottomSheet.Close>
          </BottomSheet.Content>
        </BottomSheet.Portal>
      </BottomSheet>
    </AppScreen>
  );
}