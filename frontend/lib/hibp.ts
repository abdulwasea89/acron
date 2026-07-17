"use client";

const API = "https://api.pwnedpasswords.com/range";
const TIMEOUT_MS = 4000;

async function sha1Hex(text: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-1", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
    .toUpperCase();
}

export interface PwnedResult {
  pwned: boolean;
  count: number;
}

export async function checkPwned(password: string): Promise<PwnedResult> {
  if (!password) return { pwned: false, count: 0 };

  try {
    const hash = await sha1Hex(password);
    const prefix = hash.slice(0, 5);
    const suffix = hash.slice(5);

    const res = await fetch(`${API}/${prefix}`, {
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: { "Add-Padding": "true" },
    });

    if (!res.ok) return { pwned: false, count: 0 };

    const body = await res.text();
    for (const line of body.split("\n")) {
      const lineTrimmed = line.trim();
      if (!lineTrimmed) continue;
      const [suf, countStr] = lineTrimmed.split(":");
      if (suf?.toUpperCase() === suffix) {
        return { pwned: true, count: parseInt(countStr, 10) || 0 };
      }
    }
    return { pwned: false, count: 0 };
  } catch {
    return { pwned: false, count: 0 };
  }
}
