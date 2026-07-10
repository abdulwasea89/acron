import { NextRequest, NextResponse } from "next/server";
import { backend, BackendError } from "@/lib/backend";
import { setSession } from "@/lib/session";
import type { LoginResponse, OrganizationOut } from "@/lib/types";

interface RegisterGymResponse {
  organization: OrganizationOut;
  access_token: string;
  refresh_token: string;
}

// Final step: create the gym (details + tier). On success the backend returns a
// session; we store it so the owner lands authenticated on the dashboard.
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const data = await backend<RegisterGymResponse>("/organizations/register", {
      method: "POST",
      auth: false,
      body: {
        owner_email: body.owner_email,
        details: body.details,
        tier: body.tier,
      },
    });
    await setSession({
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      organization_id: data.organization.id,
    });
    return NextResponse.json({ organization: data.organization });
  } catch (e) {
    const err = e as BackendError;
    return NextResponse.json({ detail: err.detail ?? "Gym registration failed" }, { status: err.status ?? 500 });
  }
}

export type { LoginResponse };
