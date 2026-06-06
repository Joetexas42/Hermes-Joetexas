import { hermesChat, type ChatMessage } from "@/lib/hermesClient";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST { query }  →  SSE stream of { type: "delta", text } | { type: "done" } | { type: "error", message }
 *
 * Routes the query through Grok (via the Hermes Nous Portal proxy) with a
 * system prompt that asks Grok to search X/Twitter and summarise.
 *
 * Whether Grok has live X access through Nous Portal depends on the upstream
 * plumbing — if it does, you get real-time X posts; if it doesn't, you get
 * Grok's best from training data. Either way, the UI is the same.
 */
const GROK_MODEL = "x-ai/grok-4.3";

const SYSTEM_PROMPT = `You are Grok, with real-time access to X (formerly Twitter).
When the user gives you a search query:
1. Search X for recent posts matching that query.
2. Identify the most notable / engaging / high-signal posts.
3. Return a concise summary: what people are saying, the general sentiment, any standout posts (quote them if possible, include rough timing).
4. End with 2–3 follow-up search angles the user might explore.

If you don't have live X access at this moment, say so plainly and instead summarize what you know about the topic from training data, clearly labelled as such.
Be specific, cite numbers and names where you can. UK English.`;

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { query?: string };
  const query = body.query?.trim();

  if (!query) {
    return sseError("Empty query.", 400);
  }
  if (query.length > 2000) {
    return sseError("Query too long.", 413);
  }

  const messages: ChatMessage[] = [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "user",   content: `Search X for: ${query}` },
  ];

  const encoder = new TextEncoder();
  const stream  = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (obj: unknown) =>
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`));

      const { ok, error } = await hermesChat(
        messages,
        (token) => send({ type: "delta", text: token }),
        { model: GROK_MODEL, maxTokens: 1500 },
      );

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

function sseError(message: string, status: number) {
  const body = `data: ${JSON.stringify({ type: "error", message })}\n\n`;
  return new Response(body, {
    status,
    headers: { "Content-Type": "text/event-stream; charset=utf-8", "Cache-Control": "no-cache" },
  });
}
