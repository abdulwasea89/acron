import { NextRequest, NextResponse } from "next/server";
import { backend, BackendError } from "@/lib/backend";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    await backend("/auth/recover-codes", {
      method: "POST",
      auth: false,
      body: { email: body.email },
    });
    return NextResponse.json({ message: "If the account exists, your gym codes were sent." });
  } catch (e) {
    const err = e as BackendError;
    return NextResponse.json(
      { detail: err.detail ?? "Request failed" },
      { status: err.status ?? 500 },
    );
  }
}
