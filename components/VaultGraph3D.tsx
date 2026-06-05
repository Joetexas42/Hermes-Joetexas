"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Loader2, Sparkles } from "lucide-react";

// Self-contained 3D knowledge graph: hand-rolled force simulation in 3D space,
// rendered to a 2D canvas via perspective projection. No external graph libs.
// Drag to rotate the camera, scroll to zoom, click a node to open it.

interface RawNode { id: string; title: string; group: string; degree: number; mtime: number; }
interface GNode   extends RawNode { x: number; y: number; z: number; vx: number; vy: number; vz: number; }
interface RawLink { source: string; target: string; }
interface GLink   { source: GNode; target: GNode; }

// Colour per top-level vault folder
const GROUP_COLORS: Record<string, string> = {
  "00 Inbox":      "#f472b6",
  "01 Daily":      "#fbbf24",
  "02 Projects":   "#60a5fa",
  "03 Areas":      "#34d399",
  "04 Resources":  "#a78bfa",
  "05 Memories":   "#fb7185",
  "06 Archive":    "#94a3b8",
  "Agentic OS":    "#5ab896",
  "Omi":           "#f97316",
  "Wiki":          "#d8b4fe",
  "root":          "#e2e8f0",
};
function colorFor(group: string): string {
  if (GROUP_COLORS[group]) return GROUP_COLORS[group];
  let h = 0;
  for (let i = 0; i < group.length; i++) h = (h * 31 + group.charCodeAt(i)) >>> 0;
  return `hsl(${h % 360}, 65%, 58%)`;
}

export default function VaultGraph3D({ onOpenNote }: { onOpenNote: (relPath: string) => void }) {
  const [raw, setRaw]   = useState<{ nodes: RawNode[]; links: RawLink[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hover, setHover] = useState<GNode | null>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef   = useRef<HTMLDivElement>(null);
  const animRef   = useRef<number | null>(null);

  // Camera: yaw around Y, pitch around X, smooth zoom.
  const camRef  = useRef({ yaw: 0.4, pitch: -0.2, distance: 900, targetDistance: 900, autoRotate: false });
  const dragRef = useRef<{
    kind: "rotate" | "node" | null;
    node?: GNode;
    sx: number; sy: number;
    origYaw: number; origPitch: number;
    movedPx: number;
  }>({ kind: null, sx: 0, sy: 0, origYaw: 0, origPitch: 0, movedPx: 0 });

  // Read hover & callback through refs so the canvas effect only runs once.
  const hoverRef       = useRef<GNode | null>(null);
  const onOpenNoteRef  = useRef(onOpenNote);
  useEffect(() => { onOpenNoteRef.current = onOpenNote; }, [onOpenNote]);

  // Fetch graph data
  useEffect(() => {
    let cancelled = false;
    fetch("/api/memory/graph")
      .then((r) => r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`)))
      .then((j) => { if (!cancelled) setRaw(j); })
      .catch((e: Error) => { if (!cancelled) setError(e.message); });
    return () => { cancelled = true; };
  }, []);

  // Build + pre-settle the simulation (runs synchronously in useMemo so the
  // graph appears static from frame 1 — no "big bang" animation).
  const sim = useMemo(() => {
    if (!raw) return null;
    const rand = mulberry32(1_234_567); // seeded → deterministic layout

    const nodes: GNode[] = raw.nodes.map((n) => {
      let x = 0, y = 0, z = 0, s = 2;
      while (s >= 1 || s === 0) {
        x = rand() * 2 - 1; y = rand() * 2 - 1; z = rand() * 2 - 1;
        s = x * x + y * y + z * z;
      }
      const r = 350 * Math.cbrt(rand());
      const sc = r / Math.sqrt(s);
      return { ...n, x: x * sc, y: y * sc, z: z * sc, vx: 0, vy: 0, vz: 0 };
    });

    const byId  = new Map(nodes.map((n) => [n.id, n]));
    const links: GLink[] = raw.links
      .map((l) => ({ source: byId.get(l.source)!, target: byId.get(l.target)! }))
      .filter((l) => l.source && l.target);

    const K_REPEL = 1200, REPEL_RANGE = 250, K_LINK = 0.015, L_LINK = 60;
    const DAMP = 0.85, BOUND_R = 400, K_BOUND = 0.015;
    let alpha = 1;

    for (let t = 0; t < 500; t++) {
      // Repulsion O(n²) — fine for <500 nodes
      for (let i = 0; i < nodes.length; i++) {
        const a = nodes[i];
        for (let j = i + 1; j < nodes.length; j++) {
          const b = nodes[j];
          const dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z;
          const d2 = dx * dx + dy * dy + dz * dz;
          if (d2 > REPEL_RANGE * REPEL_RANGE || d2 < 0.01) continue;
          const d = Math.sqrt(d2), f = (K_REPEL / d2) * alpha;
          const fx = (dx / d) * f, fy = (dy / d) * f, fz = (dz / d) * f;
          a.vx -= fx; a.vy -= fy; a.vz -= fz;
          b.vx += fx; b.vy += fy; b.vz += fz;
        }
      }
      // Link springs
      for (const l of links) {
        const dx = l.target.x - l.source.x, dy = l.target.y - l.source.y, dz = l.target.z - l.source.z;
        const d = Math.sqrt(dx * dx + dy * dy + dz * dz) || 0.01;
        const f = K_LINK * (d - L_LINK) * alpha;
        const fx = (dx / d) * f, fy = (dy / d) * f, fz = (dz / d) * f;
        l.source.vx += fx; l.source.vy += fy; l.source.vz += fz;
        l.target.vx -= fx; l.target.vy -= fy; l.target.vz -= fz;
      }
      // Soft spherical boundary
      for (const n of nodes) {
        const r = Math.sqrt(n.x * n.x + n.y * n.y + n.z * n.z);
        if (r > BOUND_R) {
          const f = K_BOUND * (r - BOUND_R);
          n.vx -= (n.x / r) * f; n.vy -= (n.y / r) * f; n.vz -= (n.z / r) * f;
        }
      }
      for (const n of nodes) {
        n.vx *= DAMP; n.vy *= DAMP; n.vz *= DAMP;
        n.x  += n.vx; n.y  += n.vy; n.z  += n.vz;
      }
      if (t > 50) alpha *= 0.99;
    }
    for (const n of nodes) { n.vx = 0; n.vy = 0; n.vz = 0; }

    return { nodes, links };
  }, [raw]);

  // Canvas render + RAF loop
  useEffect(() => {
    if (!sim || !canvasRef.current || !wrapRef.current) return;
    const canvas = canvasRef.current;
    const wrap   = wrapRef.current;
    const ctx    = canvas.getContext("2d", { alpha: true });
    if (!ctx) return;

    let w = 0, h = 0, dpr = 1;
    const fit = () => {
      const rect = wrap.getBoundingClientRect();
      dpr = Math.min(window.devicePixelRatio ?? 1, 2);
      w = Math.max(200, rect.width); h = Math.max(200, rect.height);
      canvas.width  = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
      canvas.style.width = `${w}px`; canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    fit();
    const ro = new ResizeObserver(fit); ro.observe(wrap);

    const K_REPEL = 1200, REPEL_RANGE = 250, K_LINK = 0.015, L_LINK = 60;
    const DAMP = 0.85, BOUND_R = 400, K_BOUND = 0.015;
    let alpha = 0, tickCount = 1000, frozen = true;

    const tickSim = () => {
      const { nodes, links } = sim;
      for (let i = 0; i < nodes.length; i++) {
        const a = nodes[i];
        for (let j = i + 1; j < nodes.length; j++) {
          const b = nodes[j];
          const dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z;
          const d2 = dx * dx + dy * dy + dz * dz;
          if (d2 > REPEL_RANGE * REPEL_RANGE || d2 < 0.01) continue;
          const d = Math.sqrt(d2), f = (K_REPEL / d2) * alpha;
          const fx = (dx / d) * f, fy = (dy / d) * f, fz = (dz / d) * f;
          a.vx -= fx; a.vy -= fy; a.vz -= fz;
          b.vx += fx; b.vy += fy; b.vz += fz;
        }
      }
      for (const l of links) {
        const dx = l.target.x - l.source.x, dy = l.target.y - l.source.y, dz = l.target.z - l.source.z;
        const d = Math.sqrt(dx * dx + dy * dy + dz * dz) || 0.01;
        const f = K_LINK * (d - L_LINK) * alpha;
        const fx = (dx / d) * f, fy = (dy / d) * f, fz = (dz / d) * f;
        l.source.vx += fx; l.source.vy += fy; l.source.vz += fz;
        l.target.vx -= fx; l.target.vy -= fy; l.target.vz -= fz;
      }
      const held = dragRef.current.kind === "node" ? dragRef.current.node : null;
      for (const n of nodes) {
        if (n === held) { n.vx = 0; n.vy = 0; n.vz = 0; continue; }
        const r = Math.sqrt(n.x * n.x + n.y * n.y + n.z * n.z);
        if (r > BOUND_R) {
          const f = K_BOUND * (r - BOUND_R);
          n.vx -= (n.x / r) * f; n.vy -= (n.y / r) * f; n.vz -= (n.z / r) * f;
        }
        n.vx *= DAMP; n.vy *= DAMP; n.vz *= DAMP;
        n.x  += n.vx; n.y  += n.vy; n.z  += n.vz;
      }
      tickCount++;
      if (tickCount > 50) alpha *= 0.99;
      if (tickCount > 500 || alpha < 0.05) {
        frozen = true;
        for (const n of sim.nodes) { n.vx = 0; n.vy = 0; n.vz = 0; }
      }
    };

    const project = (x: number, y: number, z: number) => {
      const { yaw, pitch, distance } = camRef.current;
      const cy = Math.cos(yaw), sy = Math.sin(yaw);
      const cp = Math.cos(pitch), sp = Math.sin(pitch);
      const x1 = x * cy + z * sy, z1 = -x * sy + z * cy;
      const y1 = y * cp - z1 * sp, z2 = y * sp + z1 * cp;
      const vz = distance - z2;
      if (vz < 1) return null;
      const fov = 600;
      return {
        sx: w / 2 + (x1 * fov) / vz,
        sy: h / 2 - (y1 * fov) / vz,
        depthScale: fov / vz,
        vz,
      };
    };

    const render = () => {
      ctx.save();
      // Background
      const bg = ctx.createRadialGradient(w / 2, h * 0.4, 0, w / 2, h * 0.4, Math.max(w, h));
      bg.addColorStop(0, "#1a0f3d");
      bg.addColorStop(0.5, "#0a0518");
      bg.addColorStop(1, "#000000");
      ctx.fillStyle = bg; ctx.fillRect(0, 0, w, h);

      type P = { n: GNode; sx: number; sy: number; ds: number; vz: number };
      const proj: (P | null)[] = sim.nodes.map((n) => {
        const p = project(n.x, n.y, n.z);
        return p ? { n, sx: p.sx, sy: p.sy, ds: p.depthScale, vz: p.vz } : null;
      });

      // Links
      ctx.globalCompositeOperation = "source-over";
      ctx.strokeStyle = "rgba(150,160,200,0.18)";
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      for (const l of sim.links) {
        const a = project(l.source.x, l.source.y, l.source.z);
        const b = project(l.target.x, l.target.y, l.target.z);
        if (!a || !b) continue;
        ctx.moveTo(a.sx, a.sy); ctx.lineTo(b.sx, b.sy);
      }
      ctx.stroke();

      // Depth-sort
      const sorted = proj
        .map((p, i) => ({ p, i }))
        .filter((o): o is { p: P; i: number } => o.p !== null)
        .sort((a, b) => b.p.vz - a.p.vz);

      // Nodes
      const MAX_R = 10;
      for (const { p } of sorted) {
        const r = Math.min((3 + Math.sqrt(p.n.degree) * 1.6) * p.ds, MAX_R);
        if (r < 0.4) continue;
        ctx.fillStyle = colorFor(p.n.group);
        ctx.beginPath(); ctx.arc(p.sx, p.sy, r, 0, Math.PI * 2); ctx.fill();
      }

      // Labels (hubs only)
      ctx.textAlign = "center"; ctx.textBaseline = "top";
      for (const { p } of sorted) {
        if (p.n.degree < 4) continue;
        const fs = Math.min(13, Math.max(9, 11 * p.ds));
        if (fs < 8) continue;
        const r = Math.min((3 + Math.sqrt(p.n.degree) * 1.6) * p.ds, MAX_R);
        ctx.font = `${fs}px var(--font-manrope, system-ui)`;
        ctx.lineWidth = 1; ctx.strokeStyle = "rgba(0,0,0,0.9)";
        ctx.fillStyle = "rgba(230,220,200,0.95)";
        ctx.strokeText(p.n.title, p.sx, p.sy + r + 3);
        ctx.fillText(p.n.title,   p.sx, p.sy + r + 3);
      }

      // Hover ring
      const hov = hoverRef.current;
      if (hov) {
        const p = project(hov.x, hov.y, hov.z);
        if (p) {
          const r = (4 + Math.sqrt(hov.degree) * 2) * p.depthScale;
          ctx.strokeStyle = "#ffffff"; ctx.lineWidth = 1.5;
          ctx.beginPath(); ctx.arc(p.sx, p.sy, r + 4, 0, Math.PI * 2); ctx.stroke();
        }
      }
      ctx.restore();
    };

    const loop = () => {
      if (!frozen) tickSim();
      const cam = camRef.current;
      cam.distance += (cam.targetDistance - cam.distance) * 0.18;
      if (cam.autoRotate && dragRef.current.kind === null) cam.yaw += 0.0005;
      render();
      animRef.current = requestAnimationFrame(loop);
    };
    animRef.current = requestAnimationFrame(loop);

    const thaw = () => { frozen = false; alpha = Math.max(alpha, 0.4); tickCount = 50; };

    const pick = (sx: number, sy: number): GNode | null => {
      let best: GNode | null = null, bestD2 = Infinity;
      for (const n of sim.nodes) {
        const p = project(n.x, n.y, n.z); if (!p) continue;
        const r = (4 + Math.sqrt(n.degree) * 2) * p.depthScale;
        const dx = p.sx - sx, dy = p.sy - sy;
        const d2 = dx * dx + dy * dy;
        if (d2 <= (r + 5) ** 2 && d2 < bestD2) { bestD2 = d2; best = n; }
      }
      return best;
    };

    const onPointerDown = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      const sx = e.clientX - rect.left, sy = e.clientY - rect.top;
      const node = pick(sx, sy);
      if (node) {
        dragRef.current = { kind: "node", node, sx, sy, origYaw: 0, origPitch: 0, movedPx: 0 };
        thaw();
      } else {
        camRef.current.autoRotate = false;
        dragRef.current = { kind: "rotate", sx, sy, origYaw: camRef.current.yaw, origPitch: camRef.current.pitch, movedPx: 0 };
      }
      canvas.setPointerCapture(e.pointerId);
    };

    const onPointerMove = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      const sx = e.clientX - rect.left, sy = e.clientY - rect.top;
      const d = dragRef.current;
      if (d.kind === "rotate") {
        const dx = sx - d.sx, dy = sy - d.sy;
        d.movedPx = Math.max(d.movedPx, Math.abs(dx) + Math.abs(dy));
        camRef.current.yaw   = d.origYaw   + dx * 0.005;
        camRef.current.pitch = Math.max(-Math.PI / 2 + 0.1, Math.min(Math.PI / 2 - 0.1, d.origPitch + dy * 0.005));
      } else if (d.kind === "node" && d.node) {
        d.movedPx = Math.max(d.movedPx, Math.abs(sx - d.sx) + Math.abs(sy - d.sy));
        const p = project(d.node.x, d.node.y, d.node.z);
        if (p) {
          const dxW = (sx - p.sx) / p.depthScale, dyW = -(sy - p.sy) / p.depthScale;
          const cam = camRef.current;
          const cy = Math.cos(cam.yaw), syCam = Math.sin(cam.yaw);
          const cp = Math.cos(cam.pitch), sp = Math.sin(cam.pitch);
          d.node.x += dxW * cy    + dyW * (syCam * sp);
          d.node.y += dyW * cp;
          d.node.z += dxW * -syCam + dyW * (cy * sp);
          thaw();
        }
      } else {
        const n = pick(sx, sy);
        if (hoverRef.current !== n) { hoverRef.current = n; setHover(n); }
        canvas.style.cursor = n ? "pointer" : "grab";
      }
    };

    const onPointerUp = (e: PointerEvent) => {
      const d = dragRef.current;
      const wasClick = d.movedPx < 4;
      const node = d.kind === "node" ? d.node : null;
      dragRef.current = { kind: null, sx: 0, sy: 0, origYaw: 0, origPitch: 0, movedPx: 0 };
      try { canvas.releasePointerCapture(e.pointerId); } catch {}
      if (node && wasClick) onOpenNoteRef.current(node.id);
    };

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      camRef.current.targetDistance = Math.max(
        150, Math.min(2500, camRef.current.targetDistance * Math.pow(1.0015, e.deltaY)),
      );
    };

    const onDblClick = () => { camRef.current.autoRotate = !camRef.current.autoRotate; };

    canvas.addEventListener("pointerdown",  onPointerDown);
    canvas.addEventListener("pointermove",  onPointerMove);
    canvas.addEventListener("pointerup",    onPointerUp);
    canvas.addEventListener("wheel",        onWheel,    { passive: false });
    canvas.addEventListener("dblclick",     onDblClick);
    canvas.style.cursor = "grab";

    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
      ro.disconnect();
      canvas.removeEventListener("pointerdown",  onPointerDown);
      canvas.removeEventListener("pointermove",  onPointerMove);
      canvas.removeEventListener("pointerup",    onPointerUp);
      canvas.removeEventListener("wheel",        onWheel);
      canvas.removeEventListener("dblclick",     onDblClick);
    };
  }, [sim]); // CRITICAL: only `sim` — hover & callback read via refs

  // Stats overlay
  const stats = useMemo(() => {
    if (!raw) return null;
    const groups = new Map<string, number>();
    for (const n of raw.nodes) groups.set(n.group, (groups.get(n.group) ?? 0) + 1);
    return { nodes: raw.nodes.length, links: raw.links.length, groups: [...groups.entries()].sort((a, b) => b[1] - a[1]) };
  }, [raw]);

  if (error) {
    return (
      <div className="absolute inset-0 grid place-items-center text-center p-6">
        <div className="text-sm" style={{ color: "var(--cream-dim)" }}>Graph failed to load: <code>{error}</code></div>
      </div>
    );
  }
  if (!raw) {
    return (
      <div className="absolute inset-0 grid place-items-center">
        <div className="text-center">
          <Loader2 size={20} className="mx-auto mb-2 animate-spin" style={{ color: "var(--cream-dim)" }} />
          <div className="text-[12px]" style={{ color: "var(--cream-dim)" }}>Building knowledge graph…</div>
        </div>
      </div>
    );
  }

  return (
    <div className="absolute inset-0" ref={wrapRef}>
      <canvas ref={canvasRef} className="absolute inset-0 block" />

      {/* Top-left: counts + instructions */}
      <div className="absolute left-3 top-3 pointer-events-none z-10">
        <div className="text-[10px] uppercase tracking-widest" style={{ color: "var(--cream-mute)" }}>Knowledge Graph · 3D</div>
        {stats && (
          <div className="text-[11px] mt-0.5" style={{ color: "var(--cream-dim)" }}>
            <span className="metric" style={{ color: "var(--cream)" }}>{stats.nodes}</span> notes ·{" "}
            <span className="metric" style={{ color: "var(--cream)" }}>{stats.links}</span> links
          </div>
        )}
        <div className="text-[10px] mt-2" style={{ color: "var(--cream-mute)" }}>
          drag to rotate · scroll to zoom · click a node · double-click to auto-spin
        </div>
      </div>

      {/* Bottom-left: group legend */}
      {stats && (
        <div className="absolute bottom-3 left-3 pointer-events-none z-10 flex flex-wrap gap-1.5 max-w-[60%]">
          {stats.groups.slice(0, 10).map(([g, c]) => (
            <div key={g} className="flex items-center gap-1.5 px-2 py-1 rounded-md" style={{ background: "rgba(0,0,0,0.5)", border: "1px solid rgba(255,255,255,0.08)" }}>
              <span className="w-2 h-2 rounded-full" style={{ background: colorFor(g), boxShadow: `0 0 6px ${colorFor(g)}` }} />
              <span className="text-[10px]" style={{ color: "var(--cream-dim)" }}>{g}</span>
              <span className="text-[10px] metric" style={{ color: "var(--cream-mute)" }}>{c}</span>
            </div>
          ))}
        </div>
      )}

      {/* Bottom-right: hovered node */}
      {hover && (
        <div className="absolute bottom-3 right-3 pointer-events-none z-10 px-3 py-1.5 rounded-md max-w-[300px]" style={{ background: "rgba(0,0,0,0.7)", border: "1px solid rgba(255,255,255,0.12)" }}>
          <div className="text-[12px] flex items-center gap-1.5 truncate" style={{ color: "var(--cream)" }}>
            <Sparkles size={11} style={{ color: "var(--cream-dim)" }} />
            {hover.title}
          </div>
          <div className="text-[10px] truncate" style={{ color: "var(--cream-mute)" }}>
            {hover.group} · {hover.degree} links
          </div>
        </div>
      )}
    </div>
  );
}

// Seeded PRNG — same vault → same layout every time.
function mulberry32(seed: number): () => number {
  return () => {
    let t = (seed += 0x6D2B79F5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
  };
}
