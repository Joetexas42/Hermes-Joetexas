/**
 * Snippet library — Node 24 built-in SQLite.
 * SERVER ONLY.
 */
import "server-only";
import { DatabaseSync } from "node:sqlite";
import path from "node:path";
import { mkdirSync, existsSync } from "node:fs";
import crypto from "node:crypto";
import type { Snippet } from "@/lib/snippet";

const DATA_DIR = path.join(process.cwd(), ".data");
const DB_PATH  = path.join(DATA_DIR, "snippets.db");

let _db: DatabaseSync | null = null;

function db(): DatabaseSync {
  if (_db) return _db;
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
  _db = new DatabaseSync(DB_PATH);
  _db.exec(`
    CREATE TABLE IF NOT EXISTS snippets (
      id         TEXT PRIMARY KEY,
      title      TEXT NOT NULL,
      code       TEXT NOT NULL,
      language   TEXT NOT NULL DEFAULT 'text',
      tags       TEXT NOT NULL DEFAULT '',
      createdAt  INTEGER NOT NULL,
      updatedAt  INTEGER NOT NULL
    )
  `);
  return _db;
}

export function listSnippets(q?: string): Snippet[] {
  const d = db();
  if (q) {
    const pattern = `%${q}%`;
    return d.prepare(`
      SELECT * FROM snippets
      WHERE title LIKE ? OR code LIKE ? OR tags LIKE ? OR language LIKE ?
      ORDER BY updatedAt DESC LIMIT 100
    `).all(pattern, pattern, pattern, pattern) as unknown as Snippet[];
  }
  return d.prepare("SELECT * FROM snippets ORDER BY updatedAt DESC LIMIT 100").all() as unknown as Snippet[];
}

export function getSnippet(id: string): Snippet | undefined {
  return db().prepare("SELECT * FROM snippets WHERE id = ?").get(id) as unknown as Snippet | undefined;
}

export function createSnippet(s: Omit<Snippet, "id" | "createdAt" | "updatedAt">): Snippet {
  const now = Date.now();
  const id = crypto.randomUUID();
  db().prepare(`
    INSERT INTO snippets (id, title, code, language, tags, createdAt, updatedAt)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(id, s.title, s.code, s.language, s.tags, now, now);
  return { id, ...s, createdAt: now, updatedAt: now };
}

export function updateSnippet(id: string, s: Partial<Omit<Snippet, "id" | "createdAt">>): Snippet | undefined {
  const existing = getSnippet(id);
  if (!existing) return undefined;
  const updated = {
    title: s.title ?? existing.title,
    code: s.code ?? existing.code,
    language: s.language ?? existing.language,
    tags: s.tags ?? existing.tags,
    updatedAt: Date.now(),
  };
  db().prepare(`
    UPDATE snippets SET title=?, code=?, language=?, tags=?, updatedAt=? WHERE id=?
  `).run(updated.title, updated.code, updated.language, updated.tags, updated.updatedAt, id);
  return { ...existing, ...updated };
}

export function deleteSnippet(id: string): boolean {
  const r = db().prepare("DELETE FROM snippets WHERE id = ?").run(id);
  return r.changes > 0;
}

export function snippetStats() {
  const d = db();
  const total = (d.prepare("SELECT COUNT(*) as c FROM snippets").get() as unknown as { c: number }).c;
  const langs = d.prepare("SELECT language, COUNT(*) as c FROM snippets GROUP BY language ORDER BY c DESC LIMIT 10").all() as unknown as { language: string; c: number }[];
  return { total, langs };
}
