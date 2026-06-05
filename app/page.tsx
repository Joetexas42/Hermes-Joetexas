"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { useState } from "react";
import { ArrowUpRight, Brain } from "lucide-react";
import { AGENTS } from "@/lib/agents";
import { Avatar } from "@/components/Avatar";
import { usePollWhileVisible } from "@/lib/usePollWhileVisible";

/* ─── types from /api/vitals ─── */
interface Vitals {
  ts: number;
  claude:      { ok: boolean; version: string | null; latencyMs: number; model: string };
  openclaw:    { ok: boolean; gateway: string; degraded: boolean; busy?: boolean; agents: string[]; sessions: number; latencyMs: number };
  hermes:      { ok: boolean; model: string | null; provider: string | null; latencyMs: number };
  gemini:      { ok: boolean; version: string | null; latencyMs: number };
  antigravity: { ok: boolean; version: string | null; latencyMs: number };
  codex:       { ok: boolean; version: string | null; latencyMs: number };
}

/* ─── Section eyebrow ─── */
function Eyebrow({ n, label }: { n: string; label: string }) {
  return (
    <div className="eyebrow mb-5">
      <span className="num">{n}.</span>
      <span className="line" />
      <span className="label">{label}</span>
    </div>
  );
}

/* ─── Vital tile ─── */
function VitalTile({
  label, value, sub, ok, href,
}: { label: string; value: React.ReactNode; sub?: string; ok: boolean | null; href?: string }) {
  const dot = ok === null ? "info" : ok ? "ok" : "err";
  const inner = (
    <div className="vital-tile h-full">
      <div className="k flex items-center justify-between">
        {label}
        <span className={`status-dot ${dot}`} />
      </div>
      <div className="v">{value}</div>
      {sub && <div className="sub">{sub}</div>}
    </div>
  );
  return href ? <Link href={href} className="block">{inner}</Link> : inner;
}

/* ─── Agent grid card ─── */
function AgentCard({ agent, i }: { agent: typeof AGENTS[0]; i: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: 0.04 * i, ease: "easeOut" }}
    >
      <Link
        href={`/agents/${agent.slug}`}
        className="glow-ring action-card group flex h-full flex-col"
      >
        <div className="flex items-start justify-between">
          <Avatar agent={agent} size="lg" showStatus />
          <ArrowUpRight className="h-4 w-4 opacity-40 transition-opacity group-hover:opacity-100" style={{ color: "var(--cream-dim)" }} />
        </div>
        <h3 className="action-title mt-4">{agent.name}</h3>
        <p className="action-desc mt-1 flex-1">{agent.tagline}</p>
        <div className="action-tag mt-4">Open chat →</div>
      </Link>
    </motion.div>
  );
}

/* ─── Self card (Goals / Journal / Memory) ─── */
function SelfCard({ href, title, tagline, accent, stat }: {
  href: string; title: string; tagline: string; accent: string; stat: string;
}) {
  return (
    <Link href={href} className="block group">
      <motion.div whileHover={{ y: -3 }} transition={{ duration: 0.2 }} className="surface-card relative overflow-hidden h-full">
        <div
          className="pointer-events-none absolute -bottom-16 -right-12 h-48 w-48 rounded-full blur-3xl opacity-15 transition group-hover:opacity-30"
          style={{ background: accent }}
        />
        <div className="relative flex items-start justify-between mb-3">
          <div
            className="grid h-10 w-10 place-items-center rounded-md"
            style={{ background: `${accent}1a`, color: accent, border: `1px solid ${accent}30`, boxShadow: `0 0 18px -10px ${accent}` }}
          >
            <span className="text-lg">✦</span>
          </div>
          <ArrowUpRight size={14} className="opacity-50 group-hover:opacity-100 transition" style={{ color: "var(--cream-dim)" }} />
        </div>
        <div className="relative">
          <h3 className="action-title">{title}</h3>
          <p className="action-desc mt-1">{tagline}</p>
          <div className="action-tag mt-4">{stat}</div>
        </div>
      </motion.div>
    </Link>
  );
}

/* ─── Main page ─── */
export default function MissionControl() {
  const [v, setV] = useState<Vitals | null>(null);
  const [ticks, setTicks] = useState(0);

  usePollWhileVisible(async () => {
    try {
      const data = await (await fetch("/api/vitals", { cache: "no-store" })).json() as Vitals;
      setV(data);
      setTicks((t) => t + 1);
    } catch { /* ignore */ }
  }, 10_000);

  const cl = v?.claude;
  const oc = v?.openclaw;
  const hm = v?.hermes;
  const gm = v?.gemini;
  const ag = v?.antigravity;
  const cx = v?.codex;

  return (
    <div className="mx-auto max-w-[1400px] space-y-10 px-6 py-8 md:px-10">

      {/* ── I. MISSION CONTROL ── */}
      <motion.section initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        <Eyebrow n="I" label="Mission Control" />
        <h1 className="page-title">Mission Control</h1>
        <p className="page-subtitle">Status of every agent, every memory, every signal.</p>

        {/* Vitals strip */}
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <VitalTile href="/agents/claude"
            label="Claude"
            value={cl?.ok ? <><em>{cl.version?.split(" ")[0] ?? "—"}</em></> : "Offline"}
            sub={cl ? `${cl.latencyMs}ms · ${cl.model}` : "not found"}
            ok={cl?.ok ?? null}
          />
          <VitalTile href="/agents/openclaw"
            label="OpenClaw"
            value={oc?.ok ? (oc.degraded ? "Degraded" : oc.busy ? "Busy" : "Ready") : "Offline"}
            sub={oc ? `${oc.agents.length} agents · ${oc.sessions} sessions` : "not found"}
            ok={oc ? (oc.ok && !oc.degraded) : null}
          />
          <VitalTile href="/agents/hermes"
            label="Hermes"
            value={hm?.ok ? "Online" : "Offline"}
            sub={hm?.model ? `${hm.model.split("/").pop()} · ${hm.provider ?? "—"}` : "not found"}
            ok={hm?.ok ?? null}
          />
          <VitalTile href="/agents/gemini"
            label="Gemini"
            value={gm?.ok ? "Online" : "Offline"}
            sub={gm?.version ?? "not found"}
            ok={gm?.ok ?? null}
          />
          <VitalTile href="/agents/antigravity"
            label="Antigravity"
            value={ag?.ok ? "Online" : "Offline"}
            sub={ag?.version ?? "not found"}
            ok={ag?.ok ?? null}
          />
          <VitalTile href="/agents/codex"
            label="Codex"
            value={cx?.ok ? "Online" : "Offline"}
            sub={cx?.version ?? "not found"}
            ok={cx?.ok ?? null}
          />
        </div>
      </motion.section>

      <div className="divider"><span className="rule"/><span className="ornament">✦</span><span className="rule"/></div>

      {/* ── II. AGENTS ── */}
      <section>
        <Eyebrow n="II" label="Agents · click to open control room" />
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {AGENTS.map((agent, i) => <AgentCard key={agent.slug} agent={agent} i={i} />)}
        </div>
      </section>

      <div className="divider"><span className="rule"/><span className="ornament">✦</span><span className="rule"/></div>

      {/* ── III. SELF ── */}
      <section>
        <Eyebrow n="III" label="Self · grounded in your Obsidian vault" />
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <SelfCard
            href="/goals"
            title="Goals"
            tagline="Set the targets, tick them off, watch the bar fill."
            accent="var(--gold)"
            stat="Live · saved to vault"
          />
          <SelfCard
            href="/journal"
            title="Journal"
            tagline="Daily entries, voice or text, one file per day."
            accent="var(--emerald)"
            stat="Daily files in vault"
          />
          <SelfCard
            href="/memory"
            title="Memory"
            tagline="Your Obsidian vault as a live 3-D knowledge graph."
            accent="var(--plum)"
            stat="3-D knowledge graph · live"
          />
        </div>
      </section>

      <div className="divider"><span className="rule"/><span className="ornament">✦</span><span className="rule"/></div>

      {/* ── IV. ACTIVITY ── */}
      <section>
        <Eyebrow n="IV" label="Live activity · combined log stream" />
        <ActivityStream />
      </section>

    </div>
  );
}

/* ─── Activity stream (reads /api/activity, polled) ─── */
interface LogEntry { ts: number; agent: string; text: string; level?: string }

function ActivityStream() {
  const [entries, setEntries] = useState<LogEntry[]>([]);

  usePollWhileVisible(async () => {
    try {
      const { entries: e } = await (await fetch("/api/activity", { cache: "no-store" })).json() as { entries: LogEntry[] };
      setEntries(e ?? []);
    } catch { /* ignore */ }
  }, 8_000);

  if (entries.length === 0) {
    return (
      <div className="surface-card flex items-center gap-3 text-sm" style={{ color: "var(--cream-dim)" }}>
        <Brain className="h-4 w-4 opacity-50" />
        No log entries yet. Activity from OpenClaw and Hermes will appear here.
      </div>
    );
  }

  return (
    <div className="surface-card stream-fade max-h-72 overflow-y-auto">
      {entries.map((e, i) => (
        <div key={i} className="flex items-start gap-3 py-1.5 border-b last:border-0" style={{ borderColor: "var(--line-soft)" }}>
          <span
            className="status-dot mt-1.5 shrink-0"
            style={{ background: e.level === "err" ? "var(--plum)" : e.level === "warn" ? "var(--gold)" : "var(--emerald)" }}
          />
          <span className="mono text-[11px] shrink-0" style={{ color: "var(--cream-mute)" }}>
            {new Date(e.ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </span>
          <span className="text-[11px] uppercase tracking-widest shrink-0" style={{ color: "var(--cream-dim)", fontFamily: "var(--font-manrope)" }}>
            {e.agent}
          </span>
          <span className="text-[12px] truncate" style={{ color: "var(--cream-soft)" }}>{e.text}</span>
        </div>
      ))}
    </div>
  );
}
