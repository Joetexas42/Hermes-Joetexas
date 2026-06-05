import { NextResponse } from "next/server";
import { mkdir, writeFile, readdir, stat } from "node:fs/promises";
import path from "node:path";
import { getVaultConfig } from "@/lib/vault";
import { parseExport, renderMarkdown, slugify } from "@/lib/chatgptImport";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Increase body limit — a typical conversations.json is several MB
export const maxDuration = 60;

interface ImportResult { written: number; skipped: number; errors: string[]; folder: string; }

/* ── POST: import ────────────────────────────────────────────────────── */
export async function POST(req: Request) {
  let payload: unknown;
  try {
    payload = await req.json();
  } catch (e) {
    return NextResponse.json({ error: `bad JSON: ${(e as Error).message}` }, { status: 400 });
  }

  const conversations = parseExport(payload);
  if (conversations.length === 0) {
    return NextResponse.json({
      error: "No valid conversations found. Make sure you uploaded the conversations.json file from your ChatGPT export.",
    }, { status: 400 });
  }

  const cfg = await getVaultConfig();
  const folder = path.join(cfg.vaultDir, "ChatGPT");
  await mkdir(folder, { recursive: true });

  const result: ImportResult = { written: 0, skipped: 0, errors: [], folder };

  for (const conv of conversations) {
    const dateStr = conv.createdAt
      ? new Date(conv.createdAt * 1000).toISOString().slice(0, 10)
      : "unknown-date";
    const slug = slugify(conv.title);
    const filename = `${dateStr} ${slug}.md`;
    const fullPath = path.join(folder, filename);

    try {
      // Skip if the same file already exists with identical content (idempotent re-runs)
      try {
        const existing = await stat(fullPath);
        if (existing.isFile()) { result.skipped++; continue; }
      } catch { /* doesn't exist — write it */ }

      await writeFile(fullPath, renderMarkdown(conv), "utf8");
      result.written++;
    } catch (e) {
      result.errors.push(`${filename}: ${(e as Error).message}`);
    }
  }

  return NextResponse.json(result);
}

/* ── GET: list already-imported files ────────────────────────────────── */
export async function GET() {
  const cfg = await getVaultConfig();
  const folder = path.join(cfg.vaultDir, "ChatGPT");
  try {
    const items = await readdir(folder);
    const files = await Promise.all(
      items.filter((f) => f.endsWith(".md")).map(async (name) => {
        try {
          const st = await stat(path.join(folder, name));
          return { name, mtime: st.mtimeMs, size: st.size };
        } catch { return null; }
      }),
    );
    const valid = files.filter((f): f is { name: string; mtime: number; size: number } => f !== null);
    valid.sort((a, b) => b.mtime - a.mtime);
    return NextResponse.json({ folder, count: valid.length, recent: valid.slice(0, 20) });
  } catch {
    return NextResponse.json({ folder, count: 0, recent: [] });
  }
}
