import { NextRequest, NextResponse } from "next/server";
import { backend, BackendError } from "@/lib/backend";
import { setSession } from "@/lib/session";
import type { LoginResponse } from "@/lib/types";

// Magic-link Method B (Section 5.4): exchange the emailed token for a session.
// On success, tokens land in httpOnly cookies (same as password login).
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const data = await backend<LoginResponse>("/auth/magic-link/verify", {
      method: "POST",
      auth: false,
      body: {
        org_code: body.org_code,
        email: body.email,
        token: body.token,
        remember: Boolean(body.remember),
        mfa_code: body.mfa_code || null,
      },
    });

    // MFA challenge (Section 5.5): still applies after a magic link.
    if (data.requires_mfa) {
      return NextResponse.json({ requires_mfa: true });
    }

    await setSession({
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      organization_id: data.organization_id,
    });
    return NextResponse.json({
      requires_mfa: false,
      organization_id: data.organization_id,
      role: data.role,
    });
  } catch (e) {
    const err = e as BackendError;
    return NextResponse.json({ detail: err.detail ?? "Sign-in failed" }, { status: err.status ?? 500 });
  }
}
