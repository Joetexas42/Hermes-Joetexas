import { AGENTS } from "@/lib/agents";

export type CommandKind = "agent" | "page" | "action";

export interface Command {
  id: string;
  kind: CommandKind;
  label: string;
  sub?: string;
  href?: string;
  keywords?: string[];
  icon?: string; // lucide icon name
}

const PAGE_COMMANDS: Command[] = [
  { id: "home",     kind: "page", label: "Mission Control", href: "/",         icon: "layout-dashboard", keywords: ["home", "dashboard", "mc"] },
  { id: "goals",    kind: "page", label: "Goals",           href: "/goals",    icon: "target",           keywords: ["tasks", "checklist"] },
  { id: "journal",  kind: "page", label: "Journal",         href: "/journal",  icon: "notebook-pen",     keywords: ["notes", "diary", "write"] },
  { id: "settings", kind: "page", label: "Settings",        href: "/settings", icon: "settings",         keywords: ["bridge", "vault", "token", "config"] },
  { id: "vps",      kind: "page", label: "Hermes · VPS",     href: "/vps-hermes", icon: "cloud",         keywords: ["vps", "hostinger", "remote", "docker", "cloud", "deepseek"] },
  { id: "import-chatgpt", kind: "page", label: "Import ChatGPT", href: "/import/chatgpt", icon: "inbox",    keywords: ["chatgpt", "import", "conversations", "history", "export", "openai"] },
  { id: "kanban",   kind: "page", label: "Kanban",           href: "/kanban",   icon: "columns-3",        keywords: ["tasks", "board", "todo", "triage", "done"] },
  { id: "seo",      kind: "page", label: "SEO Suite",        href: "/seo",      icon: "trending-up",      keywords: ["blog", "articles", "keyword", "transcript", "deploy", "netlify", "goldie"] },
  { id: "swarm",    kind: "page", label: "Swarm Topology",  href: "/swarm",    icon: "network",          keywords: ["ruflo", "agents", "swarm", "orbital", "topology"] },
  { id: "memory",   kind: "page", label: "Memory Graph",    href: "/memory",   icon: "brain",            keywords: ["vault", "graph", "3d", "knowledge", "obsidian"] },
];

const AGENT_COMMANDS: Command[] = AGENTS.map((a) => ({
  id: `agent-${a.slug}`,
  kind: "agent" as CommandKind,
  label: a.name,
  sub: a.role,
  href: `/agents/${a.slug}`,
  keywords: [a.slug, a.role, a.tagline.toLowerCase()],
}));

export const ALL_COMMANDS: Command[] = [...PAGE_COMMANDS, ...AGENT_COMMANDS];

export function searchCommands(q: string): Command[] {
  const lower = q.toLowerCase().trim();
  if (!lower) return ALL_COMMANDS.slice(0, 8);
  return ALL_COMMANDS.filter((c) =>
    c.label.toLowerCase().includes(lower) ||
    c.sub?.toLowerCase().includes(lower) ||
    c.keywords?.some((k) => k.includes(lower)),
  ).slice(0, 8);
}
