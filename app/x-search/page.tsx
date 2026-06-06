"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search, Loader2, Square, Sparkles, Clock, X, TrendingUp,
} from "lucide-react";
import { MicButton } from "@/components/MicButton";

const RECENT_KEY = "x-search-recent-v1";
const MAX_RECENT = 8;

const appendChunk = (prev: string, chunk: string) =>
  (prev && !prev.endsWith(" ") ? prev + " " : prev) + chunk;

export default function XSearchPage() {
  const [query, setQuery]     = useState("");
  const [result, setResult]   = useState("");
  const [busy, setBusy]       = useState(false);
  const [error, setError]     = useState<string | null>(null);
  const [recent, setRecent]   = useState<{ q: string; ts: number }[]>([]);
  const abortRef              = useRef<AbortController | null>(null);
  const scrollRef             = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(RECENT_KEY);
      if (raw) setRecent(JSON.parse(raw));
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [result]);

  const persistRecent = (next: { q: string; ts: number }[]) => {
    setRecent(next);
    try { localStorage.setItem(RECENT_KEY, JSON.stringify(next)); } catch {}
  };

  const stop = () => {
    abortRef.current?.abort();
    setBusy(false);
  };

  const search = async (q?: string) => {
    const text = (q ?? query).trim();
    if (!text || busy) return;
    setQuery(text);
    setResult("");
    setError(null);
    setBusy(true);

    // Save to recent (dedupe + cap)
    const filtered = recent.filter((r) => r.q.toLowerCase() !== text.toLowerCase());
    persistRecent([{ q: text, ts: Date.now() }, ...filtered].slice(0, MAX_RECENT));

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await fetch("/api/search/x", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: text }),
        signal: controller.signal,
      });
      if (!res.body) throw new Error("No response stream.");
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      let acc = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const events = buf.split("\n\n");
        buf = events.pop() ?? "";
        for (const block of events) {
          const line = block.split("\n").find((l) => l.startsWith("data:"));
          if (!line) continue;
          const evt = JSON.parse(line.slice(5).trim());
          if (evt.type === "delta") {
            acc += evt.text;
            // Strip Grok's optional <think> reasoning blocks like we do for Hermes
            const clean = acc.replace(/<think>[\s\S]*?<\/think>/g, "").trimStart();
            setResult(clean);
          } else if (evt.type === "error") {
            setError(evt.message);
          }
        }
      }
    } catch (e) {
      if ((e as Error).name !== "AbortError") setError(String(e));
    } finally {
      setBusy(false);
      abortRef.current = null;
    }
  };

  const removeRecent = (q: string) => {
    persistRecent(recent.filter((r) => r.q !== q));
  };

  const examples = [
    "Latest on Claude 4.8 launch",
    "What's everyone saying about MiniMax M3",
    "OpenAI's newest agent framework",
    "AI agent SaaS pricing strategies",
  ];

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-6 py-8 md:px-10">
      {/* Header */}
      <div>
        <div className="eyebrow mb-4">
          <span className="num">X.</span><span className="line" /><span className="label">X-Search · powered by Grok</span>
        </div>
        <h1 className="page-title">X-Search</h1>
        <p className="page-subtitle">
          Live X/Twitter search via Grok through your Hermes proxy. Ask anything — Grok will search and summarise.
        </p>
      </div>

      {/* Search bar */}
      <div className="flex items-center gap-2 rounded-2xl border px-4 py-3"
        style={{ background: "var(--bg-card)", borderColor: "var(--line)" }}>
        <Search size={18} style={{ color: "var(--cream-mute)" }} />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") search(); }}
          placeholder="What's everyone saying about…?"
          className="flex-1 bg-transparent text-[15px] outline-none placeholder:text-[var(--faint)]"
          style={{ color: "var(--cream)", caretColor: "var(--gold)" }}
        />
        <MicButton onTranscript={(c) => setQuery((p) => appendChunk(p, c))} size={36} />
        {busy ? (
          <button onClick={stop}
            className="grid h-10 w-10 place-items-center rounded-xl border transition"
            style={{ borderColor: "var(--line-soft)", color: "var(--cream-dim)" }}>
            <Square size={14} />
          </button>
        ) : (
          <button onClick={() => search()} disabled={!query.trim()}
            className="grid h-10 w-10 place-items-center rounded-xl text-white transition-transform hover:scale-105 disabled:opacity-30"
            style={{ background: "linear-gradient(140deg, var(--gold), var(--rust))" }}>
            <Search size={16} />
          </button>
        )}
      </div>

      {/* Example prompts (only when empty) */}
      {!result && !busy && !error && (
        <div>
          <div className="text-[10px] uppercase tracking-wider mb-2" style={{ color: "var(--cream-mute)" }}>Try one of these</div>
          <div className="grid gap-2 sm:grid-cols-2">
            {examples.map((ex) => (
              <button key={ex} onClick={() => search(ex)}
                className="surface-card text-left text-[13px] transition"
                style={{ padding: "10px 14px", color: "var(--cream-soft)" }}>
                <TrendingUp size={11} className="inline mr-1.5" style={{ color: "var(--gold)" }} />
                {ex}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Result */}
      <AnimatePresence mode="wait">
        {(result || busy) && (
          <motion.div key="result"
            initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="surface-card">
            <div className="flex items-center gap-2 mb-3">
              <Sparkles size={14} style={{ color: "var(--gold)" }} />
              <span className="text-[11px] uppercase tracking-widest" style={{ color: "var(--cream-mute)" }}>
                Grok · x-ai/grok-4.3
              </span>
              {busy && (
                <span className="flex items-center gap-1.5 text-[11px] ml-auto" style={{ color: "var(--gold)" }}>
                  <Loader2 size={11} className="animate-spin" /> searching X…
                </span>
              )}
            </div>
            <div ref={scrollRef}
              className="scroll overflow-y-auto whitespace-pre-wrap text-[13.5px] leading-relaxed"
              style={{ color: "var(--cream-soft)", maxHeight: "55vh", fontFamily: "var(--font-sans)" }}>
              {result || (busy && <span style={{ color: "var(--cream-mute)" }}>Thinking…</span>)}
              {busy && result && <span className="caret" />}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Error */}
      <AnimatePresence>
        {error && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="rounded-xl border px-4 py-3 text-[13px]"
            style={{ borderColor: "rgba(196,96,126,0.4)", background: "rgba(196,96,126,0.08)", color: "var(--cream-soft)" }}>
            ⚠ {error}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Recent */}
      {recent.length > 0 && (
        <section>
          <div className="text-[10px] uppercase tracking-wider mb-2 flex items-center gap-1.5" style={{ color: "var(--cream-mute)" }}>
            <Clock size={11} /> Recent searches
          </div>
          <div className="flex flex-wrap gap-2">
            {recent.map((r) => (
              <div key={r.q} className="group flex items-center gap-1 rounded-full border px-3 py-1.5 text-[12px] transition hover:border-white/20"
                style={{ borderColor: "var(--line-soft)", color: "var(--cream-dim)" }}>
                <button onClick={() => search(r.q)} className="text-left">
                  {r.q.length > 50 ? r.q.slice(0, 50) + "…" : r.q}
                </button>
                <button onClick={() => removeRecent(r.q)}
                  className="opacity-0 transition-opacity group-hover:opacity-60 hover:!opacity-100"
                  style={{ color: "var(--plum)" }}>
                  <X size={11} />
                </button>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
