import { NextRequest, NextResponse } from "next/server";
import { backend, BackendError } from "@/lib/backend";
import { setSession } from "@/lib/session";
import type { LoginResponse } from "@/lib/types";

// Owner/admin login. Proxies to the backend, then stores tokens in httpOnly
// cookies so the browser never handles them directly.
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const data = await backend<LoginResponse>("/auth/login", {
      method: "POST",
      auth: false,
      body: {
        email: body.email,
        password: body.password,
        org_code: body.org_code || null,
        remember: Boolean(body.remember),
        mfa_code: body.mfa_code || null,
      },
    });

    // MFA challenge: don't set a session, let the client prompt for a code.
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
      organizations: data.organizations ?? null,
    });
  } catch (e) {
    const err = e as BackendError;
    return NextResponse.json({ detail: err.detail ?? "Login failed" }, { status: err.status ?? 500 });
  }
}
