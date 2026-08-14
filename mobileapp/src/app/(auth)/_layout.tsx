import { Stack } from "expo-router";

/**
 * Every auth screen pushes and pops along the same horizontal axis, so a step
 * you advance past returns from the direction it left — the flow reads as one
 * line of screens rather than a set of unrelated modals.
 */
export default function AuthLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: "slide_from_right",
        // iOS edge-swipe back, matching the chevron. A gesture that works only
        // on some screens of a flow is worse than one that works on none.
        gestureEnabled: true,
      }}
    >
      <Stack.Screen name="login" />
      <Stack.Screen name="register/step-1" />
      <Stack.Screen name="register/step-2" />
      <Stack.Screen name="register/step-3" />
      <Stack.Screen name="register/verify" />
      <Stack.Screen name="register/gym-details" />
      <Stack.Screen name="register/tier" />
      <Stack.Screen name="register/payment" />
      <Stack.Screen name="register/org-code" />
      <Stack.Screen name="join/verify-email" />
      <Stack.Screen name="join/set-password" />
      <Stack.Screen name="join/pick-plan" />
      <Stack.Screen name="join/pay" />
      <Stack.Screen name="forgot-password" />
      <Stack.Screen name="magic-link" />
      <Stack.Screen name="recover-codes" />
      <Stack.Screen name="redeem" />
      <Stack.Screen name="mfa" />
      <Stack.Screen name="mfa-enroll" />
    </Stack>
  );
}
