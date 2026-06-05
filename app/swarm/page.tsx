"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Play, Square, RotateCcw, Plus, Trash2,
  ChevronDown, ChevronUp, Network, Bot,
} from "lucide-react";
import dynamic from "next/dynamic";
import type { SwarmAgent, SwarmState, Topology } from "@/lib/swarm";

// Canvas component is client-only
const SwarmTopology = dynamic(() => import("@/components/SwarmTopology"), { ssr: false });

const ROLES  = ["researcher", "architect", "coder", "frontend-dev", "reviewer", "seo-specialist", "writer"];
const MODELS = ["haiku", "sonnet", "opus"] as const;
const TOPOLOGIES: Topology[] = ["hierarchical", "flat", "sequential"];

const MODEL_COLOR: Record<string, string> = {
  haiku:  "var(--emerald)",
  sonnet: "var(--gold)",
  opus:   "var(--plum)",
};
const STATUS_COLOR: Record<string, string> = {
  idle:    "var(--cream-mute)",
  running: "var(--gold)",
  done:    "var(--emerald)",
  error:   "var(--plum)",
};

export default function SwarmPage() {
  const [state, setState] = useState<SwarmState | null>(null);
  const [prompt, setPrompt]   = useState("");
  const [running, setRunning] = useState(false);
  const [selected, setSelected] = useState<SwarmAgent | null>(null);
  const [showConfig, setShowConfig] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const traceRef = useRef<HTMLDivElement>(null);

  const load = async () => {
    const j = await (await fetch("/api/swarm", { cache: "no-store" })).json() as SwarmState;
    setState(j);
    if (j.activeRun?.status === "running") setRunning(true);
    else setRunning(false);
  };

  useEffect(() => { load(); }, []);

  // Auto-scroll trace
  useEffect(() => {
    traceRef.current?.scrollTo({ top: traceRef.current.scrollHeight, behavior: "smooth" });
  }, [state?.activeRun?.events?.length]);

  // Poll while running
  useEffect(() => {
    if (running) {
      pollRef.current = setInterval(load, 2500);
    } else {
      if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
    }
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [running]);

  const run = async () => {
    if (!prompt.trim() || running) return;
    setRunning(true);
    await fetch("/api/swarm/run", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: prompt.trim() }),
    });
    load();
  };

  const reset = async () => {
    setRunning(false);
    await fetch("/api/swarm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reset: true }),
    });
    load();
  };

  const patch = async (p: Partial<SwarmState>) => {
    const j = await (await fetch("/api/swarm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(p),
    })).json() as SwarmState;
    setState(j);
  };

  const addAgent = () => {
    if (!state) return;
    const id = `a${Date.now()}`;
    patch({ agents: [...state.agents, { id, role: "researcher", model: "haiku", status: "idle", output: "" }] });
  };
  const removeAgent = (id: string) => {
    if (!state) return;
    patch({ agents: state.agents.filter((a) => a.id !== id) });
  };
  const updateAgent = (id: string, key: keyof SwarmAgent, value: string) => {
    if (!state) return;
    patch({ agents: state.agents.map((a) => a.id === id ? { ...a, [key]: value } : a) });
  };

  if (!state) return (
    <div className="flex h-[80vh] items-center justify-center">
      <div className="h-6 w-6 animate-spin rounded-full border-2 border-gold border-t-transparent" />
    </div>
  );

  const liveCount  = state.agents.filter((a) => a.status === "running").length;
  const doneCount  = state.agents.filter((a) => a.status === "done").length;
  const isRunning  = state.activeRun?.status === "running";
  const events     = state.activeRun?.events ?? [];

  return (
    <div className="mx-auto max-w-[1400px] space-y-5 px-6 py-8 md:px-10">

      {/* Header */}
      <div>
        <div className="eyebrow mb-4">
          <span className="num">∞.</span>
          <span className="line" />
          <span className="label">Swarm · Topology View</span>
        </div>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="page-title">{state.name}</h1>
            <p className="page-subtitle">
              Multi-agent swarm — {state.agents.length} agents, {state.topology} topology.
              Powered by the Hermes proxy.
            </p>
          </div>

          {/* Status chips */}
          <div className="flex flex-wrap items-center gap-2 pt-1">
            {TOPOLOGIES.map((t) => (
              <button key={t} onClick={() => patch({ topology: t })}
                className="pill transition"
                style={state.topology === t ? { color: "var(--gold)", borderColor: "rgba(212,165,116,0.45)", background: "rgba(212,165,116,0.10)" } : {}}>
                {t} topology
              </button>
            ))}
            <span className="pill" style={{ color: "var(--cream-soft)" }}>
              <Network size={10} className="inline-block mr-1" />
              {state.agents.length} agents
            </span>
            <span className="pill" style={isRunning ? { color: "var(--gold)", borderColor: "rgba(212,165,116,0.4)", background: "rgba(212,165,116,0.08)" } : {}}>
              <span className={`inline-block h-1.5 w-1.5 rounded-full mr-1.5 ${isRunning ? "live-dot" : ""}`}
                style={{ background: isRunning ? "var(--gold)" : "var(--cream-mute)", display: "inline-block" }} />
              {isRunning ? `running · ${liveCount} active` : doneCount > 0 ? `done · ${doneCount}/${state.agents.length}` : "idle · swarm"}
            </span>
          </div>
        </div>
      </div>

      {/* Main grid */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_380px]">

        {/* Canvas */}
        <div className="relative overflow-hidden rounded-2xl border" style={{ height: "60vh", minHeight: 420, borderColor: "var(--line-soft)" }}>
          <SwarmTopology
            name={state.name}
            topology={state.topology}
            agents={state.agents}
            onSelectAgent={(a) => setSelected((s) => s?.id === a.id ? null : a)}
          />

          {/* Orchestrator name editor */}
          <div className="absolute left-3 top-3">
            <input
              value={state.name}
              onChange={(e) => patch({ name: e.target.value })}
              className="rounded-lg border px-2.5 py-1 font-mono text-[13px] font-semibold outline-none w-28"
              style={{ background: "rgba(0,0,0,0.5)", borderColor: "rgba(212,165,116,0.3)", color: "var(--gold)" }}
            />
          </div>

          {/* Legend */}
          <div className="absolute bottom-3 left-3 flex flex-wrap gap-2 pointer-events-none">
            {Object.entries(MODEL_COLOR).map(([m, c]) => (
              <div key={m} className="flex items-center gap-1.5 rounded-md px-2 py-1"
                style={{ background: "rgba(0,0,0,0.6)", border: "1px solid rgba(255,255,255,0.06)" }}>
                <span className="h-2 w-2 rounded-full" style={{ background: c }} />
                <span className="text-[10px]" style={{ color: "var(--cream-dim)" }}>{m}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Right panel */}
        <div className="flex flex-col gap-3">

          {/* Selected agent details */}
          <AnimatePresence mode="wait">
            {selected && (
              <motion.div key={selected.id} initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                className="surface-card" style={{ padding: "16px" }}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full" style={{ background: STATUS_COLOR[selected.status] }} />
                    <span className="font-semibold text-[14px]" style={{ fontFamily: "var(--font-bricolage)", color: "var(--cream)" }}>
                      {selected.role}
                    </span>
                    <span className="text-[11px] metric" style={{ color: MODEL_COLOR[selected.model] ?? "var(--cream-dim)" }}>
                      ·{selected.model}
                    </span>
                  </div>
                  <button onClick={() => setSelected(null)} className="text-[11px]" style={{ color: "var(--cream-mute)" }}>✕</button>
                </div>
                {selected.output
                  ? <pre className="whitespace-pre-wrap text-[12px] leading-relaxed max-h-48 overflow-y-auto"
                      style={{ color: "var(--cream-soft)", fontFamily: "var(--font-sans)" }}>{selected.output}</pre>
                  : <p className="text-[12px]" style={{ color: "var(--cream-mute)" }}>
                      {selected.status === "idle" ? "Waiting for a task." : selected.status === "running" ? "Working…" : "No output yet."}
                    </p>}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Task input */}
          <div className="surface-card" style={{ padding: "16px" }}>
            <div className="text-[11px] uppercase tracking-wider mb-2" style={{ color: "var(--cream-mute)", fontFamily: "var(--font-manrope)", fontWeight: 700 }}>
              Swarm task
            </div>
            <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} rows={3}
              onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); run(); } }}
              placeholder="Give the swarm a task…  (⌘+Enter to run)"
              className="w-full resize-none rounded-xl border px-3 py-2.5 text-[13px] outline-none"
              style={{ background: "rgba(0,0,0,0.25)", borderColor: "var(--line)", color: "var(--cream)", caretColor: "var(--gold)" }} />
            <div className="flex gap-2 mt-3">
              <button onClick={run} disabled={!prompt.trim() || isRunning}
                className="flex-1 flex items-center justify-center gap-2 rounded-xl py-2.5 text-[13px] font-semibold transition hover:scale-[1.01] disabled:opacity-40"
                style={{ background: "rgba(212,165,116,0.15)", border: "1px solid rgba(212,165,116,0.45)", color: "var(--gold)" }}>
                {isRunning ? <><span className="live-dot h-1.5 w-1.5 rounded-full bg-gold" /> Running…</> : <><Play size={14} /> Run swarm</>}
              </button>
              <button onClick={reset} title="Reset all statuses"
                className="grid h-10 w-10 place-items-center rounded-xl border transition"
                style={{ borderColor: "var(--line-soft)", color: "var(--cream-mute)" }}>
                <RotateCcw size={14} />
              </button>
            </div>
          </div>

          {/* Live trace */}
          {events.length > 0 && (
            <div ref={traceRef} className="surface-card stream-fade max-h-64 overflow-y-auto" style={{ padding: "12px" }}>
              <div className="text-[10px] uppercase tracking-widest mb-2" style={{ color: "var(--cream-mute)" }}>Live trace</div>
              {events.map((ev, i) => (
                <div key={i} className="flex items-start gap-2 py-1.5 border-b last:border-0 text-[12px]" style={{ borderColor: "var(--line-deep)" }}>
                  <span className="shrink-0 metric" style={{ color: MODEL_COLOR["haiku"], minWidth: 90 }}>{ev.role}</span>
                  <span className="line-clamp-3" style={{ color: "var(--cream-soft)" }}>{ev.text.slice(0, 180)}{ev.text.length > 180 ? "…" : ""}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Config panel */}
      <div className="surface-card">
        <button onClick={() => setShowConfig((v) => !v)}
          className="flex w-full items-center justify-between py-1 text-[13px] font-semibold"
          style={{ color: "var(--cream)", fontFamily: "var(--font-bricolage)" }}>
          <span className="flex items-center gap-2"><Bot size={15} style={{ color: "var(--gold)" }} /> Configure agents ({state.agents.length})</span>
          {showConfig ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
        </button>

        <AnimatePresence>
          {showConfig && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden">
              <div className="mt-4 space-y-2 max-h-72 overflow-y-auto pr-1">
                {state.agents.map((a) => (
                  <div key={a.id} className="flex items-center gap-2">
                    <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: STATUS_COLOR[a.status] }} />
                    <select value={a.role} onChange={(e) => updateAgent(a.id, "role", e.target.value)}
                      className="flex-1 rounded-lg border px-2 py-1 text-[12px] outline-none"
                      style={{ background: "var(--bg-card)", borderColor: "var(--line-soft)", color: "var(--cream)" }}>
                      {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                    </select>
                    <select value={a.model} onChange={(e) => updateAgent(a.id, "model", e.target.value)}
                      className="rounded-lg border px-2 py-1 text-[12px] outline-none"
                      style={{ background: "var(--bg-card)", borderColor: "var(--line-soft)", color: MODEL_COLOR[a.model] ?? "var(--cream)" }}>
                      {MODELS.map((m) => <option key={m} value={m}>{m}</option>)}
                    </select>
                    <button onClick={() => removeAgent(a.id)} className="shrink-0 transition hover:opacity-100 opacity-40"
                      style={{ color: "var(--plum)" }}>
                      <Trash2 size={13} />
                    </button>
                  </div>
                ))}
              </div>
              <button onClick={addAgent}
                className="mt-3 flex items-center gap-1.5 text-[12px] transition hover:opacity-100 opacity-60"
                style={{ color: "var(--gold)" }}>
                <Plus size={13} /> Add agent
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

    </div>
  );
}
