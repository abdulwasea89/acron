import { NextRequest, NextResponse } from "next/server";
import { backend, BackendError } from "@/lib/backend";

// Step 1.5: verify the 6-digit email code.
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const data = await backend("/auth/verify-email", {
      method: "POST",
      auth: false,
      body: { email: body.email, code: body.code },
    });
    return NextResponse.json(data);
  } catch (e) {
    const err = e as BackendError;
    return NextResponse.json({ detail: err.detail ?? "Verification failed" }, { status: err.status ?? 500 });
  }
}
