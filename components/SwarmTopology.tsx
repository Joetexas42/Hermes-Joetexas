"use client";

import { useEffect, useRef, useMemo } from "react";
import type { SwarmAgent, Topology } from "@/lib/swarm";

interface Props {
  name: string;
  topology: Topology;
  agents: SwarmAgent[];
  onSelectAgent?: (a: SwarmAgent) => void;
}

const MODEL_COLOR: Record<string, string> = {
  haiku:  "#5ab896",
  sonnet: "#d4a574",
  opus:   "#c4607e",
};

const STATUS_COLOR: Record<string, string> = {
  idle:    "rgba(255,255,255,0.12)",
  running: "#d4a574",
  done:    "#5ab896",
  error:   "#c4607e",
};

function hexToRgb(hex: string): [number, number, number] {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return [r, g, b];
}

export default function SwarmTopology({ name, topology, agents, onSelectAgent }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef   = useRef<HTMLDivElement>(null);
  const animRef   = useRef<number | null>(null);
  const timeRef   = useRef(0);

  // Pre-compute node positions on a ring (or multi-ring if >16 agents)
  const nodePositions = useMemo(() => {
    const n = agents.length;
    if (n === 0) return [];
    // Distribute across one or two rings
    const ring2 = n > 14 ? Math.floor(n / 2) : 0;
    const ring1 = n - ring2;
    const pos: { x: number; y: number; ring: number }[] = [];
    for (let i = 0; i < ring1; i++) {
      const angle = (i / ring1) * Math.PI * 2 - Math.PI / 2;
      pos.push({ x: Math.cos(angle), y: Math.sin(angle), ring: 1 });
    }
    for (let i = 0; i < ring2; i++) {
      const angle = (i / ring2) * Math.PI * 2 - Math.PI / 2 + (Math.PI / ring2) * 0.5;
      pos.push({ x: Math.cos(angle), y: Math.sin(angle), ring: 2 });
    }
    return pos;
  }, [agents.length]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap   = wrapRef.current;
    if (!canvas || !wrap) return;
    const ctx = canvas.getContext("2d"); if (!ctx) return;

    let w = 0, h = 0, dpr = 1;
    const fit = () => {
      const r = wrap.getBoundingClientRect();
      dpr = Math.min(window.devicePixelRatio ?? 1, 2);
      w = r.width; h = r.height;
      canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
      canvas.style.width = `${w}px`; canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    fit();
    const ro = new ResizeObserver(fit); ro.observe(wrap);

    const hitAreas: { x: number; y: number; r: number; agent: SwarmAgent }[] = [];

    const draw = (t: number) => {
      ctx.clearRect(0, 0, w, h);

      // Background
      const bg = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, Math.max(w, h) * 0.7);
      bg.addColorStop(0, "#1a0f2e");
      bg.addColorStop(1, "#0b0615");
      ctx.fillStyle = bg; ctx.fillRect(0, 0, w, h);

      const cx = w / 2, cy = h / 2;
      const short = Math.min(w, h);
      const r1 = short * 0.30;
      const r2 = short * 0.43;
      const nodeR = Math.max(18, Math.min(28, short * 0.038));

      hitAreas.length = 0;

      // Draw ring guide circles
      ctx.setLineDash([3, 8]);
      ctx.lineWidth = 0.5;
      ctx.strokeStyle = "rgba(212,165,116,0.08)";
      ctx.beginPath(); ctx.arc(cx, cy, r1, 0, Math.PI * 2); ctx.stroke();
      if (nodePositions.some((p) => p.ring === 2)) {
        ctx.beginPath(); ctx.arc(cx, cy, r2, 0, Math.PI * 2); ctx.stroke();
      }
      ctx.setLineDash([]);

      // Draw connection lines (center → each node)
      nodePositions.forEach((pos, i) => {
        const agent = agents[i];
        if (!agent) return;
        const radius = pos.ring === 1 ? r1 : r2;
        const nx = cx + pos.x * radius, ny = cy + pos.y * radius;
        const sColor = STATUS_COLOR[agent.status] ?? STATUS_COLOR.idle;

        // Animated pulse along the line when running
        const pulse = agent.status === "running"
          ? Math.abs(Math.sin(t * 0.0018 + i * 0.7))
          : 1;

        const grad = ctx.createLinearGradient(cx, cy, nx, ny);
        if (agent.status === "running") {
          const [r, g, b] = hexToRgb("#d4a574");
          grad.addColorStop(0, `rgba(${r},${g},${b},${0.05 + 0.15 * pulse})`);
          grad.addColorStop(0.5, `rgba(${r},${g},${b},${0.25 * pulse})`);
          grad.addColorStop(1, `rgba(${r},${g},${b},0.05)`);
        } else if (agent.status === "done") {
          grad.addColorStop(0, "rgba(90,184,150,0.08)");
          grad.addColorStop(1, "rgba(90,184,150,0.03)");
        } else {
          grad.addColorStop(0, "rgba(255,255,255,0.04)");
          grad.addColorStop(1, "rgba(255,255,255,0.01)");
        }
        ctx.beginPath();
        ctx.moveTo(cx, cy); ctx.lineTo(nx, ny);
        ctx.strokeStyle = grad;
        ctx.lineWidth = agent.status === "running" ? 1.5 * pulse + 0.5 : 0.8;
        ctx.stroke();

        // Travelling dot for running agents
        if (agent.status === "running") {
          const frac = ((t * 0.0012 + i * 0.35) % 1 + 1) % 1;
          const dx = cx + (nx - cx) * frac, dy = cy + (ny - cy) * frac;
          ctx.beginPath(); ctx.arc(dx, dy, 2.5, 0, Math.PI * 2);
          ctx.fillStyle = "#d4a574"; ctx.fill();
        }
      });

      // Draw agent nodes
      nodePositions.forEach((pos, i) => {
        const agent = agents[i];
        if (!agent) return;
        const radius = pos.ring === 1 ? r1 : r2;
        const nx = cx + pos.x * radius, ny = cy + pos.y * radius;
        const sColor = STATUS_COLOR[agent.status] ?? STATUS_COLOR.idle;
        const mColor = MODEL_COLOR[agent.model] ?? "#e2e8f0";

        hitAreas.push({ x: nx, y: ny, r: nodeR + 6, agent });

        // Glow for running/done
        if (agent.status !== "idle") {
          const glow = ctx.createRadialGradient(nx, ny, 0, nx, ny, nodeR * 2.5);
          const [r, g, b] = hexToRgb(agent.status === "done" ? "#5ab896" : agent.status === "running" ? "#d4a574" : "#c4607e");
          const alpha = agent.status === "running" ? 0.15 + 0.1 * Math.abs(Math.sin(t * 0.002 + i)) : 0.08;
          glow.addColorStop(0, `rgba(${r},${g},${b},${alpha})`);
          glow.addColorStop(1, `rgba(${r},${g},${b},0)`);
          ctx.beginPath(); ctx.arc(nx, ny, nodeR * 2.5, 0, Math.PI * 2);
          ctx.fillStyle = glow; ctx.fill();
        }

        // Node circle
        const nodeBg = ctx.createRadialGradient(nx - nodeR * 0.25, ny - nodeR * 0.25, 0, nx, ny, nodeR);
        nodeBg.addColorStop(0, "rgba(46,36,54,0.95)");
        nodeBg.addColorStop(1, "rgba(21,16,26,0.98)");
        ctx.beginPath(); ctx.arc(nx, ny, nodeR, 0, Math.PI * 2);
        ctx.fillStyle = nodeBg; ctx.fill();
        ctx.lineWidth = 1.5;
        ctx.strokeStyle = agent.status === "idle" ? "rgba(212,165,116,0.15)" : sColor;
        ctx.stroke();

        // Model colour ring
        ctx.beginPath(); ctx.arc(nx, ny, nodeR * 0.55, 0, Math.PI * 2);
        ctx.strokeStyle = mColor + "55"; ctx.lineWidth = 1; ctx.stroke();
        ctx.beginPath(); ctx.arc(nx, ny, nodeR * 0.28, 0, Math.PI * 2);
        ctx.fillStyle = mColor + "20"; ctx.fill();

        // Spinning arc for running
        if (agent.status === "running") {
          const spin = (t * 0.003 + i * 1.2) % (Math.PI * 2);
          ctx.beginPath();
          ctx.arc(nx, ny, nodeR + 4, spin, spin + Math.PI * 0.7);
          ctx.strokeStyle = "#d4a574";
          ctx.lineWidth = 1.5;
          ctx.stroke();
        }

        // Label below node
        const fontSize = Math.max(9, Math.min(12, short * 0.018));
        ctx.font = `${fontSize}px var(--font-manrope, system-ui)`;
        ctx.textAlign = "center"; ctx.textBaseline = "top";
        ctx.fillStyle = "rgba(221,208,187,0.85)";
        ctx.fillText(agent.role, nx, ny + nodeR + 5);
        ctx.font = `${fontSize - 1}px var(--font-mono, monospace)`;
        ctx.fillStyle = mColor + "aa";
        ctx.fillText(agent.model, nx, ny + nodeR + 5 + fontSize + 2);
      });

      // Center orchestrator node
      const centerR = Math.max(32, Math.min(52, short * 0.068));
      const pulse = 0.85 + 0.15 * Math.abs(Math.sin(t * 0.0015));

      // Aura
      const aura = ctx.createRadialGradient(cx, cy, centerR * 0.5, cx, cy, centerR * 2.8 * pulse);
      aura.addColorStop(0, "rgba(212,165,116,0.22)");
      aura.addColorStop(1, "rgba(212,165,116,0)");
      ctx.beginPath(); ctx.arc(cx, cy, centerR * 2.8 * pulse, 0, Math.PI * 2);
      ctx.fillStyle = aura; ctx.fill();

      // Outer ring
      ctx.beginPath(); ctx.arc(cx, cy, centerR + 8, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(212,165,116,0.18)"; ctx.lineWidth = 1; ctx.stroke();

      // Center fill
      const centerGrad = ctx.createRadialGradient(cx - centerR * 0.2, cy - centerR * 0.2, 0, cx, cy, centerR);
      centerGrad.addColorStop(0, "rgba(50,38,26,0.98)");
      centerGrad.addColorStop(1, "rgba(28,22,34,0.98)");
      ctx.beginPath(); ctx.arc(cx, cy, centerR, 0, Math.PI * 2);
      ctx.fillStyle = centerGrad; ctx.fill();
      ctx.strokeStyle = "#d4a574"; ctx.lineWidth = 2; ctx.stroke();

      // Center label
      const cFontBig = Math.max(12, Math.min(18, short * 0.028));
      const cFontSm  = Math.max(9,  Math.min(12, short * 0.017));
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.font = `600 ${cFontBig}px var(--font-bricolage, system-ui)`;
      ctx.fillStyle = "#d4a574";
      ctx.fillText(name, cx, cy - cFontSm * 0.4);
      ctx.font = `${cFontSm}px var(--font-mono, monospace)`;
      ctx.fillStyle = "rgba(212,165,116,0.55)";
      ctx.fillText(topology, cx, cy + cFontBig * 0.7);
    };

    const loop = (ts: number) => {
      timeRef.current = ts;
      draw(ts);
      animRef.current = requestAnimationFrame(loop);
    };
    animRef.current = requestAnimationFrame(loop);

    // Click handling
    const onClick = (e: MouseEvent) => {
      if (!onSelectAgent) return;
      const rect = canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left, my = e.clientY - rect.top;
      for (const hit of hitAreas) {
        if ((mx - hit.x) ** 2 + (my - hit.y) ** 2 <= hit.r ** 2) {
          onSelectAgent(hit.agent);
          break;
        }
      }
    };
    const onMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left, my = e.clientY - rect.top;
      canvas.style.cursor = hitAreas.some((h) => (mx - h.x) ** 2 + (my - h.y) ** 2 <= h.r ** 2) ? "pointer" : "default";
    };
    canvas.addEventListener("click", onClick);
    canvas.addEventListener("mousemove", onMove);

    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
      ro.disconnect();
      canvas.removeEventListener("click", onClick);
      canvas.removeEventListener("mousemove", onMove);
    };
  }, [agents, nodePositions, name, topology, onSelectAgent]);

  return (
    <div ref={wrapRef} className="absolute inset-0">
      <canvas ref={canvasRef} className="block w-full h-full" />
    </div>
  );
}
