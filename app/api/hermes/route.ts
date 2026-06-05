import { NextResponse } from "next/server";
import { run } from "@/lib/runner";
import { config } from "@/lib/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ACTIONS = {
  status:   ["status"],
  sessions: ["sessions", "list"],
  doctor:   ["doctor"],
  skills:   ["skills", "list"],
} as const;

type Action = keyof typeof ACTIONS;

const ANSI = /\x1b\[[0-9;?]*[a-zA-Z]|\x1b\]\d+;[^\x07\x1b]*(\x07|\x1b\\)/g;

export async function GET(req: Request) {
  const action = (new URL(req.url).searchParams.get("action") ?? "status") as Action;
  const args = ACTIONS[action];
  if (!args) return NextResponse.json({ error: "unknown action" }, { status: 400 });
  const out = await run(config.hermes, [...args], { timeoutMs: 10_000 });
  return NextResponse.json({
    action,
    ok: out.ok,
    text: out.stdout.replace(ANSI, "").trim(),
    durationMs: out.durationMs,
  });
}
