"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  MessageSquare, Mic, Sparkles, ArrowUp, Square,
  MicOff, Volume2, Image, Music, Film, Loader2, ShieldAlert,
} from "lucide-react";
import { Avatar } from "@/components/Avatar";
import { MicButton } from "@/components/MicButton";
import { getAgent } from "@/lib/agents";

const hermes = getAgent("hermes")!;

/* ─── shared helpers ─── */
const appendChunk = (prev: string, chunk: string) =>
  (prev && !prev.endsWith(" ") ? prev + " " : prev) + chunk;

/* ══════════════════════════════════════════════════════
   CHAT TAB
══════════════════════════════════════════════════════ */
interface ChatMsg { role: "user" | "assistant"; content: string; streaming?: boolean }

function ChatTab() {
  const [msgs, setMsgs]   = useState<ChatMsg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy]   = useState(false);
  const scrollRef         = useRef<HTMLDivElement>(null);
  // history for multi-turn
  const historyRef        = useRef<{ role: "user" | "assistant"; content: string }[]>([]);

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
            // Strip <think>…</think> reasoning blocks from the displayed content
            const clean = (full.replace(/<think>[\s\S]*?<\/think>/g, "").trimStart());
            patchLast((m) => ({ ...m, content: clean }));
          }
          else if (evt.type === "done")  patchLast((m) => ({ ...m, streaming: false }));
          else if (evt.type === "error") patchLast((m) => ({ ...m, streaming: false, content: m.content || `⚠ ${evt.message}` }));
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
    <div className="flex h-full flex-col">
      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
        <div className="mx-auto max-w-3xl space-y-4">
          {msgs.length === 0 && (
            <div className="mt-16 text-center">
              <Avatar agent={hermes} size="lg" showStatus />
              <p className="mt-4 text-[14px]" style={{ color: "var(--cream-dim)" }}>
                Hermes is live — running <span className="metric" style={{ color: "var(--gold)" }}>minimax/minimax-m2.7</span> via OpenRouter.
              </p>
              <div className="mx-auto mt-6 flex max-w-md flex-col gap-2">
                {["What can you do?", "Search the web for the latest AI news.", "Write me a short poem about Bangkok."].map((p) => (
                  <button key={p} onClick={() => setInput(p)}
                    className="surface-card text-left text-[13px] transition"
                    style={{ padding: "10px 14px", color: "var(--cream-soft)" }}>
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
                {m.role === "assistant" && <Avatar agent={hermes} size="sm" />}
                <div style={m.role === "user"
                  ? { background: "rgba(212,165,116,0.12)", border: "1px solid rgba(212,165,116,0.25)", borderRadius: "16px 16px 4px 16px", maxWidth: "78%", padding: "10px 14px", color: "var(--cream)" }
                  : { background: "var(--bg-card)", border: "1px solid var(--line-soft)", borderRadius: "4px 16px 16px 16px", maxWidth: "82%", padding: "12px 14px", color: "var(--cream-soft)" }}>
                  {m.streaming && !m.content
                    ? <span className="flex items-center gap-2 text-[13px]" style={{ color: "var(--cream-mute)" }}><Loader2 size={13} className="animate-spin" /> Thinking…</span>
                    : <span className={`whitespace-pre-wrap text-[14px] leading-relaxed ${m.streaming ? "caret" : ""}`}>{m.content}</span>}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </div>

      <div className="border-t px-4 py-3" style={{ borderColor: "var(--line-soft)" }}>
        <div className="mx-auto flex max-w-3xl items-end gap-2">
          <div className="flex flex-1 items-end gap-2 rounded-2xl border px-3 py-2"
            style={{ background: "var(--bg-card)", borderColor: "var(--line)" }}>
            <textarea value={input} onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
              rows={1} placeholder="Message Hermes…"
              className="max-h-36 flex-1 resize-none bg-transparent py-1 text-[14px] outline-none"
              style={{ color: "var(--cream)", caretColor: "var(--gold)" }} />
            <MicButton onTranscript={(c) => setInput((p) => appendChunk(p, c))} size={32} />
          </div>
          <button onClick={send} disabled={!input.trim() || busy}
            className="grid h-11 w-11 place-items-center rounded-2xl text-white transition-transform hover:scale-105 disabled:opacity-30"
            style={{ background: `linear-gradient(140deg, ${hermes.gradient[0]}, ${hermes.gradient[1]})` }}>
            {busy ? <Square size={16} /> : <ArrowUp size={18} />}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════
   TALK TAB — live voice conversation
══════════════════════════════════════════════════════ */
interface TalkTurn { role: "user" | "hermes"; text: string }

function TalkTab() {
  const [turns, setTurns]     = useState<TalkTurn[]>([]);
  const [listening, setListening] = useState(false);
  const [thinking, setThinking]   = useState(false);
  const [error, setError]         = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const recRef   = useRef<{ stop: () => void } | null>(null);

  const speak = async (text: string) => {
    setThinking(true);
    try {
      const res = await fetch("/api/hermes/talk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, history: turns.slice(-6).map((t) => ({ role: t.role === "hermes" ? "assistant" : "user", text: t.text })) }),
      });
      const j = await res.json() as { reply?: string; audio?: string; error?: string };
      if (j.error) { setError(j.error); return; }
      setTurns((t) => [...t, { role: "hermes", text: j.reply ?? "" }]);
      if (j.audio) {
        const el = new Audio(j.audio);
        audioRef.current = el;
        el.play().catch(() => {});
      }
    } catch (e) {
      setError(String(e));
    } finally {
      setThinking(false);
    }
  };

  const toggle = () => {
    if (listening) {
      recRef.current?.stop();
      setListening(false);
      return;
    }
    interface SREvent { results: { 0: { transcript: string } }[] }
    interface SRCtor { new(): { continuous: boolean; interimResults: boolean; lang: string; start(): void; stop(): void; onresult: ((e: SREvent) => void) | null; onend: (() => void) | null } }
    const w = window as unknown as { SpeechRecognition?: SRCtor; webkitSpeechRecognition?: SRCtor };
    const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
    if (!Ctor) { setError("Voice input needs Chrome, Edge, or Safari."); return; }
    const rec = new Ctor();
    rec.continuous = false;
    rec.interimResults = false;
    rec.lang = navigator.language || "en-US";
    rec.onresult = (e: SREvent) => {
      const text = e.results[0]?.[0]?.transcript?.trim();
      if (text) {
        setTurns((t) => [...t, { role: "user", text }]);
        speak(text);
      }
    };
    rec.onend = () => setListening(false);
    rec.start();
    recRef.current = { stop: () => rec.stop() };
    setListening(true);
  };

  if (error) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 p-8 text-center">
        <ShieldAlert size={32} style={{ color: "var(--plum)" }} />
        <p className="text-[14px]" style={{ color: "var(--cream-soft)" }}>{error}</p>
        <button onClick={() => setError(null)} className="pill pill-warn">Dismiss</button>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col items-center justify-between py-10">
      <div className="w-full max-w-lg space-y-3 overflow-y-auto px-4" style={{ maxHeight: "45vh" }}>
        {turns.length === 0 && (
          <p className="text-center text-[13px]" style={{ color: "var(--cream-mute)" }}>
            Tap the button and talk. Hermes replies out loud.
          </p>
        )}
        {turns.map((t, i) => (
          <div key={i} className={`flex ${t.role === "user" ? "justify-end" : "justify-start"}`}>
            <div className="max-w-[80%] rounded-2xl px-4 py-2.5 text-[14px]"
              style={{
                background: t.role === "user" ? "rgba(212,165,116,0.12)" : "var(--bg-card)",
                border: `1px solid ${t.role === "user" ? "rgba(212,165,116,0.25)" : "var(--line-soft)"}`,
                color: "var(--cream-soft)",
              }}>
              {t.text}
            </div>
          </div>
        ))}
        {thinking && (
          <div className="flex justify-start">
            <div className="rounded-2xl px-4 py-2.5 text-[13px] flex items-center gap-2"
              style={{ background: "var(--bg-card)", border: "1px solid var(--line-soft)", color: "var(--cream-mute)" }}>
              <Loader2 size={13} className="animate-spin" /> Speaking…
            </div>
          </div>
        )}
      </div>

      {/* Big mic button */}
      <div className="flex flex-col items-center gap-4">
        <button onClick={toggle} disabled={thinking}
          className="relative grid h-24 w-24 place-items-center rounded-full border-2 transition-all hover:scale-105 disabled:opacity-40"
          style={{
            background: listening ? "rgba(196,96,126,0.18)" : "rgba(212,165,116,0.10)",
            borderColor: listening ? "var(--plum)" : "var(--line)",
            boxShadow: listening ? "0 0 40px -10px var(--plum)" : "none",
          }}>
          {listening && <span className="absolute inset-0 animate-ping rounded-full" style={{ background: "rgba(196,96,126,0.18)" }} />}
          {listening ? <MicOff size={32} style={{ color: "var(--plum)" }} /> : <Mic size={32} style={{ color: "var(--gold)" }} />}
        </button>
        <p className="text-[12px]" style={{ color: "var(--cream-mute)" }}>
          {thinking ? "Hermes is thinking…" : listening ? "Listening — tap to stop" : "Tap to talk"}
        </p>
        <div className="flex items-center gap-2 text-[11px]" style={{ color: "var(--cream-mute)" }}>
          <Volume2 size={12} /> Powered by MiniMax M3 + speech-02-turbo
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════
   STUDIO TAB — image / voice / video generation
══════════════════════════════════════════════════════ */
type GenKind = "image" | "voice" | "video";

interface StudioItem { name: string; url: string; mtime: number }
interface Gallery { images: StudioItem[]; voices: StudioItem[]; videos: StudioItem[] }

function StudioTab() {
  const [kind, setKind]       = useState<GenKind>("image");
  const [prompt, setPrompt]   = useState("");
  const [busy, setBusy]       = useState(false);
  const [error, setError]     = useState<string | null>(null);
  const [gallery, setGallery] = useState<Gallery>({ images: [], voices: [], videos: [] });

  const loadGallery = () =>
    fetch("/api/hermes/studio/list", { cache: "no-store" })
      .then((r) => r.json()).then((j) => setGallery(j as Gallery)).catch(() => {});

  useEffect(() => { loadGallery(); }, []);

  const generate = async () => {
    const p = prompt.trim();
    if (!p || busy) return;
    setBusy(true); setError(null);
    try {
      const res = await fetch("/api/hermes/studio/generate", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, prompt: p }),
      });
      const j = await res.json() as { ok?: boolean; error?: string; status?: string };
      if (j.error) { setError(j.error); return; }
      if (j.status === "processing") {
        setError("Video generation started — it takes ~60 s. Refresh the gallery in a moment.");
      }
      loadGallery();
    } catch (e) { setError(String(e)); }
    finally { setBusy(false); }
  };

  const items: StudioItem[] =
    kind === "image" ? gallery.images :
    kind === "voice" ? gallery.voices :
    gallery.videos;

  const KINDS: { key: GenKind; icon: React.ReactNode; label: string }[] = [
    { key: "image", icon: <Image   size={14} />, label: "Image"  },
    { key: "voice", icon: <Music   size={14} />, label: "Voice"  },
    { key: "video", icon: <Film    size={14} />, label: "Video"  },
  ];

  return (
    <div className="flex h-full flex-col gap-4 p-4">
      {/* Kind selector */}
      <div className="flex gap-2">
        {KINDS.map((k) => (
          <button key={k.key} onClick={() => setKind(k.key)}
            className="flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-[13px] transition"
            style={{
              background: kind === k.key ? "rgba(212,165,116,0.12)" : "var(--bg-card)",
              borderColor: kind === k.key ? "rgba(212,165,116,0.45)" : "var(--line-soft)",
              color: kind === k.key ? "var(--cream)" : "var(--cream-dim)",
            }}>
            {k.icon}{k.label}
          </button>
        ))}
      </div>

      {/* Prompt */}
      <div className="flex gap-2">
        <input value={prompt} onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && generate()}
          placeholder={kind === "image" ? "Describe an image…" : kind === "voice" ? "Text to speak…" : "Describe a video…"}
          className="flex-1 rounded-xl border px-3 py-2.5 text-[14px] outline-none"
          style={{ background: "var(--bg-card)", borderColor: "var(--line)", color: "var(--cream)", caretColor: "var(--gold)" }} />
        <button onClick={generate} disabled={!prompt.trim() || busy}
          className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-[13px] font-semibold text-white transition-transform hover:scale-[1.02] disabled:opacity-30"
          style={{ background: `linear-gradient(140deg, ${hermes.gradient[0]}, ${hermes.gradient[1]})` }}>
          {busy ? <><Loader2 size={14} className="animate-spin" /> Working…</> : <><Sparkles size={14} /> Generate</>}
        </button>
      </div>

      {error && (
        <div className="rounded-xl border px-4 py-3 text-[13px]"
          style={{ borderColor: "rgba(196,96,126,0.35)", background: "rgba(196,96,126,0.07)", color: "var(--cream-soft)" }}>
          {error}
        </div>
      )}

      {/* Gallery */}
      <div className="min-h-0 flex-1 overflow-y-auto">
        {items.length === 0
          ? <p className="py-10 text-center text-[13px]" style={{ color: "var(--cream-mute)" }}>Nothing generated yet. Enter a prompt above.</p>
          : (
            <div className={`grid gap-3 ${kind === "image" ? "grid-cols-2 sm:grid-cols-3" : "grid-cols-1 sm:grid-cols-2"}`}>
              {items.map((item) => (
                <motion.div key={item.name} initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }}
                  className="overflow-hidden rounded-xl border" style={{ borderColor: "var(--line-soft)" }}>
                  {kind === "image" && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={item.url} alt={item.name} className="h-40 w-full object-cover" />
                  )}
                  {kind === "voice" && (
                    <div className="flex flex-col gap-2 p-3" style={{ background: "var(--bg-card)" }}>
                      <audio controls src={item.url} className="w-full" style={{ height: 36 }} />
                      <p className="truncate text-[11px]" style={{ color: "var(--cream-mute)" }}>{item.name}</p>
                    </div>
                  )}
                  {kind === "video" && (
                    <video controls src={item.url} className="h-40 w-full object-cover" />
                  )}
                </motion.div>
              ))}
            </div>
          )}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════
   ROOT — tab switcher
══════════════════════════════════════════════════════ */
type Tab = "chat" | "talk" | "studio";

export default function HermesView() {
  const [tab, setTab] = useState<Tab>("chat");

  const TABS: { key: Tab; icon: React.ReactNode; label: string }[] = [
    { key: "chat",   icon: <MessageSquare size={14} />, label: "Chat"   },
    { key: "talk",   icon: <Mic           size={14} />, label: "Talk"   },
    { key: "studio", icon: <Sparkles      size={14} />, label: "Studio" },
  ];

  return (
    <div className="flex h-[calc(100vh-3.5rem)] flex-col">
      {/* Header */}
      <div className="flex items-center gap-3 border-b px-6 py-3.5 shrink-0" style={{ borderColor: "var(--line-soft)" }}>
        <Avatar agent={hermes} size="md" showStatus />
        <div className="min-w-0 flex-1">
          <div className="font-semibold" style={{ fontFamily: "var(--font-bricolage)", color: "var(--cream)" }}>Hermes</div>
          <div className="flex items-center gap-1.5 text-[12px]" style={{ color: "var(--cream-dim)" }}>
            <span className="metric" style={{ color: "var(--gold)" }}>minimax/minimax-m2.7</span>
            <span style={{ color: "var(--cream-mute)" }}>· OpenRouter · live</span>
          </div>
        </div>
        {/* Tab bar */}
        <div className="flex gap-1.5">
          {TABS.map((t) => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className="flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-[13px] transition"
              style={{
                background: tab === t.key ? "rgba(212,165,116,0.10)" : "transparent",
                borderColor: tab === t.key ? "rgba(212,165,116,0.40)" : "var(--line-soft)",
                color: tab === t.key ? "var(--cream)" : "var(--cream-dim)",
              }}>
              {t.icon}{t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      <div className="min-h-0 flex-1">
        <AnimatePresence mode="wait">
          <motion.div key={tab} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }} className="h-full">
            {tab === "chat"   && <ChatTab />}
            {tab === "talk"   && <TalkTab />}
            {tab === "studio" && <StudioTab />}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
