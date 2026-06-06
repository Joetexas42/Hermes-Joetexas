// Parse a Grok/X data export (prod-grok-backend.json) into ordered
// conversations and render each as markdown for the Obsidian vault.
//
// Format: The export ZIP contains a JSON file with:
//   { "conversations": [{ "conversation": {...}, "responses": [...] }, ...] }
//
// Each response has sender "human" or "assistant", with timestamps stored as
// { "$date": { "$numberLong": "millis" } }.

export interface GrokExport {
  conversations: GrokConversationWrapper[];
}

interface GrokConversationWrapper {
  conversation: {
    id: string;
    title?: string;
    create_time?: string;   // ISO 8601
    modify_time?: string;
    media_types?: string[];
  };
  responses: GrokResponseWrapper[];
}

interface GrokResponseWrapper {
  response: {
    _id: string;
    conversation_id: string;
    message: string;
    sender: "human" | "assistant";
    create_time: { $date: { $numberLong: string } };
    parent_response_id?: string;
    model?: string;
    web_search_results?: unknown[];
  };
}

export interface ParsedMessage {
  role: "user" | "assistant";
  text: string;
  createdAt: number;  // millis epoch
  model?: string;
}

export interface ParsedConversation {
  title: string;
  createdAt: number;       // millis epoch
  updatedAt: number;
  model: string | null;
  messageCount: number;
  messages: ParsedMessage[];
}

/* ── Public: parse the export JSON ────────────────────────────────────── */
export function parseGrokExport(raw: unknown): ParsedConversation[] {
  if (!raw || typeof raw !== "object") return [];
  const data = raw as GrokExport;
  if (!Array.isArray(data.conversations)) return [];

  const out: ParsedConversation[] = [];

  for (const wrapper of data.conversations) {
    const conv = wrapper.conversation;
    const responses = wrapper.responses;
    if (!responses?.length) continue;

    // Sort responses by timestamp
    const sorted = [...responses]
      .map((r) => r.response)
      .filter((r) => r.message?.trim())
      .sort((a, b) => {
        const ta = Number(a.create_time?.$date?.$numberLong ?? 0);
        const tb = Number(b.create_time?.$date?.$numberLong ?? 0);
        return ta - tb;
      });

    if (sorted.length === 0) continue;

    const messages: ParsedMessage[] = sorted.map((r) => ({
      role: r.sender === "human" ? "user" as const : "assistant" as const,
      text: r.message.trim(),
      createdAt: Number(r.create_time?.$date?.$numberLong ?? 0),
      model: r.model || undefined,
    }));

    const firstTs = messages[0].createdAt;
    const lastTs = messages[messages.length - 1].createdAt;

    out.push({
      title: conv.title?.trim() || "Untitled Grok conversation",
      createdAt: firstTs || (conv.create_time ? new Date(conv.create_time).getTime() : 0),
      updatedAt: lastTs || (conv.modify_time ? new Date(conv.modify_time).getTime() : 0),
      model: sorted.find((r) => r.model)?.model ?? null,
      messageCount: messages.length,
      messages,
    });
  }

  // Newest first
  return out.sort((a, b) => b.updatedAt - a.updatedAt);
}

/* ── Markdown rendering ─────────────────────────────────────────────── */
function pad2(n: number): string { return String(n).padStart(2, "0"); }

function formatLocal(epochMs: number): string {
  if (!epochMs) return "";
  const d = new Date(epochMs);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

export function slugify(s: string, max = 60): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, max) || "chat";
}

export function renderMarkdown(conv: ParsedConversation): string {
  const created = formatLocal(conv.createdAt);
  const dateOnly = created.slice(0, 10);

  const front = [
    "---",
    "source: grok",
    `title: ${JSON.stringify(conv.title)}`,
    `created: ${dateOnly || "unknown"}`,
    `updated: ${formatLocal(conv.updatedAt).slice(0, 10) || "unknown"}`,
    conv.model ? `model: ${conv.model}` : "",
    `messages: ${conv.messageCount}`,
    "tags: [grok, imported]",
    "---",
    "",
  ].filter(Boolean).join("\n");

  const body = conv.messages.map((m) => {
    const who = m.role === "user" ? "You" : "Grok";
    const ts = formatLocal(m.createdAt);
    const head = `## ${who}${ts ? ` — ${ts}` : ""}`;
    return `${head}\n\n${m.text}\n`;
  }).join("\n");

  return `${front}# ${conv.title}\n\n_Imported from Grok · ${created || "unknown date"}_\n\n${body}`;
}
