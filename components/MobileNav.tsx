"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, MessageSquare, Sparkles, Search, MoreHorizontal } from "lucide-react";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

const TABS = [
  { href: "/",              icon: LayoutDashboard, label: "Home" },
  { href: "/agents/hermes", icon: MessageSquare,   label: "Hermes" },
  { href: "/agents/gemini", icon: Sparkles,        label: "Gemini" },
  { href: "/x-search",      icon: Search,          label: "Search" },
];

const MORE_ITEMS = [
  { href: "/agents/openclaw", label: "OpenClaw" },
  { href: "/kanban",          label: "Kanban" },
  { href: "/goals",           label: "Goals" },
  { href: "/journal",         label: "Journal" },
  { href: "/seo",             label: "SEO" },
  { href: "/swarm",           label: "Swarm" },
  { href: "/memory",          label: "Memory" },
  { href: "/import/chatgpt",  label: "Import ChatGPT" },
  { href: "/import/grok",     label: "Import Grok" },
  { href: "/vps-hermes",      label: "Hermes VPS" },
];

export function MobileNav() {
  const pathname = usePathname();
  const [showMore, setShowMore] = useState(false);

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <>
      {/* More menu overlay */}
      <AnimatePresence>
        {showMore && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[90] md:hidden"
            onClick={() => setShowMore(false)}
          >
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
            <motion.div
              initial={{ y: 100, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 100, opacity: 0 }}
              transition={{ type: "spring", stiffness: 400, damping: 30 }}
              className="absolute bottom-[calc(env(safe-area-inset-bottom,0px)+72px)] left-3 right-3 rounded-2xl border p-3"
              style={{ background: "var(--panel-solid)", borderColor: "var(--line)" }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="grid grid-cols-2 gap-1.5">
                {MORE_ITEMS.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setShowMore(false)}
                    className="rounded-xl px-3 py-2.5 text-[13px] font-medium transition"
                    style={{
                      background: isActive(item.href) ? "rgba(212,165,116,0.12)" : "transparent",
                      color: isActive(item.href) ? "var(--cream)" : "var(--cream-dim)",
                    }}
                  >
                    {item.label}
                  </Link>
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bottom tab bar */}
      <nav
        className="fixed bottom-0 left-0 right-0 z-[100] flex items-center justify-around border-t md:hidden"
        style={{
          background: "rgba(13,11,20,0.92)",
          backdropFilter: "blur(20px) saturate(1.5)",
          WebkitBackdropFilter: "blur(20px) saturate(1.5)",
          borderColor: "var(--line-soft)",
          paddingBottom: "env(safe-area-inset-bottom, 0px)",
        }}
      >
        {TABS.map((tab) => {
          const active = isActive(tab.href);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className="flex flex-col items-center gap-0.5 px-3 py-2.5 transition"
            >
              <tab.icon
                size={20}
                style={{ color: active ? "var(--gold)" : "var(--cream-mute)" }}
              />
              <span
                className="text-[10px] font-medium"
                style={{ color: active ? "var(--gold)" : "var(--cream-mute)" }}
              >
                {tab.label}
              </span>
            </Link>
          );
        })}
        <button
          onClick={() => setShowMore(!showMore)}
          className="flex flex-col items-center gap-0.5 px-3 py-2.5 transition"
        >
          <MoreHorizontal
            size={20}
            style={{ color: showMore ? "var(--gold)" : "var(--cream-mute)" }}
          />
          <span
            className="text-[10px] font-medium"
            style={{ color: showMore ? "var(--gold)" : "var(--cream-mute)" }}
          >
            More
          </span>
        </button>
      </nav>
    </>
  );
}
