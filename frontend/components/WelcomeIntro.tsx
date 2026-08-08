"use client";

import { useState } from "react";
import { WELCOME_CARDS, STORAGE_KEY } from "./onboardingSteps";

function PathIcon({ path, className }: { path: string; className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={path} />
    </svg>
  );
}

export function WelcomeIntro({ onStart, onSkip }: { onStart: () => void; onSkip: () => void }) {
  const [index, setIndex] = useState(0);
  const card = WELCOME_CARDS[index];
  const isLast = index === WELCOME_CARDS.length - 1;

  return (
    <div className="pointer-events-none fixed inset-0 z-[70] flex items-center justify-center overflow-hidden px-3 py-3 sm:px-8 sm:py-6" role="dialog" aria-modal="false" aria-label="Welcome to your gym dashboard">
      <div key={card.key} className="pointer-events-auto tour-pop w-full max-w-[620px]">
        <div className="max-h-[calc(100dvh-1.5rem)] overflow-y-auto rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-[0_24px_60px_-15px_rgba(0,0,0,0.25)] sm:max-h-[calc(100dvh-3rem)] sm:p-10">
          <div className="text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-[var(--primary-light)] text-[var(--primary)] sm:h-20 sm:w-20">
              <PathIcon path={card.icon} className="h-8 w-8 sm:h-10 sm:w-10" />
            </div>
            <p className="mt-6 text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--muted)] sm:mt-8 sm:text-[11px] sm:tracking-[0.16em]">
              Welcome — here&rsquo;s how your gym software works
            </p>
            <h1 className="font-heading mt-3 text-balance text-[30px] leading-[1.05] text-[var(--foreground)] sm:text-[40px]">
              {card.title}
            </h1>
            <p className="mx-auto mt-4 max-w-lg text-sm leading-relaxed text-[var(--foreground-muted)] sm:mt-5 sm:text-[15px]">
              {card.description}
            </p>
          </div>

          {/* Progress dots */}
          <div className="mt-8 flex items-center justify-center gap-2 sm:mt-10">
            {WELCOME_CARDS.map((c, i) => (
              <button
                key={c.key}
                onClick={() => setIndex(i)}
                aria-label={`Go to step ${i + 1}`}
                className={`h-2 rounded-full transition-all duration-300 ${i === index ? "w-7 bg-[var(--primary)]" : "w-2 bg-[var(--border-strong)] hover:bg-[var(--muted)]"}`}
              />
            ))}
          </div>

          <div className="mt-7 flex flex-col-reverse items-stretch gap-3 sm:mt-8 sm:flex-row sm:items-center sm:justify-center sm:gap-2.5">
            <button
              type="button"
              onClick={onSkip}
              className="h-12 rounded-2xl px-5 text-sm font-semibold text-[var(--foreground-muted)] transition-colors hover:bg-[var(--background)] hover:text-[var(--foreground)]"
            >
              Skip for now
            </button>
            {isLast ? (
              <button
                type="button"
                onClick={onStart}
                className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-[var(--primary)] px-7 text-sm font-semibold text-[var(--primary-foreground)] shadow-sm transition-transform duration-150 hover:bg-[var(--primary-hover)] active:scale-[0.98]"
              >
                Take the guided tour
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M13 7l5 5-5 5M6 12h12" /></svg>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setIndex(index + 1)}
                className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-[var(--primary)] px-7 text-sm font-semibold text-[var(--primary-foreground)] shadow-sm transition-transform duration-150 hover:bg-[var(--primary-hover)] active:scale-[0.98]"
              >
                Next
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M13 7l5 5-5 5M6 12h12" /></svg>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export function markTourDone() {
  try {
    localStorage.setItem(STORAGE_KEY, "1");
  } catch {
    /* private mode etc. — ignore */
  }
}