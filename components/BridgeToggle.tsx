"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";

interface BridgeInfo {
  armed: boolean;
  cliFound: boolean;
  cliPath: string | null;
}

export function BridgeToggle() {
  const [info, setInfo] = useState<BridgeInfo | null>(null);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    try {
      const res = await fetch("/api/bridge", { cache: "no-store" });
      setInfo(await res.json());
    } catch {
      setInfo(null);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const toggle = async () => {
    if (!info || busy) return;
    setBusy(true);
    try {
      const res = await fetch("/api/bridge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ armed: !info.armed }),
      });
      setInfo(await res.json());
    } finally {
      setBusy(false);
    }
  };

  const armed = info?.armed ?? false;
  const disabled = !info?.cliFound;

  return (
    <div className="flex items-center gap-3">
      <div className="hidden text-right text-[11px] leading-tight sm:block">
        <div className="font-medium text-fg">Claude Bridge</div>
        <div className="text-[var(--faint)]">
          {!info
            ? "checking…"
            : !info.cliFound
              ? "CLI not found"
              : armed
                ? "armed · live"
                : "disarmed"}
        </div>
      </div>

      <button
        onClick={toggle}
        disabled={disabled || busy}
        title={
          disabled
            ? "Claude Code CLI was not found on this machine"
            : armed
              ? "Click to disarm the bridge"
              : "Click to arm the bridge (lets this page run your real Claude)"
        }
        className="relative flex h-7 w-[52px] items-center rounded-full border border-[var(--border-strong)] px-0.5 transition-colors disabled:opacity-40"
        style={{
          background: armed
            ? "linear-gradient(90deg, rgba(52,211,153,0.35), rgba(34,211,238,0.35))"
            : "rgba(255,255,255,0.05)",
        }}
      >
        <motion.span
          layout
          transition={{ type: "spring", stiffness: 600, damping: 34 }}
          className="grid h-6 w-6 place-items-center rounded-full bg-white shadow"
          style={{ marginLeft: armed ? "auto" : 0 }}
        >
          <span
            className={`h-2 w-2 rounded-full ${armed ? "live-dot bg-green" : "bg-[var(--faint)]"}`}
            style={armed ? { background: "var(--green)" } : undefined}
          />
        </motion.span>
      </button>
    </div>
  );
}
