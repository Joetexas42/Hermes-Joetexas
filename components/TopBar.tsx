"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Settings, Command } from "lucide-react";
import { BridgeToggle } from "@/components/BridgeToggle";
import { usePalette } from "@/components/CommandPalette";

export function TopBar() {
  const [now, setNow] = useState<Date | null>(null);
  const palette = usePalette();

  useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const time = now
    ? now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })
    : "--:--:--";

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-[var(--border)] bg-[rgba(6,5,9,0.55)] px-5 backdrop-blur-xl">
      <div className="flex items-center gap-3 text-xs text-[var(--faint)]">
        <span className="font-mono tabular-nums text-muted">{time}</span>
        <span className="h-1 w-1 rounded-full bg-[var(--faint)]" />
        <span className="uppercase tracking-[0.16em]">Local</span>
      </div>
      <div className="flex items-center gap-2">
        {/* ⌘K trigger */}
        <button
          onClick={palette.open}
          className="hidden items-center gap-2 rounded-lg border border-[var(--border)] bg-white/[0.02] px-2.5 py-1.5 text-[12px] text-muted transition-colors hover:text-fg sm:flex"
        >
          <Command className="h-3.5 w-3.5" />
          <span>Search</span>
          <kbd className="ml-1 rounded border border-[var(--border-strong)] bg-white/[0.04] px-1 py-0.5 font-mono text-[10px]">
            Ctrl K
          </kbd>
        </button>
        <BridgeToggle />
        <Link
          href="/settings"
          title="Bridge settings"
          className="grid h-8 w-8 place-items-center rounded-lg border border-[var(--border)] text-muted transition-colors hover:text-fg"
        >
          <Settings className="h-4 w-4" />
        </Link>
      </div>
    </header>
  );
}
