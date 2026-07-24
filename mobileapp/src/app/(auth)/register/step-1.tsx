import { useState } from "react";
import { View, Text, Pressable } from "@/tw";
import { router } from "expo-router";
import { AuthScreen } from "@/components/auth-screen";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { api, ApiError } from "@/lib/api";
import { useRegisterStore } from "@/stores/register-store";
import { ownerSchema } from "@/lib/validations";
import type { Message } from "@/types/api";

const GENDER_OPTIONS = [
  { label: "Male", value: "male" },
  { label: "Female", value: "female" },
  { label: "Other", value: "other" },
];

export default function RegisterStep1() {
  const { setAccount } = useRegisterStore();
  const [form, setForm] = useState({
    full_name: "",
    email: "",
    password: "",
    confirm_password: "",
    cnic: "",
    phone: "",
    occupation: "",
    education: "",
    address: "",
    date_of_birth: "",
    gender: "" as string,
    city: "",
    emergency_contact: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const update = (field: string, value: string) => {
    setForm((p) => ({ ...p, [field]: value }));
    setFieldErrors((p) => ({ ...p, [field]: "" }));
  };

  const handleSubmit = async () => {
    setError(null);
    setFieldErrors({});

    const parse = ownerSchema.safeParse(form);
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
      await api.post<Message>("/auth/register", parse.data);
      setAccount(parse.data.email, parse.data.full_name);
      router.push("/(auth)/register/verify");
    } catch (e) {
      if (e instanceof ApiError) setError(e.message);
      else setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const FieldError = ({ field }: { field: string }) =>
    fieldErrors[field] ? (
      <Text className="text-sm text-danger mt-1">{fieldErrors[field]}</Text>
    ) : null;

  return (
    <AuthScreen
      title="Create your account"
      description="Tell us about yourself — you'll set up your gym in the next steps."
      back
    >
        {error && (
          <View className="mb-4">
            <Alert type="error" message={error} onDismiss={() => setError(null)} />
          </View>
        )}

        <View className="gap-4">
          <Input
            label="Full Name"
            placeholder="John Doe"
            value={form.full_name}
            onChangeText={(t) => update("full_name", t)}
            error={fieldErrors.full_name}
          />

          <Input
            label="Email"
            placeholder="you@example.com"
            value={form.email}
            onChangeText={(t) => update("email", t)}
            autoCapitalize="none"
            keyboardType="email-address"
            error={fieldErrors.email}
          />

          <Input
            label="Password"
            placeholder="At least 12 characters"
            value={form.password}
            onChangeText={(t) => update("password", t)}
            secureTextEntry
            error={fieldErrors.password}
          />

          <Input
            label="Confirm Password"
            placeholder="Repeat password"
            value={form.confirm_password}
            onChangeText={(t) => update("confirm_password", t)}
            secureTextEntry
            error={fieldErrors.confirm_password}
          />

          <Input
            label="CNIC"
            placeholder="42101-1234567-8"
            value={form.cnic}
            onChangeText={(t) => update("cnic", t)}
            error={fieldErrors.cnic}
          />

          <Input
            label="Phone"
            placeholder="+1234567890"
            value={form.phone}
            onChangeText={(t) => update("phone", t)}
            keyboardType="phone-pad"
            error={fieldErrors.phone}
          />

          <Input
            label="Occupation"
            placeholder="e.g. Business Owner"
            value={form.occupation}
            onChangeText={(t) => update("occupation", t)}
            error={fieldErrors.occupation}
          />

          <Input
            label="Education"
            placeholder="e.g. Bachelor's Degree"
            value={form.education}
            onChangeText={(t) => update("education", t)}
            error={fieldErrors.education}
          />

          <Input
            label="Address"
            placeholder="Street, city, postal code"
            value={form.address}
            onChangeText={(t) => update("address", t)}
            error={fieldErrors.address}
          />

          <Input
            label="Date of Birth"
            placeholder="YYYY-MM-DD"
            value={form.date_of_birth}
            onChangeText={(t) => update("date_of_birth", t)}
            error={fieldErrors.date_of_birth}
          />

          <View className="gap-2">
            <Text className="text-[13px] font-semibold text-ink dark:text-paper">Gender</Text>
            <View className="flex-row gap-3">
              {GENDER_OPTIONS.map((opt) => (
                <Pressable
                  key={opt.value}
                  className={`flex-1 py-3.5 rounded-xl items-center border
                    ${form.gender === opt.value
                      ? "bg-ink dark:bg-paper border-ink dark:border-paper"
                      : "bg-bg-secondary dark:bg-surface-dark-2 border-border dark:border-border-dark"
                    }`}
                  onPress={() => update("gender", opt.value)}
                >
                  <Text
                    className={`font-semibold text-[14px] ${form.gender === opt.value ? "text-paper dark:text-ink" : "text-ink dark:text-paper"}`}
                  >
                    {opt.label}
                  </Text>
                </Pressable>
              ))}
            </View>
            <FieldError field="gender" />
          </View>

          <Input
            label="City"
            placeholder="Your city"
            value={form.city}
            onChangeText={(t) => update("city", t)}
            error={fieldErrors.city}
          />

          <Input
            label="Emergency Contact"
            placeholder="Name and phone"
            value={form.emergency_contact}
            onChangeText={(t) => update("emergency_contact", t)}
            error={fieldErrors.emergency_contact}
          />

          <Button loading={loading} onPress={handleSubmit} className="mt-4">
            Continue
          </Button>
        </View>
    </AuthScreen>
  );
}
