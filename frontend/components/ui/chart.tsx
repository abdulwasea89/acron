"use client"

import * as React from "react"
import * as RechartsPrimitive from "recharts"

function cn(...inputs: (string | false | null | undefined)[]) {
  return inputs.filter(Boolean).join(" ")
}

export type ChartConfig = Record<
  string,
  { label?: React.ReactNode; icon?: React.ComponentType; color?: string }
>

const ChartContext = React.createContext<ChartConfig | null>(null)

function useChart() {
  const config = React.useContext(ChartContext)
  if (!config) throw new Error("useChart must be used within a <ChartContainer />")
  return config
}

const ChartContainer = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<"div"> & {
    config: ChartConfig
    children: React.ReactElement
  }
>(({ id, className, children, config, ...props }, ref) => {
  const uniqueId = React.useId()
  const chartId = `chart-${id || uniqueId.replace(/:/g, "")}`

  const colorVars = Object.entries(config)
    .filter(([, c]) => c.color)
    .map(([key, c]) => `--color-${key}: ${c.color};`)
    .join("\n")

  return (
    <ChartContext.Provider value={config}>
      <div
        data-chart={chartId}
        ref={ref}
        className={cn(
          "flex aspect-video justify-center text-xs [&_.recharts-cartesian-axis-tick_text]:fill-[var(--muted)] [&_.recharts-cartesian-grid_line]:stroke-[var(--border)] [&_.recharts-curve.recharts-tooltip-cursor]:stroke-[var(--border)] [&_.recharts-layer]:outline-none [&_.recharts-rectangle.recharts-tooltip-cursor]:fill-[var(--background)] [&_.recharts-sector]:outline-none [&_.recharts-surface]:outline-none",
          className,
        )}
        {...props}
      >
        <style>{`[data-chart="${chartId}"] { ${colorVars} }`}</style>
        <RechartsPrimitive.ResponsiveContainer>
          {children}
        </RechartsPrimitive.ResponsiveContainer>
      </div>
    </ChartContext.Provider>
  )
})
ChartContainer.displayName = "Chart"

const ChartTooltip = RechartsPrimitive.Tooltip

function ChartTooltipContent({
  active,
  payload,
  label,
  hideLabel,
  formatter,
}: {
  active?: boolean;
  payload?: unknown[];
  label?: string;
  hideLabel?: boolean;
  formatter?: (value: number) => string;
}) {
  if (!active || !payload?.length) return null

  const items = payload as Array<{ name?: string; value: number; color?: string; dataKey?: string }>

  return (
    <div className="grid min-w-[8rem] items-start gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-xs shadow-lg">
      {!hideLabel && label && (
        <div className="font-medium text-[var(--foreground)]">{label}</div>
      )}
      <div className="grid gap-1.5">
        {items.map((item) => (
          <div key={item.dataKey} className="flex items-center gap-2">
            <div className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: item.color }} />
            <span className="text-[var(--foreground-muted)]">{item.name}</span>
            <span className="ml-auto font-medium tabular-nums text-[var(--foreground)]">
              {formatter ? formatter(item.value) : item.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

const ChartLegend = RechartsPrimitive.Legend

function ChartLegendContent({
  payload,
}: {
  payload?: unknown[];
}) {
  if (!payload?.length) return null

  const items = payload as Array<{ value?: string; color?: string; dataKey?: string }>

  return (
    <div className="flex items-center justify-center gap-4 pt-3">
      {items.map((item) => (
        <div key={item.value} className="flex items-center gap-1.5 text-xs text-[var(--foreground-muted)]">
          <div className="h-2 w-2 shrink-0 rounded-[2px]" style={{ backgroundColor: item.color }} />
          {item.value}
        </div>
      ))}
    </div>
  )
}

export {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
}
