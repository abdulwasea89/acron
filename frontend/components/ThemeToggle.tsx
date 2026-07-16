"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";

function cx(...parts: (string | false | undefined | null)[]): string {
  return parts.filter(Boolean).join(" ");
}

const OPTIONS = [
  {
    value: "system",
    label: "System",
    // monitor
    icon: "M9 17.25v1.007a3 3 0 01-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0115 18.257V17.25m6-12V15a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 15V5.25m18 0A2.25 2.25 0 0018.75 3H5.25A2.25 2.25 0 003 5.25m18 0V12a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 12V5.25",
  },
  {
    value: "light",
    label: "Light",
    // sun
    icon: "M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z",
  },
  {
    value: "dark",
    label: "Dark",
    // moon
    icon: "M21.752 15.002A9.718 9.718 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 009.002-5.998z",
  },
] as const;

function Icon({ path }: { path: string }) {
  return (
    <svg
      className="h-[15px] w-[15px]"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={path} />
    </svg>
  );
}

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  // Hydration guard: the resolved theme is only known client-side, so we render
  // inert until mounted to keep SSR and first paint in sync (next-themes docs).
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setMounted(true), []);

  return (
    <div
      role="radiogroup"
      aria-label="Theme"
      className="flex items-center gap-0.5 rounded-lg border border-[var(--border)] bg-[var(--background)] p-0.5"
    >
      {OPTIONS.map((opt) => {
        // Before mount the resolved theme is unknown; render inert so SSR and the
        // first client paint agree (next-themes anti-FOUC guidance).
        const active = mounted && theme === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={opt.label}
            title={opt.label}
            onClick={() => setTheme(opt.value)}
            className={cx(
              "inline-flex h-7 flex-1 items-center justify-center rounded-md transition-colors duration-150",
              "focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]",
              active
                ? "bg-[var(--surface)] text-[var(--foreground)] shadow-xs"
                : "text-[var(--foreground-muted)] hover:text-[var(--foreground)]",
            )}
          >
            <Icon path={opt.icon} />
          </button>
        );
      })}
    </div>
  );
}
