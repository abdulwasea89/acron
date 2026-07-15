import { NextRequest, NextResponse } from "next/server";
import { backend, BackendError } from "@/lib/backend";
import { clearSession, setSession } from "@/lib/session";
import type { SaasTier } from "@/lib/types";

interface CreateGymBody {
  details: {
    name: string;
    country?: string;
    timezone?: string;
    default_currency?: string;
    address?: string | null;
    logo_url?: string | null;
    accent_color?: string | null;
    working_hours?: string | null;
  };
  tier: SaasTier;
  payment_token?: string;
}

interface CreateGymResponse {
  organization: {
    id: string;
    name: string;
    org_code: string;
    saas_tier: string;
    saas_status: string;
    enrollment_mode: string;
    gym_status: string;
    member_cap: number | null;
    stripe_connect_status: string;
    accent_color: string | null;
    logo_url: string | null;
  };
  access_token: string;
  refresh_token: string;
  token_type: string;
}

export async function POST(req: NextRequest) {
  try {
    const body: CreateGymBody = await req.json();
    const data = await backend<CreateGymResponse>("/organizations/create", {
      method: "POST",
      body,
    });

    await clearSession();
    await setSession({
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      organization_id: data.organization.id,
    });

    return NextResponse.json({ organization: data.organization });
  } catch (e) {
    const err = e as BackendError;
    return NextResponse.json(
      { detail: err.detail ?? "Failed to create gym" },
      { status: err.status ?? 500 },
    );
  }
}
