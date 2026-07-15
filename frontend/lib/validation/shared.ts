// Shared validation primitives used across the auth forms (Zod).
// Field-level rules mirror the backend Pydantic schemas in
// backend/app/schemas/auth.py — keep the two in sync.
import { z } from "zod";

// Person/place names: letters (incl. accented Latin), spaces, . ' - — no digits.
export const NAME_RE = /^[A-Za-zÀ-ɏ][A-Za-zÀ-ɏ .'-]*$/;
// CNIC: 13 digits, optionally grouped 5-7-1 with dashes (e.g. 42101-1234567-8).
export const CNIC_RE = /^\d{5}-?\d{7}-?\d$/;
// Phone: optional leading +, then 7–15 digits once separators are stripped.
export const PHONE_RE = /^\+?[0-9]{7,15}$/;
// Org / gym code: 6–20 chars, uppercase letters, digits and dashes (IRON-PULS-3K9).
export const ORG_CODE_RE = /^[A-Z0-9-]{6,20}$/;

export const emailField = z.string().trim().min(1, "Required").email("Enter a valid email");

export const orgCodeField = z
  .string()
  .trim()
  .min(1, "Required")
  .regex(ORG_CODE_RE, "Enter a valid gym code");

export const mfaField = z.string().regex(/^\d{6}$/, "Enter the 6-digit code");

/**
 * Run a Zod schema and flatten field errors into a
 * `{ fieldName: firstMessage }` map matching the forms' fieldErrors shape.
 * Returns `{ success, errors, data }`.
 */
export function collectErrors<T>(
  schema: z.ZodType<T>,
  value: unknown,
): { success: boolean; errors: Record<string, string>; data?: T } {
  const result = schema.safeParse(value);
  if (result.success) return { success: true, errors: {}, data: result.data };
  const errors: Record<string, string> = {};
  for (const issue of result.error.issues) {
    const key = issue.path[0];
    if (typeof key === "string" && !errors[key]) errors[key] = issue.message;
  }
  return { success: false, errors };
}
