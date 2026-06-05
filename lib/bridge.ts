import { promises as fs } from "node:fs";
import { existsSync, readdirSync } from "node:fs";
import os from "node:os";
import path from "node:path";

/**
 * The Claude Code CLI bridge.
 *
 * The Claude desktop app ships a versioned CLI at
 *   %APPDATA%/Claude/claude-code/<version>/claude.exe
 * We resolve the newest version at runtime so the bridge survives updates.
 * (Override with CLAUDE_CLI_PATH if your install lives elsewhere.)
 */
export function resolveClaudeExe(): string | null {
  if (process.env.CLAUDE_CLI_PATH && existsSync(process.env.CLAUDE_CLI_PATH)) {
    return process.env.CLAUDE_CLI_PATH;
  }

  const exeName = process.platform === "win32" ? "claude.exe" : "claude";
  const roots = [
    path.join(process.env.APPDATA ?? "", "Claude", "claude-code"),
    path.join(os.homedir(), "AppData", "Roaming", "Claude", "claude-code"),
    path.join(os.homedir(), ".claude", "claude-code"),
  ].filter(Boolean);

  for (const root of roots) {
    if (!existsSync(root)) continue;
    const versions = readdirSync(root, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name)
      .sort(compareVersionsDesc);
    for (const v of versions) {
      const candidate = path.join(root, v, exeName);
      if (existsSync(candidate)) return candidate;
    }
  }
  return null;
}

function compareVersionsDesc(a: string, b: string): number {
  const pa = a.split(".").map((n) => parseInt(n, 10) || 0);
  const pb = b.split(".").map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const diff = (pb[i] ?? 0) - (pa[i] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

/* ───────────────  Armed state (off by default, persisted)  ─────────────── */

const STATE_FILE = path.join(process.cwd(), ".bridge-state.json");

export type AuthMethod = "oauth" | "apikey" | "none";

export interface BridgeState {
  armed: boolean;
  workingDir: string;
  /** how the spawned CLI authenticates */
  authMethod: AuthMethod;
  /** the OAuth token (from `claude setup-token`) or the ANTHROPIC_API_KEY */
  token: string;
}

export async function getBridgeState(): Promise<BridgeState> {
  try {
    const raw = await fs.readFile(STATE_FILE, "utf8");
    const parsed = JSON.parse(raw) as Partial<BridgeState>;
    return {
      armed: parsed.armed === true,
      workingDir: parsed.workingDir || os.homedir(),
      authMethod: parsed.authMethod ?? "none",
      token: parsed.token ?? "",
    };
  } catch {
    return { armed: false, workingDir: os.homedir(), authMethod: "none", token: "" };
  }
}

/**
 * Build the environment for the spawned CLI. We always strip any inherited
 * ANTHROPIC_API_KEY (the host may set a non-standalone one that breaks auth),
 * then inject the credential the user chose.
 */
export function buildChildEnv(state: BridgeState): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = { ...process.env };
  delete env.ANTHROPIC_API_KEY;
  delete env.CLAUDE_CODE_OAUTH_TOKEN;
  if (state.authMethod === "oauth" && state.token) {
    env.CLAUDE_CODE_OAUTH_TOKEN = state.token;
  } else if (state.authMethod === "apikey" && state.token) {
    env.ANTHROPIC_API_KEY = state.token;
  }
  return env;
}

export async function setBridgeState(next: Partial<BridgeState>): Promise<BridgeState> {
  const current = await getBridgeState();
  const merged: BridgeState = { ...current, ...next };
  await fs.writeFile(STATE_FILE, JSON.stringify(merged, null, 2), "utf8");
  return merged;
}

/** Reject any request that isn't from the loopback interface. */
export function isLocalRequest(req: Request): boolean {
  const host = (req.headers.get("host") ?? "").split(":")[0];
  return host === "localhost" || host === "127.0.0.1" || host === "::1" || host === "[::1]";
}
