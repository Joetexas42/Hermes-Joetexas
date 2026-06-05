/**
 * Single source of truth for paths + config.
 *
 * Load order:
 *   1. Environment variables             (highest priority)
 *   2. ~/.agentic-os/config.json         (user override)
 *   3. Auto-detect CLIs on PATH          (via `where` on Windows, `which` on Unix)
 *   4. Known Windows install paths       (for bundled CLIs like Claude Code)
 *   5. Sensible defaults
 *
 * Create ~/.agentic-os/config.json from source/agentic-os.config.example.json
 * to override any path without touching code.
 */

import { readFileSync, existsSync } from "node:fs";
import { execSync } from "node:child_process";
import path from "node:path";
import os from "node:os";

export interface AgenticConfig {
  claude:       string | null;  // Claude Code CLI
  openclaw:     string | null;
  hermes:       string | null;
  gemini:       string | null;
  antigravity:  string | null;  // `agy` binary
  codex:        string | null;
  fcc:          string | null;  // free-claude-code server

  /** Obsidian vault root (Agentic OS writes notes here) */
  vaultRoot:    string | null;

  /** Agent log dirs for the Activity Stream */
  openclawLogs: string;
  hermesLogs:   string;

  /** Location label shown in the sidebar / top bar */
  locationLabel: string;

  /** Goal categories shown in the dropdown */
  goalCategories: string[];
}

/* ── Config file loader ── */
function loadFileConfig(): Partial<AgenticConfig> {
  const candidates = [
    process.env.AGENTIC_OS_CONFIG,
    path.join(os.homedir(), ".agentic-os", "config.json"),
    path.join(process.cwd(), "agentic-os.config.json"),
  ].filter(Boolean) as string[];

  for (const p of candidates) {
    if (!existsSync(p)) continue;
    try { return JSON.parse(readFileSync(p, "utf8")); } catch { /* ignore */ }
  }
  return {};
}

/* ── CLI finder — works on Windows (where.exe) and Unix (which) ── */
function which(cmd: string): string | null {
  try {
    const isWin = process.platform === "win32";
    const out = execSync(
      isWin ? `where.exe ${cmd} 2>nul` : `command -v ${cmd} 2>/dev/null`,
      { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"], timeout: 3000 },
    );
    const first = out.trim().split(/\r?\n/)[0]?.trim();
    return first || null;
  } catch { return null; }
}

/** Resolve the newest bundled Claude Code CLI from the desktop app install. */
function findBundledClaude(): string | null {
  const appData = process.env.APPDATA ?? path.join(os.homedir(), "AppData", "Roaming");
  const root = path.join(appData, "Claude", "claude-code");
  if (!existsSync(root)) return null;
  try {
    const { readdirSync } = require("node:fs") as typeof import("node:fs");
    const exe = readdirSync(root, { withFileTypes: true })
      .filter((d: import("node:fs").Dirent) => d.isDirectory())
      .map((d: import("node:fs").Dirent) => d.name)
      .sort((a: string, b: string) => {
        const pa = a.split(".").map(Number);
        const pb = b.split(".").map(Number);
        for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
          const d = (pb[i] ?? 0) - (pa[i] ?? 0);
          if (d !== 0) return d;
        }
        return 0;
      })
      .map((v: string) => path.join(root, v, "claude.exe"))
      .find((p: string) => existsSync(p)) ?? null;
    return exe;
  } catch { return null; }
}

function defaultVault(fileCfg: Partial<AgenticConfig>): string | null {
  const fromFile = fileCfg.vaultRoot;
  if (typeof fromFile === "string" && existsSync(fromFile)) return fromFile;
  const fromEnv = process.env.AGENTIC_OS_VAULT;
  if (fromEnv && existsSync(fromEnv)) return fromEnv;
  const guesses = [
    "G:\\My Drive\\DO NOT DELETE\\Joe Hermes\\Vault",
    path.join(os.homedir(), "Documents", "Obsidian Vault"),
    path.join(os.homedir(), "Obsidian"),
    path.join(os.homedir(), "Obsidian Vault"),
  ];
  for (const g of guesses) if (existsSync(g)) return g;
  return null;
}

const fileCfg = loadFileConfig();

export const config: AgenticConfig = {
  claude:
    process.env.AGENTIC_OS_CLAUDE_BIN ??
    fileCfg.claude ??
    which("claude") ??
    findBundledClaude(),

  openclaw:
    process.env.AGENTIC_OS_OPENCLAW_BIN ?? fileCfg.openclaw ?? which("openclaw"),

  hermes:
    process.env.AGENTIC_OS_HERMES_BIN ?? fileCfg.hermes ?? which("hermes"),

  gemini:
    process.env.AGENTIC_OS_GEMINI_BIN ?? fileCfg.gemini ?? which("gemini"),

  antigravity:
    process.env.AGENTIC_OS_ANTIGRAVITY_BIN ?? fileCfg.antigravity ?? which("agy"),

  codex:
    process.env.AGENTIC_OS_CODEX_BIN ?? fileCfg.codex ?? which("codex"),

  fcc:
    process.env.AGENTIC_OS_FCC_BIN ?? fileCfg.fcc ?? which("fcc-server"),

  vaultRoot: defaultVault(fileCfg),

  openclawLogs:
    process.env.AGENTIC_OS_OPENCLAW_LOGS ??
    fileCfg.openclawLogs ??
    path.join(os.homedir(), ".openclaw", "logs"),

  hermesLogs:
    process.env.AGENTIC_OS_HERMES_LOGS ??
    fileCfg.hermesLogs ??
    path.join(os.homedir(), ".hermes", "cache"),

  locationLabel:
    process.env.AGENTIC_OS_LOCATION ?? fileCfg.locationLabel ?? "Local",

  goalCategories:
    fileCfg.goalCategories ?? ["Health", "Personal", "Work", "Learning", "Side Project"],
};

export function expandHome(p: string): string {
  if (p === "~") return os.homedir();
  if (p.startsWith("~/") || p.startsWith("~\\"))
    return path.join(os.homedir(), p.slice(2));
  return p;
}

export function isInstalled(agent: keyof Pick<AgenticConfig, "claude"|"openclaw"|"hermes"|"gemini"|"antigravity"|"codex">): boolean {
  return Boolean(config[agent]);
}

/** Claude model override — single source of truth. */
export const CLAUDE_MODEL: string =
  process.env.AGENTIC_OS_CLAUDE_MODEL ??
  (fileCfg as { claudeModel?: string }).claudeModel ??
  "claude-opus-4-8";
