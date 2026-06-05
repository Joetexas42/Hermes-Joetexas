"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { NotebookPen, Send } from "lucide-react";
import { MicButton } from "@/components/MicButton";

const appendChunk = (prev: string, chunk: string) =>
  (prev && !prev.endsWith(" ") ? prev + " " : prev) + chunk;

interface Entry {
  id: string;
  text: string;
  createdAt: string;
}

export default function JournalPage() {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [text, setText] = useState("");

  const load = async () => setEntries(await (await fetch("/api/journal", { cache: "no-store" })).json());
  useEffect(() => {
    load();
  }, []);

  const add = async () => {
    const t = text.trim();
    if (!t) return;
    setText("");
    await fetch("/api/journal", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: t }),
    });
    load();
  };

  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <div className="flex items-center gap-3">
        <span className="grid h-11 w-11 place-items-center rounded-2xl bg-gradient-to-br from-amber to-magenta text-white">
          <NotebookPen className="h-5 w-5" />
        </span>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Journal</h1>
          <p className="text-[13px] text-muted">Capture a thought. It lands in today&apos;s vault note.</p>
        </div>
      </div>

      <div className="glass mt-6 rounded-2xl p-3">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) add();
          }}
          rows={3}
          placeholder="What's on your mind?  (tap the mic to talk · ⌘/Ctrl+Enter to save)"
          className="w-full resize-none bg-transparent px-2 py-1 text-[14px] outline-none placeholder:text-[var(--faint)]"
        />
        <div className="flex items-center justify-end gap-2">
          <MicButton onTranscript={(c) => setText((p) => appendChunk(p, c))} size={40} />
          <button
            onClick={add}
            className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-amber to-magenta px-4 py-2 text-sm font-semibold text-white transition-transform hover:scale-[1.02]"
          >
            <Send className="h-4 w-4" />
            Save entry
          </button>
        </div>
      </div>

      <div className="mt-6 space-y-3">
        <AnimatePresence initial={false}>
          {entries.map((e) => (
            <motion.div
              key={e.id}
              layout
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              className="glass rounded-xl p-4"
            >
              <div className="text-[11px] uppercase tracking-[0.12em] text-[var(--faint)]">
                {new Date(e.createdAt).toLocaleString([], {
                  month: "short",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </div>
              <p className="mt-1 whitespace-pre-wrap text-[14px] leading-relaxed">{e.text}</p>
            </motion.div>
          ))}
        </AnimatePresence>
        {entries.length === 0 && (
          <p className="py-10 text-center text-[13px] text-muted">No entries yet. Write your first above.</p>
        )}
      </div>
    </div>
  );
}
