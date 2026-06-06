/**
 * Read the OpenRouter API key from Hermes' .env and call the OpenRouter
 * chat-completions endpoint directly. This bypasses the `hermes -z` credential
 * pool (which is empty on this install) and goes straight to the API that
 * Hermes itself is configured to use.
 *
 * Hermes home on Windows: %LOCALAPPDATA%\hermes  (NOT ~/.hermes)
 */
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import os from "node:os";

export const HERMES_HOME = path.join(
  process.env.LOCALAPPDATA ?? path.join(os.homedir(), "AppData", "Local"),
  "hermes",
);

function loadHermesEnv(): Record<string, string> {
  const envFile = path.join(HERMES_HOME, ".env");
  if (!existsSync(envFile)) return {};
  const out: Record<string, string> = {};
  try {
    for (const line of readFileSync(envFile, "utf8").split(/\r?\n/)) {
      const eq = line.indexOf("=");
      if (eq < 1 || line.startsWith("#")) continue;
      const key = line.slice(0, eq).trim();
      const val = line.slice(eq + 1).trim().replace(/^["']|["']$/g, "");
      if (key) out[key] = val;
    }
  } catch { /* best-effort */ }
  return out;
}

// Lazy — evaluated on first call so process.env is fully populated.
let _env: Record<string, string> | null = null;

export function openRouterKey(): string | null {
  if (process.env.OPENROUTER_API_KEY) return process.env.OPENROUTER_API_KEY;
  if (!_env) _env = loadHermesEnv();
  return _env["OPENROUTER_API_KEY"] ?? null;
}

/**
 * The Hermes proxy exposes an OpenAI-compatible API authenticated via Nous Portal.
 * On the local dev machine it runs on http://127.0.0.1:8645 (started via
 * `hermes proxy start`). On a remote deployment (Hostinger VPS, etc.) point at
 * the deployed proxy URL via the AGENTIC_OS_HERMES_PROXY env var.
 *
 * If no proxy URL is reachable, the chat route returns a friendly error and
 * the UI suggests using the embedded Hermes terminal at /vps-hermes instead.
 *
 * The proxy accepts any bearer token — the string "hermes" is conventional.
 */
export const PROXY_BASE  = process.env.AGENTIC_OS_HERMES_PROXY?.replace(/\/+$/, "") || "http://127.0.0.1:8645/v1";
export const PROXY_TOKEN = process.env.AGENTIC_OS_HERMES_TOKEN || "hermes";
export const HERMES_MODEL = "minimax/minimax-m2.7";

export interface ChatMessage { role: "user" | "assistant" | "system"; content: string }

/**
 * Chat via the local Hermes proxy (Nous Portal auth, OpenAI-compatible).
 * Streams tokens and calls onToken for each chunk.
 */
export async function hermesChat(
  messages: ChatMessage[],
  onToken: (token: string) => void,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(`${PROXY_BASE}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${PROXY_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: HERMES_MODEL,
        messages,
        stream: true,
        max_tokens: 2048,
      }),
    });

    if (!res.ok || !res.body) {
      const errText = await res.text().catch(() => `HTTP ${res.status}`);
      return { ok: false, error: `OpenRouter error ${res.status}: ${errText.slice(0, 300)}` };
    }

    const reader  = res.body.getReader();
    const decoder = new TextDecoder();
    let   buf     = "";

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
          const j = JSON.parse(data) as { choices?: { delta?: { content?: string } }[] };
          const token = j.choices?.[0]?.delta?.content ?? "";
          if (token) onToken(token);
        } catch { /* skip malformed */ }
      }
    }
    return { ok: true };
  } catch (e) {
    // Most common cause in the wild: the proxy URL points at localhost on a
    // deployed (VPS) instance where no proxy is running. Detect that and give
    // a useful error rather than an opaque "fetch failed".
    const msg = e instanceof Error ? e.message : String(e);
    const usingLocalhost = /127\.0\.0\.1|localhost/.test(PROXY_BASE);
    if (usingLocalhost && /fetch failed|ECONNREFUSED/i.test(msg)) {
      return {
        ok: false,
        error: "Hermes proxy not reachable. This dashboard is configured to reach a Hermes proxy at " +
               `${PROXY_BASE} but nothing is responding. On the VPS, use the Hermes·VPS terminal (/vps-hermes) — ` +
               "it's a full Hermes Agent UI and works right now.",
      };
    }
    return { ok: false, error: msg };
  }
}
