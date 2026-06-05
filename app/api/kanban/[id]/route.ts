import { NextResponse } from "next/server";
import { updateTask, deleteTask, type KanbanStatus } from "@/lib/kanbanDb";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json() as Partial<{ title: string; body: string; assignee: string; status: KanbanStatus; priority: number; started_at: number; completed_at: number }>;
  const task = updateTask(id, body);
  if (!task) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json(task);
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ok = deleteTask(id);
  return NextResponse.json({ ok });
}
