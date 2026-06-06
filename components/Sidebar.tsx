"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { motion } from "framer-motion";
import { LayoutDashboard, Search, Target, NotebookPen, Brain, Network, TrendingUp, Columns3, Cloud, Inbox, AtSign } from "lucide-react";
import { AGENTS } from "@/lib/agents";
import { Avatar } from "@/components/Avatar";

export function Sidebar() {
  const pathname = usePathname();
  const [q, setQ] = useState("");

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  const filtered = AGENTS.filter((a) => a.name.toLowerCase().includes(q.toLowerCase()));

  return (
    <aside className="sticky top-0 hidden h-screen w-[264px] shrink-0 flex-col border-r border-[var(--border)] bg-[rgba(8,7,12,0.72)] px-3 py-5 backdrop-blur-xl md:flex">
      <Link href="/" className="mb-5 block px-2">
        <div className="sidebar-section-label mb-0.5" style={{ color: "var(--cream-mute)" }}>Local · Bangkok</div>
        <div className="text-xl tracking-tight" style={{ fontFamily: "var(--font-bricolage), sans-serif", fontWeight: 500, color: "var(--cream)" }}>
          Agentic <span className="hand text-[1.3em] ml-1" style={{ color: "var(--gold)" }}>OS</span>
        </div>
      </Link>

      {/* Search */}
      <div className="mb-4 flex items-center gap-2 rounded-lg border border-[var(--border)] bg-white/[0.02] px-2.5 py-1.5">
        <Search className="h-3.5 w-3.5 text-[var(--faint)]" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search agents"
          className="w-full bg-transparent text-[13px] outline-none placeholder:text-[var(--faint)]"
        />
      </div>

      <p className="mb-1 px-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--faint)]">
        Workspace
      </p>
      <NavRow href="/" active={isActive("/")} label="Mission Control">
        <span className="grid h-8 w-8 place-items-center rounded-lg border border-[var(--border)] text-muted">
          <LayoutDashboard className="h-[17px] w-[17px]" />
        </span>
      </NavRow>

      <p className="mb-1 mt-5 px-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--faint)]">
        Agents
      </p>
      <nav className="flex flex-col gap-0.5 overflow-y-auto">
        {filtered.map((agent) => {
          const href = `/agents/${agent.slug}`;
          return (
            <NavRow key={agent.slug} href={href} active={isActive(href)} label={agent.name} sub={agent.role}>
              <Avatar agent={agent} size="sm" showStatus />
            </NavRow>
          );
        })}
        {filtered.length === 0 && (
          <p className="px-2 py-3 text-[12px] text-[var(--faint)]">No agents match.</p>
        )}
      </nav>

      <p className="mb-1 mt-5 px-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--faint)]">
        Cloud
      </p>
      <NavRow href="/vps-hermes" active={isActive("/vps-hermes")} label="Hermes · VPS" sub="Hostinger · deepseek-v4-flash">
        <span className="grid h-8 w-8 place-items-center rounded-lg border border-[var(--border)] text-muted">
          <Cloud className="h-[17px] w-[17px]" />
        </span>
      </NavRow>

      <p className="mb-1 mt-5 px-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--faint)]">
        Self
      </p>
      <NavRow href="/kanban" active={isActive("/kanban")} label="Kanban">
        <span className="grid h-8 w-8 place-items-center rounded-lg border border-[var(--border)] text-muted">
          <Columns3 className="h-[17px] w-[17px]" />
        </span>
      </NavRow>
      <NavRow href="/x-search" active={isActive("/x-search")} label="X-Search" sub="Grok · live X/Twitter">
        <span className="grid h-8 w-8 place-items-center rounded-lg border border-[var(--border)] text-muted">
          <AtSign className="h-[17px] w-[17px]" />
        </span>
      </NavRow>
      <NavRow href="/seo" active={isActive("/seo")} label="SEO">
        <span className="grid h-8 w-8 place-items-center rounded-lg border border-[var(--border)] text-muted">
          <TrendingUp className="h-[17px] w-[17px]" />
        </span>
      </NavRow>
      <NavRow href="/goals" active={isActive("/goals")} label="Goals">
        <span className="grid h-8 w-8 place-items-center rounded-lg border border-[var(--border)] text-muted">
          <Target className="h-[17px] w-[17px]" />
        </span>
      </NavRow>
      <NavRow href="/journal" active={isActive("/journal")} label="Journal">
        <span className="grid h-8 w-8 place-items-center rounded-lg border border-[var(--border)] text-muted">
          <NotebookPen className="h-[17px] w-[17px]" />
        </span>
      </NavRow>
      <NavRow href="/swarm" active={isActive("/swarm")} label="Swarm">
        <span className="grid h-8 w-8 place-items-center rounded-lg border border-[var(--border)] text-muted">
          <Network className="h-[17px] w-[17px]" />
        </span>
      </NavRow>
      <NavRow href="/import/chatgpt" active={pathname.startsWith("/import/chatgpt")} label="Import ChatGPT" sub="conversations.json">
        <span className="grid h-8 w-8 place-items-center rounded-lg border border-[var(--border)] text-muted">
          <Inbox className="h-[17px] w-[17px]" />
        </span>
      </NavRow>
      <NavRow href="/import/grok" active={pathname.startsWith("/import/grok")} label="Import Grok" sub="prod-grok-backend.json">
        <span className="grid h-8 w-8 place-items-center rounded-lg border border-[var(--border)] text-muted">
          <Inbox className="h-[17px] w-[17px]" />
        </span>
      </NavRow>
      <NavRow href="/memory" active={isActive("/memory")} label="Memory">
        <span className="grid h-8 w-8 place-items-center rounded-lg border border-[var(--border)] text-muted">
          <Brain className="h-[17px] w-[17px]" />
        </span>
      </NavRow>

      <div className="mt-auto border-t pt-4 mx-2" style={{ borderColor: "var(--line-soft)" }}>
        <div className="sidebar-section-label mb-2">Wired</div>
        <div className="text-[11px] leading-relaxed mono" style={{ color: "var(--cream-dim)" }}>
          claude · openclaw · hermes<br />
          <span className="hand text-[1.15em]">+</span> Obsidian vault
        </div>
      </div>
    </aside>
  );
}

function NavRow({
  href,
  active,
  label,
  sub,
  children,
}: {
  href: string;
  active: boolean;
  label: string;
  sub?: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="group relative flex items-center gap-2.5 rounded-xl px-2 py-1.5 transition-colors"
    >
      {active && (
        <motion.span
          layoutId="nav-active"
          className="absolute inset-0 -z-10 rounded-xl border border-[var(--border-strong)] bg-white/[0.05]"
          transition={{ type: "spring", stiffness: 420, damping: 34 }}
        />
      )}
      {children}
      <span className="min-w-0 flex-1">
        <span className={`block truncate text-[13.5px] font-medium ${active ? "text-fg" : "text-muted group-hover:text-fg"}`}>
          {label}
        </span>
        {sub && <span className="block truncate text-[11px] text-[var(--faint)]">{sub}</span>}
      </span>
    </Link>
  );
}
