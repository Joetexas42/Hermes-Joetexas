import { hermesChat, type ChatMessage } from "@/lib/hermesClient";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST { messages: ChatMessage[], prompt?: string }
 * → Server-Sent Events  { type: "delta", text } | { type: "done" } | { type: "error", message }
 *
 * Calls OpenRouter directly using the key from Hermes' .env, streaming tokens
 * back as SSE. Multi-turn: pass the full history as `messages`.
 */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as {
    prompt?: string;
    messages?: ChatMessage[];
  };

  // Accept either a raw prompt (single-turn) or a full messages array (multi-turn)
  let messages: ChatMessage[];
  if (Array.isArray(body.messages) && body.messages.length > 0) {
    messages = body.messages;
  } else if (body.prompt?.trim()) {
    messages = [{ role: "user", content: body.prompt.trim() }];
  } else {
    return new Response(
      `data: ${JSON.stringify({ type: "error", message: "missing prompt or messages" })}\n\n`,
      { status: 400, headers: { "Content-Type": "text/event-stream" } },
    );
  }

  const encoder = new TextEncoder();
  const stream  = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (obj: unknown) =>
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`));

      const { ok, error } = await hermesChat(messages, (token) => {
        send({ type: "delta", text: token });
      });

      if (!ok && error) send({ type: "error", message: error });
      else              send({ type: "done" });

      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
