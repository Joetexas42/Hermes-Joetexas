import { NextResponse } from "next/server";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { studioDirs } from "@/lib/hermesStudio";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MIME: Record<string, string> = {
  ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp",
  ".mp3": "audio/mpeg", ".wav": "audio/wav", ".m4a": "audio/mp4", ".ogg": "audio/ogg",
  ".mp4": "video/mp4", ".webm": "video/webm", ".mov": "video/quicktime",
};

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const segments = (await params).path;
  if (!segments || segments.length < 2) return NextResponse.json({ error: "bad path" }, { status: 400 });

  const [bucket, ...rest] = segments;
  const filename = decodeURIComponent(rest.join("/"));
  const dirs = studioDirs();

  const dir =
    bucket === "images" ? dirs.image :
    bucket === "audio"  ? dirs.voice :
    bucket === "videos" ? dirs.video : null;

  if (!dir) return NextResponse.json({ error: "unknown bucket" }, { status: 404 });

  const abs = path.join(dir, filename);
  // Sanitise: must stay inside its bucket dir
  if (!abs.startsWith(dir)) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  try {
    const data = await readFile(abs);
    const ext  = path.extname(filename).toLowerCase();
    const mime = MIME[ext] ?? "application/octet-stream";
    return new Response(data, {
      headers: {
        "Content-Type": mime,
        "Cache-Control": "public, max-age=86400, immutable",
      },
    });
  } catch {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
}
