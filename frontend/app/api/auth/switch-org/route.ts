import { NextRequest, NextResponse } from "next/server";
import { backend, BackendError } from "@/lib/backend";
import { clearSession, setSession } from "@/lib/session";
import type { LoginResponse } from "@/lib/types";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const data = await backend<LoginResponse>("/auth/switch-org", {
      method: "POST",
      body: { organization_id: body.organization_id },
    });

    await clearSession();
    await setSession({
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      organization_id: data.organization_id,
    });

    return NextResponse.json({ success: true });
  } catch (e) {
    const err = e as BackendError;
    return NextResponse.json(
      { detail: err.detail ?? "Failed to switch organization" },
      { status: err.status ?? 500 },
    );
  }
}
