import { z } from "zod";

const NAME_RE = /^[A-Za-zÀ-ɏ][A-Za-zÀ-ɏ .'\-]*$/;
const CNIC_RE = /^\d{5}-?\d{7}-?\d$/;
const PHONE_RE = /^\+?[0-9]{7,15}$/;

export const nameSchema = z.string().min(2).max(100).regex(NAME_RE, "May only contain letters, spaces, . ' and -");

export const emailSchema = z.string().email("Enter a valid email");

export const codeSchema = z.string().length(6).regex(/^\d{6}$/, "Enter a 6-digit code");

export const passwordSchema = z
  .string()
  .min(12, "At least 12 characters")
  .regex(/[a-z]/, "Must contain a lowercase letter")
  .regex(/[A-Z]/, "Must contain an uppercase letter")
  .regex(/[0-9]/, "Must contain a number")
  .regex(/[^a-zA-Z0-9]/, "Must contain a symbol");

export const cnicSchema = z.string().regex(CNIC_RE, "CNIC must be 13 digits (e.g. 42101-1234567-8)");

export const phoneSchema = z.string().regex(PHONE_RE, "Enter a valid phone number (7–15 digits)");

export const orgCodeSchema = z.string().min(4, "Enter a valid gym code").max(20);

// --- Owner Registration -----------------------------------------------

export const ownerSchema = z
  .object({
    full_name: nameSchema,
    email: emailSchema,
    password: passwordSchema,
    confirm_password: z.string(),
    cnic: cnicSchema,
    phone: phoneSchema,
    occupation: z.string().min(2, "Occupation is too short").max(100),
    education: z.string().min(2, "Education is too short").max(100),
    address: z.string().min(5, "Address is too short").max(200),
    date_of_birth: z.string().min(1, "Date of birth is required"),
    gender: z.enum(["male", "female", "other"]),
    city: nameSchema,
    emergency_contact: z.string().min(5, "Emergency contact is too short").max(120),
  })
  .refine((data) => data.password === data.confirm_password, {
    message: "Passwords do not match",
    path: ["confirm_password"],
  });

export const gymDetailsSchema = z.object({
  name: z.string().min(2, "Gym name is too short").max(100),
  country: z.string().default("US"),
  timezone: z.string().default("UTC"),
  default_currency: z.string().default("USD"),
  address: z.string().nullable().optional(),
  logo_url: z.string().nullable().optional(),
  accent_color: z.string().nullable().optional(),
  working_hours: z.string().nullable().optional(),
});

export const tierSchema = z.enum(["starter", "pro", "enterprise"]);

// --- Member Signup ----------------------------------------------------

export const signupStartSchema = z.object({
  org_code: orgCodeSchema,
});

export const signupEmailSchema = z.object({
  org_code: orgCodeSchema,
  email: emailSchema,
});

export const signupVerifySchema = z.object({
  org_code: orgCodeSchema,
  email: emailSchema,
  code: codeSchema,
});

export const signupPasswordSchema = z
  .object({
    password: passwordSchema,
    confirm_password: z.string(),
  })
  .refine((data) => data.password === data.confirm_password, {
    message: "Passwords do not match",
    path: ["confirm_password"],
  });

// --- Login ------------------------------------------------------------

export const loginSchema = z.object({
  org_code: z.string().optional(),
  email: emailSchema,
  password: z.string().min(1, "Password is required"),
  remember: z.boolean().default(false),
});

export const memberLoginSchema = z.object({
  org_code: orgCodeSchema,
  email: emailSchema,
  password: z.string().min(1, "Password is required"),
  remember: z.boolean().default(false),
});

// --- Magic Link -------------------------------------------------------

export const magicLinkSchema = z.object({
  org_code: orgCodeSchema,
  email: emailSchema,
});

// --- Password Reset ---------------------------------------------------

export const passwordResetSchema = z.object({
  email: emailSchema,
});

export const passwordResetConfirmSchema = z.object({
  email: emailSchema,
  token: z.string().min(1, "Token is required"),
  new_password: passwordSchema,
});

// --- MFA --------------------------------------------------------------

export const mfaCodeSchema = z.object({
  code: z.string().length(6).regex(/^\d{6}$/, "Enter a 6-digit code"),
});

export const mfaDisableSchema = z.object({
  password: z.string().min(1, "Password is required"),
});

// --- Invite -----------------------------------------------------------

export const redeemSchema = z
  .object({
    org_code: orgCodeSchema,
    email: emailSchema,
    code: z.string().min(1, "Invite code is required"),
    password: passwordSchema,
    confirm_password: z.string(),
  })
  .refine((data) => data.password === data.confirm_password, {
    message: "Passwords do not match",
    path: ["confirm_password"],
  });

// --- Recovery ---------------------------------------------------------

export const recoverCodesSchema = z.object({
  email: emailSchema,
});

// --- Profile ----------------------------------------------------------

export const profileSchema = z.object({
  full_name: nameSchema,
  phone: phoneSchema.nullable().optional(),
  emergency_contact: z.string().min(5).max(120).nullable().optional(),
});
