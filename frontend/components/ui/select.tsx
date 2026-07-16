"use client"

import * as React from "react"

function cn(...inputs: (string | false | null | undefined)[]) {
  return inputs.filter(Boolean).join(" ")
}

const SelectContext = React.createContext<{ value?: string; onValueChange?: (v: string) => void }>({})

function Select({ value, onValueChange, children }: { value?: string; onValueChange?: (v: string) => void; children: React.ReactNode }) {
  return (
    <SelectContext.Provider value={{ value, onValueChange }}>
      <div className="relative">
        <select
          value={value}
          onChange={(e) => onValueChange?.(e.target.value)}
          className="flex h-10 w-full items-center justify-between rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--foreground)] outline-none transition-colors appearance-none cursor-pointer focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary-light)] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {children}
        </select>
        <svg
          className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted)]"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </div>
    </SelectContext.Provider>
  )
}

function SelectTrigger({ children, ...props }: { children?: React.ReactNode; [key: string]: unknown }) {
  return null as unknown as React.ReactElement
}

function SelectValue({ placeholder, ...props }: { placeholder?: string; [key: string]: unknown }) {
  return null as unknown as React.ReactElement
}

function SelectContent({ children, ...props }: { children?: React.ReactNode; [key: string]: unknown }) {
  return <>{children}</>
}

function SelectItem({ value, children, ...props }: { value: string; children?: React.ReactNode; [key: string]: unknown }) {
  return <option value={value}>{children}</option>
}

export { Select, SelectContent, SelectItem, SelectTrigger, SelectValue }
