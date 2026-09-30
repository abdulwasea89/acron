// Login & magic-link validation schemas (Zod).
// Mirror the backend Pydantic schemas LoginRequest / MagicLinkRequest /
// MagicLinkVerify in backend/app/schemas/auth.py.
import { z } from "zod";

import { emailField, orgCodeField, mfaField } from "./shared";

// Member / seat-holder invite redemption. Mirrors the backend Pydantic schema
// RedeemInvite in backend/app/schemas/memberships.py.
export const redeemMemberInviteSchema = z.object({
  orgCode: orgCodeField,
  email: emailField,
  // Codes are 43-char tokens that mail clients soft-wrap. Strip any whitespace
  // so a copy-paste out of the email body still matches.
  code: z
    .string()
    .transform((v) => v.replace(/\s+/g, ""))
    .pipe(z.string().min(1, "Invite code is required")),
  password: z
    .string()
    .min(12, "At least 12 characters")
    .regex(/[a-z]/, "Needs lowercase")
    .regex(/[A-Z]/, "Needs uppercase")
    .regex(/[0-9]/, "Needs a number")
    .regex(/[^A-Za-z0-9]/, "Needs a symbol"),
});

// Login: org code is optional (owners managing one gym can omit it).
export const loginSchema = z.object({
  email: emailField,
  password: z.string().min(1, "Password is required"),
  orgCode: orgCodeField.optional().or(z.literal("")),
});

// MFA step (login or magic-link) — a standalone 6-digit code.
export const mfaSchema = z.object({
  mfaCode: mfaField,
});

// Magic-link request: org code + email both required.
export const magicRequestSchema = z.object({
  orgCode: orgCodeField,
  email: emailField,
});

// Magic-link verify: paste the single-use token.
export const magicVerifySchema = z.object({
  token: z.string().trim().min(1, "Paste the token from your email"),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type MagicRequestInput = z.infer<typeof magicRequestSchema>;
