/**
 * Kanban board — Node 24 built-in SQLite (DatabaseSync).
 * SERVER ONLY — never import this from a client component.
 * Types live in lib/kanban.ts (safe for both sides).
 */
import "server-only";
import { DatabaseSync } from "node:sqlite";
import path from "node:path";
import { mkdirSync, existsSync } from "node:fs";
import crypto from "node:crypto";
export type { KanbanTask, KanbanStatus } from "@/lib/kanban";
import type { KanbanTask, KanbanStatus } from "@/lib/kanban";

const DATA_DIR = path.join(process.cwd(), ".data");
const DB_PATH  = path.join(DATA_DIR, "kanban.db");

/* ── DB init ─────────────────────────────────────────────────────────── */
let _db: DatabaseSync | null = null;

function db(): DatabaseSync {
  if (_db) return _db;
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
  _db = new DatabaseSync(DB_PATH);
  _db.exec(`
    CREATE TABLE IF NOT EXISTS tasks (
      id           TEXT PRIMARY KEY,
      title        TEXT NOT NULL,
      body         TEXT,
      assignee     TEXT,
      status       TEXT NOT NULL DEFAULT 'triage',
      priority     INTEGER NOT NULL DEFAULT 0,
      created_at   INTEGER NOT NULL,
      started_at   INTEGER,
      completed_at INTEGER
    );
  `);
  return _db;
}

function newId(): string {
  return "t_" + crypto.randomBytes(6).toString("hex");
}

function rowToTask(r: Record<string, unknown>): KanbanTask {
  return {
    id:           String(r.id),
    title:        String(r.title ?? ""),
    body:         (r.body as string | null) ?? null,
    assignee:     (r.assignee as string | null) ?? null,
    status:       (r.status as KanbanStatus) ?? "triage",
    priority:     Number(r.priority ?? 0),
    created_at:   Number(r.created_at ?? 0),
    started_at:   r.started_at == null ? null : Number(r.started_at),
    completed_at: r.completed_at == null ? null : Number(r.completed_at),
  };
}

/* ── CRUD ────────────────────────────────────────────────────────────── */
export function listTasks(includeArchived = true): KanbanTask[] {
  const rows = db()
    .prepare(includeArchived
      ? "SELECT * FROM tasks ORDER BY priority DESC, created_at DESC"
      : "SELECT * FROM tasks WHERE status != 'done' ORDER BY priority DESC, created_at DESC")
    .all() as Record<string, unknown>[];
  return rows.map(rowToTask);
}

export function getTask(id: string): KanbanTask | null {
  const row = db().prepare("SELECT * FROM tasks WHERE id = ?").get(id) as Record<string, unknown> | undefined;
  return row ? rowToTask(row) : null;
}

export function createTask(input: { title: string; body?: string; assignee?: string; status?: KanbanStatus; priority?: number }): KanbanTask {
  const id  = newId();
  const now = Math.floor(Date.now() / 1000);
  db().prepare(
    "INSERT INTO tasks (id, title, body, assignee, status, priority, created_at) VALUES (?,?,?,?,?,?,?)"
  ).run(id, input.title, input.body ?? null, input.assignee ?? null, input.status ?? "triage", input.priority ?? 0, now);
  return getTask(id)!;
}

export function updateTask(id: string, patch: Partial<Omit<KanbanTask, "id" | "created_at">>): KanbanTask | null {
  const task = getTask(id);
  if (!task) return null;

  const next = { ...task, ...patch };

  // Auto-set timestamps
  if (patch.status === "running" && !task.started_at) next.started_at = Math.floor(Date.now() / 1000);
  if (patch.status === "done" && !task.completed_at) next.completed_at = Math.floor(Date.now() / 1000);

  db().prepare(
    "UPDATE tasks SET title=?, body=?, assignee=?, status=?, priority=?, started_at=?, completed_at=? WHERE id=?"
  ).run(next.title, next.body, next.assignee, next.status, next.priority, next.started_at, next.completed_at, id);

  return getTask(id)!;
}

export function deleteTask(id: string): boolean {
  const r = db().prepare("DELETE FROM tasks WHERE id = ?").run(id);
  return (r.changes as number) > 0;
}

export function statsFor(): Record<KanbanStatus, number> {
  const rows = db()
    .prepare("SELECT status, COUNT(*) as c FROM tasks GROUP BY status")
    .all() as { status: string; c: number }[];
  const out = { triage: 0, todo: 0, ready: 0, running: 0, blocked: 0, done: 0 };
  for (const r of rows) if (r.status in out) (out as Record<string, number>)[r.status] = r.c;
  return out;
}
