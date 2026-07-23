import { Stack } from "expo-router";

export default function AuthLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="login" />
      <Stack.Screen name="register/step-1" />
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
