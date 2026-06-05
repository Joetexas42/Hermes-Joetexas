import { readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import os from "node:os";

const HISTORY_FILE = path.join(os.homedir(), ".agentic-os", "seo-history.json");
const MAX = 200;

export interface ArticleWritten { siteId: string; filePath: string; liveUrl?: string; }

export interface GenerateSession {
  id: string; createdAt: number; finishedAt?: number;
  keyword: string; slug: string; transcriptSource: string;
  status: "running" | "completed" | "failed" | "aborted";
  articles: ArticleWritten[]; exitCode?: number;
}

export interface DeployEvent {
  id: string; startedAt: number; finishedAt?: number;
  siteId: string; siteName: string; blogBaseUrl: string;
  status: "running" | "ok" | "failed";
  liveSlug?: string; liveUrl?: string; netlifyUrl?: string;
  durationMs?: number; errorTail?: string;
}

interface HistFile { version: 1; sessions: GenerateSession[]; deploys: DeployEvent[]; }

async function load(): Promise<HistFile> {
  if (!existsSync(HISTORY_FILE)) return { version: 1, sessions: [], deploys: [] };
  try { const p = JSON.parse(await readFile(HISTORY_FILE, "utf8")) as HistFile; return p.version ? p : { version: 1, sessions: [], deploys: [] }; }
  catch { return { version: 1, sessions: [], deploys: [] }; }
}

async function save(d: HistFile) {
  await mkdir(path.dirname(HISTORY_FILE), { recursive: true });
  d.sessions = d.sessions.slice(-MAX); d.deploys = d.deploys.slice(-MAX);
  await writeFile(HISTORY_FILE, JSON.stringify(d, null, 2), "utf8");
}

const id = () => Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 8);

export async function startSession(i: { keyword: string; slug: string; transcriptSource: string }): Promise<GenerateSession> {
  const d = await load();
  const s: GenerateSession = { id: id(), createdAt: Date.now(), ...i, status: "running", articles: [] };
  d.sessions.push(s); await save(d); return s;
}

export async function appendArticle(sessionId: string, article: ArticleWritten) {
  const d = await load();
  const s = d.sessions.find((x) => x.id === sessionId);
  if (!s) return;
  if (!s.articles.some((a) => a.filePath === article.filePath)) { s.articles.push(article); await save(d); }
}

export async function finishSession(sessionId: string, status: "completed" | "failed" | "aborted", exitCode?: number) {
  const d = await load();
  const s = d.sessions.find((x) => x.id === sessionId);
  if (!s) return;
  s.status = status; s.finishedAt = Date.now();
  if (typeof exitCode === "number") s.exitCode = exitCode;
  await save(d);
}

export async function startDeploy(i: { siteId: string; siteName: string; blogBaseUrl: string; liveSlug?: string }): Promise<DeployEvent> {
  const d = await load();
  const ev: DeployEvent = { id: id(), startedAt: Date.now(), ...i, status: "running", liveUrl: i.liveSlug ? `${i.blogBaseUrl}/blog/${i.liveSlug}/` : undefined };
  d.deploys.push(ev); await save(d); return ev;
}

export async function finishDeploy(deployId: string, fields: { status: "ok" | "failed"; netlifyUrl?: string; errorTail?: string }) {
  const d = await load();
  const ev = d.deploys.find((x) => x.id === deployId);
  if (!ev) return;
  Object.assign(ev, fields, { finishedAt: Date.now(), durationMs: Date.now() - ev.startedAt });
  await save(d);
}

export async function getHistory() {
  const d = await load();
  return { sessions: d.sessions.slice().reverse(), deploys: d.deploys.slice().reverse() };
}
