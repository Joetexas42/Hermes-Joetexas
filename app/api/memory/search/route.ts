import { NextResponse } from "next/server";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { listNotes, getVaultConfig } from "@/lib/vault";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const q = (searchParams.get("q") ?? "").trim().toLowerCase();
  if (!q) return NextResponse.json({ notes: [] });

  const cfg = await getVaultConfig();
  const files = await listNotes(cfg.vaultDir);

  const hits = await Promise.all(
    files.map(async (abs) => {
      let content = "";
      try { content = await readFile(abs, "utf8"); } catch { return null; }

      const lower = content.toLowerCase();
      const titleLower = path.basename(abs, ".md").toLowerCase();

      const titleMatch = titleLower.includes(q) ? 2 : 0;
      const bodyCount  = (lower.match(new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g")) ?? []).length;
      const score = titleMatch + bodyCount;
      if (score === 0) return null;

      // Build a preview snippet around the first body hit
      const idx = lower.indexOf(q);
      const start = Math.max(0, idx - 60);
      const end   = Math.min(content.length, idx + 120);
      const preview = (start > 0 ? "…" : "") + content.slice(start, end).replace(/\n+/g, " ") + (end < content.length ? "…" : "");

      let mtime = 0;
      try { const st = await stat(abs); mtime = st.mtimeMs; } catch {}

      return {
        path:    path.relative(cfg.vaultDir, abs),
        title:   path.basename(abs, ".md"),
        preview: preview.trim(),
        score,
        mtime,
      };
    }),
  );

  const notes = hits
    .filter(Boolean)
    .sort((a, b) => b!.score - a!.score)
    .slice(0, 30);

  return NextResponse.json({ notes });
}
