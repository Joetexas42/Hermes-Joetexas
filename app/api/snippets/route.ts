import { NextResponse } from "next/server";
import { listSnippets, createSnippet, snippetStats } from "@/lib/snippetDb";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const q = url.searchParams.get("q") ?? undefined;
  const mode = url.searchParams.get("mode");

  if (mode === "stats") {
    return NextResponse.json(snippetStats());
  }

  return NextResponse.json(listSnippets(q));
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const { title, code, language, tags } = body as {
    title?: string; code?: string; language?: string; tags?: string;
  };

  if (!title?.trim() || !code?.trim()) {
    return NextResponse.json({ error: "title and code are required" }, { status: 400 });
  }

  const snippet = createSnippet({
    title: title.trim(),
    code: code.trim(),
    language: (language ?? "text").trim(),
    tags: (tags ?? "").trim(),
  });

  return NextResponse.json(snippet, { status: 201 });
}
