import { useState } from "react";
import { ScrollView, KeyboardAvoidingView, Platform } from "react-native";
import { View, Text, TextInput } from "@/tw";
import { router } from "expo-router";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { api, ApiError } from "@/lib/api";
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
      <View className="flex-1 items-center justify-center bg-white dark:bg-bg-dark p-6">
        <Text className="text-2xl font-bold text-gray-900 dark:text-white mb-2 text-center">
          Check your email
        </Text>
        <Text className="text-muted text-center mb-8">
          If {email} is an admin of this gym, you'll receive a sign-in link shortly.
        </Text>
        <Button variant="secondary" onPress={() => router.replace("/(auth)/login")}>
          Back to Login
        </Button>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      className="flex-1"
    >
      <ScrollView
        className="flex-1 bg-white dark:bg-bg-dark"
        contentContainerClassName="p-6 pt-20 flex-grow"
        keyboardShouldPersistTaps="handled"
      >
        <Text className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
          Magic Link
        </Text>
        <Text className="text-muted mb-8">
          Enter your gym code and email to receive a sign-in link.
        </Text>

        {error && (
          <View className="mb-4">
            <Alert type="error" message={error} onDismiss={() => setError(null)} />
          </View>
        )}

        <View className="gap-4">
          <Input
            label="Gym Code"
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
            Send Magic Link
          </Button>
        </View>

        <Button variant="ghost" onPress={() => router.back()} className="mt-6">
          Back to Login
        </Button>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
