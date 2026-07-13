import { NextRequest, NextResponse } from "next/server";
import { backend, BackendError } from "@/lib/backend";

// Magic-link Method B (Section 5.4): email an admin a single-use sign-in link.
// No session is set here — the link's token is exchanged in /verify.
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const data = await backend("/auth/magic-link/request", {
      method: "POST",
      auth: false,
      body: { org_code: body.org_code, email: body.email },
    });
    return NextResponse.json(data);
  } catch (e) {
    const err = e as BackendError;
    return NextResponse.json({ detail: err.detail ?? "Request failed" }, { status: err.status ?? 500 });
  }
}
