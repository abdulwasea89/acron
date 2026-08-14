/**
 * Sign-up flow maps.
 *
 * Both onboarding paths span several screens, and a person part-way through one
 * needs to know two things: how much is left, and what the current screen is
 * called. Keeping the running order here — rather than hardcoding "Step 2 of 5"
 * into each screen — means inserting or reordering a screen updates every
 * progress rail at once.
 */

export interface FlowStep {
  /** Short phase name shown beside the progress rail. */
  label: string;
  /** Route this step lives at, for cross-checking against the router. */
  route: string;
}

/** Owner registration: account details, then the gym, then billing. */
export const OWNER_FLOW: FlowStep[] = [
  { label: "Your account", route: "/(auth)/register/step-1" },
  { label: "About you", route: "/(auth)/register/step-2" },
  { label: "A few more details", route: "/(auth)/register/step-3" },
  { label: "Verify your email", route: "/(auth)/register/verify" },
  { label: "Your gym", route: "/(auth)/register/gym-details" },
  { label: "Choose a plan", route: "/(auth)/register/tier" },
  { label: "Payment", route: "/(auth)/register/payment" },
];

/** Member signup: find the gym, prove the email, set a password, pay. */
export const JOIN_FLOW: FlowStep[] = [
  { label: "Find your gym", route: "/(auth)/register/org-code" },
  { label: "Verify your email", route: "/(auth)/join/verify-email" },
  { label: "Create a password", route: "/(auth)/join/set-password" },
  { label: "Choose a plan", route: "/(auth)/join/pick-plan" },
  { label: "Payment", route: "/(auth)/join/pay" },
];

export interface FlowPosition {
  /** 1-based index of the current step. */
  step: number;
  total: number;
  label: string;
}

/**
 * Position of `route` within `flow`, or `null` when the route isn't part of it
 * (so a screen shared between flows can simply render no rail).
 */
export function flowPosition(flow: FlowStep[], route: string): FlowPosition | null {
  const index = flow.findIndex((s) => s.route === route);
  if (index === -1) return null;

  return { step: index + 1, total: flow.length, label: flow[index].label };
}
