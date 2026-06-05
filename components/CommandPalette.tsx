"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard, Target, NotebookPen, Settings,
  Sparkles, Feather, Gem, Rocket, Braces, Orbit,
  ArrowRight, Search,
} from "lucide-react";
import { searchCommands, type Command } from "@/lib/commands";
import { AGENTS } from "@/lib/agents";

const PAGE_ICONS: Record<string, React.ReactNode> = {
  "layout-dashboard": <LayoutDashboard className="h-4 w-4" />,
  target:             <Target className="h-4 w-4" />,
  "notebook-pen":     <NotebookPen className="h-4 w-4" />,
  settings:           <Settings className="h-4 w-4" />,
};

const AGENT_GLYPHS: Record<string, React.ReactNode> = {
  sparkles: <Sparkles className="h-4 w-4" />,
  feather:  <Feather className="h-4 w-4" />,
  gem:      <Gem className="h-4 w-4" />,
  rocket:   <Rocket className="h-4 w-4" />,
  braces:   <Braces className="h-4 w-4" />,
  orbit:    <Orbit className="h-4 w-4" />,
};

function CommandIcon({ cmd }: { cmd: Command }) {
  if (cmd.kind === "agent") {
    const agent = AGENTS.find((a) => `agent-${a.slug}` === cmd.id);
    if (agent) {
      return (
        <span
          className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-white"
          style={{ background: `linear-gradient(140deg,${agent.gradient[0]},${agent.gradient[1]})` }}
        >
          {AGENT_GLYPHS[agent.icon]}
        </span>
      );
    }
  }
  return (
    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-[var(--border-strong)] text-muted">
      {cmd.icon ? PAGE_ICONS[cmd.icon] : <ArrowRight className="h-4 w-4" />}
    </span>
  );
}

/* ─────────── Context exposed to the whole app ─────────── */
import { createContext, useContext } from "react";

interface PaletteCtx {
  open: () => void;
  close: () => void;
}
const Ctx = createContext<PaletteCtx>({ open: () => {}, close: () => {} });
export const usePalette = () => useContext(Ctx);

export function CommandPaletteProvider({ children }: { children: React.ReactNode }) {
  const [visible, setVisible] = useState(false);
  const open  = useCallback(() => setVisible(true),  []);
  const close = useCallback(() => setVisible(false), []);

  /* Global keyboard shortcut */
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setVisible((v) => !v);
      }
      if (e.key === "Escape") setVisible(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  return (
    <Ctx.Provider value={{ open, close }}>
      {children}
      <CommandPalette visible={visible} onClose={close} />
    </Ctx.Provider>
  );
}

/* ─────────── The palette UI ─────────── */
function CommandPalette({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [cursor, setCursor] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const results = searchCommands(query);

  /* Reset + focus on open */
  useEffect(() => {
    if (visible) {
      setQuery("");
      setCursor(0);
      setTimeout(() => inputRef.current?.focus(), 30);
    }
  }, [visible]);

  useEffect(() => setCursor(0), [query]);

  const go = (cmd: Command) => {
    if (cmd.href) router.push(cmd.href);
    onClose();
  };

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setCursor((c) => Math.min(c + 1, results.length - 1)); }
    if (e.key === "ArrowUp")   { e.preventDefault(); setCursor((c) => Math.max(c - 1, 0)); }
    if (e.key === "Enter")     { e.preventDefault(); if (results[cursor]) go(results[cursor]); }
  };

  return (
    <AnimatePresence>
      {visible && (
        <>
          {/* Backdrop */}
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            onClick={onClose}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
          />

          {/* Panel */}
          <motion.div
            key="panel"
            initial={{ opacity: 0, scale: 0.97, y: -8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: -8 }}
            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
            className="fixed left-1/2 top-[18vh] z-50 w-full max-w-xl -translate-x-1/2"
          >
            <div className="glass overflow-hidden rounded-2xl border border-[var(--border-strong)] shadow-[0_32px_80px_-12px_rgba(0,0,0,0.9)]">
              {/* Search row */}
              <div className="flex items-center gap-3 border-b border-[var(--border)] px-4 py-3.5">
                <Search className="h-4 w-4 shrink-0 text-[var(--faint)]" />
                <input
                  ref={inputRef}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={onKey}
                  placeholder="Search agents, pages, actions…"
                  className="flex-1 bg-transparent text-[15px] outline-none placeholder:text-[var(--faint)]"
                />
                <kbd className="rounded border border-[var(--border-strong)] bg-white/[0.05] px-1.5 py-0.5 font-mono text-[10px] text-[var(--faint)]">
                  ESC
                </kbd>
              </div>

              {/* Results */}
              <ul className="max-h-80 overflow-y-auto p-2">
                {results.length === 0 && (
                  <li className="px-3 py-8 text-center text-[13px] text-[var(--faint)]">No results.</li>
                )}
                {results.map((cmd, i) => (
                  <li key={cmd.id}>
                    <button
                      onMouseEnter={() => setCursor(i)}
                      onClick={() => go(cmd)}
                      className={`flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left transition-colors ${
                        i === cursor ? "bg-white/[0.07]" : "hover:bg-white/[0.04]"
                      }`}
                    >
                      <CommandIcon cmd={cmd} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[14px] font-medium">{cmd.label}</span>
                        {cmd.sub && (
                          <span className="block truncate text-[12px] text-muted">{cmd.sub}</span>
                        )}
                      </span>
                      <span className="text-[11px] text-[var(--faint)]">
                        {cmd.kind === "agent" ? "Agent" : "Page"}
                      </span>
                      {i === cursor && (
                        <kbd className="rounded border border-[var(--border-strong)] bg-white/[0.05] px-1.5 py-0.5 font-mono text-[10px] text-[var(--faint)]">
                          ↵
                        </kbd>
                      )}
                    </button>
                  </li>
                ))}
              </ul>

              {/* Footer */}
              <div className="flex items-center gap-4 border-t border-[var(--border)] px-4 py-2.5 text-[11px] text-[var(--faint)]">
                <span><kbd className="mr-1 font-mono">↑↓</kbd>navigate</span>
                <span><kbd className="mr-1 font-mono">↵</kbd>open</span>
                <span><kbd className="mr-1 font-mono">Esc</kbd>close</span>
                <span className="ml-auto">Ctrl+K to toggle</span>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
