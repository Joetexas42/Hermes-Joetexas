import { geminiChat } from "@/lib/geminiClient";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST { messages: [{ role, content }] }
 * → SSE stream: { type: "delta", text } | { type: "done" } | { type: "error", message }
 *
 * Multi-turn chat with Gemini 2.5 Flash via Google's native API.
 */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as {
    messages?: { role: "user" | "assistant" | "system"; content: string }[];
  };

  const messages = body.messages;
  if (!messages?.length) {
    return sseError("No messages provided.", 400);
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (obj: unknown) =>
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`));

      const { ok, error } = await geminiChat(messages, (token) =>
        send({ type: "delta", text: token }),
      );

      if (!ok && error) send({ type: "error", message: error });
      else send({ type: "done" });

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

function sseError(message: string, status: number) {
  const body = `data: ${JSON.stringify({ type: "error", message })}\n\n`;
  return new Response(body, {
    status,
    headers: { "Content-Type": "text/event-stream; charset=utf-8", "Cache-Control": "no-cache" },
  });
}
