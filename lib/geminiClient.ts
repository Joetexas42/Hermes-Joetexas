/**
 * Gemini streaming client.
 *
 * Uses Google's native generateContent SSE endpoint so we don't need an
 * OpenAI-compatibility shim. The API key comes from GEMINI_API_KEY env var.
 */

const MODEL = "gemini-2.5-flash";

export interface GeminiMessage {
  role: "user" | "model";
  parts: { text: string }[];
}

/**
 * Convert our standard chat messages into Google's format.
 * "assistant" → "model", system messages get prepended to the first user turn.
 */
export function toGeminiMessages(
  msgs: { role: "user" | "assistant" | "system"; content: string }[],
): { systemInstruction?: { parts: { text: string }[] }; contents: GeminiMessage[] } {
  let systemText = "";
  const contents: GeminiMessage[] = [];

  for (const m of msgs) {
    if (m.role === "system") {
      systemText += (systemText ? "\n" : "") + m.content;
    } else {
      contents.push({
        role: m.role === "assistant" ? "model" : "user",
        parts: [{ text: m.content }],
      });
    }
  }

  return {
    ...(systemText ? { systemInstruction: { parts: [{ text: systemText }] } } : {}),
    contents,
  };
}

/**
 * Stream a Gemini chat completion. Calls onToken for each text chunk.
 */
export async function geminiChat(
  messages: { role: "user" | "assistant" | "system"; content: string }[],
  onToken: (token: string) => void,
): Promise<{ ok: boolean; error?: string }> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return { ok: false, error: "GEMINI_API_KEY not set. Add it to your .env file." };
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:streamGenerateContent?alt=sse&key=${apiKey}`;
  const { systemInstruction, contents } = toGeminiMessages(messages);

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...(systemInstruction ? { systemInstruction } : {}),
        contents,
        generationConfig: { maxOutputTokens: 4096 },
      }),
    });

    if (!res.ok || !res.body) {
      const errText = await res.text().catch(() => `HTTP ${res.status}`);
      return { ok: false, error: `Gemini API error ${res.status}: ${errText.slice(0, 300)}` };
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buf = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      const lines = buf.split("\n");
      buf = lines.pop() ?? "";
      for (const line of lines) {
        const data = line.replace(/^data:\s*/, "").trim();
        if (!data || data === "[DONE]") continue;
        try {
          const j = JSON.parse(data) as {
            candidates?: { content?: { parts?: { text?: string }[] } }[];
          };
          const token = j.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
          if (token) onToken(token);
        } catch { /* skip malformed */ }
      }
    }

    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
