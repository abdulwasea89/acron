import { NextRequest, NextResponse } from "next/server";
import { backendRaw, BackendError } from "@/lib/backend";

// The one backend call that cannot go through /api/proxy: that handler buffers
// the whole upstream body with `res.text()`, which would hold every token until
// the answer finished and defeat streaming entirely. Here the upstream body is
// piped straight through, token by token.
//
// Everything else is identical to the proxy — the auth cookie is read server
// side and the token never reaches client JavaScript.

export async function POST(req: NextRequest) {
  // Body shape: { conversation_id, content? }. `content` omitted means "answer
  // whatever the trailing user turn already is" — what the session page sends
  // on load so a new conversation starts replying without resending the prompt.
  let payload: { conversation_id?: string; content?: string };
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
      `/assistant/conversations/${encodeURIComponent(conversationId)}/stream`,
      {
        method: "POST",
        body: payload.content === undefined ? {} : { content: payload.content },
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
      // no-transform matters as much as no-cache: it tells any intermediary
      // (nginx, the Next server, a corporate proxy) not to gzip the response,
      // which it cannot do while still flushing each token as it arrives.
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
