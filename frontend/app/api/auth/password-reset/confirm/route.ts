import { NextRequest, NextResponse } from "next/server";
import { backend, BackendError } from "@/lib/backend";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    await backend("/auth/password-reset/confirm", {
      method: "POST",
      auth: false,
      body: {
        email: body.email,
        token: body.token,
        new_password: body.new_password,
      },
    });
    return NextResponse.json({ message: "Password updated." });
  } catch (e) {
    const err = e as BackendError;
    return NextResponse.json(
      { detail: err.detail ?? "Reset failed" },
      { status: err.status ?? 500 },
    );
  }
}
