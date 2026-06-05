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
    tagline: "Creative cockpit — image, voice, video, X-search.",
    role: "Creative studio",
    accent: "#e8389b",
    gradient: ["#f0468f", "#8b5cf6"],
    icon: "orbit",
    status: "stub",
    connection: "Not connected yet. Tell me what OpenClaw exposes and I'll wire it.",
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
    tagline: "Google's multimodal model.",
    role: "Multimodal",
    accent: "#8b5cf6",
    gradient: ["#8b5cf6", "#ec4899"],
    icon: "gem",
    status: "stub",
    connection: "Not connected yet. Add a GEMINI_API_KEY and I'll bridge it.",
  },
  {
    slug: "antigravity",
    name: "Antigravity",
    tagline: "Autonomous build agent.",
    role: "Autonomous builder",
    accent: "#a78bfa",
    gradient: ["#6366f1", "#a78bfa"],
    icon: "rocket",
    status: "stub",
    connection: "Not connected yet.",
  },
  {
    slug: "codex",
    name: "Codex",
    tagline: "Code generation & refactors.",
    role: "Code generation",
    accent: "#34d399",
    gradient: ["#10b981", "#34d399"],
    icon: "braces",
    status: "stub",
    connection: "Not connected yet.",
  },
];

export const getAgent = (slug: string) => AGENTS.find((a) => a.slug === slug);
