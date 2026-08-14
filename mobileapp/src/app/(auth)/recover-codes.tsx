import { useState } from "react";
import { View } from "react-native";
import { router } from "expo-router";

import { AuthScreen } from "@/components/auth-screen";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { Field, FieldGroup } from "@/components/auth/field-group";
import { SentConfirmation } from "@/components/auth/sent-confirmation";
import { api } from "@/lib/api";
import { emailSchema } from "@/lib/validations";
import type { Message } from "@/types/api";

export default function RecoverCodes() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState("");

  const handleSubmit = async () => {
    const parsed = emailSchema.safeParse(email);
    if (!parsed.success) {
      setFieldError(parsed.error.issues[0].message);
      return;
    }

    setLoading(true);
    setError(null);
    setFieldError("");
    try {
      await api.post<Message>("/auth/recover-codes", { email });
      setSent(true);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (sent) {
    return (
      <AuthScreen title="Codes sent" back onBack={() => router.replace("/(auth)/login")}>
        <SentConfirmation
          title="Check your email"
          message={`If ${email} belongs to a member or staff account, we've sent a list of your gyms and their codes.`}
          action={
            <Button onPress={() => router.replace("/(auth)/login")}>Back to sign in</Button>
          }
        />
      </AuthScreen>
    );
  }

  return (
    <AuthScreen
      title="Find your gym code"
      subtitle="We'll email you every gym you belong to, with its code."
      back
      footer={
        <Button loading={loading} onPress={handleSubmit}>
          Email me my codes
        </Button>
      }
    >
      {error ? (
        <View className="mb-5">
          <Alert type="error" message={error} onDismiss={() => setError(null)} />
        </View>
      ) : null}

      <FieldGroup>
        <Field
          label="Email"
          placeholder="you@example.com"
          value={email}
          onChangeText={(t) => {
            setEmail(t);
            setFieldError("");
          }}
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          autoFocus
          returnKeyType="go"
          onSubmitEditing={handleSubmit}
          error={fieldError}
        />
      </FieldGroup>
    </AuthScreen>
  );
}
