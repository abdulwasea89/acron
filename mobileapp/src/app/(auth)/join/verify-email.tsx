import { useState } from "react";
import { View } from "react-native";
import { router } from "expo-router";

import { AuthScreen } from "@/components/auth-screen";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { Field, FieldGroup } from "@/components/auth/field-group";
import { CodeEntry } from "@/components/auth/code-entry";
import { api, ApiError } from "@/lib/api";
import { useJoinStore } from "@/stores/join-store";
import { JOIN_FLOW, flowPosition } from "@/lib/flow";
import type { Message } from "@/types/api";

/**
 * Email entry and code confirmation, as two sub-steps of one screen.
 *
 * They stay together because they're one idea — "prove this address is yours" —
 * and splitting them across routes would make the back chevron mean "change my
 * email" on one screen and "leave the flow" on the next. Here `onBack` returns
 * to the address, which is what someone who mistyped it actually wants.
 */
export default function JoinVerifyEmail() {
  const { orgCode, orgName, setEmail, setVerified } = useJoinStore();
  const [email, setEmailLocal] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"email" | "code">("email");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState("");

  if (!orgCode) {
    router.replace("/(auth)/register/org-code");
    return null;
  }

  const handleRequestCode = async () => {
    setError(null);
    setFieldError("");
    if (!email.includes("@")) {
      setFieldError("Enter a valid email");
      return;
    }

    setLoading(true);
    try {
      await api.post<Message>("/memberships/signup/request-email", { org_code: orgCode, email });
      setEmail(email);
      setStep("code");
    } catch (e) {
      if (e instanceof ApiError) setError(e.message);
      else setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async (value: string = code) => {
    if (value.length !== 6) return;
    setError(null);
    setLoading(true);
    try {
      await api.post<Message>("/memberships/signup/verify-email", {
        org_code: orgCode,
        email,
        code: value,
      });
      setVerified();
      router.push("/(auth)/join/set-password");
    } catch (e) {
      if (e instanceof ApiError) setError(e.message);
      else setError("Network error. Please try again.");
      setCode("");
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    try {
      await api.post<Message>("/memberships/signup/request-email", { org_code: orgCode, email });
    } catch {
      // Silent — the response is identical either way, by design.
    }
  };

  const onEmailStep = step === "email";

  return (
    <AuthScreen
      title={onEmailStep ? "Your email" : "Check your email"}
      subtitle={
        onEmailStep
          ? `We'll send a code to confirm it's you joining ${orgName || "this gym"}.`
          : "The code expires in 10 minutes."
      }
      back
      onBack={() => (onEmailStep ? router.back() : setStep("email"))}
      progress={flowPosition(JOIN_FLOW, "/(auth)/join/verify-email")}
      footer={
        onEmailStep ? (
          <Button loading={loading} onPress={handleRequestCode}>
            Send code
          </Button>
        ) : (
          <Button loading={loading} disabled={code.length !== 6} onPress={() => handleVerify()}>
            Verify email
          </Button>
        )
      }
    >
      {error ? (
        <View className="mb-5">
          <Alert type="error" message={error} onDismiss={() => setError(null)} />
        </View>
      ) : null}

      {onEmailStep ? (
        <FieldGroup>
          <Field
            label="Email"
            placeholder="you@example.com"
            value={email}
            onChangeText={(t) => {
              setEmailLocal(t);
              setFieldError("");
            }}
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            autoFocus
            returnKeyType="go"
            onSubmitEditing={handleRequestCode}
            error={fieldError}
          />
        </FieldGroup>
      ) : (
        <CodeEntry
          value={code}
          onChange={setCode}
          onComplete={handleVerify}
          destination={email}
          onResend={handleResend}
          invalid={Boolean(error)}
        />
      )}
    </AuthScreen>
  );
}
