"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Upload, FileJson, CheckCircle2, AlertTriangle, Loader2, X,
  MessageSquare, Inbox, ChevronRight, FolderOpen, FileArchive,
} from "lucide-react";

interface RecentFile { name: string; mtime: number; size: number; }
interface RecentResp { folder: string; count: number; recent: RecentFile[]; }
interface ImportResult { written: number; skipped: number; errors: string[]; folder: string; }

function fmtAgo(ms: number): string {
  const d = Date.now() - ms;
  if (d < 60_000) return "just now";
  if (d < 3_600_000) return `${Math.floor(d / 60_000)}m ago`;
  if (d < 86_400_000) return `${Math.floor(d / 3_600_000)}h ago`;
  return `${Math.floor(d / 86_400_000)}d ago`;
}
function fmtBytes(b: number): string {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / 1024 / 1024).toFixed(1)} MB`;
}

export default function GrokImportPage() {
  const [recent, setRecent]     = useState<RecentResp | null>(null);
  const [preview, setPreview]   = useState<{ count: number; sample: string[] } | null>(null);
  const [pickedJson, setPicked] = useState<unknown | null>(null);
  const [pickedName, setName]   = useState<string | null>(null);
  const [busy, setBusy]         = useState<"reading" | "uploading" | null>(null);
  const [result, setResult]     = useState<ImportResult | null>(null);
  const [error, setError]       = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef            = useRef<HTMLInputElement>(null);

  const refreshRecent = async () => {
    try {
      const r: RecentResp = await (await fetch("/api/import/grok", { cache: "no-store" })).json();
      setRecent(r);
    } catch { /* ignore */ }
  };
  useEffect(() => { refreshRecent(); }, []);

  /* ── Read a picked .json file in the browser ──────────────────────── */
  const handleFile = async (file: File) => {
    setError(null); setResult(null); setPreview(null); setPicked(null);
    if (!file.name.toLowerCase().endsWith(".json")) {
      setError("Please pick the prod-grok-backend.json file from your Grok export ZIP.");
      return;
    }
    setBusy("reading");
    setName(file.name);
    try {
      const text = await file.text();
      const parsed = JSON.parse(text) as unknown;
      if (!parsed || typeof parsed !== "object" || !("conversations" in (parsed as Record<string, unknown>))) {
        setError("That file doesn't look like a Grok export — it should have a \"conversations\" array inside.");
        setBusy(null); return;
      }
      const convs = (parsed as { conversations: { conversation: { title?: string } }[] }).conversations;
      const sample = convs.slice(0, 5).map((c) => c.conversation?.title || "Untitled");
      setPicked(parsed);
      setPreview({ count: convs.length, sample });
    } catch (e) {
      setError(`Couldn't parse the file: ${(e as Error).message}`);
    }
    setBusy(null);
  };

  /* ── Send to the server to write into the vault ──────────────────── */
  const runImport = async () => {
    if (!pickedJson) return;
    setBusy("uploading"); setError(null);
    try {
      const r = await fetch("/api/import/grok", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(pickedJson),
      });
      const j = await r.json();
      if (!r.ok) { setError(j.error ?? `HTTP ${r.status}`); }
      else { setResult(j as ImportResult); }
      refreshRecent();
    } catch (e) { setError(String(e)); }
    setBusy(null);
  };

  const reset = () => { setPicked(null); setPreview(null); setResult(null); setError(null); setName(null); };

  return (
    <div className="mx-auto max-w-[1200px] space-y-6 px-6 py-8 md:px-10">
      {/* Header */}
      <div>
        <div className="eyebrow mb-4">
          <span className="num">IM.</span><span className="line" /><span className="label">Import · Grok</span>
        </div>
        <h1 className="page-title">Bring your Grok history in</h1>
        <p className="page-subtitle">
          Upload the <code className="rounded bg-white/[0.06] px-1.5 py-0.5 text-[12px]">prod-grok-backend.json</code> file
          from your Grok data export. Every conversation becomes a markdown note in your Obsidian vault.
        </p>
      </div>

      {/* How-to card */}
      <div className="surface-card">
        <div className="flex items-start gap-3">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-white"
            style={{ background: "linear-gradient(140deg, #8b5cf6, #ec4899)" }}>
            <Inbox size={16} />
          </span>
          <div className="flex-1 text-[13px] leading-relaxed" style={{ color: "var(--cream-soft)" }}>
            <div className="font-semibold mb-1" style={{ fontFamily: "var(--font-bricolage)", color: "var(--cream)" }}>
              Three steps
            </div>
            <ol className="space-y-1.5 list-decimal list-inside" style={{ color: "var(--cream-dim)" }}>
              <li>In Grok/X: go to <strong>Settings → Your Account → Download Data</strong>. You&apos;ll get a ZIP file.</li>
              <li>Unzip it, navigate into <code className="rounded bg-white/[0.06] px-1 text-[11px]">ttl/30d/export_data/…/</code> and find <code className="rounded bg-white/[0.06] px-1 text-[11px]">prod-grok-backend.json</code>.</li>
              <li>Drag that file into the box below.</li>
            </ol>
          </div>
        </div>
      </div>

      {/* Drop zone */}
      {!result && (
        <motion.div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault(); setDragOver(false);
            const f = e.dataTransfer.files[0];
            if (f) handleFile(f);
          }}
          animate={{ scale: dragOver ? 1.005 : 1 }}
          className="relative rounded-2xl border-2 border-dashed p-8 transition-colors"
          style={{
            borderColor: dragOver ? "var(--gold)" : "var(--line-soft)",
            background: dragOver ? "rgba(139,92,246,0.06)" : "var(--bg-card)",
          }}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".json,application/json"
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
          />

          {!pickedJson ? (
            <div className="text-center">
              <FileArchive size={28} className="mx-auto mb-3 opacity-50" style={{ color: "var(--cream)" }} />
              <p className="text-[15px] font-semibold" style={{ color: "var(--cream)", fontFamily: "var(--font-bricolage)" }}>
                Drop <code>prod-grok-backend.json</code> here
              </p>
              <p className="mt-1 text-[12px]" style={{ color: "var(--cream-mute)" }}>
                or click below to browse (~54 MB is normal)
              </p>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="mt-4 inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-[13px] font-semibold text-white transition-transform hover:scale-[1.02]"
                style={{ background: "linear-gradient(140deg, #8b5cf6, #ec4899)" }}
              >
                <FileJson size={14} /> Choose file
              </button>
              {busy === "reading" && (
                <p className="mt-3 text-[12px] flex items-center justify-center gap-1.5" style={{ color: "var(--cream-dim)" }}>
                  <Loader2 size={12} className="animate-spin" /> Reading {pickedName}…
                </p>
              )}
            </div>
          ) : (
            <div>
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="flex items-center gap-2">
                  <FileJson size={18} style={{ color: "#8b5cf6" }} />
                  <div>
                    <div className="text-[14px] font-semibold" style={{ color: "var(--cream)" }}>{pickedName}</div>
                    <div className="text-[12px]" style={{ color: "var(--cream-dim)" }}>
                      <strong style={{ color: "#8b5cf6" }}>{preview?.count ?? 0}</strong> conversations ready to import
                    </div>
                  </div>
                </div>
                <button onClick={reset} className="opacity-60 hover:opacity-100" style={{ color: "var(--cream)" }}>
                  <X size={16} />
                </button>
              </div>

              {preview && preview.sample.length > 0 && (
                <div className="mt-3 rounded-xl border p-3" style={{ borderColor: "var(--line-soft)", background: "rgba(0,0,0,0.2)" }}>
                  <div className="text-[10px] uppercase tracking-wider mb-2" style={{ color: "var(--cream-mute)" }}>
                    First few conversations
                  </div>
                  {preview.sample.map((title, i) => (
                    <div key={i} className="flex items-center gap-1.5 py-0.5 text-[12px]" style={{ color: "var(--cream-soft)" }}>
                      <MessageSquare size={11} style={{ color: "var(--cream-mute)" }} />
                      <span className="truncate">{title}</span>
                    </div>
                  ))}
                  {(preview.count - preview.sample.length) > 0 && (
                    <div className="mt-1 text-[11px]" style={{ color: "var(--cream-mute)" }}>
                      …and {preview.count - preview.sample.length} more
                    </div>
                  )}
                </div>
              )}

              <div className="mt-4 flex items-center justify-end gap-2">
                <button onClick={reset} className="rounded-xl border px-4 py-2 text-[13px]"
                  style={{ borderColor: "var(--line-soft)", color: "var(--cream-dim)" }}>
                  Cancel
                </button>
                <button
                  onClick={runImport}
                  disabled={busy === "uploading"}
                  className="inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-[13px] font-semibold text-white transition-transform hover:scale-[1.02] disabled:opacity-40"
                  style={{ background: "linear-gradient(140deg, #8b5cf6, #ec4899)" }}
                >
                  {busy === "uploading" ? <><Loader2 size={14} className="animate-spin" /> Importing…</> : <><ChevronRight size={14} /> Import all to vault</>}
                </button>
              </div>
            </div>
          )}
        </motion.div>
      )}

      {/* Error */}
      <AnimatePresence>
        {error && (
          <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="rounded-xl border px-4 py-3 text-[13px] flex items-start gap-2"
            style={{ borderColor: "rgba(196,96,126,0.4)", background: "rgba(196,96,126,0.08)", color: "var(--cream-soft)" }}>
            <AlertTriangle size={14} className="mt-0.5 shrink-0" style={{ color: "var(--plum)" }} />
            <span>{error}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Result */}
      <AnimatePresence>
        {result && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
            className="surface-card">
            <div className="flex items-start gap-3">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl text-white"
                style={{ background: "var(--emerald)" }}>
                <CheckCircle2 size={18} />
              </span>
              <div className="flex-1">
                <div className="text-[15px] font-semibold mb-1" style={{ fontFamily: "var(--font-bricolage)", color: "var(--cream)" }}>
                  Import complete
                </div>
                <p className="text-[13px]" style={{ color: "var(--cream-soft)" }}>
                  <strong style={{ color: "var(--emerald)" }}>{result.written}</strong> conversations written
                  {result.skipped > 0 && (
                    <span style={{ color: "var(--cream-dim)" }}> · {result.skipped} skipped (already imported)</span>
                  )}
                </p>
                <p className="mt-2 flex items-center gap-1.5 text-[11px] mono" style={{ color: "var(--cream-mute)" }}>
                  <FolderOpen size={11} /> {result.folder}
                </p>
                {result.errors.length > 0 && (
                  <details className="mt-3">
                    <summary className="text-[11px] cursor-pointer" style={{ color: "var(--plum)" }}>
                      {result.errors.length} error(s)
                    </summary>
                    <ul className="mt-2 ml-3 list-disc text-[11px]" style={{ color: "var(--cream-dim)" }}>
                      {result.errors.slice(0, 10).map((e, i) => <li key={i}>{e}</li>)}
                    </ul>
                  </details>
                )}
                <button onClick={reset} className="mt-4 rounded-lg border px-3 py-1.5 text-[12px]"
                  style={{ borderColor: "var(--line-soft)", color: "var(--cream-dim)" }}>
                  Import another file
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Already imported */}
      {recent && recent.count > 0 && (
        <section>
          <div className="eyebrow mb-3"><span className="num">▣</span><span className="line" /><span className="label">Already in vault · {recent.count}</span></div>
          <div className="grid gap-2 sm:grid-cols-2">
            {recent.recent.map((f) => (
              <div key={f.name} className="surface-card flex items-center gap-2.5" style={{ padding: "10px 14px" }}>
                <MessageSquare size={13} className="shrink-0" style={{ color: "#8b5cf6" }} />
                <span className="min-w-0 flex-1 truncate text-[13px]" style={{ color: "var(--cream)" }}>
                  {f.name.replace(/\.md$/, "")}
                </span>
                <span className="shrink-0 text-[10px]" style={{ color: "var(--cream-mute)" }}>{fmtBytes(f.size)} · {fmtAgo(f.mtime)}</span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
