"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";
import { SPOTLIGHT_STEPS, STORAGE_KEY } from "./onboardingSteps";
import { WelcomeIntro, markTourDone } from "./WelcomeIntro";
import { SpotlightTour } from "./SpotlightTour";

type Phase = "hidden" | "welcome" | "spots";

const noopSubscribe = () => () => {};

function readSeen(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return true; // can't read storage → don't pester
  }
}

export function Onboarding() {
  const pathname = usePathname();

  // localStorage + window events are not available during SSR, so track
  // hydration via the store snapshot (server = false, client = true).
  const isHydrated = useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );
  const seen = useSyncExternalStore(noopSubscribe, readSeen, () => true);

  const [phase, setPhase] = useState<Phase>("hidden");

  // Start the tour automatically on the first visit, unless it was already
  // completed or the user opened it again via the Help button.
  const active: Phase =
    phase !== "hidden" ? phase : isHydrated && !seen ? "welcome" : "hidden";

  // Spotlight steps are filtered to the current page so sidebar steps work
  // everywhere while dashboard-specific steps only run on /app.
  const spotSteps = useMemo(
    () => SPOTLIGHT_STEPS.filter((s) => !s.onlyOn || (pathname ?? "").startsWith(s.onlyOn)),
    [pathname],
  );

  function finish() {
    markTourDone();
    setPhase("hidden");
  }

  return (
    <>
      <HelpButton onClick={() => setPhase("welcome")} />
      {active === "welcome" && <WelcomeIntro onStart={() => setPhase("spots")} onSkip={finish} />}
      {active === "spots" && spotSteps.length > 0 && <SpotlightTour steps={spotSteps} onFinish={finish} />}
    </>
  );
}

function HelpButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      data-tour="help"
      onClick={onClick}
      aria-label="Replay the onboarding tour"
      title="Replay the tour"
      className="fixed bottom-6 right-6 z-50 flex h-12 w-12 items-center justify-center rounded-full bg-[var(--primary)] text-[var(--primary-foreground)] shadow-lg transition-transform duration-150 hover:scale-105 active:scale-95"
    >
      <span className="tour-pulse-ring pointer-events-none absolute inset-0 rounded-full" aria-hidden="true" />
      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.362-1.45.898-1.451 1.866v.276M12 21h.01M19.5 12a7.5 7.5 0 11-15 0 7.5 7.5 0 0115 0z" />
      </svg>
    </button>
  );
}