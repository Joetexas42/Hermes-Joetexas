// Parse a ChatGPT data export (conversations.json) into ordered conversations
// and render each as a markdown file for the Obsidian vault.
//
// Format reference (as of 2026): ChatGPT exports a ZIP. Inside, the file
// `conversations.json` is an array of conversation objects. Each conversation
// has a `mapping` keyed by message UUID; messages form a tree connected by
// `parent` / `children`. We walk that tree from the root, following the FIRST
// child of each node, to reconstruct the linear conversation the user saw.

export interface ExportedConversation {
  title?: string;
  create_time?: number;
  update_time?: number;
  default_model_slug?: string;
  mapping: Record<string, MappingNode>;
  current_node?: string;
}

interface MappingNode {
  id: string;
  parent?: string | null;
  children?: string[];
  message?: {
    id?: string;
    author?: { role?: "user" | "assistant" | "system" | "tool" };
    create_time?: number | null;
    content?: { content_type?: string; parts?: unknown[]; text?: string };
    metadata?: { model_slug?: string };
  };
}

export interface ParsedMessage {
  role: "user" | "assistant" | "system" | "tool";
  text: string;
  createdAt: number | null;
  model?: string;
}

export interface ParsedConversation {
  title: string;
  createdAt: number;       // seconds epoch
  updatedAt: number;
  model: string | null;
  messages: ParsedMessage[];
}

/* ── Walk one mapping into an ordered message list ─────────────────────── */
function partsToText(parts: unknown[] | undefined): string {
  if (!Array.isArray(parts)) return "";
  return parts
    .map((p) => {
      if (typeof p === "string") return p;
      if (p && typeof p === "object" && "text" in (p as Record<string, unknown>)) {
        return String((p as { text: unknown }).text ?? "");
      }
      // Image references etc. — note them but don't fail
      if (p && typeof p === "object" && "asset_pointer" in (p as Record<string, unknown>)) {
        return "*(image attachment — not yet imported)*";
      }
      return "";
    })
    .filter(Boolean)
    .join("\n");
}

function nodeToMessage(node: MappingNode): ParsedMessage | null {
  const m = node.message;
  if (!m || !m.author?.role) return null;
  if (m.author.role === "system" || m.author.role === "tool") return null;

  const text = m.content?.text ?? partsToText(m.content?.parts);
  if (!text.trim()) return null;

  return {
    role: m.author.role,
    text: text.trim(),
    createdAt: m.create_time ?? null,
    model: m.metadata?.model_slug,
  };
}

function walkMapping(conv: ExportedConversation): ParsedMessage[] {
  const out: ParsedMessage[] = [];
  // Find the root: parentless node, or the one called "client-created-root"
  let rootId: string | undefined;
  for (const [id, node] of Object.entries(conv.mapping)) {
    if (!node.parent) { rootId = id; break; }
  }
  if (!rootId) return out;

  // Walk: at each node, take the first child (linearizes the visible branch).
  // ChatGPT uses children[] to store regenerations; we want the path the user
  // actually saw, which by export-time is consistently the first child.
  let cursor: string | undefined = rootId;
  const seen = new Set<string>();
  while (cursor && !seen.has(cursor)) {
    seen.add(cursor);
    const node: MappingNode | undefined = conv.mapping[cursor];
    if (!node) break;
    const msg = nodeToMessage(node);
    if (msg) out.push(msg);
    cursor = node.children?.[0];
  }
  return out;
}

/* ── Public: parse an entire export JSON ────────────────────────────────── */
export function parseExport(raw: unknown): ParsedConversation[] {
  if (!Array.isArray(raw)) return [];
  const out: ParsedConversation[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const conv = item as ExportedConversation;
    if (!conv.mapping) continue;

    const messages = walkMapping(conv);
    if (messages.length === 0) continue;

    out.push({
      title:     (conv.title?.trim()) || "Untitled conversation",
      createdAt: conv.create_time ?? 0,
      updatedAt: conv.update_time ?? conv.create_time ?? 0,
      model:     conv.default_model_slug ?? null,
      messages,
    });
  }
  // Newest first
  return out.sort((a, b) => b.updatedAt - a.updatedAt);
}

/* ── Markdown rendering ─────────────────────────────────────────────────── */
function pad2(n: number): string { return String(n).padStart(2, "0"); }

function formatLocal(epochSeconds: number | null): string {
  if (!epochSeconds) return "";
  const d = new Date(epochSeconds * 1000);
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
  const updated = formatLocal(conv.updatedAt);
  const dateOnly = created.slice(0, 10);

  const front = [
    "---",
    "source: chatgpt",
    `title: ${JSON.stringify(conv.title)}`,
    `created: ${dateOnly || "unknown"}`,
    `updated: ${updated.slice(0, 10) || "unknown"}`,
    conv.model ? `model: ${conv.model}` : "",
    "tags: [chatgpt, imported]",
    "---",
    "",
  ].filter(Boolean).join("\n");

  const body = conv.messages.map((m) => {
    const who = m.role === "user" ? "You" : "ChatGPT";
    const ts  = formatLocal(m.createdAt);
    const head = `## ${who}${ts ? ` — ${ts}` : ""}`;
    return `${head}\n\n${m.text}\n`;
  }).join("\n");

  return `${front}# ${conv.title}\n\n_Imported from ChatGPT · ${created || "unknown date"}_\n\n${body}`;
}
