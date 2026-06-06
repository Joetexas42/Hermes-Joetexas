"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus, Search, Copy, Trash2, Check, X, Edit3, Braces,
} from "lucide-react";
import type { Snippet } from "@/lib/snippet";
import { Avatar } from "@/components/Avatar";
import { getAgent } from "@/lib/agents";

const codex = getAgent("codex")!;

const LANGUAGES = [
  "typescript", "javascript", "python", "bash", "html", "css",
  "sql", "json", "yaml", "markdown", "go", "rust", "text",
];

export default function CodexView() {
  const [snippets, setSnippets] = useState<Snippet[]>([]);
  const [search, setSearch]     = useState("");
  const [adding, setAdding]     = useState(false);
  const [editing, setEditing]   = useState<string | null>(null);
  const [copied, setCopied]     = useState<string | null>(null);

  // New snippet form
  const [title, setTitle]       = useState("");
  const [code, setCode]         = useState("");
  const [lang, setLang]         = useState("typescript");
  const [tags, setTags]         = useState("");

  const load = async () => {
    const q = search.trim() ? `?q=${encodeURIComponent(search)}` : "";
    const r = await fetch(`/api/snippets${q}`, { cache: "no-store" });
    setSnippets(await r.json());
  };

  useEffect(() => { load(); }, [search]);

  const resetForm = () => { setTitle(""); setCode(""); setLang("typescript"); setTags(""); setAdding(false); setEditing(null); };

  const save = async () => {
    if (!title.trim() || !code.trim()) return;

    if (editing) {
      await fetch(`/api/snippets/${editing}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, code, language: lang, tags }),
      });
    } else {
      await fetch("/api/snippets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, code, language: lang, tags }),
      });
    }
    resetForm();
    load();
  };

  const del = async (id: string) => {
    await fetch(`/api/snippets/${id}`, { method: "DELETE" });
    load();
  };

  const edit = (s: Snippet) => {
    setTitle(s.title); setCode(s.code); setLang(s.language); setTags(s.tags);
    setEditing(s.id); setAdding(true);
  };

  const copyCode = (id: string, text: string) => {
    navigator.clipboard.writeText(text).catch(() => {});
    setCopied(id);
    setTimeout(() => setCopied(null), 1500);
  };

  const fmtDate = (ms: number) => new Date(ms).toLocaleDateString("en-GB", { day: "numeric", month: "short" });

  return (
    <div className="flex h-[calc(100vh-3.5rem)] flex-col">
      {/* Header */}
      <div className="flex items-center gap-3 border-b px-6 py-3.5 shrink-0" style={{ borderColor: "var(--line-soft)" }}>
        <Avatar agent={codex} size="md" showStatus />
        <div className="min-w-0 flex-1">
          <div className="font-semibold" style={{ fontFamily: "var(--font-bricolage)", color: "var(--cream)" }}>Codex</div>
          <div className="text-[12px]" style={{ color: "var(--cream-dim)" }}>
            Snippet library · <span className="metric" style={{ color: "var(--emerald)" }}>{snippets.length}</span> saved
          </div>
        </div>
        <button
          onClick={() => { resetForm(); setAdding(true); }}
          className="inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-[13px] font-semibold text-white transition-transform hover:scale-[1.02]"
          style={{ background: `linear-gradient(140deg, ${codex.gradient[0]}, ${codex.gradient[1]})` }}
        >
          <Plus size={14} /> New snippet
        </button>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-4 p-4 md:p-6 overflow-y-auto">
        {/* Search */}
        <div className="flex items-center gap-2 rounded-xl border px-3 py-2"
          style={{ background: "var(--bg-card)", borderColor: "var(--line)" }}>
          <Search size={15} style={{ color: "var(--cream-mute)" }} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search snippets by title, code, language, or tag…"
            className="flex-1 bg-transparent text-[14px] outline-none"
            style={{ color: "var(--cream)", caretColor: "var(--emerald)" }}
          />
        </div>

        {/* Add / Edit form */}
        <AnimatePresence>
          {adding && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <div className="surface-card space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[13px] font-semibold" style={{ color: "var(--cream)" }}>
                    {editing ? "Edit snippet" : "New snippet"}
                  </span>
                  <button onClick={resetForm} style={{ color: "var(--cream-mute)" }}><X size={16} /></button>
                </div>
                <input
                  value={title} onChange={(e) => setTitle(e.target.value)}
                  placeholder="Title"
                  className="w-full rounded-lg border px-3 py-2 text-[14px] outline-none"
                  style={{ background: "rgba(0,0,0,0.3)", borderColor: "var(--line-soft)", color: "var(--cream)" }}
                />
                <textarea
                  value={code} onChange={(e) => setCode(e.target.value)}
                  placeholder="Paste your code here…"
                  rows={8}
                  className="w-full rounded-lg border px-3 py-2 text-[13px] outline-none"
                  style={{ background: "rgba(0,0,0,0.3)", borderColor: "var(--line-soft)", color: "var(--cream)", fontFamily: "var(--font-mono)" }}
                />
                <div className="flex gap-2">
                  <select
                    value={lang} onChange={(e) => setLang(e.target.value)}
                    className="rounded-lg border px-3 py-2 text-[13px] outline-none"
                    style={{ background: "rgba(0,0,0,0.3)", borderColor: "var(--line-soft)", color: "var(--cream)" }}
                  >
                    {LANGUAGES.map((l) => <option key={l} value={l}>{l}</option>)}
                  </select>
                  <input
                    value={tags} onChange={(e) => setTags(e.target.value)}
                    placeholder="Tags (comma-separated)"
                    className="flex-1 rounded-lg border px-3 py-2 text-[13px] outline-none"
                    style={{ background: "rgba(0,0,0,0.3)", borderColor: "var(--line-soft)", color: "var(--cream)" }}
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <button onClick={resetForm} className="rounded-xl border px-4 py-2 text-[13px]"
                    style={{ borderColor: "var(--line-soft)", color: "var(--cream-dim)" }}>Cancel</button>
                  <button onClick={save} disabled={!title.trim() || !code.trim()}
                    className="rounded-xl px-4 py-2 text-[13px] font-semibold text-white disabled:opacity-30"
                    style={{ background: `linear-gradient(140deg, ${codex.gradient[0]}, ${codex.gradient[1]})` }}>
                    {editing ? "Update" : "Save"}
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Snippet list */}
        {snippets.length === 0 && !adding ? (
          <div className="mt-12 flex flex-col items-center text-center">
            <Avatar agent={codex} size="lg" showStatus />
            <h2 className="mt-4 text-xl font-semibold" style={{ color: "var(--cream)" }}>No snippets yet</h2>
            <p className="mt-1 text-[13px]" style={{ color: "var(--cream-dim)" }}>
              Save reusable code, templates, and boilerplate here. Search them instantly.
            </p>
            <button
              onClick={() => { resetForm(); setAdding(true); }}
              className="mt-4 inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-[13px] font-semibold text-white"
              style={{ background: `linear-gradient(140deg, ${codex.gradient[0]}, ${codex.gradient[1]})` }}
            >
              <Plus size={14} /> Add your first snippet
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {snippets.map((s) => (
              <motion.div key={s.id}
                initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                className="group surface-card"
              >
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <Braces size={13} style={{ color: "var(--emerald)" }} />
                      <span className="text-[14px] font-semibold truncate" style={{ color: "var(--cream)" }}>{s.title}</span>
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="rounded-md px-1.5 py-0.5 text-[10px] font-mono"
                        style={{ background: "rgba(52,211,153,0.12)", color: "var(--emerald)" }}>{s.language}</span>
                      {s.tags && s.tags.split(",").map((t) => t.trim()).filter(Boolean).map((t) => (
                        <span key={t} className="rounded-md px-1.5 py-0.5 text-[10px]"
                          style={{ background: "rgba(139,92,246,0.12)", color: "#a78bfa" }}>{t}</span>
                      ))}
                      <span className="text-[10px]" style={{ color: "var(--cream-mute)" }}>{fmtDate(s.updatedAt)}</span>
                    </div>
                  </div>
                  <div className="flex gap-1 opacity-0 transition group-hover:opacity-100">
                    <button onClick={() => copyCode(s.id, s.code)}
                      className="grid h-7 w-7 place-items-center rounded-lg transition hover:bg-white/[0.06]"
                      style={{ color: copied === s.id ? "var(--emerald)" : "var(--cream-dim)" }}>
                      {copied === s.id ? <Check size={13} /> : <Copy size={13} />}
                    </button>
                    <button onClick={() => edit(s)}
                      className="grid h-7 w-7 place-items-center rounded-lg transition hover:bg-white/[0.06]"
                      style={{ color: "var(--cream-dim)" }}>
                      <Edit3 size={13} />
                    </button>
                    <button onClick={() => del(s.id)}
                      className="grid h-7 w-7 place-items-center rounded-lg transition hover:bg-white/[0.06]"
                      style={{ color: "var(--plum)" }}>
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
                <pre className="overflow-x-auto rounded-lg p-3 text-[12px] leading-relaxed"
                  style={{ background: "rgba(0,0,0,0.35)", color: "var(--cream-soft)", fontFamily: "var(--font-mono)" }}>
                  {s.code.length > 500 ? s.code.slice(0, 500) + "\n…" : s.code}
                </pre>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
