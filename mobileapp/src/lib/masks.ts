/**
 * Input masks for fields with a fixed shape.
 *
 * A placeholder showing `42101-1234567-8` tells you the format; a mask means
 * you can't get it wrong. Each of these is applied on every keystroke, so they
 * take whatever is currently in the field — including a partial value mid-type
 * and a value the user is backspacing through — and return the best-formed
 * version of it. They never reject input, only shape it; validation stays with
 * the zod schemas.
 */

/** `42101-1234567-8` — 5 digits, 7 digits, 1 check digit. */
export function maskCnic(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 13);
  if (digits.length <= 5) return digits;
  if (digits.length <= 12) return `${digits.slice(0, 5)}-${digits.slice(5)}`;
  return `${digits.slice(0, 5)}-${digits.slice(5, 12)}-${digits.slice(12)}`;
}

/** `YYYY-MM-DD`, the format the backend's `date` field parses. */
export function maskDate(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 8);
  if (digits.length <= 4) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 4)}-${digits.slice(4)}`;
  return `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6)}`;
}

/** Digits and a single leading `+`, which is all `phoneSchema` accepts. */
export function maskPhone(value: string): string {
  const plus = value.trimStart().startsWith("+");
  const digits = value.replace(/\D/g, "").slice(0, 15);
  return plus ? `+${digits}` : digits;
}
