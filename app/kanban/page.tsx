"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, X, Trash2, GripVertical, Columns3 } from "lucide-react";
import { COLUMNS, STATUS_COLOR, type KanbanTask, type KanbanStatus } from "@/lib/kanban";

/* ── API helpers ─────────────────────────────────────────────────────── */
const api = {
  list: () => fetch("/api/kanban", { cache: "no-store" }).then((r) => r.json()) as Promise<{ tasks: KanbanTask[]; stats: Record<string, number>; ok: boolean }>,
  create: (body: Partial<KanbanTask>) => fetch("/api/kanban", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).then((r) => r.json()) as Promise<KanbanTask>,
  patch: (id: string, patch: Partial<KanbanTask>) => fetch(`/api/kanban/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(patch) }).then((r) => r.json()) as Promise<KanbanTask>,
  del: (id: string) => fetch(`/api/kanban/${id}`, { method: "DELETE" }),
};

function fmtAgo(ts: number | null): string {
  if (!ts) return "—";
  const d = Date.now() - ts * 1000;
  if (d < 60_000) return "just now";
  if (d < 3_600_000) return `${Math.floor(d / 60_000)}m`;
  if (d < 86_400_000) return `${Math.floor(d / 3_600_000)}h`;
  return `${Math.floor(d / 86_400_000)}d`;
}

/* ── Task card ───────────────────────────────────────────────────────── */
function Card({
  task,
  onDragStart,
  onEdit,
  onDelete,
}: {
  task: KanbanTask;
  onDragStart: (t: KanbanTask) => void;
  onEdit: (t: KanbanTask) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.96 }}
      draggable
      onDragStart={() => onDragStart(task)}
      className="group surface-card cursor-grab active:cursor-grabbing select-none"
      style={{ padding: "12px 14px" }}
    >
      <div className="flex items-start gap-2">
        <GripVertical size={14} className="mt-0.5 shrink-0 opacity-20 group-hover:opacity-50 transition-opacity" style={{ color: "var(--cream-dim)" }} />
        <div className="min-w-0 flex-1">
          <button
            onClick={() => onEdit(task)}
            className="w-full text-left text-[13px] font-medium leading-snug hover:opacity-80 transition-opacity"
            style={{ color: "var(--cream)", fontFamily: "var(--font-bricolage)" }}
          >
            {task.title}
          </button>
          {task.body && (
            <p className="mt-1 text-[11px] leading-relaxed line-clamp-2" style={{ color: "var(--cream-dim)" }}>
              {task.body}
            </p>
          )}
          <div className="mt-2 flex items-center gap-2 text-[10px]" style={{ color: "var(--cream-mute)" }}>
            {task.assignee && (
              <span className="flex items-center gap-1 rounded-full border px-1.5 py-0.5" style={{ borderColor: "var(--line-soft)" }}>
                {task.assignee}
              </span>
            )}
            <span>{fmtAgo(task.created_at)}</span>
          </div>
        </div>
        <button
          onClick={() => onDelete(task.id)}
          className="shrink-0 opacity-0 group-hover:opacity-40 hover:!opacity-100 transition-opacity"
          style={{ color: "var(--plum)" }}
        >
          <Trash2 size={13} />
        </button>
      </div>
    </motion.div>
  );
}

/* ── Column ──────────────────────────────────────────────────────────── */
function Column({
  col, tasks, draggingId, onDrop, onDragStart, onEdit, onDelete,
}: {
  col: typeof COLUMNS[0];
  tasks: KanbanTask[];
  draggingId: string | null;
  onDrop: (status: KanbanStatus) => void;
  onDragStart: (t: KanbanTask) => void;
  onEdit: (t: KanbanTask) => void;
  onDelete: (id: string) => void;
}) {
  const [over, setOver] = useState(false);

  return (
    <div
      className="flex min-w-[220px] flex-1 flex-col rounded-2xl border transition-colors"
      style={{
        background: over ? `${col.accent}08` : "var(--bg-card)",
        borderColor: over ? `${col.accent}40` : "var(--line-soft)",
        maxWidth: 280,
      }}
      onDragOver={(e) => { e.preventDefault(); setOver(true); }}
      onDragLeave={() => setOver(false)}
      onDrop={() => { setOver(false); onDrop(col.key); }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2.5 border-b" style={{ borderColor: "var(--line-soft)" }}>
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full" style={{ background: col.accent, boxShadow: `0 0 8px ${col.accent}` }} />
          <span className="text-[12px] font-semibold uppercase tracking-wide" style={{ color: "var(--cream-soft)", fontFamily: "var(--font-manrope)" }}>
            {col.label}
          </span>
        </div>
        <span className="metric text-[11px]" style={{ color: "var(--cream-mute)" }}>{tasks.length}</span>
      </div>

      {/* Cards */}
      <div className="flex flex-col gap-2 overflow-y-auto p-2" style={{ minHeight: 120, maxHeight: "calc(100vh - 280px)" }}>
        <AnimatePresence initial={false}>
          {tasks.map((t) => (
            <Card key={t.id} task={t} onDragStart={onDragStart} onEdit={onEdit} onDelete={onDelete} />
          ))}
        </AnimatePresence>
        {over && draggingId && (
          <div className="rounded-xl border-2 border-dashed h-14" style={{ borderColor: col.accent + "60" }} />
        )}
      </div>
    </div>
  );
}

/* ── Edit / Create modal ─────────────────────────────────────────────── */
function TaskModal({
  task,
  onSave,
  onClose,
}: {
  task: Partial<KanbanTask> | null;
  onSave: (t: Partial<KanbanTask>) => void;
  onClose: () => void;
}) {
  const [title, setTitle]       = useState(task?.title ?? "");
  const [body, setBody]         = useState(task?.body ?? "");
  const [assignee, setAssignee] = useState(task?.assignee ?? "");
  const [status, setStatus]     = useState<KanbanStatus>(task?.status ?? "triage");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.7)" }} onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, scale: 0.97, y: -8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.97 }}
        transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
        onClick={(e) => e.stopPropagation()}
        className="glass w-full max-w-lg rounded-2xl p-6 shadow-[0_32px_80px_-12px_rgba(0,0,0,0.9)]"
        style={{ border: "1px solid var(--line)" }}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-[15px] font-semibold" style={{ fontFamily: "var(--font-bricolage)", color: "var(--cream)" }}>
            {task?.id ? "Edit task" : "New task"}
          </h3>
          <button onClick={onClose} style={{ color: "var(--cream-mute)" }}><X size={16} /></button>
        </div>

        <div className="space-y-3">
          <input
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Task title"
            className="w-full rounded-xl border px-3 py-2.5 text-[14px] outline-none"
            style={{ background: "rgba(0,0,0,0.3)", borderColor: "var(--line)", color: "var(--cream)", caretColor: "var(--gold)" }}
          />
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Description (optional)"
            rows={3}
            className="w-full resize-none rounded-xl border px-3 py-2.5 text-[13px] outline-none"
            style={{ background: "rgba(0,0,0,0.3)", borderColor: "var(--line-soft)", color: "var(--cream-soft)", caretColor: "var(--gold)" }}
          />
          <div className="flex gap-2">
            <input
              value={assignee}
              onChange={(e) => setAssignee(e.target.value)}
              placeholder="Assignee"
              className="flex-1 rounded-xl border px-3 py-2 text-[13px] outline-none"
              style={{ background: "rgba(0,0,0,0.3)", borderColor: "var(--line-soft)", color: "var(--cream-soft)" }}
            />
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as KanbanStatus)}
              className="rounded-xl border px-3 py-2 text-[13px] outline-none"
              style={{ background: "var(--bg-card)", borderColor: "var(--line-soft)", color: STATUS_COLOR[status] }}
            >
              {COLUMNS.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
            </select>
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-5">
          <button onClick={onClose}
            className="rounded-xl border px-4 py-2 text-[13px] transition"
            style={{ borderColor: "var(--line-soft)", color: "var(--cream-dim)" }}>
            Cancel
          </button>
          <button
            onClick={() => { if (title.trim()) onSave({ title: title.trim(), body: body || null, assignee: assignee || null, status }); }}
            disabled={!title.trim()}
            className="rounded-xl px-4 py-2 text-[13px] font-semibold text-white transition disabled:opacity-40"
            style={{ background: "linear-gradient(135deg, var(--gold), var(--rust))" }}
          >
            {task?.id ? "Save" : "Create"}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

/* ── Page ────────────────────────────────────────────────────────────── */
export default function KanbanPage() {
  const [tasks, setTasks]           = useState<KanbanTask[]>([]);
  const [stats, setStats]           = useState<Record<string, number>>({});
  const [modal, setModal]           = useState<Partial<KanbanTask> | null>(null);
  const [showModal, setShowModal]   = useState(false);
  const [dragging, setDragging]     = useState<KanbanTask | null>(null);

  const load = async () => {
    const d = await api.list();
    if (d.ok) { setTasks(d.tasks); setStats(d.stats); }
  };

  useEffect(() => { load(); }, []);

  const openCreate = (status: KanbanStatus = "triage") => {
    setModal({ status });
    setShowModal(true);
  };
  const openEdit = (t: KanbanTask) => {
    setModal(t);
    setShowModal(true);
  };
  const closeModal = () => { setShowModal(false); setModal(null); };

  const handleSave = async (patch: Partial<KanbanTask>) => {
    closeModal();
    if (modal?.id) {
      const updated = await api.patch(modal.id, patch);
      setTasks((ts) => ts.map((t) => t.id === updated.id ? updated : t));
    } else {
      const created = await api.create(patch);
      setTasks((ts) => [created, ...ts]);
    }
    setStats((await api.list()).stats);
  };

  const handleDelete = async (id: string) => {
    setTasks((ts) => ts.filter((t) => t.id !== id));
    await api.del(id);
    setStats((await api.list()).stats);
  };

  const handleDrop = async (status: KanbanStatus) => {
    if (!dragging || dragging.status === status) { setDragging(null); return; }
    const updated = await api.patch(dragging.id, { status });
    setTasks((ts) => ts.map((t) => t.id === updated.id ? updated : t));
    setDragging(null);
  };

  const totalActive = Object.entries(stats).filter(([k]) => k !== "done").reduce((s, [, v]) => s + v, 0);

  return (
    <div className="flex h-[calc(100vh-3.5rem)] flex-col">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 border-b px-6 py-4 shrink-0" style={{ borderColor: "var(--line-soft)" }}>
        <div>
          <div className="eyebrow mb-1">
            <span className="num">K.</span><span className="line" /><span className="label">Kanban board</span>
          </div>
          <div className="flex items-center gap-3">
            <h1 className="text-[22px] font-semibold" style={{ fontFamily: "var(--font-bricolage)", color: "var(--cream)" }}>
              Kanban
            </h1>
            {totalActive > 0 && (
              <span className="pill pill-warn">{totalActive} active</span>
            )}
            {stats.done > 0 && (
              <span className="pill pill-ok">{stats.done} done</span>
            )}
          </div>
        </div>
        <button
          onClick={() => openCreate()}
          className="flex items-center gap-2 rounded-xl px-4 py-2.5 text-[13px] font-semibold text-white transition-transform hover:scale-[1.02]"
          style={{ background: "linear-gradient(140deg, var(--gold), var(--rust))" }}
        >
          <Plus size={15} /> New task
        </button>
      </div>

      {/* Board */}
      <div className="min-h-0 flex-1 overflow-x-auto px-4 py-4">
        <div className="flex gap-3 h-full" style={{ minWidth: "fit-content" }}>
          {COLUMNS.map((col) => (
            <Column
              key={col.key}
              col={col}
              tasks={tasks.filter((t) => t.status === col.key)}
              draggingId={dragging?.id ?? null}
              onDrop={handleDrop}
              onDragStart={setDragging}
              onEdit={openEdit}
              onDelete={handleDelete}
            />
          ))}

          {/* Add column shortcut */}
          <button
            onClick={() => openCreate("triage")}
            className="flex h-14 w-14 shrink-0 self-start items-center justify-center rounded-2xl border border-dashed transition-colors hover:border-[var(--line)] mt-10"
            style={{ borderColor: "var(--line-soft)", color: "var(--cream-mute)" }}
            title="Add task"
          >
            <Plus size={20} />
          </button>
        </div>
      </div>

      {/* Empty state */}
      {tasks.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="text-center">
            <Columns3 size={36} className="mx-auto mb-3 opacity-20" style={{ color: "var(--cream)" }} />
            <p className="text-[14px]" style={{ color: "var(--cream-mute)" }}>No tasks yet — click <strong style={{ color: "var(--gold)" }}>New task</strong> to add one.</p>
          </div>
        </div>
      )}

      {/* Modal */}
      <AnimatePresence>
        {showModal && (
          <TaskModal task={modal} onSave={handleSave} onClose={closeModal} />
        )}
      </AnimatePresence>
    </div>
  );
}
