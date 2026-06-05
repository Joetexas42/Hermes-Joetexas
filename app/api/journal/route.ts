import { NextResponse } from "next/server";
import { readStore, writeStore } from "@/lib/store";
import { saveEntry } from "@/lib/vault";
import { isLocalRequest } from "@/lib/bridge";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface JournalEntry {
  id: string;
  text: string;
  createdAt: string;
}

const load = () => readStore<JournalEntry[]>("journal", []);

export async function GET() {
  return NextResponse.json(await load());
}

export async function POST(req: Request) {
  if (!isLocalRequest(req)) return NextResponse.json({ error: "localhost-only" }, { status: 403 });
  const { text } = (await req.json().catch(() => ({}))) as { text?: string };
  if (!text?.trim()) return NextResponse.json({ error: "empty" }, { status: 400 });

  const entries = await load();
  const entry: JournalEntry = { id: crypto.randomUUID(), text: text.trim(), createdAt: new Date().toISOString() };
  entries.unshift(entry);
  await writeStore("journal", entries);
  const res = await saveEntry({ kind: "journal", text: entry.text });
  return NextResponse.json({ ...entry, saved: res.ok, file: res.file });
}
