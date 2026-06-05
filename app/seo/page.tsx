"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sparkles, Rocket, FileText, Play, Square, CheckCircle2,
  AlertCircle, Globe, ClipboardPaste, Save, History as HistIcon,
  ExternalLink, Clock, TrendingUp,
} from "lucide-react";

/* ── Types ─────────────────────────────────────────────────────────────── */
type Tab = "generate" | "deploy" | "history" | "transcripts";

interface SiteData { site: { id: string; name: string; url: string; path: string }; postCount: number; recent: { slug: string; mtime: number; title?: string }[]; exists: boolean; }
interface Transcript { slug: string; bytes: number; mtime: number; preview: string; }
interface GenSession { id: string; createdAt: number; finishedAt?: number; keyword: string; slug: string; transcriptSource: string; status: "running"|"completed"|"failed"|"aborted"; articles: { siteId:string; filePath:string; liveUrl?:string }[]; }
interface DeployRecord { id: string; startedAt: number; finishedAt?: number; siteId: string; siteName: string; status: "running"|"ok"|"failed"; liveUrl?: string; netlifyUrl?: string; durationMs?: number; errorTail?: string; }

/* ── Accent per site ──────────────────────────────────────────────────── */
const ACCENT: Record<string, string> = {
  bestaiagentcommunity:   "var(--rust)",
  aiprofitboardroom:      "var(--purple)",
  juliangoldieautomation: "var(--cyan)",
  aisuccesslab:           "var(--plum)",
  aimoneylab:             "var(--emerald)",
};
const accent = (id: string) => ACCENT[id] ?? "var(--gold)";

function fmtAgo(ts: number) {
  const d = Date.now() - ts;
  if (d < 60_000) return "just now";
  if (d < 3_600_000) return `${Math.floor(d / 60_000)}m ago`;
  if (d < 86_400_000) return `${Math.floor(d / 3_600_000)}h ago`;
  return `${Math.floor(d / 86_400_000)}d ago`;
}
function fmtDur(ms?: number) {
  if (!ms) return "—";
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.floor(ms / 60_000)}m ${Math.floor((ms % 60_000) / 1000)}s`;
}

/* ══════════════════════════════════════════════════════════════════════ */
export default function SEOPage() {
  const [tab, setTab] = useState<Tab>("generate");

  // Generate
  const [keyword, setKeyword]         = useState("");
  const [slug, setSlug]               = useState("");
  const [transcriptMode, setTMode]    = useState<"pick"|"paste">("pick");
  const [selTranscript, setSelTrans]  = useState("");
  const [pastedTrans, setPasted]      = useState("");
  const [transcripts, setTranscripts] = useState<Transcript[]>([]);
  const [generating, setGenerating]   = useState(false);
  const [genLog, setGenLog]           = useState<string[]>([]);
  const [genDone, setGenDone]         = useState<{ code: number } | null>(null);
  const [autoDeploy, setAutoDeploy]   = useState(true);
  const [writtenIds, setWrittenIds]   = useState<Set<string>>(new Set());
  const writtenIdsRef                 = useRef<Set<string>>(new Set());
  const abortRef                      = useRef<AbortController | null>(null);

  // Sites / Deploy
  const [sites, setSites]               = useState<SiteData[]>([]);
  const [deployLog, setDeployLog]       = useState<Record<string, string[]>>({});
  const [deployStatus, setDeployStatus] = useState<Record<string, "running"|"ok"|"err"|undefined>>({});

  // History
  const [sessions, setSessions] = useState<GenSession[]>([]);
  const [deploys, setDeploys]   = useState<DeployRecord[]>([]);

  // Saving transcript
  const [savingTrans, setSavingTrans]   = useState(false);
  const [savedNotice, setSavedNotice]   = useState<string | null>(null);

  const deployingCount = Object.values(deployStatus).filter((s) => s === "running").length;

  async function loadAll() {
    const [ts, ss, hist] = await Promise.all([
      fetch("/api/seo/transcripts", { cache: "no-store" }).then((r) => r.json()).catch(() => ({ transcripts: [] })),
      fetch("/api/seo/sites", { cache: "no-store" }).then((r) => r.json()).catch(() => ({ sites: [] })),
      fetch("/api/seo/history", { cache: "no-store" }).then((r) => r.json()).catch(() => ({ sessions: [], deploys: [] })),
    ]);
    setTranscripts(ts.transcripts ?? []);
    setSites(ss.sites ?? []);
    setSessions(hist.sessions ?? []);
    setDeploys(hist.deploys ?? []);
  }

  useEffect(() => { loadAll(); try { const v = localStorage.getItem("seo-autodeploy"); if (v !== null) setAutoDeploy(v === "1"); } catch {} }, []);
  useEffect(() => { try { localStorage.setItem("seo-autodeploy", autoDeploy ? "1" : "0"); } catch {} }, [autoDeploy]);
  useEffect(() => {
    if (!generating && deployingCount === 0) return;
    const t = setInterval(loadAll, 3000); return () => clearInterval(t);
  }, [generating, deployingCount]);

  // Auto-derive slug from keyword
  useEffect(() => {
    if (!keyword.trim()) return;
    const d = keyword.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80);
    setSlug((cur) => cur && cur !== d.slice(0, cur.length) ? cur : d);
  }, [keyword]);

  function siteIdFromPath(fp: string): string | null {
    for (const s of sites) { if (fp.includes(s.site.path.replace(/\\/g, "/")) || fp.includes(s.site.id)) return s.site.id; }
    return null;
  }

  async function startGenerate() {
    if (!keyword.trim() || !slug.trim() || generating) return;
    setGenerating(true); setGenLog([]); setGenDone(null);
    setWrittenIds(new Set()); writtenIdsRef.current = new Set();
    const ctrl = new AbortController(); abortRef.current = ctrl;

    try {
      const payload: Record<string, string> = { keyword: keyword.trim(), slug: slug.trim() };
      if (transcriptMode === "pick" && selTranscript) payload.transcriptSlug = selTranscript;
      else if (transcriptMode === "paste" && pastedTrans.trim()) payload.transcriptText = pastedTrans.trim();

      const r = await fetch("/api/seo/generate", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload), signal: ctrl.signal });
      if (!r.body) throw new Error("no stream");
      const reader = r.body.getReader(); const dec = new TextDecoder(); let buf = "";
      while (true) {
        const { value, done } = await reader.read(); if (done) break;
        buf += dec.decode(value, { stream: true });
        const lines = buf.split("\n"); buf = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const evt = JSON.parse(line) as Record<string, unknown>;
            if (evt.type === "stream_event" && (evt as { event?: { delta?: { text?: string } } }).event?.delta?.text) {
              setGenLog((a) => [...a.slice(-400), (evt as { event: { delta: { text: string } } }).event.delta.text]);
            } else if (evt.type === "assistant") {
              const content = (evt as { message?: { content?: { type?: string; name?: string; input?: { file_path?: string } }[] } }).message?.content;
              if (Array.isArray(content)) for (const p of content) {
                if (p.type === "tool_use" && p.name === "Write" && p.input?.file_path) {
                  const sid = siteIdFromPath(p.input.file_path);
                  if (sid) { writtenIdsRef.current.add(sid); setWrittenIds(new Set(writtenIdsRef.current)); }
                }
              }
            } else if (evt.type === "result") {
              setGenLog((a) => [...a, `\n──── done ────\n${evt.result}\n`]);
            } else if (evt.type === "done") {
              setGenDone({ code: (evt.code as number) ?? 0 });
            }
          } catch {}
        }
      }
    } catch (e) { if ((e as Error).name !== "AbortError") setGenLog((a) => [...a, `\n[error] ${String(e)}\n`]); }
    setGenerating(false); loadAll();

    const ids = Array.from(writtenIdsRef.current);
    if (autoDeploy && ids.length) Promise.all(ids.map(deploySite)).then(loadAll);
  }

  function stopGenerate() { abortRef.current?.abort(); setGenerating(false); }

  async function saveTranscript() {
    if (!pastedTrans.trim() || !slug.trim() || savingTrans) return;
    setSavingTrans(true); setSavedNotice(null);
    try {
      const r = await fetch("/api/seo/transcript/save", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ slug: slug.trim(), content: pastedTrans }) });
      const j = await r.json() as { ok?: boolean; path?: string; error?: string; slug?: string };
      if (!r.ok) { setSavedNotice(j.error ?? "save failed"); }
      else {
        setSavedNotice(`saved`);
        loadAll(); setSelTrans(j.slug ?? slug); setTMode("pick"); setPasted("");
      }
    } catch (e) { setSavedNotice(String(e)); }
    setSavingTrans(false);
  }

  async function deploySite(siteId: string) {
    if (deployStatus[siteId] === "running") return;
    setDeployStatus((s) => ({ ...s, [siteId]: "running" }));
    setDeployLog((s) => ({ ...s, [siteId]: [] }));
    try {
      const r = await fetch("/api/seo/deploy", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ siteId }) });
      if (!r.body) throw new Error("no stream");
      const reader = r.body.getReader(); const dec = new TextDecoder(); let buf = "";
      while (true) {
        const { value, done } = await reader.read(); if (done) break;
        buf += dec.decode(value, { stream: true });
        const lines = buf.split("\n"); buf = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const evt = JSON.parse(line) as Record<string, unknown>;
            if (evt.type === "stdout" || evt.type === "stderr") setDeployLog((s) => ({ ...s, [siteId]: [...(s[siteId] ?? []).slice(-200), evt.text as string] }));
            else if (evt.type === "step") setDeployLog((s) => ({ ...s, [siteId]: [...(s[siteId] ?? []), `\n▸ ${evt.label}\n`] }));
            else if (evt.type === "done") setDeployStatus((s) => ({ ...s, [siteId]: (evt.ok as boolean) ? "ok" : "err" }));
          } catch {}
        }
      }
    } catch (e) {
      setDeployLog((s) => ({ ...s, [siteId]: [...(s[siteId] ?? []), `[error] ${String(e)}\n`] }));
      setDeployStatus((s) => ({ ...s, [siteId]: "err" }));
    }
    loadAll();
  }

  const TABS = [
    { key: "generate" as Tab,    label: "Generate",    icon: <Sparkles size={13} /> },
    { key: "deploy" as Tab,      label: "Deploy",      icon: <Rocket size={13} /> },
    { key: "history" as Tab,     label: "History",     icon: <HistIcon size={13} />, badge: sessions.length + deploys.length },
    { key: "transcripts" as Tab, label: "Transcripts", icon: <FileText size={13} />, badge: transcripts.length },
  ];

  return (
    <div className="mx-auto max-w-[1400px] space-y-6 px-6 py-8 md:px-10">
      {/* Header */}
      <div>
        <div className="eyebrow mb-4"><span className="num">SEO.</span><span className="line" /><span className="label">Content Engine</span></div>
        <h1 className="page-title">SEO Suite</h1>
        <p className="page-subtitle">Paste a transcript · Claude writes 5 unique articles · auto-deploys to all sites.</p>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap items-center gap-2">
        {TABS.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className="flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-[12.5px] transition"
            style={{
              background: tab === t.key ? "rgba(163,230,53,0.14)" : "transparent",
              borderColor: tab === t.key ? "#a3e635" : "var(--line-soft)",
              color: tab === t.key ? "var(--cream)" : "var(--cream-dim)",
            }}>
            {t.icon}{t.label}
            {typeof t.badge === "number" && t.badge > 0 && (
              <span className="metric text-[10px] px-1.5 py-0.5 rounded-full" style={{ background: "rgba(255,255,255,0.06)", color: "var(--cream-mute)" }}>{t.badge}</span>
            )}
          </button>
        ))}
      </div>

      {/* ── GENERATE ── */}
      {tab === "generate" && (
        <div className="space-y-4">
          <div className="surface-card space-y-4">
            <div className="flex items-center gap-2">
              <Sparkles size={15} style={{ color: "#a3e635" }} />
              <h3 className="text-[14px] font-semibold" style={{ fontFamily: "var(--font-bricolage)", color: "var(--cream)" }}>
                Generate {sites.length || 5} unique SEO articles
              </h3>
            </div>

            {/* Keyword + slug */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {[["Target keyword", keyword, setKeyword, "e.g. best AI agent for SEO", false],
                ["File slug", slug, setSlug, "best-ai-agent-for-seo", true]].map(([label, val, setter, ph, mono]) => (
                <div key={label as string}>
                  <label className="text-[10px] uppercase tracking-wider" style={{ color: "var(--cream-mute)", fontWeight: 700 }}>{label as string}</label>
                  <input value={val as string} onChange={(e) => (setter as (v: string) => void)(e.target.value)}
                    placeholder={ph as string}
                    className="mt-1 w-full rounded-lg border px-3 py-2 text-[13px] outline-none"
                    style={{ background: "rgba(0,0,0,0.25)", borderColor: "var(--line-soft)", color: "var(--cream)", fontFamily: mono ? "var(--font-mono)" : undefined }} />
                </div>
              ))}
            </div>

            {/* Transcript mode */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-[10px] uppercase tracking-wider font-bold" style={{ color: "var(--cream-mute)" }}>Source transcript</label>
                <div className="flex gap-1">
                  {(["pick", "paste"] as const).map((m) => (
                    <button key={m} onClick={() => setTMode(m)}
                      className="flex items-center gap-1 px-2 py-1 rounded text-[10px] uppercase tracking-wider border transition"
                      style={{ background: transcriptMode === m ? "rgba(163,230,53,0.14)" : "transparent", borderColor: transcriptMode === m ? "#a3e635" : "var(--line-soft)", color: transcriptMode === m ? "var(--cream)" : "var(--cream-dim)" }}>
                      {m === "pick" ? <FileText size={10} /> : <ClipboardPaste size={10} />}{m === "pick" ? "Pick" : "Paste"}
                    </button>
                  ))}
                </div>
              </div>

              {transcriptMode === "pick" ? (
                <div className="max-h-44 overflow-y-auto rounded-xl border p-2" style={{ borderColor: "var(--line-soft)", background: "rgba(0,0,0,0.15)" }}>
                  {transcripts.length === 0
                    ? <p className="py-4 text-center text-[12px]" style={{ color: "var(--cream-mute)" }}>No transcripts yet — paste one first.</p>
                    : <div className="grid grid-cols-1 gap-1 sm:grid-cols-2">
                        {transcripts.map((t) => (
                          <button key={t.slug} onClick={() => { setSelTrans(t.slug); if (!keyword) { setKeyword(t.slug.replace(/-/g, " ")); setSlug(t.slug); } }}
                            className="text-left rounded-lg border px-2.5 py-2 text-[12px] transition truncate"
                            style={{ borderColor: selTranscript === t.slug ? "#a3e635" : "var(--line-soft)", background: selTranscript === t.slug ? "rgba(163,230,53,0.1)" : "transparent", color: selTranscript === t.slug ? "var(--cream)" : "var(--cream-dim)" }}
                            title={t.preview}>
                            <span className="mono">{t.slug}</span>
                            <span className="ml-2 text-[10px]" style={{ color: "var(--cream-mute)" }}>{(t.bytes / 1024).toFixed(1)}KB</span>
                          </button>
                        ))}
                      </div>}
                </div>
              ) : (
                <div className="space-y-2">
                  <textarea value={pastedTrans} onChange={(e) => setPasted(e.target.value)} rows={8}
                    placeholder={"Paste your YouTube transcript or video notes here…\n\nTip: raw auto-captions work great."}
                    className="w-full resize-y rounded-xl border px-3 py-2.5 text-[12.5px] leading-relaxed outline-none"
                    style={{ background: "rgba(0,0,0,0.25)", borderColor: "var(--line-soft)", color: "var(--cream)", fontFamily: "var(--font-mono)" }} />
                  <div className="flex items-center justify-between text-[11px]">
                    <span style={{ color: "var(--cream-mute)" }}>{pastedTrans.length.toLocaleString()} chars</span>
                    <div className="flex items-center gap-2">
                      {savedNotice && <span style={{ color: savedNotice.startsWith("saved") ? "var(--emerald)" : "var(--plum)" }}>{savedNotice}</span>}
                      <button onClick={saveTranscript} disabled={!pastedTrans.trim() || !slug.trim() || savingTrans}
                        className="flex items-center gap-1.5 rounded border px-2.5 py-1 text-[11px] transition disabled:opacity-40"
                        style={{ background: "rgba(90,184,150,0.1)", borderColor: "rgba(90,184,150,0.4)", color: "var(--emerald)" }}>
                        <Save size={11} /> {savingTrans ? "Saving…" : "Save & reuse"}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Auto-deploy toggle */}
            <div className="flex items-center justify-between rounded-xl border px-4 py-3"
              style={{ borderColor: "rgba(139,92,246,0.3)", background: "rgba(139,92,246,0.06)" }}>
              <div className="flex items-start gap-2.5">
                <Rocket size={14} style={{ color: "var(--purple)", marginTop: 2 }} />
                <div>
                  <div className="text-[13px] font-semibold" style={{ color: "var(--cream)" }}>Auto-deploy after generate</div>
                  <div className="text-[11px]" style={{ color: "var(--cream-dim)" }}>All sites build + deploy in parallel the moment Claude finishes.</div>
                </div>
              </div>
              <button onClick={() => setAutoDeploy((v) => !v)}
                className="relative h-6 w-11 rounded-full transition shrink-0"
                style={{ background: autoDeploy ? "rgba(139,92,246,0.5)" : "rgba(255,255,255,0.08)" }}>
                <span className="absolute top-0.5 h-5 w-5 rounded-full transition-all"
                  style={{ left: autoDeploy ? "calc(100% - 22px)" : "2px", background: autoDeploy ? "var(--purple)" : "var(--cream-mute)", boxShadow: autoDeploy ? "0 0 14px var(--purple)" : "none" }} />
              </button>
            </div>

            {/* Run button */}
            <div className="flex items-center justify-end gap-2">
              {generating
                ? <button onClick={stopGenerate} className="flex items-center gap-1.5 rounded-xl border px-4 py-2 text-[13px] transition"
                    style={{ background: "rgba(196,96,126,0.14)", borderColor: "rgba(196,96,126,0.4)", color: "var(--plum)" }}>
                    <Square size={14} /> Stop
                  </button>
                : <button onClick={startGenerate} disabled={!keyword.trim() || !slug.trim()}
                    className="flex items-center gap-1.5 rounded-xl px-5 py-2.5 text-[13px] font-semibold transition disabled:opacity-40"
                    style={{ background: "rgba(163,230,53,0.18)", border: "1px solid rgba(163,230,53,0.55)", color: "#a3e635" }}>
                    <Play size={14} /> Generate {sites.length || 5} articles
                  </button>}
            </div>
          </div>

          {/* Live generation log */}
          {(generating || genLog.length > 0) && (
            <div className="surface-card">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2 text-[13px] font-semibold" style={{ color: "var(--cream)" }}>
                  <Sparkles size={14} style={{ color: "#a3e635" }} /> Live generation
                  {generating && <span className="flex ml-2"><span className="tick live" style={{ color: "#a3e635" }}/><span className="tick live" style={{ color: "#a3e635", animationDelay: ".15s" }}/><span className="tick live" style={{ color: "#a3e635", animationDelay: ".3s" }}/></span>}
                </div>
                {genDone && <span className="text-[11px] uppercase tracking-wider" style={{ color: genDone.code === 0 ? "var(--emerald)" : "var(--plum)" }}>{genDone.code === 0 ? "✓ done" : `exit ${genDone.code}`}</span>}
              </div>
              <pre className="scroll max-h-[480px] overflow-auto rounded-xl border p-3 text-[11.5px] leading-relaxed whitespace-pre-wrap"
                style={{ background: "rgba(0,0,0,0.4)", borderColor: "var(--line-soft)", color: "var(--cream-dim)", fontFamily: "var(--font-mono)" }}>
                {genLog.join("") || "starting…"}
              </pre>
            </div>
          )}
        </div>
      )}

      {/* ── DEPLOY ── */}
      {tab === "deploy" && (
        <div className="space-y-4">
          <p className="text-[12px]" style={{ color: "var(--cream-dim)" }}>
            Each deploy runs <code className="rounded px-1.5 py-0.5 text-[11px]" style={{ background: "rgba(0,0,0,0.3)", color: "var(--cream)" }}>npx @11ty/eleventy</code> then <code className="rounded px-1.5 py-0.5 text-[11px]" style={{ background: "rgba(0,0,0,0.3)", color: "var(--cream)" }}>netlify deploy --prod --dir=_site</code>
          </p>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {sites.map((s) => {
              const ac = accent(s.site.id);
              const status = deployStatus[s.site.id];
              const log = deployLog[s.site.id] ?? [];
              return (
                <div key={s.site.id} className="surface-card relative overflow-hidden">
                  <div className="pointer-events-none absolute -right-8 -top-8 h-28 w-28 rounded-full blur-3xl opacity-20" style={{ background: ac }} />
                  <div className="relative flex items-start justify-between mb-3">
                    <div className="min-w-0">
                      <div className="text-[10px] uppercase tracking-widest flex items-center gap-1" style={{ color: "var(--cream-mute)" }}><Globe size={10} /> {s.postCount} posts{!s.exists && " · path not found"}</div>
                      <div className="font-semibold" style={{ fontFamily: "var(--font-bricolage)", color: ac }}>{s.site.name}</div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {status === "ok"  && <CheckCircle2 size={14} style={{ color: "var(--emerald)" }} />}
                      {status === "err" && <AlertCircle  size={14} style={{ color: "var(--plum)" }} />}
                      <button disabled={status === "running" || !s.exists} onClick={() => deploySite(s.site.id)}
                        className="flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-[12px] transition disabled:opacity-50"
                        style={{ background: `${ac}20`, border: `1px solid ${ac}50`, color: ac }}>
                        {status === "running" ? "Deploying…" : <><Rocket size={12} /> Deploy</>}
                      </button>
                    </div>
                  </div>
                  {s.recent.slice(0, 3).map((r) => (
                    <div key={r.slug} className="flex justify-between py-0.5 text-[11px]">
                      <span className="truncate mono" style={{ color: "var(--cream-dim)" }}>{r.slug}</span>
                      <span className="shrink-0 ml-2" style={{ color: "var(--cream-mute)" }}>{new Date(r.mtime).toLocaleDateString("en-GB", { day: "2-digit", month: "short" })}</span>
                    </div>
                  ))}
                  {log.length > 0 && (
                    <pre className="mt-2 scroll max-h-40 overflow-auto rounded-lg p-2 text-[10.5px] whitespace-pre-wrap"
                      style={{ background: "rgba(0,0,0,0.4)", color: "var(--cream-dim)", fontFamily: "var(--font-mono)" }}>
                      {log.join("")}
                    </pre>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── HISTORY ── */}
      {tab === "history" && (
        <div className="space-y-6">
          <section>
            <h3 className="mb-3 flex items-center gap-2 text-[13px] font-semibold" style={{ fontFamily: "var(--font-bricolage)", color: "var(--cream)" }}>
              <Rocket size={14} style={{ color: "var(--purple)" }} /> Recent deploys
            </h3>
            {deploys.length === 0
              ? <p className="surface-card text-[13px]" style={{ color: "var(--cream-dim)" }}>No deploys yet.</p>
              : <div className="grid gap-3 sm:grid-cols-2">
                  {deploys.slice(0, 12).map((d) => {
                    const ac = accent(d.siteId);
                    const col = d.status === "ok" ? "var(--emerald)" : d.status === "failed" ? "var(--plum)" : "var(--gold)";
                    return (
                      <div key={d.id} className="surface-card relative overflow-hidden">
                        <div className="pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full blur-3xl opacity-15" style={{ background: ac }} />
                        <div className="relative">
                          <div className="flex items-start justify-between gap-2 mb-1">
                            <div>
                              <div className="text-[10px] flex items-center gap-1" style={{ color: "var(--cream-mute)" }}><Clock size={9} /> {fmtAgo(d.startedAt)} · {fmtDur(d.durationMs)}</div>
                              <div className="font-semibold" style={{ color: ac, fontFamily: "var(--font-bricolage)" }}>{d.siteName}</div>
                            </div>
                            <span className="text-[10px] uppercase tracking-wider rounded-full border px-2 py-0.5 shrink-0"
                              style={{ color: col, borderColor: `${col}50`, background: `${col}14` }}>
                              {d.status === "ok" ? "✓ ok" : d.status === "failed" ? "✗ failed" : "⋯ running"}
                            </span>
                          </div>
                          {d.liveUrl && (
                            <a href={d.liveUrl} target="_blank" rel="noopener noreferrer"
                              className="flex items-center gap-1.5 text-[11.5px] hover:underline truncate"
                              style={{ color: "var(--emerald)" }}>
                              <ExternalLink size={11} /><span className="truncate mono">{d.liveUrl}</span>
                            </a>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>}
          </section>

          <section>
            <h3 className="mb-3 flex items-center gap-2 text-[13px] font-semibold" style={{ fontFamily: "var(--font-bricolage)", color: "var(--cream)" }}>
              <Sparkles size={14} style={{ color: "#a3e635" }} /> Generate sessions
            </h3>
            {sessions.length === 0
              ? <p className="surface-card text-[13px]" style={{ color: "var(--cream-dim)" }}>No sessions yet.</p>
              : <div className="space-y-2">
                  {sessions.slice(0, 30).map((s) => {
                    const col = s.status === "completed" ? "var(--emerald)" : s.status === "failed" ? "var(--plum)" : s.status === "aborted" ? "var(--gold)" : "var(--cyan)";
                    return (
                      <div key={s.id} className="surface-card">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <div className="text-[10px] flex items-center gap-1 mb-0.5" style={{ color: "var(--cream-mute)" }}><Clock size={9} /> {fmtAgo(s.createdAt)}</div>
                            <div className="font-semibold truncate" style={{ color: "var(--cream)" }}>{s.keyword}</div>
                            <div className="text-[11px] truncate mono" style={{ color: "var(--cream-dim)" }}>/{s.slug} · {s.transcriptSource}</div>
                          </div>
                          <span className="text-[10px] uppercase tracking-wider rounded-full border px-2 py-0.5 shrink-0"
                            style={{ color: col, borderColor: `${col}50`, background: `${col}14` }}>
                            {s.status === "completed" ? "✓ done" : s.status === "failed" ? "✗ failed" : s.status === "aborted" ? "⏹ aborted" : "⋯ running"}
                          </span>
                        </div>
                        {s.articles.length > 0 && (
                          <div className="mt-2 pt-2 border-t" style={{ borderColor: "var(--line-deep)" }}>
                            <div className="text-[10px] uppercase tracking-wider mb-1" style={{ color: "var(--cream-mute)" }}>{s.articles.length} articles written</div>
                            {s.articles.map((a) => (
                              <div key={a.filePath} className="flex items-center gap-1.5 text-[11px]">
                                <span className="h-1.5 w-1.5 rounded-full shrink-0" style={{ background: accent(a.siteId) }} />
                                {a.liveUrl
                                  ? <a href={a.liveUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 hover:underline truncate mono" style={{ color: "var(--emerald)" }}><ExternalLink size={9} />{a.liveUrl}</a>
                                  : <span className="truncate mono" style={{ color: "var(--cream-dim)" }}>{a.filePath}</span>}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>}
          </section>
        </div>
      )}

      {/* ── TRANSCRIPTS ── */}
      {tab === "transcripts" && (
        <div className="space-y-2">
          <p className="text-[11px] uppercase tracking-widest" style={{ color: "var(--cream-mute)" }}>{transcripts.length} transcripts</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {transcripts.map((t) => (
              <button key={t.slug} onClick={() => { setTab("generate"); setSelTrans(t.slug); setTMode("pick"); if (!keyword) { setKeyword(t.slug.replace(/-/g, " ")); setSlug(t.slug); } }}
                className="surface-card text-left panel-hover">
                <div className="flex items-baseline justify-between gap-2 mb-1">
                  <span className="mono text-[13px] truncate" style={{ color: "var(--cream)" }}>{t.slug}</span>
                  <span className="text-[10px] shrink-0" style={{ color: "var(--cream-mute)" }}>{new Date(t.mtime).toLocaleDateString("en-GB", { day: "2-digit", month: "short" })} · {(t.bytes/1024).toFixed(1)}KB</span>
                </div>
                <p className="text-[12px] line-clamp-2 leading-snug" style={{ color: "var(--cream-dim)" }}>{t.preview}</p>
              </button>
            ))}
            {transcripts.length === 0 && <p className="text-[13px]" style={{ color: "var(--cream-dim)" }}>No transcripts yet. Switch to Generate → Paste new to add one.</p>}
          </div>
        </div>
      )}
    </div>
  );
}
