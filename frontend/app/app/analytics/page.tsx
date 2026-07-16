"use client";

import { useEffect, useMemo, useState } from "react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Label, Pie, PieChart, XAxis, YAxis } from "recharts";

import { PageHeader } from "@/components/PageHeader";
import { Alert, Spinner } from "@/components/ui";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { api, ApiError } from "@/lib/api";
import { money } from "@/lib/format";
import type { RevenueAnalytics } from "@/lib/types";

/* ─── Helpers ─── */

const METHOD_LABELS: Record<string, string> = {
  card: "Card",
  cash: "Cash",
  bank_transfer: "Bank transfer",
  mobile_wallet: "Mobile wallet",
};

export default function AnalyticsPage() {
  const [data, setData] = useState<RevenueAnalytics | null>(null);
  const [error, setError] = useState("");

  async function load() {
    setError("");
    try {
      setData(await api.get<RevenueAnalytics>("/analytics/revenue"));
    } catch (e) {
      setError((e as ApiError).message);
    }
  }

  useEffect(() => {
    queueMicrotask(() => void load());
  }, []);

  const revenueChartConfig = useMemo(() => {
    if (!data) return {} satisfies ChartConfig;
    const config: ChartConfig = {};
    Object.keys(data.revenue_by_method).forEach((method, i) => {
      const colors = ["#3b82f6", "#10b981", "#f59e0b", "#8b5cf6"];
      config[method] = {
        label: METHOD_LABELS[method] || method,
        color: colors[i % colors.length],
      };
    });
    return config;
  }, [data]);

  const revenueChartData = useMemo(() => {
    if (!data) return [];
    return Object.entries(data.revenue_by_method).map(([method, amount]) => ({
      method: METHOD_LABELS[method] || method,
      amount,
      fill: revenueChartConfig[method]?.color || "var(--muted)",
    }));
  }, [data, revenueChartConfig]);

  const statusChartConfig = useMemo(() => {
    if (!data) return {} satisfies ChartConfig;
    const palette: Record<string, string> = {
      active: "#10b981",
      grace: "#f59e0b",
      expired: "#ef4444",
      cancelled: "#94a3b8",
      frozen: "#06b6d4",
      pending_payment: "#f97316",
      pending_approval: "#f97316",
      pending_activation: "#0ea5e9",
      banned: "#f43f5e",
    };
    const config: ChartConfig = {};
    Object.keys(data.member_count_by_status).forEach((status) => {
      config[status] = {
        label: status.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
        color: palette[status] || "var(--muted)",
      };
    });
    return config;
  }, [data]);

  const statusChartData = useMemo(() => {
    if (!data) return [];
    return Object.entries(data.member_count_by_status).map(([status, count]) => ({
      status: status.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
      count,
      fill: statusChartConfig[status]?.color || "var(--muted)",
    }));
  }, [data, statusChartConfig]);

  const totalByMethod = data
    ? Object.values(data.revenue_by_method).reduce((a, b) => a + b, 0)
    : 0;

  return (
    <>
      <PageHeader
        title="Revenue analytics"
        subtitle="Your gym's financial health at a glance"
      />

      {error && <div className="mb-4"><Alert onDismiss={() => setError("")}>{error}</Alert></div>}

      {data === null ? (
        <Spinner label="Loading analytics…" />
      ) : (
        <div className="grid gap-6">
          {/* Stat cards */}
          <div className="grid gap-4 sm:grid-cols-3">
            <StatCard
              label="Total revenue"
              value={money(data.total_revenue, data.currency)}
              icon={
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 6v12m-3-2.818.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              }
            />
            <StatCard
              label="Active members"
              value={String(data.active_members)}
              icon={
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
                </svg>
              }
            />
            <StatCard
              label="Churned"
              value={String(data.churn_count)}
              icon={
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 10.5h-6m-2.25-4.125a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zM4 19.235v-.11a6.375 6.375 0 0112.75 0v.109A12.318 12.318 0 0110.374 21c-2.331 0-4.512-.645-6.374-1.766z" />
                </svg>
              }
            />
          </div>

          {/* Revenue trend area chart */}
          <Card>
            <CardHeader>
              <CardTitle>Revenue trend</CardTitle>
              <CardDescription>Daily revenue over time — data appears once payments are processed.</CardDescription>
            </CardHeader>
            <CardContent>
              {totalByMethod === 0 ? (
                <EmptyChartArea />
              ) : (
                <ChartContainer config={{}} className="aspect-auto h-[250px] w-full">
                  <AreaChart data={[]} margin={{ top: 10, right: 12, left: 12, bottom: 0 }}>
                    <defs>
                      <linearGradient id="fillRevenue" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="var(--color-revenue, #3b82f6)" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="var(--color-revenue, #3b82f6)" stopOpacity={0.05} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="4 4" />
                    <XAxis dataKey="date" tickLine={false} axisLine={false} tickMargin={8} />
                    <YAxis tickLine={false} axisLine={false} tickMargin={8} />
                    <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
                    <Area
                      type="monotone"
                      dataKey="revenue"
                      stroke="var(--color-revenue, #3b82f6)"
                      fill="url(#fillRevenue)"
                    />
                  </AreaChart>
                </ChartContainer>
              )}
            </CardContent>
          </Card>

          {/* Revenue by method bar chart */}
          <Card>
            <CardHeader>
              <CardTitle>Revenue by method</CardTitle>
              <CardDescription>Gross revenue broken down by payment method.</CardDescription>
            </CardHeader>
            <CardContent>
              {revenueChartData.length === 0 ? (
                <EmptyChart icon="bar" title="No revenue yet" hint="Revenue data will appear here once payments start coming in." />
              ) : (
                <ChartContainer config={revenueChartConfig} className="aspect-auto h-[300px] w-full">
                  <BarChart data={revenueChartData} margin={{ top: 10, right: 12, left: 12, bottom: 0 }}>
                    <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="4 4" />
                    <XAxis
                      dataKey="method"
                      tickLine={false}
                      axisLine={false}
                      tickMargin={8}
                    />
                    <YAxis
                      tickLine={false}
                      axisLine={false}
                      tickMargin={8}
                      tickFormatter={(v: number) => money(v, data.currency)}
                    />
                    <ChartTooltip
                      cursor={false}
                      content={<ChartTooltipContent formatter={(v) => money(v, data.currency)} />}
                    />
                    <Bar dataKey="amount" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ChartContainer>
              )}
            </CardContent>
          </Card>

          {/* Members by status pie chart */}
          <Card>
            <CardHeader>
              <CardTitle>Members by status</CardTitle>
              <CardDescription>Current breakdown of all members.</CardDescription>
            </CardHeader>
            <CardContent>
              {statusChartData.length === 0 ? (
                <EmptyChart icon="pie" title="No members yet" hint="Once members join your gym, their status breakdown will be displayed here." />
              ) : (
                <ChartContainer config={statusChartConfig} className="aspect-auto h-[300px] w-full">
                  <PieChart margin={{ top: 10, right: 12, left: 12, bottom: 0 }}>
                    <Pie
                      data={statusChartData}
                      dataKey="count"
                      nameKey="status"
                      cx="50%"
                      cy="50%"
                      innerRadius={70}
                      outerRadius={110}
                      strokeWidth={2}
                      stroke="var(--background)"
                    >
                      <Label
                        content={({ viewBox }) => {
                          if (viewBox && "cx" in viewBox) {
                            return (
                              <text x={viewBox.cx} y={viewBox.cy} textAnchor="middle" dominantBaseline="middle">
                                <tspan x={viewBox.cx} y={(viewBox.cy ?? 0) - 6} className="fill-[var(--foreground)] text-2xl font-bold">
                                  {data.active_members}
                                </tspan>
                                <tspan x={viewBox.cx} y={(viewBox.cy ?? 0) + 16} className="fill-[var(--muted)] text-xs">
                                  Active
                                </tspan>
                              </text>
                            );
                          }
                        }}
                      />
                    </Pie>
                    <ChartTooltip
                      cursor={false}
                      content={<ChartTooltipContent />}
                    />
                    <ChartLegend content={<ChartLegendContent />} />
                  </PieChart>
                </ChartContainer>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </>
  );
}

/* ─── StatCard ─── */

function StatCard({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
  return (
    <Card className="p-5 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between">
        <div className="min-w-0 flex-1">
          <p className="text-[13px] text-[var(--muted)]">{label}</p>
          <p className="mt-1.5 font-heading text-[30px] leading-none tabular-nums text-[var(--foreground)]">{value}</p>
        </div>
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[var(--primary-light)] text-[var(--primary)]">
          {icon}
        </div>
      </div>
    </Card>
  );
}

/* ─── Empty Chart States ─── */

const emptyBarHeights = [28, 52, 18, 42, 64, 35, 48, 22];

function EmptyChartArea() {
  return (
    <div className="relative overflow-hidden rounded-xl border border-dashed border-[var(--border)] bg-[var(--background)]/50">
      <svg className="absolute inset-0 h-full w-full" aria-hidden="true">
        <line x1="0" y1="25%" x2="100%" y2="25%" stroke="var(--border)" strokeWidth="1" strokeDasharray="4 4" />
        <line x1="0" y1="50%" x2="100%" y2="50%" stroke="var(--border)" strokeWidth="1" strokeDasharray="4 4" />
        <line x1="0" y1="75%" x2="100%" y2="75%" stroke="var(--border)" strokeWidth="1" strokeDasharray="4 4" />
      </svg>
      <div className="flex items-end justify-around gap-3 px-6 pt-8 pb-4" style={{ height: 200 }}>
        {emptyBarHeights.map((h, i) => (
          <div key={i} className="flex-1 rounded-t-md bg-[var(--border)] opacity-30" style={{ height: `${h}%` }} />
        ))}
      </div>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-[var(--primary-light)] text-[var(--primary)]">
          <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
          </svg>
        </div>
        <p className="text-sm font-semibold text-[var(--foreground)]">No revenue data yet</p>
        <p className="mt-0.5 text-xs text-[var(--foreground-muted)]">Revenue trend will appear once payments start processing.</p>
      </div>
    </div>
  );
}

function EmptyChart({ icon, title, hint }: { icon: "bar" | "pie"; title: string; hint: string }) {
  return (
    <div className="relative overflow-hidden rounded-xl border border-dashed border-[var(--border)] bg-[var(--background)]/50" style={{ minHeight: 200 }}>
      {icon === "bar" ? (
        <div className="flex items-end justify-around gap-3 px-6 pt-8 pb-4" style={{ height: 200 }}>
          {emptyBarHeights.map((h, i) => (
            <div key={i} className="flex-1 rounded-t-md bg-[var(--border)] opacity-30" style={{ height: `${h}%` }} />
          ))}
        </div>
      ) : (
        <div className="flex items-center justify-center" style={{ height: 200 }}>
          <svg className="h-28 w-28 text-[var(--border)]" viewBox="0 0 100 100" fill="none" stroke="currentColor" strokeWidth="0.5">
            <circle cx="50" cy="50" r="40" strokeDasharray="8 4" />
            <circle cx="50" cy="50" r="28" strokeDasharray="6 4" />
            <circle cx="50" cy="50" r="16" strokeDasharray="4 4" />
          </svg>
        </div>
      )}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-[var(--primary-light)] text-[var(--primary)]">
          {icon === "bar" ? (
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
            </svg>
          ) : (
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10.5 6a7.5 7.5 0 107.5 7.5h-7.5V6z" />
              <path d="M13.5 10.5H21A7.5 7.5 0 0013.5 3v7.5z" />
            </svg>
          )}
        </div>
        <p className="text-sm font-semibold text-[var(--foreground)]">{title}</p>
        <p className="mt-0.5 text-xs text-[var(--foreground-muted)]">{hint}</p>
      </div>
    </div>
  );
}
