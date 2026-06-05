"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { ShieldCheck, KeyRound, FolderOpen, Check, Copy, TriangleAlert, Database } from "lucide-react";

interface Info {
  armed: boolean;
  workingDir: string;
  authMethod: "oauth" | "apikey" | "none";
  hasToken: boolean;
  cliFound: boolean;
  cliPath: string | null;
}

export default function SettingsPage() {
  const [info, setInfo] = useState<Info | null>(null);
  const [method, setMethod] = useState<"oauth" | "apikey">("oauth");
  const [token, setToken] = useState("");
  const [workingDir, setWorkingDir] = useState("");
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);

  const load = async () => {
    const res = await fetch("/api/bridge", { cache: "no-store" });
    const data: Info = await res.json();
    setInfo(data);
    if (data.authMethod !== "none") setMethod(data.authMethod);
    setWorkingDir(data.workingDir);
  };

  useEffect(() => {
    load();
  }, []);

  const save = async () => {
    const res = await fetch("/api/bridge", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        authMethod: method,
        workingDir,
        ...(token ? { token } : {}),
      }),
    });
    setInfo(await res.json());
    setToken("");
    setSaved(true);
    setTimeout(() => setSaved(false), 1800);
  };

  const copyCmd = () => {
    navigator.clipboard.writeText("claude setup-token");
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <h1 className="text-3xl font-bold tracking-tight">
        <span className="text-gradient">Bridge settings</span>
      </h1>
      <p className="mt-2 text-[14px] text-muted">
        The bridge spawns the real Claude Code CLI on this machine. It needs a credential so the CLI
        can log in headlessly. Everything here is stored locally in{" "}
        <code className="rounded bg-white/[0.06] px-1.5 py-0.5 text-[12px]">.bridge-state.json</code>{" "}
        and is gitignored.
      </p>

      {/* Status strip */}
      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <StatusPill ok={info?.cliFound} label="CLI" yes="found" no="missing" />
        <StatusPill ok={info?.hasToken} label="Credential" yes="set" no="none" />
        <StatusPill ok={info?.armed} label="Bridge" yes="armed" no="disarmed" />
      </div>

      {/* setup-token helper */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass mt-6 rounded-2xl p-5"
      >
        <div className="flex items-center gap-2 text-sm font-semibold">
          <ShieldCheck className="h-4 w-4 text-green" />
          Step 1 · Generate a token from your subscription
        </div>
        <p className="mt-2 text-[13px] leading-relaxed text-muted">
          In any terminal, run the command below. It opens a browser, you authorize, and it prints a
          long-lived token tied to your Claude plan (no per-token API billing). Copy that token.
        </p>
        <button
          onClick={copyCmd}
          className="mt-3 inline-flex items-center gap-2 rounded-lg border border-[var(--border-strong)] bg-black/30 px-3 py-2 font-mono text-[13px] text-fg transition-colors hover:border-white/30"
        >
          claude setup-token
          {copied ? <Check className="h-3.5 w-3.5 text-green" /> : <Copy className="h-3.5 w-3.5 text-muted" />}
        </button>
      </motion.div>

      {/* Credential form */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className="glass mt-4 rounded-2xl p-5"
      >
        <div className="flex items-center gap-2 text-sm font-semibold">
          <KeyRound className="h-4 w-4 text-amber" />
          Step 2 · Paste it here
        </div>

        <div className="mt-4 flex gap-2">
          <MethodTab active={method === "oauth"} onClick={() => setMethod("oauth")} label="Subscription token" />
          <MethodTab active={method === "apikey"} onClick={() => setMethod("apikey")} label="API key" />
        </div>

        <input
          type="password"
          value={token}
          onChange={(e) => setToken(e.target.value)}
          placeholder={
            method === "oauth"
              ? info?.hasToken
                ? "•••••••• (saved — paste again to replace)"
                : "Paste your setup-token here"
              : "sk-ant-..."
          }
          className="mt-3 w-full rounded-xl border border-[var(--border-strong)] bg-black/30 px-3 py-2.5 text-[14px] outline-none placeholder:text-[var(--faint)] focus:border-white/30"
        />

        <div className="mt-4 flex items-center gap-2 text-sm font-semibold">
          <FolderOpen className="h-4 w-4 text-cyan" />
          Working directory
        </div>
        <input
          value={workingDir}
          onChange={(e) => setWorkingDir(e.target.value)}
          placeholder="C:\Users\you"
          className="mt-2 w-full rounded-xl border border-[var(--border-strong)] bg-black/30 px-3 py-2.5 font-mono text-[13px] outline-none placeholder:text-[var(--faint)] focus:border-white/30"
        />
        <p className="mt-1.5 text-[12px] text-[var(--faint)]">
          Where Claude runs. In plan mode it&apos;s read-only, but it can still read files here.
        </p>

        <button
          onClick={save}
          className="mt-5 inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-magenta to-purple px-5 py-2.5 text-sm font-semibold text-white shadow-[0_0_30px_-8px_var(--magenta)] transition-transform hover:scale-[1.02]"
        >
          {saved ? <Check className="h-4 w-4" /> : null}
          {saved ? "Saved" : "Save credential"}
        </button>
      </motion.div>

      <VaultCard />

      <div className="mt-4 flex items-start gap-2 rounded-xl border border-amber/20 bg-amber/[0.05] p-4 text-[12px] leading-relaxed text-muted">
        <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber" />
        <span>
          Arming the bridge lets this local page run your real Claude. Keep it on{" "}
          <span className="text-fg">localhost</span> only, and disarm it with the top-right switch when
          you&apos;re done.
        </span>
      </div>
    </div>
  );
}

function MethodTab({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-lg border px-3 py-1.5 text-[13px] font-medium transition-colors ${
        active
          ? "border-white/30 bg-white/[0.06] text-fg"
          : "border-[var(--border)] text-muted hover:text-fg"
      }`}
    >
      {label}
    </button>
  );
}

function StatusPill({ ok, label, yes, no }: { ok?: boolean; label: string; yes: string; no: string }) {
  return (
    <div className="glass flex items-center justify-between rounded-xl px-3 py-2.5">
      <span className="text-[11px] uppercase tracking-[0.14em] text-[var(--faint)]">{label}</span>
      <span
        className={`inline-flex items-center gap-1.5 text-[12px] font-semibold ${
          ok ? "text-green" : "text-[var(--faint)]"
        }`}
      >
        <span
          className="h-1.5 w-1.5 rounded-full"
          style={{ background: ok ? "var(--green)" : "var(--faint)" }}
        />
        {ok ? yes : no}
      </span>
    </div>
  );
}

interface VaultInfo {
  vaultDir: string;
  enabled: boolean;
  vaultExists: boolean;
  folder: string;
  todayFile: string;
}

function VaultCard() {
  const [v, setV] = useState<VaultInfo | null>(null);
  const [dir, setDir] = useState("");
  const [saved, setSaved] = useState(false);

  const load = async () => {
    const data: VaultInfo = await (await fetch("/api/vault", { cache: "no-store" })).json();
    setV(data);
    setDir(data.vaultDir);
  };
  useEffect(() => {
    load();
  }, []);

  const save = async (patch: Partial<VaultInfo>) => {
    const data: VaultInfo = await (
      await fetch("/api/vault", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      })
    ).json();
    setV(data);
    setSaved(true);
    setTimeout(() => setSaved(false), 1600);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1 }}
      className="glass mt-4 rounded-2xl p-5"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <Database className="h-4 w-4 text-cyan" />
          Obsidian vault auto-save
        </div>
        <button
          onClick={() => v && save({ enabled: !v.enabled })}
          className={`rounded-lg border px-2.5 py-1 text-[12px] font-semibold transition-colors ${
            v?.enabled ? "border-green/40 bg-green/10 text-green" : "border-[var(--border-strong)] text-muted"
          }`}
        >
          {v?.enabled ? "On" : "Off"}
        </button>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-3">
        <StatusPill ok={v?.vaultExists} label="Vault folder" yes="found" no="missing" />
        <StatusPill ok={v?.enabled} label="Auto-save" yes="on" no="off" />
      </div>

      <p className="mt-4 text-[12px] text-muted">Vault root (the app writes to an “Agentic OS” folder inside it):</p>
      <div className="mt-2 flex gap-2">
        <input
          value={dir}
          onChange={(e) => setDir(e.target.value)}
          className="flex-1 rounded-xl border border-[var(--border-strong)] bg-black/30 px-3 py-2.5 font-mono text-[12px] outline-none focus:border-white/30"
        />
        <button
          onClick={() => save({ vaultDir: dir })}
          className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--border-strong)] bg-white/[0.04] px-4 text-sm font-medium text-fg transition-colors hover:border-white/30"
        >
          {saved ? <Check className="h-4 w-4 text-green" /> : null}
          Save
        </button>
      </div>
      {v && (
        <p className="mt-2 truncate font-mono text-[11px] text-[var(--faint)]">today → {v.todayFile}</p>
      )}
    </motion.div>
  );
}
