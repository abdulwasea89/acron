// Onboarding tour content + target selectors. Steps carry an optional
// `onlyOn` path so they only run on matching routes; sidebar-based steps run
// everywhere. Targets are real DOM elements marked with `data-tour="…"`.

export type Placement = "top" | "right" | "bottom" | "left";

export interface WelcomeCard {
  key: string;
  icon: string; // SVG path data, rendered inside a 24x24 stroke icon
  title: string;
  description: string;
  tilt: string; // rotation used by the float animation
  floatDur: string; // seconds per float cycle
}

export interface SpotlightStep {
  key: string;
  selector: string;
  title: string;
  description: string;
  placement: Placement;
  onlyOn?: string; // route prefix restriction; omit = any authenticated page
  icon?: string;
}

export const WELCOME_CARDS: WelcomeCard[] = [
  {
    key: "overview",
    icon: "M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-4 0a1 1 0 01-1-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 01-1 1",
    title: "Your gym, at a glance",
    description:
      "This is your command center. Headline numbers, pending approvals, and the setup checklist live on the Dashboard so you always know what needs your attention.",
    tilt: "1.5deg",
    floatDur: "5.2s",
  },
  {
    key: "plans",
    icon: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4",
    title: "Plans & members",
    description:
      "Build membership plans, set pricing, and grow your directory. Import members by CSV, invite them, and track each person's status independently.",
    tilt: "-1deg",
    floatDur: "4.4s",
  },
  {
    key: "money",
    icon: "M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z",
    title: "Payments, cash & receipts",
    description:
      "Card payments go straight to your gym via Stripe Connect. Log cash at the front desk, and the AI verifies receipt uploads automatically — no double charges, no lost cash.",
    tilt: "2deg",
    floatDur: "5.8s",
  },
  {
    key: "people",
    icon: "M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z",
    title: "Staff & payroll",
    description:
      "Manage trainers and front-desk staff, run fixed, hourly, per-class and commission payroll, and check that every run before it's locked and paid.",
    tilt: "-1.5deg",
    floatDur: "4.9s",
  },
];

export const SPOTLIGHT_STEPS: SpotlightStep[] = [
  {
    key: "nav",
    selector: "[data-tour='nav-dashboard']",
    title: "Everything lives here",
    description:
      "The left rail is your whole gym. Jump between members, plans, payments, cash, receipts, staff, payroll and more from here.",
    placement: "right",
    icon: "M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-4 0a1 1 0 01-1-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 01-1 1",
  },
  {
    key: "org",
    selector: "[data-tour='org']",
    title: "Your gym's context",
    description:
      "See which gym you're in, switch between multiple gyms, and flip the open / closed sign for your members in one tap.",
    placement: "right",
    icon: "M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75",
  },
  {
    key: "stats",
    selector: "[data-tour='stats']",
    title: "Today at a glance",
    description:
      "Active members, today's revenue, check-ins and pending approvals. Click into the full analytics page for charts and exports.",
    placement: "bottom",
    onlyOn: "/app",
    icon: "M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z",
  },
  {
    key: "checklist",
    selector: "[data-tour='checklist']",
    title: "Get fully live",
    description:
      "The setup checklist is your launch path: connect Stripe to collect payments, publish a plan, and invite staff. Finish it and members can sign up.",
    placement: "bottom",
    onlyOn: "/app",
    icon: "M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z",
  },
  {
    key: "help",
    selector: "[data-tour='help']",
    title: "Need a refresher?",
    description:
      "This button in the corner reopens the welcome tour any time — come back to it whenever something is new.",
    placement: "left",
    icon: "M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.362-1.45.898-1.451 1.866v.276M12 21h.01M19.5 12a7.5 7.5 0 11-15 0 7.5 7.5 0 0115 0z",
  },
];

export const STORAGE_KEY = "gym:onboarding:v1";