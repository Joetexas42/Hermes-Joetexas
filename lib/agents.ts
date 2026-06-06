export type AgentStatus = "live" | "stub";

export type IconKey =
  | "sparkles"
  | "feather"
  | "gem"
  | "rocket"
  | "braces"
  | "orbit";

export interface Agent {
  slug: string;
  name: string;
  tagline: string;
  /** short one-word role shown under the name in chat */
  role: string;
  /** hex accent used for dots, gradients, focus rings */
  accent: string;
  /** two-stop gradient for the avatar */
  gradient: [string, string];
  /** glyph rendered inside the avatar */
  icon: IconKey;
  status: AgentStatus;
  /** what this agent is wired to (honest description) */
  connection: string;
}

export const AGENTS: Agent[] = [
  {
    slug: "claude",
    name: "Claude",
    tagline: "Your Claude Code, live through the CLI bridge.",
    role: "Reasoning · live CLI",
    accent: "#f5a524",
    gradient: ["#f6b73c", "#e8389b"],
    icon: "sparkles",
    status: "live",
    connection: "Spawns the real claude.exe on this machine and streams it back.",
  },
  {
    slug: "openclaw",
    name: "OpenClaw",
    tagline: "Creative cockpit — image, voice, video generation via MiniMax.",
    role: "Creative studio · MiniMax",
    accent: "#e8389b",
    gradient: ["#f0468f", "#8b5cf6"],
    icon: "orbit",
    status: "live",
    connection: "Chat + Studio via MiniMax (image-01, speech-02-hd, Hailuo-2.3).",
  },
  {
    slug: "hermes",
    name: "Hermes",
    tagline: "Nous Research agent — tool calls, skills, MiniMax Studio.",
    role: "minimax/minimax-m2.7 · OpenRouter",
    accent: "#e6c69a",
    gradient: ["#e6c69a", "#c97c5e"],
    icon: "feather",
    status: "live",
    connection: "Runs via `hermes -z` CLI. MiniMax OAuth unlocks Talk + Studio.",
  },
  {
    slug: "gemini",
    name: "Gemini",
    tagline: "Google's multimodal model — Gemini 2.5 Flash.",
    role: "Gemini 2.5 Flash · Google",
    accent: "#8b5cf6",
    gradient: ["#8b5cf6", "#ec4899"],
    icon: "gem",
    status: "live",
    connection: "Streaming chat via Google Gemini API (gemini-2.5-flash).",
  },
  {
    slug: "antigravity",
    name: "Antigravity",
    tagline: "Autonomous site builder — niche research, keywords, content planning.",
    role: "Site builder · SEO strategist",
    accent: "#a78bfa",
    gradient: ["#6366f1", "#a78bfa"],
    icon: "rocket",
    status: "live",
    connection: "Chat-based SEO strategist via Hermes proxy. Plans sites, researches keywords, drafts content outlines.",
  },
  {
    slug: "codex",
    name: "Codex",
    tagline: "Save, search, and reuse code snippets and templates.",
    role: "Snippet library",
    accent: "#34d399",
    gradient: ["#10b981", "#34d399"],
    icon: "braces",
    status: "live",
    connection: "Local snippet library with SQLite storage. Search by title, language, or tag.",
  },
];

export const getAgent = (slug: string) => AGENTS.find((a) => a.slug === slug);
