// Shared types — safe to import from both client and server components.

export type KanbanStatus = "triage" | "todo" | "ready" | "running" | "blocked" | "done";

export interface KanbanTask {
  id: string;
  title: string;
  body: string | null;
  assignee: string | null;
  status: KanbanStatus;
  priority: number;
  created_at: number;
  started_at: number | null;
  completed_at: number | null;
}

export const COLUMNS: { key: KanbanStatus; label: string; accent: string }[] = [
  { key: "triage",  label: "Triage",  accent: "#a855f7" },
  { key: "todo",    label: "Todo",    accent: "#94a3b8" },
  { key: "ready",   label: "Ready",   accent: "#22d3ee" },
  { key: "running", label: "Running", accent: "#fbbf24" },
  { key: "blocked", label: "Blocked", accent: "#f87171" },
  { key: "done",    label: "Done",    accent: "#86efac" },
];

export const STATUS_COLOR: Record<KanbanStatus, string> = {
  triage: "#a855f7", todo: "#94a3b8", ready: "#22d3ee",
  running: "#fbbf24", blocked: "#f87171", done: "#86efac",
};
