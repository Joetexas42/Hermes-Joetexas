import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import os from "node:os";

// ── Site definitions ──────────────────────────────────────────────────────
// Override via ~/.agentic-os/config.json "seoSites" array or the env var
// AGENTIC_OS_SEO_SITES (JSON). The default funnel mirrors Julian Goldie's 5 sites.
// On Windows, "~" expands to C:\Users\ADMIN (or current user home).
export interface SiteConfig {
  id: string;
  name: string;
  url: string;
  path: string;      // local repo root
  postsDir?: string; // defaults to <path>/src/blog/posts
}

function expandHome(p: string): string {
  if (p === "~") return os.homedir();
  if (p.startsWith("~/") || p.startsWith("~\\"))
    return path.join(os.homedir(), p.slice(2));
  return p;
}

const DEFAULT_SITES: SiteConfig[] = [
  { id: "bestaiagentcommunity",   name: "bestaiagentcommunity.com",     url: "https://bestaiagentcommunity.com",       path: "~/AIProfitBoardroom.com" },
  { id: "aiprofitboardroom",      name: "aiprofitboardroom.com",        url: "https://aiprofitboardroom.com",          path: "~/AIProfitBoardroom-main" },
  { id: "juliangoldieautomation", name: "juliangoldieaiautomation.com", url: "https://juliangoldieaiautomation.com",   path: "~/juliangoldieaiautomation" },
  { id: "aisuccesslab",           name: "aisuccesslabjuliangoldie.com", url: "https://aisuccesslabjuliangoldie.com",   path: "~/aisuccesslab" },
  { id: "aimoneylab",             name: "aimoneylabjuliangoldie.com",   url: "https://aimoneylabjuliangoldie.com",     path: "~/aimoneylab" },
];

function loadSiteConfig(): SiteConfig[] {
  // Env var override
  const raw = process.env.AGENTIC_OS_SEO_SITES;
  if (raw) { try { const v = JSON.parse(raw); if (Array.isArray(v)) return v; } catch {} }
  return DEFAULT_SITES;
}

export interface Site {
  id: string; name: string; url: string;
  path: string; postsDir: string;
}

function resolveSites(): Site[] {
  return loadSiteConfig().map((s) => {
    const root = expandHome(s.path);
    return {
      id: s.id, name: s.name,
      url: s.url.replace(/\/+$/, ""),
      path: root,
      postsDir: s.postsDir ? expandHome(s.postsDir) : path.join(root, "src", "blog", "posts"),
    };
  });
}

export const SITES: Site[] = resolveSites();

// The skill + transcripts live under the first configured site's .claude dir.
const SKILL_SITE = SITES[0];
export const TRANSCRIPTS_DIR = path.join(SKILL_SITE.path, ".claude", "transcripts");
export const BLOG_POST_SKILL  = path.join(SKILL_SITE.path, ".claude", "skills", "blog-post.md");

// ── Site stats ────────────────────────────────────────────────────────────
export interface SiteStats {
  site: Site;
  postCount: number;
  recent: { slug: string; mtime: number; title?: string; date?: string }[];
  exists: boolean;
}

async function listRecent(dir: string, n = 6) {
  try {
    const items = await readdir(dir);
    const mds = items.filter((f) => /\.md$/i.test(f));
    const with_stat = await Promise.all(
      mds.map(async (f) => {
        try { const s = await stat(path.join(dir, f)); return { name: f, mtime: s.mtimeMs }; }
        catch { return { name: f, mtime: 0 }; }
      }),
    );
    return with_stat.sort((a, b) => b.mtime - a.mtime).slice(0, n);
  } catch { return []; }
}

async function readFrontmatter(file: string): Promise<{ title?: string; date?: string }> {
  try {
    const data = await readFile(file, "utf8");
    const m = data.match(/^---\s*\n([\s\S]*?)\n---/);
    if (!m) return {};
    const fm = m[1];
    const t = fm.match(/^title:\s*["']?([^"'\n]+)["']?\s*$/m);
    const d = fm.match(/^date:\s*["']?([^"'\n]+)["']?\s*$/m);
    return { title: t?.[1].trim(), date: d?.[1].trim() };
  } catch { return {}; }
}

export async function getSiteStats(site: Site): Promise<SiteStats> {
  let postCount = 0, exists = false;
  try {
    const items = await readdir(site.postsDir);
    postCount = items.filter((f) => /\.md$/i.test(f)).length;
    exists = true;
  } catch { exists = false; }

  const recent = await listRecent(site.postsDir);
  const enriched = await Promise.all(
    recent.map(async (r) => ({
      slug: r.name.replace(/\.md$/, ""),
      mtime: r.mtime,
      ...(await readFrontmatter(path.join(site.postsDir, r.name))),
    })),
  );
  return { site, postCount, recent: enriched, exists };
}

export async function getAllSiteStats(): Promise<SiteStats[]> {
  return Promise.all(SITES.map(getSiteStats));
}

// ── Transcripts ───────────────────────────────────────────────────────────
export interface TranscriptMeta { slug: string; bytes: number; mtime: number; preview: string; }

export async function listTranscripts(): Promise<TranscriptMeta[]> {
  try {
    const items = await readdir(TRANSCRIPTS_DIR);
    const out: TranscriptMeta[] = [];
    for (const f of items.filter((f) => /\.txt$/i.test(f))) {
      try {
        const full = path.join(TRANSCRIPTS_DIR, f);
        const s = await stat(full);
        const head = (await readFile(full, "utf8")).slice(0, 220).replace(/\s+/g, " ").trim();
        out.push({ slug: f.replace(/\.txt$/, ""), bytes: s.size, mtime: s.mtimeMs, preview: head });
      } catch {}
    }
    return out.sort((a, b) => b.mtime - a.mtime);
  } catch { return []; }
}

export async function readTranscript(slug: string): Promise<string | null> {
  if (!/^[A-Za-z0-9_-]+$/.test(slug)) return null;
  try { return await readFile(path.join(TRANSCRIPTS_DIR, `${slug}.txt`), "utf8"); }
  catch { return null; }
}

export async function saveTranscript(slug: string, content: string): Promise<string> {
  const { mkdir, writeFile } = await import("node:fs/promises");
  await mkdir(TRANSCRIPTS_DIR, { recursive: true });
  const file = path.join(TRANSCRIPTS_DIR, `${slug}.txt`);
  await writeFile(file, content, "utf8");
  return file;
}
