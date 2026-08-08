"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { Placement, SpotlightStep } from "./onboardingSteps";

interface Rect { left: number; top: number; width: number; height: number; }

const CARD_W = 360;
const CARD_H = 170; // estimate used for placement; the real height is measured
const GAP = 18;

function waitForElement(selector: string, timeout = 4000): Promise<Element | null> {
  const started = Date.now();
  return new Promise((resolve) => {
    const probe = () => {
      const el = document.querySelector(selector);
      if (el) return resolve(el);
      if (Date.now() - started > timeout) return resolve(null);
      setTimeout(probe, 80);
    };
    probe();
  });
}

export function SpotlightTour({ steps, onFinish }: { steps: SpotlightStep[]; onFinish: () => void }) {
  const [index, setIndex] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);
  const [targetKey, setTargetKey] = useState<string | null>(null);
  const elRef = useRef<Element | null>(null);
  const cardRef = useRef<HTMLDivElement | null>(null);

  const step = steps[Math.min(index, steps.length - 1)];

  const measure = useMemo(
    () => () => {
      const el = elRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      setRect({ left: r.left, top: r.top, width: r.width, height: r.height });
    },
    [],
  );

  // Resolve the current step's target, then keep measuring on scroll/resize.
  useEffect(() => {
    let cancelled = false;
    waitForElement(step.selector).then((el) => {
      if (cancelled) return;
      elRef.current = el;
      if (el) {
        el.scrollIntoView({ block: "center", behavior: "smooth" });
        requestAnimationFrame(() => requestAnimationFrame(measure));
      }
      // Advance the display gate even when the target is hidden (small
      // screens), so the tooltip still shows in a centered fallback spot.
      setTargetKey(step.key);
    });
    return () => { cancelled = true; };
  }, [step, measure]);

  useEffect(() => {
    if (!rect) return;
    const onScroll = () => requestAnimationFrame(measure);
    window.addEventListener("resize", onScroll);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("resize", onScroll);
      window.removeEventListener("scroll", onScroll);
    };
  }, [rect, measure]);

  // Keep the (auto-height) tooltip fully inside the viewport after it lays out.
  useLayoutEffect(() => {
    const el = cardRef.current;
    if (!el) return;
    el.style.transform = "translate(0px, 0px)";
    const r = el.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    let dx = 0;
    let dy = 0;
    if (r.right > vw - 8) dx = vw - 8 - r.right;
    else if (r.left < 8) dx = 8 - r.left;
    if (r.bottom > vh - 8) dy = vh - 8 - r.bottom;
    else if (r.top < 8) dy = 8 - r.top;
    if (dx !== 0 || dy !== 0) el.style.transform = `translate(${dx}px, ${dy}px)`;
  }, [rect, step]);

  // Keyboard navigation.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") next();
      else if (e.key === "ArrowLeft") prev();
      else if (e.key === "Escape") onFinish();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, steps.length]);

  function next() {
    if (index >= steps.length - 1) onFinish();
    else setIndex(index + 1);
  }
  function prev() {
    setIndex((i) => Math.max(0, i - 1));
  }

  if (!step) return null;

  const isCurrent = targetKey === step.key;
  const total = steps.length;
  const pos = rect && isCurrent ? computePosition(rect, step.placement) : centeredFallback(step.placement);

  return (
    <div className="pointer-events-none fixed inset-0 z-[70] overflow-hidden" role="dialog" aria-modal="false" aria-label={step.title}>
      {/* Subtle ring around the element this step explains */}
      {rect && isCurrent && (
        <div
          className="tour-fade absolute z-[1] rounded-2xl transition-all duration-300 ease-out"
          style={{
            left: rect.left - 4,
            top: rect.top - 4,
            width: rect.width + 8,
            height: rect.height + 8,
            boxShadow: "0 0 0 2px var(--primary), 0 0 0 8px color-mix(in oklab, var(--primary) 10%, transparent)",
          }}
          aria-hidden="true"
        />
      )}

      {/* Tooltip card */}
      <div
        key={step.key}
        ref={cardRef}
        className="pointer-events-auto absolute z-[2]"
        style={{ left: pos.left, top: pos.top, width: pos.width }}
      >
        <div className="tour-pop relative flex h-auto flex-col rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-[0_18px_50px_-12px_rgba(0,0,0,0.28)]">
          {isCurrent && <Arrow position={pos.placement} />}
          <div className="flex items-start gap-4">
            {step.icon && (
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[var(--primary-light)] text-[var(--primary)]">
                <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d={step.icon} />
                </svg>
              </span>
            )}
            <div className="min-w-0 flex-1">
              <h3 className="text-[15px] font-bold leading-snug text-[var(--foreground)]">{step.title}</h3>
              <p className="mt-1.5 text-[13px] leading-relaxed text-[var(--foreground-muted)]">{step.description}</p>
            </div>
          </div>

          <div className="mt-4 flex items-center justify-between gap-3 pt-1">
            <div className="flex items-center gap-1.5">
              {steps.map((s, i) => (
                <span
                  key={s.key}
                  className={`h-1.5 rounded-full transition-all duration-300 ${i === index ? "w-6 bg-[var(--primary)]" : "w-1.5 bg-[var(--border-strong)]"}`}
                />
              ))}
            </div>
            <div className="flex items-center gap-2">
              {index > 0 && (
                <button
                  type="button"
                  onClick={prev}
                  aria-label="Previous step"
                  className="flex h-9 w-9 items-center justify-center rounded-xl text-[var(--foreground-muted)] transition-colors hover:bg-[var(--background)] hover:text-[var(--foreground)]"
                >
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 19l-7-7 7-7" /></svg>
                </button>
              )}
              <button
                type="button"
                onClick={next}
                className="inline-flex h-9 items-center gap-1 rounded-xl bg-[var(--primary)] px-5 text-[13px] font-semibold text-[var(--primary-foreground)] transition duration-150 hover:bg-[var(--primary-hover)] active:brightness-95"
              >
                {index === total - 1 ? "Done" : "Next"}
                {index < total - 1 && (
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M13 7l5 5-5 5M6 12h12" /></svg>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Compute where to park the tooltip relative to the focused element, flipping
// to the opposite side when there isn't enough room.
function computePosition(rect: Rect, placement: Placement) {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const width = Math.min(CARD_W, vw - 32);
  const height = CARD_H;

  let left: number;
  let top: number;
  let used = placement;

  if (placement === "right" || placement === "left") {
    const center = rect.top + rect.height / 2;
    if (placement === "right") {
      left = rect.left + rect.width + GAP;
      top = center - height / 2;
      if (left + width > vw - 8) { left = rect.left - GAP - width; used = "left"; }
    } else {
      left = rect.left - GAP - width;
      top = center - height / 2;
      if (left < 8) { left = rect.left + rect.width + GAP; used = "right"; }
    }
  } else {
    const center = rect.left + rect.width / 2;
    if (placement === "bottom") {
      left = center - width / 2;
      top = rect.top + rect.height + GAP;
      if (top + height > vh - 8) { top = rect.top - GAP - height; used = "top"; }
    } else {
      left = center - width / 2;
      top = rect.top - GAP - height;
      if (top < 8) { top = rect.top + rect.height + GAP; used = "bottom"; }
    }
  }

  left = Math.max(8, Math.min(left, vw - width - 8));
  top = Math.max(8, Math.min(top, vh - height - 8));
  return { left, top, width, height, placement: used };
}

// When no target is on screen (e.g. sidebar hidden on mobile), park the
// tooltip at the top-center of the viewport instead of skipping the step.
function centeredFallback(placement: Placement) {
  const vw = typeof window !== "undefined" ? window.innerWidth : 1024;
  const width = Math.min(CARD_W, vw - 32);
  const height = CARD_H;
  return {
    left: (vw - width) / 2,
    top: 24,
    width,
    height,
    placement,
  };
}

function Arrow({ position }: { position: Placement }) {
  const cls = "pointer-events-none absolute h-3 w-3 rotate-45 border-[var(--border)] bg-[var(--surface)]";
  const styles: Record<Placement, React.CSSProperties> = {
    right: { top: "50%", left: -7, marginTop: -6, borderStyle: "none none solid solid", borderWidth: 1 },
    left: { top: "50%", right: -7, marginTop: -6, borderStyle: "solid solid none none", borderWidth: 1 },
    bottom: { left: "50%", top: -7, marginLeft: -6, borderStyle: "none none solid solid", borderWidth: 1 },
    top: { left: "50%", bottom: -7, marginLeft: -6, borderStyle: "solid solid solid none", borderWidth: 1 },
  };
  return <span className={cls} style={styles[position]} aria-hidden="true" />;
}