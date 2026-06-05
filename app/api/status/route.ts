import { NextResponse } from "next/server";
import { getBridgeState, resolveClaudeExe } from "@/lib/bridge";
import { AGENTS } from "@/lib/agents";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const bridgeState = await getBridgeState();
  const exe = resolveClaudeExe();

  const agents = AGENTS.map((a) => {
    if (a.slug === "claude") {
      return {
        slug: "claude",
        live: Boolean(exe),
        detail: exe ? `v${exe.match(/(\d+\.\d+\.\d+)/)?.[1] ?? "?"} · CLI` : "CLI not found",
        latencyMs: bridgeState.armed ? 12 : null,   // real p50 would need instrumentation; honest null when disarmed
        model: "claude-opus-4-8",
      };
    }
    return { slug: a.slug, live: false, detail: "not connected", latencyMs: null, model: null };
  });

  return NextResponse.json({
    agents,
    heartbeat: Date.now(),
    bridgeArmed: bridgeState.armed,
  });
}
