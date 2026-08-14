import { useRef, useState } from "react";
import { TextInput, View } from "react-native";
import { router } from "expo-router";

import { AuthScreen } from "@/components/auth-screen";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { Field, FieldGroup } from "@/components/auth/field-group";
import { SentConfirmation } from "@/components/auth/sent-confirmation";
import { api } from "@/lib/api";
import { magicLinkSchema } from "@/lib/validations";
import type { Message } from "@/types/api";

export default function MagicLink() {
  const [orgCode, setOrgCode] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const emailRef = useRef<TextInput>(null);

  const handleSend = async () => {
    setError(null);
    setFieldErrors({});

    const parse = magicLinkSchema.safeParse({ org_code: orgCode, email });
    if (!parse.success) {
      const errs: Record<string, string> = {};
      for (const issue of parse.error.issues) {
        const field = issue.path.join(".");
        if (!errs[field]) errs[field] = issue.message;
      }
      setFieldErrors(errs);
      return;
    }

    setLoading(true);
    try {
      await api.post<Message>("/auth/magic-link/request", parse.data);
      setSent(true);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (sent) {
    return (
      <AuthScreen title="Link sent" back onBack={() => router.replace("/(auth)/login")}>
        <SentConfirmation
          title="Check your email"
          message={`If ${email} manages this gym, a secure sign-in link is on its way. It expires in 15 minutes.`}
          action={
            <Button variant="secondary" onPress={() => router.replace("/(auth)/login")}>
              Back to sign in
            </Button>
          }
        />
      </AuthScreen>
    );
  }

  return (
    <AuthScreen
      title="Sign in by email"
      subtitle="We'll send a link that signs you in — no password needed."
      back
      footer={
        <Button loading={loading} onPress={handleSend}>
          Send sign-in link
        </Button>
      }
    >
      {error ? (
        <View className="mb-5">
          <Alert type="error" message={error} onDismiss={() => setError(null)} />
        </View>
      ) : null}

      <FieldGroup caption="Available to gym owners and managers.">
        <Field
          label="Gym code"
          placeholder="IRON-PULS-3K9"
          value={orgCode}
          onChangeText={(t) => {
            setOrgCode(t.toUpperCase());
            setFieldErrors((p) => ({ ...p, org_code: "" }));
          }}
          autoCapitalize="characters"
          autoCorrect={false}
          autoFocus
          returnKeyType="next"
          onSubmitEditing={() => emailRef.current?.focus()}
          submitBehavior="submit"
          error={fieldErrors.org_code}
        />
        <Field
          ref={emailRef}
          label="Email"
          placeholder="you@yourgym.com"
          value={email}
          onChangeText={(t) => {
            setEmail(t);
            setFieldErrors((p) => ({ ...p, email: "" }));
          }}
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          returnKeyType="go"
          onSubmitEditing={handleSend}
          error={fieldErrors.email}
        />
      </FieldGroup>
    </AuthScreen>
  );
}
