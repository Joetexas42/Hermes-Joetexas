import { NextResponse } from "next/server";
import { listTasks, createTask, statsFor, type KanbanStatus } from "@/lib/kanbanDb";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const tasks = listTasks();
    const stats = statsFor();
    return NextResponse.json({ tasks, stats, ok: true });
  } catch (e) {
    return NextResponse.json({ error: String(e), ok: false }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json() as { title?: string; body?: string; assignee?: string; status?: KanbanStatus; priority?: number };
    if (!body.title?.trim()) return NextResponse.json({ error: "title required" }, { status: 400 });
    const task = createTask({
      title:    body.title.trim(),
      body:     body.body,
      assignee: body.assignee,
      status:   body.status ?? "triage",
      priority: body.priority ?? 0,
    });
    return NextResponse.json(task);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
