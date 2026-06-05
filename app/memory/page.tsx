"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Brain, Search, FileText, Clock, Network, X } from "lucide-react";
import dynamic from "next/dynamic";

// Load the heavy canvas component client-side only.
const VaultGraph3D = dynamic(() => import("@/components/VaultGraph3D"), { ssr: false });

type Tab = "graph" | "recent" | "notes";

interface NoteHit   { path: string; title: string; preview: string; score: number; mtime: number; }
interface RecentNote { path: string; title: string; mtime: number; }

export default function MemoryPage() {
  const [tab, setTab]       = useState<Tab>("graph");
  const [q, setQ]           = useState("");
  const [notes, setNotes]   = useState<NoteHit[]>([]);
  const [recent, setRecent] = useState<RecentNote[]>([]);
  const [open, setOpen]     = useState<{ path: string; content: string } | null>(null);
  const [searching, setSearching] = useState(false);
  const [stats, setStats]   = useState<{ nodes: number; links: number } | null>(null);
  const debRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Fetch recent on mount + graph stats
  useEffect(() => {
    fetch("/api/memory/recent", { cache: "no-store" })
      .then((r) => r.json()).then((j) => setRecent(j.recent ?? []));
    fetch("/api/memory/graph", { cache: "no-store" })
      .then((r) => r.json()).then((j) => setStats({ nodes: j.nodes?.length ?? 0, links: j.links?.length ?? 0 }));
  }, []);

  // Debounced search
  useEffect(() => {
    if (!q.trim()) { setNotes([]); setSearching(false); return; }
    setSearching(true);
    if (debRef.current) clearTimeout(debRef.current);
    debRef.current = setTimeout(async () => {
      try {
        const r = await fetch(`/api/memory/search?q=${encodeURIComponent(q)}`);
        const j = await r.json();
        setNotes(j.notes ?? []);
        if (tab === "recent") setTab("notes");
      } finally { setSearching(false); }
    }, 220);
    return () => { if (debRef.current) clearTimeout(debRef.current); };
  }, [q, tab]);

  const openNote = async (p: string) => {
    const r = await fetch(`/api/memory/note?path=${encodeURIComponent(p)}`);
    if (!r.ok) return;
    const j = await r.json();
    setOpen({ path: j.path, content: j.content });
  };

  const fmtAgo = (ms: number) => {
    const d = Date.now() - ms;
    if (d < 60_000)       return "just now";
    if (d < 3_600_000)    return `${Math.floor(d / 60_000)}m ago`;
    if (d < 86_400_000)   return `${Math.floor(d / 3_600_000)}h ago`;
    return `${Math.floor(d / 86_400_000)}d ago`;
  };

  const highlight = (text: string) => {
    if (!q.trim()) return <>{text}</>;
    const re = new RegExp(`(${q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "ig");
    return (
      <>
        {text.split(re).map((part, i) =>
          re.test(part)
            ? <mark key={i} style={{ background: "rgba(212,165,116,0.30)", color: "var(--cream)", borderRadius: 2, padding: "0 2px" }}>{part}</mark>
            : <span key={i}>{part}</span>,
        )}
      </>
    );
  };

  const TABS: { key: Tab; label: string; icon: React.ReactNode; count?: number }[] = [
    { key: "graph",  label: "Graph",  icon: <Network  size={12} /> },
    { key: "recent", label: "Recent", icon: <Clock    size={12} />, count: recent.length },
    { key: "notes",  label: "Notes",  icon: <FileText size={12} />, count: notes.length },
  ];

  return (
    <div className="mx-auto max-w-[1400px] space-y-6 px-6 py-8 md:px-10">

      {/* Header */}
      <div>
        <div className="eyebrow mb-4">
          <span className="num">XV.</span>
          <span className="line" />
          <span className="label">Self · Memory</span>
        </div>
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="page-title">Memory</h1>
            <p className="page-subtitle">
              Your Obsidian vault as a live 3-D knowledge graph.
              {stats && <> <span className="metric" style={{ color: "var(--gold)" }}>{stats.nodes}</span> notes · <span className="metric" style={{ color: "var(--gold)" }}>{stats.links}</span> links.</>}
            </p>
          </div>
          {/* Search */}
          <div className="flex items-center gap-2 rounded-xl border px-3 py-2 min-w-[260px]" style={{ borderColor: "var(--line)", background: "var(--bg-card)" }}>
            <Search size={14} style={{ color: "var(--cream-mute)" }} />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search your vault…"
              className="flex-1 bg-transparent outline-none text-sm"
              style={{ color: "var(--cream)" }}
            />
            {searching && <span className="text-[10px] uppercase tracking-wider" style={{ color: "var(--cream-mute)" }}>…</span>}
            {q && !searching && (
              <button onClick={() => setQ("")} style={{ color: "var(--cream-dim)" }}><X size={12} /></button>
            )}
          </div>
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1.5">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className="flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[12px] transition"
            style={{
              background: tab === t.key ? "rgba(212,165,116,0.10)" : "rgba(255,255,255,0.02)",
              borderColor: tab === t.key ? "rgba(212,165,116,0.45)" : "var(--line-soft)",
              color: tab === t.key ? "var(--cream)" : "var(--cream-dim)",
            }}
          >
            {t.icon}
            {t.label}
            {t.count !== undefined && t.count > 0 && (
              <span className="metric text-[10px]" style={{ color: "var(--cream-mute)" }}>{t.count}</span>
            )}
          </button>
        ))}
      </div>

      {/* Graph tab */}
      {tab === "graph" && (
        <div className="flex flex-col gap-4">
          <div
            className="relative overflow-hidden rounded-2xl border"
            style={{ height: "70vh", minHeight: 480, borderColor: "var(--line-soft)", background: "#000" }}
          >
            <VaultGraph3D onOpenNote={(p) => { openNote(p); }} />
          </div>
          {open && (
            <NoteViewer note={open} onClose={() => setOpen(null)} />
          )}
        </div>
      )}

      {/* Recent + Notes tabs — list + viewer side-by-side */}
      {tab !== "graph" && (
        <div className="flex flex-col gap-4 lg:flex-row" style={{ minHeight: 520 }}>
          {/* List */}
          <div className="flex flex-col gap-2 lg:w-[360px] shrink-0">
            {tab === "recent" && recent.map((n) => (
              <motion.button
                key={n.path}
                initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }}
                onClick={() => openNote(n.path)}
                className="surface-card text-left"
                style={{ padding: "12px 16px" }}
              >
                <div className="text-[13px] truncate" style={{ color: "var(--cream)" }}>{n.title}</div>
                <div className="flex justify-between mt-1">
                  <span className="text-[10px] truncate mr-2" style={{ color: "var(--cream-mute)" }}>{n.path}</span>
                  <span className="text-[10px] shrink-0" style={{ color: "var(--cream-mute)" }}>{fmtAgo(n.mtime)}</span>
                </div>
              </motion.button>
            ))}

            {tab === "notes" && notes.map((n) => (
              <motion.button
                key={n.path}
                initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }}
                onClick={() => openNote(n.path)}
                className="surface-card text-left"
                style={{ padding: "12px 16px" }}
              >
                <div className="text-[13px] truncate" style={{ color: "var(--cream)" }}>{highlight(n.title)}</div>
                <div className="text-[12px] mt-1 leading-snug line-clamp-2" style={{ color: "var(--cream-soft)" }}>{highlight(n.preview)}</div>
                <div className="text-[10px] mt-1 truncate" style={{ color: "var(--cream-mute)" }}>{n.path}</div>
              </motion.button>
            ))}

            {tab === "notes" && q && notes.length === 0 && !searching && (
              <p className="text-[13px] px-1" style={{ color: "var(--cream-dim)" }}>No notes match "{q}".</p>
            )}
            {tab === "recent" && recent.length === 0 && (
              <p className="text-[13px] px-1" style={{ color: "var(--cream-dim)" }}>No recent notes found.</p>
            )}
          </div>

          {/* Note viewer */}
          <div className="flex-1 min-h-0">
            <AnimatePresence mode="wait">
              {open ? (
                <motion.div key={open.path} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                  <NoteViewer note={open} onClose={() => setOpen(null)} />
                </motion.div>
              ) : (
                <motion.div
                  key="empty"
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                  className="panel flex h-full min-h-[400px] items-center justify-center text-center p-6"
                >
                  <div>
                    <Brain size={28} className="mx-auto mb-3" style={{ color: "var(--cream-mute)" }} />
                    <div className="text-sm" style={{ color: "var(--cream-dim)" }}>Select a note to read it.</div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      )}

    </div>
  );
}

function NoteViewer({ note, onClose }: { note: { path: string; content: string }; onClose: () => void }) {
  return (
    <div className="panel overflow-hidden flex flex-col" style={{ maxHeight: "60vh", minHeight: 280 }}>
      <div className="flex items-center justify-between border-b px-4 py-2 shrink-0" style={{ borderColor: "var(--line-soft)", background: "rgba(0,0,0,0.2)" }}>
        <span className="text-[11px] uppercase tracking-widest truncate" style={{ color: "var(--cream-mute)" }}>{note.path}</span>
        <button onClick={onClose} className="ml-3 shrink-0 text-[11px] transition hover:opacity-100 opacity-60" style={{ color: "var(--cream)" }}>
          <X size={14} />
        </button>
      </div>
      <pre className="scroll flex-1 min-h-0 overflow-auto p-4 text-[12.5px] leading-relaxed whitespace-pre-wrap" style={{ color: "var(--cream)", fontFamily: "var(--font-mono), monospace" }}>
        {note.content}
      </pre>
    </div>
  );
}
