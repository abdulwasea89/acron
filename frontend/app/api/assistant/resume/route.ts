import { NextRequest, NextResponse } from "next/server";
import { backendRaw, BackendError } from "@/lib/backend";

// Streams a resumed agent run start-to-finish, exactly like
// app/api/assistant/stream. It lives in its own route because the body and the
// upstream path differ: a resume carries the human decision and hits
// /resume, where the graph continues from the checkpoint its interrupt saved.
//
// As with the stream route, the upstream body is piped through token by token;
// /api/proxy would buffer it and defeat streaming.

export async function POST(req: NextRequest) {
  // Body shape: { conversation_id, resume }. `resume` is passed to the backend
  // as-is and becomes the return value of the tool's interrupt().
  let payload: { conversation_id?: string; resume?: Record<string, unknown> };
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ detail: "Invalid request body." }, { status: 400 });
  }

  const conversationId = payload.conversation_id;
  if (!conversationId) {
    return NextResponse.json({ detail: "conversation_id is required." }, { status: 400 });
  }

  const idempotencyKey = req.headers.get("Idempotency-Key");

  let upstream: Response;
  try {
    upstream = await backendRaw(
      `/assistant/conversations/${encodeURIComponent(conversationId)}/resume`,
      {
        method: "POST",
        body: { resume: payload.resume ?? {} },
        headers: idempotencyKey ? { "Idempotency-Key": idempotencyKey } : undefined,
      },
    );
  } catch (e) {
    const err = e as BackendError;
    return NextResponse.json(
      { detail: err.detail ?? "Request failed" },
      { status: err.status ?? 500 },
    );
  }

  return new Response(upstream.body, {
    status: 200,
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
