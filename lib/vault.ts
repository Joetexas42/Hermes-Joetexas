import { promises as fs } from "node:fs";
import path from "node:path";

/* ── Vault note walker ──────────────────────────────────────────────────── */

/**
 * Recursively list all .md files under `dir`, skipping hidden folders
 * (.obsidian, .trash, etc.) and node_modules. Returns absolute paths.
 * Always async — never uses sync fs calls on a Drive-mounted path.
 */
export async function listNotes(dir: string): Promise<string[]> {
  const results: string[] = [];
  let entries;
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return results;
  }
  await Promise.all(
    entries.map(async (e) => {
      if (e.name.startsWith(".") || e.name === "node_modules") return;
      const full = path.join(dir, e.name);
      if (e.isDirectory()) {
        results.push(...await listNotes(full));
      } else if (e.isFile() && e.name.endsWith(".md")) {
        results.push(full);
      }
    }),
  );
  return results;
}

/** Async existence check — never use existsSync on the Drive-mounted vault path
 *  (a sync stat on Google Drive FS can block the whole Node event loop). */
async function pathExists(p: string): Promise<boolean> {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

/** Default vault root (detected Drive-synced Obsidian vault). Override in settings. */
const DEFAULT_VAULT = "G:\\My Drive\\DO NOT DELETE\\Joe Hermes\\Vault";
const SUBFOLDER = "Agentic OS";
const STATE_FILE = path.join(process.cwd(), ".vault-state.json");

export interface VaultConfig {
  vaultDir: string;
  enabled: boolean;
}

export async function getVaultConfig(): Promise<VaultConfig> {
  try {
    const raw = await fs.readFile(STATE_FILE, "utf8");
    const parsed = JSON.parse(raw) as Partial<VaultConfig>;
    return {
      vaultDir: parsed.vaultDir || DEFAULT_VAULT,
      enabled: parsed.enabled !== false,
    };
  } catch {
    return { vaultDir: DEFAULT_VAULT, enabled: true };
  }
}

export async function setVaultConfig(next: Partial<VaultConfig>): Promise<VaultConfig> {
  const current = await getVaultConfig();
  const merged: VaultConfig = { ...current, ...next };
  await fs.writeFile(STATE_FILE, JSON.stringify(merged, null, 2), "utf8");
  return merged;
}

export function agenticDir(cfg: VaultConfig) {
  return path.join(cfg.vaultDir, SUBFOLDER);
}

export async function vaultStatus() {
  const cfg = await getVaultConfig();
  const dir = agenticDir(cfg);
  return {
    ...cfg,
    vaultExists: await pathExists(cfg.vaultDir),
    folder: dir,
    todayFile: path.join(dir, `${localDate()}.md`),
  };
}

/* ───────────────────────────  date helpers  ─────────────────────────── */
function pad(n: number) {
  return String(n).padStart(2, "0");
}
export function localDate(d = new Date()) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
export function localTime(d = new Date()) {
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function humanDate(d = new Date()) {
  return new Intl.DateTimeFormat(undefined, {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(d);
}

/* ───────────────────────────  entry writing  ─────────────────────────── */
export type EntryKind = "chat" | "goal" | "journal";

const SECTIONS: Record<EntryKind, string> = {
  chat: "## 🗨️ Chats",
  goal: "## 🎯 Goals",
  journal: "## 📓 Journal",
};

interface EntryInput {
  kind: EntryKind;
  /** chat */
  agent?: string;
  you?: string;
  assistant?: string;
  /** goal / journal */
  text?: string;
  /** goal lifecycle: "added" | "completed" */
  event?: string;
}

function dayTemplate(d = new Date()) {
  return [
    "---",
    `created: ${localDate(d)}`,
    "tags: [agentic-os]",
    "---",
    "",
    `# Agentic OS — ${humanDate(d)}`,
    "",
    SECTIONS.chat,
    "",
    SECTIONS.goal,
    "",
    SECTIONS.journal,
    "",
  ].join("\n");
}

function renderBlock(input: EntryInput, now: Date): string {
  const t = localTime(now);
  if (input.kind === "chat") {
    const you = (input.you ?? "").trim();
    const asst = (input.assistant ?? "").trim();
    return [
      `### ${t} · ${input.agent ?? "Agent"}`,
      "",
      `**You:** ${you}`,
      "",
      `**${input.agent ?? "Agent"}:** ${asst}`,
      "",
    ].join("\n");
  }
  if (input.kind === "goal") {
    const box = input.event === "completed" ? "[x]" : "[ ]";
    const verb = input.event === "completed" ? "✓ completed" : "added";
    return `- ${box} ${t} ${input.text ?? ""}  _(${verb})_\n`;
  }
  // journal
  return [`### ${t}`, "", (input.text ?? "").trim(), ""].join("\n");
}

/** Insert a block at the end of the named section (before the next "## " or EOF). */
function appendToSection(content: string, sectionHeading: string, block: string): string {
  const lines = content.split("\n");
  const start = lines.findIndex((l) => l.trim() === sectionHeading);
  if (start === -1) {
    // Section missing — append section + block at end.
    return `${content.replace(/\s*$/, "")}\n\n${sectionHeading}\n\n${block}`;
  }
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i++) {
    if (lines[i].startsWith("## ")) {
      end = i;
      break;
    }
  }
  // Trim trailing blank lines within the section, then insert the block.
  let insertAt = end;
  while (insertAt - 1 > start && lines[insertAt - 1].trim() === "") insertAt--;
  const before = lines.slice(0, insertAt);
  const after = lines.slice(insertAt);
  return [...before, "", ...block.split("\n"), ...after].join("\n");
}

/* Serialize writes so concurrent saves to the same day file don't clobber. */
let writeLock: Promise<unknown> = Promise.resolve();

export async function saveEntry(input: EntryInput): Promise<{ ok: boolean; file?: string; reason?: string }> {
  const run = async () => {
    const cfg = await getVaultConfig();
    if (!cfg.enabled) return { ok: false, reason: "Vault auto-save is off." };
    if (!(await pathExists(cfg.vaultDir))) return { ok: false, reason: "Vault folder not found." };

    const dir = agenticDir(cfg);
    await fs.mkdir(dir, { recursive: true });

    const now = new Date();
    const file = path.join(dir, `${localDate(now)}.md`);

    let content: string;
    try {
      content = await fs.readFile(file, "utf8");
    } catch {
      content = dayTemplate(now);
    }

    const block = renderBlock(input, now);
    const updated = appendToSection(content, SECTIONS[input.kind], block);
    await fs.writeFile(file, updated, "utf8");
    return { ok: true, file };
  };

  const result = writeLock.then(run, run);
  writeLock = result.catch(() => {});
  return result;
}
