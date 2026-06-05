import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { listNotes, getVaultConfig } from "@/lib/vault";

export interface GraphNode {
  id: string;       // relative path (unique key)
  title: string;    // basename without .md (display label)
  group: string;    // top-level folder → colour bucket
  degree: number;   // in + out link count → node size
  mtime: number;
}
export interface GraphLink { source: string; target: string; }
export interface VaultGraph { nodes: GraphNode[]; links: GraphLink[]; }

// Matches [[Note Title]], [[Note#heading]], [[Note|alias]], combinations thereof.
const WIKILINK_RE = /\[\[([^\[\]\n|#]+)(?:#[^\[\]\n|]+)?(?:\|[^\[\]\n]+)?\]\]/g;

export async function buildVaultGraph(): Promise<VaultGraph> {
  const cfg = await getVaultConfig();
  const VAULT_ROOT = cfg.vaultDir;

  const files = await listNotes(VAULT_ROOT);
  if (files.length === 0) return { nodes: [], links: [] };

  // ── Index: title (lowercase) → relative path ──
  const byTitle = new Map<string, string>();
  const meta = new Map<string, { rel: string; title: string; group: string; mtime: number }>();

  await Promise.all(
    files.map(async (abs) => {
      const rel  = path.relative(VAULT_ROOT, abs);
      const title = path.basename(abs, ".md");
      const parts = rel.split(path.sep);
      const group = parts.length > 1 ? parts[0] : "root";
      let mtime = 0;
      try { const st = await stat(abs); mtime = st.mtimeMs; } catch {}
      meta.set(rel, { rel, title, group, mtime });
      if (!byTitle.has(title.toLowerCase())) byTitle.set(title.toLowerCase(), rel);
    }),
  );

  // ── Walk links ──
  const linkSet = new Set<string>();
  const links: GraphLink[] = [];
  const degree = new Map<string, number>();

  await Promise.all(
    files.map(async (abs) => {
      const rel = path.relative(VAULT_ROOT, abs);
      let content = "";
      try { content = await readFile(abs, "utf8"); } catch { return; }

      for (const m of content.matchAll(WIKILINK_RE)) {
        const targetTitle = m[1].trim();
        if (!targetTitle) continue;
        const targetRel = byTitle.get(targetTitle.toLowerCase());
        if (!targetRel || targetRel === rel) continue;
        const key = `${rel}→${targetRel}`;
        if (linkSet.has(key)) continue;
        linkSet.add(key);
        links.push({ source: rel, target: targetRel });
        degree.set(rel,       (degree.get(rel)       ?? 0) + 1);
        degree.set(targetRel, (degree.get(targetRel) ?? 0) + 1);
      }
    }),
  );

  const nodes: GraphNode[] = Array.from(meta.values()).map((m) => ({
    id:     m.rel,
    title:  m.title,
    group:  m.group,
    degree: degree.get(m.rel) ?? 0,
    mtime:  m.mtime,
  }));

  return { nodes, links };
}
