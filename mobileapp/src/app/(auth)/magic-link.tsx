import { useState } from "react";
import { View } from "@/tw";
import { router } from "expo-router";
import { AuthScreen } from "@/components/auth-screen";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
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
      <AuthScreen
        title="Check your email"
        description={`If ${email} is an admin of this gym, a secure sign-in link is on its way.`}
      >
        <Button variant="secondary" onPress={() => router.replace("/(auth)/login")}>
          Back to sign in
        </Button>
      </AuthScreen>
    );
  }

  return (
    <AuthScreen
      title="Magic link"
      description="Enter your gym code and email to receive a secure sign-in link."
      back
    >
      {error && (
        <View className="mb-5">
          <Alert type="error" message={error} onDismiss={() => setError(null)} />
        </View>
      )}

      <View className="gap-5">
        <Input
          label="Gym code"
          placeholder="IRON-PULS-3K9"
          value={orgCode}
          onChangeText={(t) => { setOrgCode(t.toUpperCase()); setFieldErrors((p) => ({ ...p, org_code: "" })); }}
          autoCapitalize="characters"
          error={fieldErrors.org_code}
        />
        <Input
          label="Email"
          placeholder="you@example.com"
          value={email}
          onChangeText={(t) => { setEmail(t); setFieldErrors((p) => ({ ...p, email: "" })); }}
          autoCapitalize="none"
          keyboardType="email-address"
          error={fieldErrors.email}
        />
        <Button loading={loading} onPress={handleSend}>
          Send magic link
        </Button>
      </View>
    </AuthScreen>
  );
}
