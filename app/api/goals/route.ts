import { NextResponse } from "next/server";
import { readStore, writeStore } from "@/lib/store";
import { saveEntry } from "@/lib/vault";
import { isLocalRequest } from "@/lib/bridge";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface Goal {
  id: string;
  text: string;
  done: boolean;
  createdAt: string;
}

const load = () => readStore<Goal[]>("goals", []);

export async function GET() {
  return NextResponse.json(await load());
}

export async function POST(req: Request) {
  if (!isLocalRequest(req)) return NextResponse.json({ error: "localhost-only" }, { status: 403 });
  const { text } = (await req.json().catch(() => ({}))) as { text?: string };
  if (!text?.trim()) return NextResponse.json({ error: "empty" }, { status: 400 });

  const goals = await load();
  const goal: Goal = { id: crypto.randomUUID(), text: text.trim(), done: false, createdAt: new Date().toISOString() };
  goals.unshift(goal);
  await writeStore("goals", goals);
  await saveEntry({ kind: "goal", text: goal.text, event: "added" });
  return NextResponse.json(goal);
}

export async function PATCH(req: Request) {
  if (!isLocalRequest(req)) return NextResponse.json({ error: "localhost-only" }, { status: 403 });
  const { id } = (await req.json().catch(() => ({}))) as { id?: string };
  const goals = await load();
  const goal = goals.find((g) => g.id === id);
  if (!goal) return NextResponse.json({ error: "not found" }, { status: 404 });

  goal.done = !goal.done;
  await writeStore("goals", goals);
  if (goal.done) await saveEntry({ kind: "goal", text: goal.text, event: "completed" });
  return NextResponse.json(goal);
}
