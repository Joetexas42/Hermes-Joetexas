// Hermes Studio — live media via MiniMax, using the OAuth token Hermes stores.
import { promises as fs } from "node:fs";
import path from "node:path";
import os from "node:os";

// On Windows, Hermes installs to %LOCALAPPDATA%\hermes, not ~/.hermes
export const HERMES_ROOT =
  process.platform === "win32"
    ? path.join(process.env.LOCALAPPDATA ?? path.join(os.homedir(), "AppData", "Local"), "hermes")
    : path.join(os.homedir(), ".hermes");
export const MINIMAX_BASE = "https://api.minimax.io/v1";

export function activeProfile(): string {
  try {
    const { readFileSync } = require("node:fs") as typeof import("node:fs");
    const t = readFileSync(path.join(HERMES_ROOT, "active_profile"), "utf8").trim();
    if (/^[A-Za-z0-9_.-]+$/.test(t)) return t;
  } catch { /* fall through */ }
  return "main";
}

export function studioDirs() {
  const prof = activeProfile();
  return {
    image: path.join(HERMES_ROOT, "images"),
    voice: path.join(HERMES_ROOT, "profiles", prof, "audio_cache"),
    video: path.join(HERMES_ROOT, "videos"),
  } as const;
}

export const PREVIEW_BUCKET = {
  image: "images",
  voice: "audio",
  video: "videos",
} as const;

export function minimaxToken(): string | null {
  const { readFileSync } = require("node:fs") as typeof import("node:fs");
  // Try root auth.json first (Windows install layout), then profiles subfolder (macOS/Linux)
  const candidates = [
    path.join(HERMES_ROOT, "auth.json"),
    path.join(HERMES_ROOT, "profiles", activeProfile(), "auth.json"),
  ];
  for (const p of candidates) {
    try {
      const auth = JSON.parse(readFileSync(p, "utf8"));
      const mm = auth?.providers?.["minimax-oauth"] ?? auth?.providers?.minimax;
      const tok = mm?.access_token as string | undefined;
      if (tok) return tok;
    } catch { /* try next */ }
  }
  return null;
}

export function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 40).replace(/^-|-$/g, "") || "gen";
}

const EXT = {
  image: /\.(png|jpe?g|webp)$/i,
  voice: /\.(mp3|wav|m4a|ogg)$/i,
  video: /\.(mp4|webm|mov)$/i,
} as const;

export interface StudioItem { name: string; url: string; mtime: number; }

export async function listStudio(kind: "image" | "voice" | "video", max = 40): Promise<StudioItem[]> {
  const dir = studioDirs()[kind];
  const out: StudioItem[] = [];
  try {
    const entries = await fs.readdir(dir);
    await Promise.all(entries.map(async (name) => {
      if (!EXT[kind].test(name)) return;
      try {
        const st = await fs.stat(path.join(dir, name));
        if (!st.isFile()) return;
        out.push({
          name,
          mtime: st.mtimeMs,
          url: `/api/hermes/preview/${PREVIEW_BUCKET[kind]}/${encodeURIComponent(name)}`,
        });
      } catch { /* skip */ }
    }));
  } catch { /* dir missing = not yet generated anything */ }
  return out.sort((a, b) => b.mtime - a.mtime).slice(0, max);
}
