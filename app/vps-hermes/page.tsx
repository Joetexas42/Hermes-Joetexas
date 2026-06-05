"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { ExternalLink, Cloud, RefreshCw, Maximize2 } from "lucide-react";

// VPS-hosted Hermes Agent (Hostinger Docker container behind Traefik).
// Change this constant if you move it.
const VPS_HERMES_URL = "https://hermes-agent-gn0b.srv1344233.hstgr.cloud/";

export default function VpsHermesPage() {
  const [reloadKey, setReloadKey] = useState(0);
  const [fullscreen, setFullscreen] = useState(false);

  return (
    <div className="flex h-[calc(100vh-3.5rem)] flex-col">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 border-b px-6 py-3.5 shrink-0"
        style={{ borderColor: "var(--line-soft)" }}>
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-xl text-white"
            style={{ background: "linear-gradient(140deg, var(--gold), var(--rust))" }}>
            <Cloud size={18} />
          </span>
          <div>
            <div className="font-semibold" style={{ fontFamily: "var(--font-bricolage)", color: "var(--cream)" }}>
              Hermes · VPS
            </div>
            <div className="flex items-center gap-1.5 text-[12px]" style={{ color: "var(--cream-dim)" }}>
              <span className="live-dot h-1.5 w-1.5 rounded-full" style={{ background: "var(--emerald)" }} />
              <span className="metric" style={{ color: "var(--gold)" }}>deepseek-v4-flash</span>
              <span style={{ color: "var(--cream-mute)" }}>· Hostinger VPS · Docker</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setReloadKey((k) => k + 1)}
            title="Reload"
            className="grid h-9 w-9 place-items-center rounded-xl border transition hover:border-white/20"
            style={{ borderColor: "var(--line-soft)", color: "var(--cream-dim)" }}
          >
            <RefreshCw size={14} />
          </button>
          <button
            onClick={() => setFullscreen((v) => !v)}
            title={fullscreen ? "Exit fullscreen" : "Fullscreen"}
            className="grid h-9 w-9 place-items-center rounded-xl border transition hover:border-white/20"
            style={{ borderColor: "var(--line-soft)", color: "var(--cream-dim)" }}
          >
            <Maximize2 size={14} />
          </button>
          <a
            href={VPS_HERMES_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-[13px] font-semibold text-white transition-transform hover:scale-[1.02]"
            style={{ background: "linear-gradient(140deg, var(--gold), var(--rust))" }}
          >
            <ExternalLink size={13} /> Open in tab
          </a>
        </div>
      </div>

      {/* Iframe area */}
      <div className={fullscreen ? "fixed inset-0 z-40 bg-black" : "relative min-h-0 flex-1"}>
        {fullscreen && (
          <button
            onClick={() => setFullscreen(false)}
            className="absolute right-4 top-4 z-50 rounded-xl border px-3 py-2 text-[12px] font-semibold transition"
            style={{ background: "var(--bg-card)", borderColor: "var(--line)", color: "var(--cream)" }}
          >
            Exit fullscreen
          </button>
        )}
        <motion.iframe
          key={reloadKey}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3 }}
          src={VPS_HERMES_URL}
          title="Hermes Agent on VPS"
          className="h-full w-full"
          style={{ background: "var(--bg-deep)", border: 0 }}
          allow="clipboard-read; clipboard-write; microphone"
        />

        {/* Fallback panel — shown if iframe is blocked by the server (CSP / X-Frame-Options).
            The user sees the iframe first; if it fails to load they can use the link below. */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 flex justify-center p-3">
          <div className="pointer-events-auto rounded-xl border px-3 py-2 text-[11px]"
            style={{ background: "rgba(0,0,0,0.6)", borderColor: "var(--line-soft)", color: "var(--cream-mute)" }}>
            Can&apos;t see Hermes above? Some browsers block embedded sites — use the{" "}
            <a href={VPS_HERMES_URL} target="_blank" rel="noopener noreferrer"
              className="underline" style={{ color: "var(--gold)" }}>
              Open in tab
            </a>{" "}
            button instead.
          </div>
        </div>
      </div>
    </div>
  );
}
