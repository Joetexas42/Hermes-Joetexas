import { NextResponse } from "next/server";
import { run } from "@/lib/runner";
import { config } from "@/lib/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Real CLI health checks — runs the actual binaries and parses their output.
 * 5-second process-level cache + in-flight coalescing so multiple open tabs /
 * rapid polls don't fork dozens of CLI processes.
 */
const CACHE_TTL_MS = 5_000;
let cached: { ts: number; body: unknown } | null = null;
let inflight: Promise<unknown> | null = null;

async function computeVitals() {
  const [claude, openclaw, hermes, gemini, antigravity, codex] = await Promise.all([
    run(config.claude,       ["--version"],  { timeoutMs: 6_000 }),
    run(config.openclaw,     ["health"],     { timeoutMs: 6_000 }),
    run(config.hermes,       ["status"],     { timeoutMs: 8_000 }),
    run(config.gemini,       ["--version"],  { timeoutMs: 6_000 }),
    run(config.antigravity,  ["--version"],  { timeoutMs: 6_000 }),
    run(config.codex,        ["--version"],  { timeoutMs: 6_000 }),
  ]);
  return { claude, openclaw, hermes, gemini, antigravity, codex };
}

export async function GET() {
  const now = Date.now();
  if (cached && now - cached.ts < CACHE_TTL_MS) {
    return NextResponse.json(cached.body, { headers: { "X-Vitals-Cache": "hit" } });
  }
  if (!inflight) {
    inflight = computeVitals().finally(() => { inflight = null; });
  }
  const { claude, openclaw, hermes, gemini, antigravity, codex } =
    (await inflight) as Awaited<ReturnType<typeof computeVitals>>;

  const body = {
    ts: Date.now(),
    claude: {
      ok: claude.ok,
      version: claude.stdout.trim() || claude.stderr.trim() || null,
      latencyMs: claude.durationMs,
      model: process.env.AGENTIC_OS_CLAUDE_MODEL ?? "claude-opus-4-8",
    },
    openclaw: (() => {
      const max = Number((openclaw.stdout.match(/max=(\d+)ms/) ?? [])[1] ?? 0);
      const p99 = Number((openclaw.stdout.match(/p99=(\d+)ms/) ?? [])[1] ?? 0);
      const reportedDegraded = /degraded/i.test(openclaw.stdout);
      const trulyDegraded = reportedDegraded && (max > 100 || p99 > 50);
      const agents = (() => {
        const m = openclaw.stdout.match(/Agents:\s*(.*)/);
        if (!m) return [];
        return m[1].split(",").map((s) => s.trim().split(/\s+/)[0]).filter(Boolean);
      })();
      const sessions = (() => {
        const m = openclaw.stdout.match(/\((\d+)\s+entries?\)/);
        return m ? Number(m[1]) : 0;
      })();
      return {
        ok: openclaw.ok,
        gateway: /Gateway event loop:/i.test(openclaw.stdout) ? "live" : "down",
        degraded: trulyDegraded,
        busy: reportedDegraded && !trulyDegraded,
        agents,
        sessions,
        latencyMs: openclaw.durationMs,
      };
    })(),
    hermes: {
      ok: hermes.ok,
      model:    (hermes.stdout.match(/Model:\s+(\S+)/)     ?? [])[1] ?? null,
      provider: (hermes.stdout.match(/Provider:\s+([^\n]+)/) ?? [])[1]?.trim() ?? null,
      latencyMs: hermes.durationMs,
    },
    gemini: {
      ok: gemini.ok,
      version: gemini.stdout.trim() || gemini.stderr.trim() || null,
      latencyMs: gemini.durationMs,
    },
    antigravity: {
      ok: antigravity.ok,
      version: antigravity.stdout.trim() || antigravity.stderr.trim() || null,
      latencyMs: antigravity.durationMs,
    },
    codex: {
      ok: codex.ok,
      version: codex.stdout.trim() || codex.stderr.trim() || null,
      latencyMs: codex.durationMs,
    },
  };

  cached = { ts: now, body };
  return NextResponse.json(body, { headers: { "X-Vitals-Cache": "miss" } });
}
