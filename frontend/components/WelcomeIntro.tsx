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
    <div className="tour-fixed fixed inset-0 z-[70] flex items-center justify-center overflow-hidden bg-black/75 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="Welcome to your gym dashboard">
      {/* Decorative floating cards in the corners */}
      <Decorative exclude={card.key} />

      <div key={card.key} className="tour-pop relative w-[min(540px,100%)]">
        <div
          className="tour-float relative overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-2xl"
          style={{ "--tilt": "0deg", "--float-dur": "6s" } as React.CSSProperties}
        >
          <div className="h-1.5 w-full bg-gradient-to-r from-[var(--primary)] via-[var(--accent)] to-[var(--primary)]" />
          <div className="p-8 text-center">
            <div className="tour-float mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-[var(--primary-light)] text-[var(--primary)] shadow-sm" style={{ "--tilt": "0deg", "--float-dur": "4s" } as React.CSSProperties}>
              <PathIcon path={card.icon} className="h-8 w-8" />
            </div>
            <p className="mt-5 text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--muted)]">
              How your gym software works
            </p>
            <h1 className="font-heading mt-2 text-[34px] leading-none text-[var(--foreground)]">
              {card.title}
            </h1>
            <p className="mx-auto mt-4 max-w-md text-sm leading-relaxed text-[var(--foreground-muted)]">
              {card.description}
            </p>

            {/* Progress dots */}
            <div className="mt-6 flex items-center justify-center gap-1.5">
              {WELCOME_CARDS.map((c, i) => (
                <button
                  key={c.key}
                  onClick={() => setIndex(i)}
                  aria-label={`Go to step ${i + 1}`}
                  className={`h-1.5 rounded-full transition-all duration-300 ${i === index ? "w-6 bg-[var(--primary)]" : "w-1.5 bg-[var(--border-strong)] hover:bg-[var(--muted)]"}`}
                />
              ))}
            </div>

            <div className="mt-7 flex items-center justify-center gap-2.5">
              <button
                type="button"
                onClick={onSkip}
                className="h-10 rounded-[10px] px-4 text-sm font-semibold text-[var(--foreground-muted)] transition-colors hover:bg-[var(--background)] hover:text-[var(--foreground)]"
              >
                Skip
              </button>
              {!isLast && (
                <button
                  type="button"
                  onClick={() => setIndex(index + 1)}
                  className="inline-flex h-10 items-center gap-1.5 rounded-[10px] bg-[var(--primary)] px-5 text-sm font-semibold text-[var(--primary-foreground)] shadow-sm transition duration-150 hover:bg-[var(--primary-hover)] active:brightness-95"
                >
                  Next
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m13 7 5 5-5 5M6 12h12" /></svg>
                </button>
              )}
              {isLast && (
                <button
                  type="button"
                  onClick={onStart}
                  className="inline-flex h-10 items-center gap-1.5 rounded-[10px] bg-[var(--primary)] px-5 text-sm font-semibold text-[var(--primary-foreground)] shadow-sm transition-transform duration-150 hover:bg-[var(--primary-hover)] active:brightness-95"
                >
                  Take the tour
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M13 7l5 5-5 5M6 12h12" /></svg>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Decorative({ exclude }: { exclude: string }) {
  const others = WELCOME_CARDS.filter((c) => c.key !== exclude).slice(0, 2);
  return (
    <>
      {others.map((c, i) => (
        <div
          key={c.key}
          aria-hidden="true"
          className={`absolute hidden lg:flex h-20 w-20 items-center justify-center rounded-2xl border border-[var(--border)] bg-[var(--surface)]/90 text-[var(--primary)] shadow-xl backdrop-blur ${i === 0 ? "left-[10%] top-[22%]" : "right-[12%] bottom-[18%]"}`}
          style={{ "--tilt": c.tilt, "--float-dur": c.floatDur } as React.CSSProperties}
        >
          <PathIcon path={c.icon} className="h-9 w-9" />
        </div>
      ))}
      <div
        aria-hidden="true"
        className="tour-float absolute bottom-[16%] left-[18%] hidden rounded-full bg-[var(--primary)]/10 px-3 py-1.5 text-xs font-semibold text-[var(--primary)] lg:block"
        style={{ "--tilt": "-2deg", "--float-dur": "7s" } as React.CSSProperties}
      >
        {WELCOME_CARDS.length} core flows
      </div>
    </>
  );
}

export function markTourDone() {
  try {
    localStorage.setItem(STORAGE_KEY, "1");
  } catch {
    /* private mode etc. — ignore */
  }
}