import { NextResponse } from "next/server";
import { saveTranscript } from "@/lib/seoPipeline";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function POST(req: Request) {
  const { slug, content } = await req.json().catch(() => ({})) as { slug?: string; content?: string };
  if (!slug || !/^[A-Za-z0-9_-]+$/.test(slug)) return NextResponse.json({ error: "invalid slug" }, { status: 400 });
  if (!content?.trim()) return NextResponse.json({ error: "empty content" }, { status: 400 });
  const filePath = await saveTranscript(slug, content);
  return NextResponse.json({ ok: true, slug, path: filePath });
}
