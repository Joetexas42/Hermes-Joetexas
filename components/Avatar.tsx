import { Sparkles, Feather, Gem, Rocket, Braces, Orbit } from "lucide-react";
import type { Agent, IconKey } from "@/lib/agents";

const ICONS: Record<IconKey, React.ComponentType<{ className?: string }>> = {
  sparkles: Sparkles,
  feather: Feather,
  gem: Gem,
  rocket: Rocket,
  braces: Braces,
  orbit: Orbit,
};

const SIZES = {
  sm: { box: "h-8 w-8 rounded-lg", glyph: "h-4 w-4", dot: "h-2 w-2" },
  md: { box: "h-10 w-10 rounded-xl", glyph: "h-5 w-5", dot: "h-2.5 w-2.5" },
  lg: { box: "h-12 w-12 rounded-2xl", glyph: "h-6 w-6", dot: "h-3 w-3" },
} as const;

export function Avatar({
  agent,
  size = "md",
  showStatus = false,
}: {
  agent: Agent;
  size?: keyof typeof SIZES;
  showStatus?: boolean;
}) {
  const Glyph = ICONS[agent.icon];
  const s = SIZES[size];
  return (
    <span className="relative inline-flex shrink-0">
      <span
        className={`grid place-items-center ${s.box} text-white shadow-[0_4px_14px_-4px_rgba(0,0,0,0.6)]`}
        style={{ background: `linear-gradient(140deg, ${agent.gradient[0]}, ${agent.gradient[1]})` }}
      >
        <Glyph className={s.glyph} />
      </span>
      {showStatus && (
        <span
          className={`absolute -bottom-0.5 -right-0.5 ${s.dot} rounded-full ring-2 ring-[var(--bg)] ${
            agent.status === "live" ? "live-dot" : ""
          }`}
          style={{ background: agent.status === "live" ? "var(--green)" : "var(--faint)" }}
        />
      )}
    </span>
  );
}
