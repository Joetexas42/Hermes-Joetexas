"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  MessageSquare, ArrowUp, Square, Loader2, Rocket, Globe, ExternalLink,
} from "lucide-react";
import { Avatar } from "@/components/Avatar";
import { MicButton } from "@/components/MicButton";
import { getAgent } from "@/lib/agents";

const antigravity = getAgent("antigravity")!;

const appendChunk = (prev: string, chunk: string) =>
  (prev && !prev.endsWith(" ") ? prev + " " : prev) + chunk;

const SYSTEM_PROMPT = `You are Antigravity, an autonomous site-building AI inside Agentic OS. Your mission: help the user plan, generate, and deploy SEO-optimised websites.

When the user describes a niche or topic, you:
1. Suggest 5-10 high-intent long-tail keywords
2. Propose a site structure (pages, categories, pillar content)
3. Draft article outlines with titles, meta descriptions, and H2s
4. Help the user refine before they hit "Build" in the SEO Suite

You think like a growth hacker. You know SEO cold — search intent, EEAT, internal linking, topical authority. You're direct, energetic, and action-oriented.

When asked to "build" or "deploy", tell the user to switch to the SEO Suite tab (linked in the sidebar) where the actual generation and Netlify deployment happens. You're the strategist; the SEO Suite is the factory.`;

interface ChatMsg { role: "user" | "assistant"; content: string; streaming?: boolean }

interface SiteData {
  site: { id: string; name: string; url: string };
  postCount: number;
  exists: boolean;
}

function SitesPanel() {
  const [sites, setSites] = useState<SiteData[]>([]);

  useEffect(() => {
    fetch("/api/seo/sites", { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => setSites(Array.isArray(j) ? j : []))
      .catch(() => {});
  }, []);

  if (sites.length === 0) return null;

  return (
    <div className="border-t px-4 py-3" style={{ borderColor: "var(--line-soft)" }}>
      <div className="text-[10px] uppercase tracking-wider mb-2" style={{ color: "var(--cream-mute)" }}>
        <Globe size={10} className="inline mr-1" /> Your sites
      </div>
      <div className="flex flex-wrap gap-2">
        {sites.map((s) => (
          <a key={s.site.id} href={s.site.url} target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[11px] transition hover:border-white/20"
            style={{ borderColor: "var(--line-soft)", color: "var(--cream-dim)" }}>
            {s.site.name}
            <span className="metric" style={{ color: "var(--emerald)" }}>{s.postCount}</span>
            <ExternalLink size={9} />
          </a>
        ))}
      </div>
    </div>
  );
}

export default function AntigravityView() {
  const [msgs, setMsgs]   = useState<ChatMsg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy]   = useState(false);
  const scrollRef         = useRef<HTMLDivElement>(null);
  const historyRef        = useRef<{ role: "user" | "assistant" | "system"; content: string }[]>([
    { role: "system", content: SYSTEM_PROMPT },
  ]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [msgs]);

  const patchLast = (fn: (m: ChatMsg) => ChatMsg) =>
    setMsgs((m) => { const c = [...m]; c[c.length - 1] = fn(c[c.length - 1]); return c; });

  const send = async () => {
    const prompt = input.trim();
    if (!prompt || busy) return;
    setInput("");
    setBusy(true);

    historyRef.current.push({ role: "user", content: prompt });
    setMsgs((m) => [...m,
      { role: "user", content: prompt },
      { role: "assistant", content: "", streaming: true },
    ]);

    try {
      const res = await fetch("/api/hermes/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: historyRef.current }),
      });
      if (!res.body) throw new Error("No stream");
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = "", full = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        const lines = buf.split("\n\n"); buf = lines.pop() ?? "";
        for (const block of lines) {
          const line = block.split("\n").find((l) => l.startsWith("data:"));
          if (!line) continue;
          const evt = JSON.parse(line.slice(5).trim()) as { type: string; text?: string; message?: string };
          if (evt.type === "delta" && evt.text) {
            full += evt.text;
            const clean = full.replace(/<think>[\s\S]*?<\/think>/g, "").trimStart();
            patchLast((m) => ({ ...m, content: clean }));
          }
          else if (evt.type === "done")  patchLast((m) => ({ ...m, streaming: false }));
          else if (evt.type === "error") patchLast((m) => ({
            ...m, streaming: false,
            content: m.content || `⚠ ${evt.message}`,
          }));
        }
      }
      if (full) historyRef.current.push({ role: "assistant", content: full });
    } catch (e) {
      patchLast((m) => ({ ...m, streaming: false, content: m.content || `⚠ ${(e as Error).message}` }));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex h-[calc(100vh-3.5rem)] flex-col">
      {/* Header */}
      <div className="flex items-center gap-3 border-b px-6 py-3.5 shrink-0" style={{ borderColor: "var(--line-soft)" }}>
        <Avatar agent={antigravity} size="md" showStatus />
        <div className="min-w-0 flex-1">
          <div className="font-semibold" style={{ fontFamily: "var(--font-bricolage)", color: "var(--cream)" }}>Antigravity</div>
          <div className="flex items-center gap-1.5 text-[12px]" style={{ color: "var(--cream-dim)" }}>
            <span className="metric" style={{ color: "#a78bfa" }}>Site Builder</span>
            <span style={{ color: "var(--cream-mute)" }}>· SEO strategist · keyword research · content planning</span>
          </div>
        </div>
      </div>

      {/* Chat */}
      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
        <div className="mx-auto max-w-3xl space-y-4">
          {msgs.length === 0 && (
            <div className="mt-16 text-center">
              <Avatar agent={antigravity} size="lg" showStatus />
              <p className="mt-4 text-[14px]" style={{ color: "var(--cream-dim)" }}>
                Antigravity — autonomous site builder. Tell me a niche and I&apos;ll plan the whole site.
              </p>
              <div className="mx-auto mt-6 flex max-w-md flex-col gap-2">
                {[
                  "Plan an SEO site about AI automation tools for small businesses",
                  "Give me 10 keywords for a site about Bangkok digital nomad life",
                  "What's the best site structure for a SaaS review blog?",
                ].map((p) => (
                  <button key={p} onClick={() => setInput(p)}
                    className="surface-card text-left text-[13px] transition"
                    style={{ padding: "10px 14px", color: "var(--cream-soft)" }}>
                    <Rocket size={11} className="inline mr-1.5" style={{ color: "#a78bfa" }} />
                    {p}
                  </button>
                ))}
              </div>
            </div>
          )}
          <AnimatePresence initial={false}>
            {msgs.map((m, i) => (
              <motion.div key={i} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}
                className={m.role === "user" ? "flex justify-end" : "flex items-start gap-2.5"}>
                {m.role === "assistant" && <Avatar agent={antigravity} size="sm" />}
                <div style={m.role === "user"
                  ? { background: "rgba(167,139,250,0.12)", border: "1px solid rgba(167,139,250,0.25)", borderRadius: "16px 16px 4px 16px", maxWidth: "78%", padding: "10px 14px", color: "var(--cream)" }
                  : { background: "var(--bg-card)", border: "1px solid var(--line-soft)", borderRadius: "4px 16px 16px 16px", maxWidth: "82%", padding: "12px 14px", color: "var(--cream-soft)" }}>
                  {m.streaming && !m.content
                    ? <span className="flex items-center gap-2 text-[13px]" style={{ color: "var(--cream-mute)" }}><Loader2 size={13} className="animate-spin" /> Planning…</span>
                    : <span className={`whitespace-pre-wrap text-[14px] leading-relaxed ${m.streaming ? "caret" : ""}`}>{m.content}</span>}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </div>

      {/* Sites panel */}
      <SitesPanel />

      {/* Composer */}
      <div className="border-t px-4 py-3" style={{ borderColor: "var(--line-soft)" }}>
        <div className="mx-auto flex max-w-3xl items-end gap-2">
          <div className="flex flex-1 items-end gap-2 rounded-2xl border px-3 py-2"
            style={{ background: "var(--bg-card)", borderColor: "var(--line)" }}>
            <textarea value={input} onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
              rows={1} placeholder="Describe a site, niche, or ask about SEO…"
              className="max-h-36 flex-1 resize-none bg-transparent py-1 text-[14px] outline-none"
              style={{ color: "var(--cream)", caretColor: "#a78bfa" }} />
            <MicButton onTranscript={(c) => setInput((p) => appendChunk(p, c))} size={32} />
          </div>
          <button onClick={send} disabled={!input.trim() || busy}
            className="grid h-11 w-11 place-items-center rounded-2xl text-white transition-transform hover:scale-105 disabled:opacity-30"
            style={{ background: `linear-gradient(140deg, ${antigravity.gradient[0]}, ${antigravity.gradient[1]})` }}>
            {busy ? <Square size={16} /> : <ArrowUp size={18} />}
          </button>
        </div>
      </div>
    </div>
  );
}
