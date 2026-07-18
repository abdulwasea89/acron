import { NextResponse } from "next/server";
import { getAccessToken, getOrgId } from "@/lib/session";

// Bridges the httpOnly access-token cookie to the browser WebSocket, which
// can't read cookies or set headers. Returns the short-lived (15-min) access
// token as a one-off ticket; the long-lived refresh token never leaves the server.
export async function GET() {
  const token = await getAccessToken();
  if (!token) return NextResponse.json({ detail: "unauthorized" }, { status: 401 });
  return NextResponse.json({ token, orgId: await getOrgId() });
}
