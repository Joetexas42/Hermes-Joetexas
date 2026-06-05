import { promises as fs } from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const STATE_FILE = path.join(process.cwd(), ".swarm-state.json");

/* ── Data model ──────────────────────────────────────────────────────── */
export type Topology = "hierarchical" | "flat" | "sequential";
export type AgentStatus = "idle" | "running" | "done" | "error";

export interface SwarmAgent {
  id: string;
  role: string;          // "researcher", "architect", "coder", …
  model: string;         // "haiku" | "sonnet" | "opus"
  status: AgentStatus;
  output: string;
}

export interface SwarmRun {
  id: string;
  prompt: string;
  startedAt: number;
  doneAt?: number;
  status: "running" | "done" | "error";
  events: { agentId: string; role: string; text: string; ts: number }[];
}

export interface SwarmState {
  name: string;
  topology: Topology;
  agents: SwarmAgent[];
  activeRun: SwarmRun | null;
}

const DEFAULT: SwarmState = {
  name: "RUFLO",
  topology: "hierarchical",
  agents: [
    { id: "a1", role: "researcher",   model: "haiku",  status: "idle", output: "" },
    { id: "a2", role: "researcher",   model: "haiku",  status: "idle", output: "" },
    { id: "a3", role: "researcher",   model: "haiku",  status: "idle", output: "" },
    { id: "a4", role: "researcher",   model: "haiku",  status: "idle", output: "" },
    { id: "a5", role: "architect",    model: "sonnet", status: "idle", output: "" },
    { id: "a6", role: "architect",    model: "sonnet", status: "idle", output: "" },
    { id: "a7", role: "architect",    model: "opus",   status: "idle", output: "" },
    { id: "a8", role: "coder",        model: "sonnet", status: "idle", output: "" },
    { id: "a9", role: "coder",        model: "sonnet", status: "idle", output: "" },
    { id: "a10", role: "frontend-dev", model: "sonnet", status: "idle", output: "" },
    { id: "a11", role: "reviewer",    model: "sonnet", status: "idle", output: "" },
    { id: "a12", role: "reviewer",    model: "haiku",  status: "idle", output: "" },
    { id: "a13", role: "reviewer",    model: "haiku",  status: "idle", output: "" },
    { id: "a14", role: "seo-specialist", model: "sonnet", status: "idle", output: "" },
    { id: "a15", role: "researcher",  model: "haiku",  status: "idle", output: "" },
    { id: "a16", role: "researcher",  model: "haiku",  status: "idle", output: "" },
    { id: "a17", role: "researcher",  model: "haiku",  status: "idle", output: "" },
    { id: "a18", role: "researcher",  model: "haiku",  status: "idle", output: "" },
    { id: "a19", role: "architect",   model: "sonnet", status: "idle", output: "" },
    { id: "a20", role: "researcher",  model: "haiku",  status: "idle", output: "" },
  ],
  activeRun: null,
};

/* ── Persistence ─────────────────────────────────────────────────────── */
export async function getSwarm(): Promise<SwarmState> {
  try {
    const raw = await fs.readFile(STATE_FILE, "utf8");
    return { ...DEFAULT, ...JSON.parse(raw) };
  } catch {
    return structuredClone(DEFAULT);
  }
}

export async function setSwarm(patch: Partial<SwarmState>): Promise<SwarmState> {
  const current = await getSwarm();
  const next = { ...current, ...patch };
  await fs.writeFile(STATE_FILE, JSON.stringify(next, null, 2), "utf8");
  return next;
}

export async function patchAgents(agents: SwarmAgent[]): Promise<SwarmState> {
  return setSwarm({ agents });
}

export async function resetStatuses(): Promise<SwarmState> {
  const s = await getSwarm();
  return setSwarm({
    agents: s.agents.map((a) => ({ ...a, status: "idle", output: "" })),
    activeRun: null,
  });
}

export function makeId(): string {
  return crypto.randomBytes(6).toString("hex");
}

/** Map model nickname to full model id for Hermes Nous proxy */
export const MODEL_MAP: Record<string, string> = {
  haiku:  "~anthropic/claude-haiku-latest",
  sonnet: "minimax/minimax-m2.7",   // fastest model confirmed working on this proxy
  opus:   "anthropic/claude-opus-4.8",
};

export const ROLE_PROMPTS: Record<string, string> = {
  researcher:     "You are a focused research assistant. Extract key facts and insights relevant to the task. Be concise.",
  architect:      "You are a systems architect. Design clear, scalable solutions. Respond with structured plans.",
  coder:          "You are an expert programmer. Write clean, working code with brief explanations.",
  "frontend-dev": "You are a frontend developer specializing in React and Tailwind. Produce polished UI code.",
  reviewer:       "You are a code reviewer. Identify issues, improvements, and best practices. Be concise.",
  "seo-specialist": "You are an SEO specialist. Analyse and improve content for search visibility.",
  writer:         "You are a technical writer. Produce clear, structured documentation.",
};
