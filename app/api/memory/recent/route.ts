import { NextResponse } from "next/server";
import { stat } from "node:fs/promises";
import path from "node:path";
import { listNotes, getVaultConfig } from "@/lib/vault";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const cfg = await getVaultConfig();
  const files = await listNotes(cfg.vaultDir);

  const withMtime = await Promise.all(
    files.map(async (abs) => {
      let mtime = 0;
      try { const st = await stat(abs); mtime = st.mtimeMs; } catch {}
      return { abs, mtime };
    }),
  );

  const recent = withMtime
    .sort((a, b) => b.mtime - a.mtime)
    .slice(0, 20)
    .map(({ abs, mtime }) => ({
      path:  path.relative(cfg.vaultDir, abs),
      title: path.basename(abs, ".md"),
      mtime,
    }));

  return NextResponse.json({ recent });
}
