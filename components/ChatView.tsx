"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowUp, Square, ShieldCheck, Lock, Eraser, Mic } from "lucide-react";
import type { Agent } from "@/lib/agents";
import { Avatar } from "@/components/Avatar";
import { useSpeechRecognition } from "@/lib/useSpeechRecognition";

interface Msg {
  role: "user" | "assistant" | "system";
  content: string;
  streaming?: boolean;
  cost?: number | null;
}

export function ChatView({ agent }: { agent: Agent }) {
  const live = agent.status === "live";
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const speech = useSpeechRecognition((chunk) =>
    setInput((prev) => (prev && !prev.endsWith(" ") ? prev + " " : prev) + chunk),
  );

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const patchLast = (fn: (msg: Msg) => Msg) =>
    setMessages((m) => {
      const copy = [...m];
      copy[copy.length - 1] = fn(copy[copy.length - 1]);
      return copy;
    });

  const stop = () => {
    abortRef.current?.abort();
    setBusy(false);
    setMessages((m) => m.map((msg) => (msg.streaming ? { ...msg, streaming: false } : msg)));
  };

  const send = async () => {
    const prompt = input.trim();
    if (!prompt || busy) return;
    speech.stop();
    setInput("");

    if (!live) {
      setMessages((m) => [
        ...m,
        { role: "user", content: prompt },
        {
          role: "system",
          content: `${agent.name} isn't connected yet, so I won't fake a reply. ${agent.connection}`,
        },
      ]);
      return;
    }

    setBusy(true);
    setMessages((m) => [
      ...m,
      { role: "user", content: prompt },
      { role: "assistant", content: "", streaming: true },
    ]);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await fetch("/api/claude", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, sessionId }),
        signal: controller.signal,
      });
      if (!res.body) throw new Error("No response stream.");
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      let assistantText = "";
      let errored = false;
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
          if (evt.type === "session") setSessionId(evt.id);
          else if (evt.type === "delta") {
            assistantText += evt.text;
            patchLast((msg) => ({ ...msg, content: msg.content + evt.text }));
          } else if (evt.type === "done") {
            if (!assistantText) assistantText = evt.result || "";
            patchLast((msg) => ({
              ...msg,
              streaming: false,
              cost: evt.cost,
              content: msg.content || evt.result || "",
            }));
            if (evt.sessionId) setSessionId(evt.sessionId);
          } else if (evt.type === "error") {
            errored = true;
            patchLast((msg) => ({ ...msg, streaming: false, content: msg.content || `⚠️ ${evt.message}` }));
          }
        }
      }

      // Mirror the completed exchange into the Obsidian vault (fire-and-forget).
      if (!errored && assistantText.trim()) {
        fetch("/api/vault", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ kind: "chat", agent: agent.name, you: prompt, assistant: assistantText }),
        }).catch(() => {});
      }
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        patchLast((msg) => ({ ...msg, streaming: false, content: msg.content || `⚠️ ${(err as Error).message}` }));
      }
    } finally {
      setBusy(false);
      abortRef.current = null;
    }
  };

  return (
    <div className="flex h-[calc(100vh-3.5rem)] flex-col">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-[var(--border)] px-6 py-3.5">
        <Avatar agent={agent} size="md" showStatus />
        <div className="min-w-0 flex-1">
          <div className="font-semibold leading-tight">{agent.name}</div>
          <div className="flex items-center gap-1.5 text-[12px] text-muted">
            {live ? (
              <>
                <ShieldCheck className="h-3.5 w-3.5 text-green" />
                Plan mode · read-only · streamed from your local CLI
              </>
            ) : (
              <>
                <Lock className="h-3.5 w-3.5" />
                {agent.role} · not connected
              </>
            )}
          </div>
        </div>
        {messages.length > 0 && (
          <button
            onClick={() => {
              setMessages([]);
              setSessionId(null);
            }}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border)] px-2.5 py-1.5 text-[12px] text-muted transition-colors hover:text-fg"
          >
            <Eraser className="h-3.5 w-3.5" />
            Clear
          </button>
        )}
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto px-6 py-6">
        <div className="mx-auto max-w-3xl space-y-4">
          {messages.length === 0 && <EmptyState agent={agent} onPick={setInput} />}
          <AnimatePresence initial={false}>
            {messages.map((msg, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.22 }}
                className={
                  msg.role === "user"
                    ? "flex justify-end"
                    : msg.role === "system"
                      ? "flex justify-center"
                      : "flex items-start justify-start gap-2.5"
                }
              >
                {msg.role === "assistant" && <Avatar agent={agent} size="sm" />}
                {msg.role === "system" ? (
                  <div className="max-w-[85%] rounded-xl border border-[var(--border)] bg-white/[0.02] px-4 py-2.5 text-center text-[13px] text-muted">
                    {msg.content}
                  </div>
                ) : (
                  <div
                    className={
                      msg.role === "user"
                        ? "max-w-[78%] rounded-2xl rounded-br-md bg-white/[0.08] px-4 py-2.5 text-[14px] text-fg"
                        : "max-w-[82%] rounded-2xl rounded-bl-md border border-[var(--border)] bg-[var(--panel-solid)] px-4 py-3 text-[14px] leading-relaxed"
                    }
                  >
                    <span className={`whitespace-pre-wrap ${msg.streaming ? "caret" : ""}`}>{msg.content}</span>
                    {msg.role === "assistant" && typeof msg.cost === "number" && (
                      <div className="mt-2 text-[11px] text-[var(--faint)]">${msg.cost.toFixed(4)} · session kept</div>
                    )}
                  </div>
                )}
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </div>

      {/* Composer */}
      <div className="border-t border-[var(--border)] px-6 py-4">
        <div className="mx-auto flex max-w-3xl items-end gap-2">
          <div
            className="flex flex-1 items-end gap-2 rounded-2xl border border-[var(--border-strong)] bg-[var(--panel-solid)] px-4 py-2.5 transition-colors focus-within:border-white/25"
          >
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
              }}
              rows={1}
              placeholder={`Message ${agent.name}…`}
              className="max-h-40 flex-1 resize-none bg-transparent py-1 text-[14px] outline-none placeholder:text-[var(--faint)]"
            />
            <button
              type="button"
              onClick={speech.toggle}
              disabled={!speech.supported}
              title={
                !speech.supported
                  ? "Voice input needs Chrome, Edge, or Safari"
                  : speech.listening
                    ? "Stop dictation"
                    : "Click to talk"
              }
              className={`relative grid h-8 w-8 shrink-0 place-items-center rounded-full transition-colors disabled:opacity-30 ${
                speech.listening
                  ? "bg-red-500/20 text-red-400"
                  : "text-[var(--faint)] hover:text-fg"
              }`}
            >
              {speech.listening && (
                <span className="absolute h-8 w-8 animate-ping rounded-full bg-red-500/25" />
              )}
              <Mic className="h-[18px] w-[18px]" />
            </button>
          </div>
          {busy ? (
            <button
              onClick={stop}
              className="grid h-11 w-11 place-items-center rounded-2xl border border-[var(--border-strong)] bg-white/[0.04] text-muted transition-colors hover:text-fg"
              title="Stop"
            >
              <Square className="h-4 w-4" />
            </button>
          ) : (
            <button
              onClick={send}
              disabled={!input.trim()}
              className="grid h-11 w-11 place-items-center rounded-2xl text-white shadow-[0_6px_20px_-8px_rgba(0,0,0,0.7)] transition-transform hover:scale-105 disabled:opacity-30 disabled:hover:scale-100"
              style={{ background: `linear-gradient(140deg, ${agent.gradient[0]}, ${agent.gradient[1]})` }}
              title="Send"
            >
              <ArrowUp className="h-5 w-5" />
            </button>
          )}
        </div>
        {speech.listening ? (
          <p className="mx-auto mt-2 flex max-w-3xl items-center justify-center gap-2 text-[11px] text-red-400">
            <span className="live-dot inline-block h-1.5 w-1.5 rounded-full bg-red-500" />
            Listening… {speech.interim && <span className="text-muted">“{speech.interim}”</span>}
          </p>
        ) : (
          <p className="mx-auto mt-2 max-w-3xl text-center text-[11px] text-[var(--faint)]">
            {live
              ? "Enter to send · Shift+Enter for newline · tap the mic to talk"
              : `This is a real chat surface for ${agent.name}. Wire it up and it goes live here.`}
          </p>
        )}
      </div>
    </div>
  );
}

function EmptyState({ agent, onPick }: { agent: Agent; onPick: (p: string) => void }) {
  const prompts = agent.status === "live"
    ? [
        "What's in my current working directory?",
        "Summarize what this Agentic OS app does.",
        "Give me 3 ideas for the next agent to dock in.",
      ]
    : [];
  return (
    <div className="mt-12 flex flex-col items-center text-center">
      <Avatar agent={agent} size="lg" showStatus />
      <h2 className="mt-4 text-xl font-semibold">{agent.name}</h2>
      <p className="mx-auto mt-1 max-w-sm text-[13px] text-muted">{agent.tagline}</p>
      {agent.status === "live" ? (
        <div className="mx-auto mt-6 flex max-w-md flex-col gap-2">
          {prompts.map((p) => (
            <button
              key={p}
              onClick={() => onPick(p)}
              className="rounded-xl border border-[var(--border)] bg-white/[0.02] px-4 py-2.5 text-left text-[13px] text-muted transition-colors hover:border-white/20 hover:text-fg"
            >
              {p}
            </button>
          ))}
        </div>
      ) : (
        <div className="mx-auto mt-5 max-w-md rounded-xl border border-[var(--border)] bg-white/[0.02] px-4 py-3 text-[13px] leading-relaxed text-muted">
          {agent.connection}
        </div>
      )}
    </div>
  );
}
