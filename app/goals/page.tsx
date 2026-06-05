"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Target, Plus, Check } from "lucide-react";
import { MicButton } from "@/components/MicButton";

const appendChunk = (prev: string, chunk: string) =>
  (prev && !prev.endsWith(" ") ? prev + " " : prev) + chunk;

interface Goal {
  id: string;
  text: string;
  done: boolean;
  createdAt: string;
}

export default function GoalsPage() {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [text, setText] = useState("");

  const load = async () => setGoals(await (await fetch("/api/goals", { cache: "no-store" })).json());
  useEffect(() => {
    load();
  }, []);

  const add = async () => {
    const t = text.trim();
    if (!t) return;
    setText("");
    await fetch("/api/goals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: t }),
    });
    load();
  };

  const toggle = async (id: string) => {
    setGoals((g) => g.map((x) => (x.id === id ? { ...x, done: !x.done } : x)));
    await fetch("/api/goals", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    load();
  };

  const active = goals.filter((g) => !g.done);
  const done = goals.filter((g) => g.done);
  const pct = goals.length ? Math.round((done.length / goals.length) * 100) : 0;

  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <div className="flex items-center gap-3">
        <span className="grid h-11 w-11 place-items-center rounded-2xl bg-gradient-to-br from-cyan to-purple text-white">
          <Target className="h-5 w-5" />
        </span>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Goals</h1>
          <p className="text-[13px] text-muted">Set targets, tick them off. Mirrored to your vault.</p>
        </div>
      </div>

      {/* progress */}
      <div className="glass mt-6 rounded-2xl p-4">
        <div className="flex items-center justify-between text-[12px] text-muted">
          <span>{active.length} active · {done.length} done</span>
          <span className="font-semibold text-fg">{pct}%</span>
        </div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/[0.06]">
          <motion.div
            className="h-full rounded-full bg-gradient-to-r from-cyan to-green"
            animate={{ width: `${pct}%` }}
            transition={{ type: "spring", stiffness: 120, damping: 20 }}
          />
        </div>
      </div>

      {/* add */}
      <div className="mt-4 flex gap-2">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add()}
          placeholder="What's the goal?  (or tap the mic)"
          className="flex-1 rounded-xl border border-[var(--border-strong)] bg-[var(--panel-solid)] px-4 py-2.5 text-[14px] outline-none placeholder:text-[var(--faint)] focus:border-white/25"
        />
        <MicButton onTranscript={(c) => setText((p) => appendChunk(p, c))} size={44} />
        <button
          onClick={add}
          className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-cyan to-purple px-4 py-2.5 text-sm font-semibold text-white transition-transform hover:scale-[1.02]"
        >
          <Plus className="h-4 w-4" />
          Add
        </button>
      </div>

      {/* list */}
      <div className="mt-6 space-y-2">
        <AnimatePresence initial={false}>
          {goals.map((g) => (
            <motion.button
              key={g.id}
              layout
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              onClick={() => toggle(g.id)}
              className="glass flex w-full items-center gap-3 rounded-xl p-3 text-left transition-colors hover:border-white/15"
            >
              <span
                className={`grid h-5 w-5 shrink-0 place-items-center rounded-md border ${
                  g.done ? "border-green bg-green/20 text-green" : "border-[var(--border-strong)]"
                }`}
              >
                {g.done && <Check className="h-3.5 w-3.5" />}
              </span>
              <span className={`text-[14px] ${g.done ? "text-muted line-through" : ""}`}>{g.text}</span>
            </motion.button>
          ))}
        </AnimatePresence>
        {goals.length === 0 && (
          <p className="py-10 text-center text-[13px] text-muted">Nothing yet. Add your first goal above.</p>
        )}
      </div>

      <p className="mt-6 text-center text-[11px] text-[var(--faint)]">
        Saved to <code className="rounded bg-white/[0.06] px-1.5 py-0.5">Agentic OS/{new Date().toISOString().slice(0, 10)}.md</code>
      </p>
    </div>
  );
}
