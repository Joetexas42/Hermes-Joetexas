import { NextResponse } from "next/server";
import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { studioDirs, minimaxToken, slugify, MINIMAX_BASE, PREVIEW_BUCKET } from "@/lib/hermesStudio";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const { kind, prompt, voiceId } = (await req.json()) as {
    kind?: string; prompt?: string; voiceId?: string;
  };

  if (!prompt?.trim()) return NextResponse.json({ error: "missing prompt" }, { status: 400 });
  if (prompt.length > 2000) return NextResponse.json({ error: "prompt too long" }, { status: 413 });
  if (!["image", "voice", "video"].includes(kind ?? "")) {
    return NextResponse.json({ error: "kind must be image, voice, or video" }, { status: 400 });
  }

  const tok = minimaxToken();
  if (!tok) {
    return NextResponse.json({
      error: "MiniMax not connected. Run `hermes auth add minimax-oauth` in a terminal, then restart the dev server.",
    }, { status: 400 });
  }

  const H = { Authorization: `Bearer ${tok}`, "Content-Type": "application/json" };
  const dirs = studioDirs();
  const ts = Date.now();
  const slug = slugify(prompt);

  try {
    if (kind === "image") {
      const r = await fetch(`${MINIMAX_BASE}/image_generation`, {
        method: "POST", headers: H,
        body: JSON.stringify({ model: "image-01", prompt, aspect_ratio: "16:9", response_format: "url", n: 1 }),
      });
      const j = await r.json() as { data?: { image_urls?: string[] }; base_resp?: unknown };
      const src = j?.data?.image_urls?.[0];
      if (!src) return NextResponse.json({ error: "no image returned", detail: j?.base_resp ?? j }, { status: 502 });

      const buf = Buffer.from(await (await fetch(src)).arrayBuffer());
      await mkdir(dirs.image, { recursive: true });
      const name = `${ts}-${slug}.png`;
      await writeFile(path.join(dirs.image, name), buf);
      return NextResponse.json({ ok: true, kind, name, prompt, url: `/api/hermes/preview/${PREVIEW_BUCKET.image}/${encodeURIComponent(name)}` });
    }

    if (kind === "voice") {
      const vid = typeof voiceId === "string" && /^[a-z0-9_-]+$/i.test(voiceId) ? voiceId : "male-qn-qingse";
      const r = await fetch(`${MINIMAX_BASE}/t2a_v2`, {
        method: "POST", headers: H,
        body: JSON.stringify({
          model: "speech-02-hd", text: prompt, stream: false,
          voice_setting: { voice_id: vid, speed: 1, vol: 1, pitch: 0 },
          audio_setting: { format: "mp3", sample_rate: 32000, bitrate: 128000 },
        }),
      });
      const j = await r.json() as { data?: { audio?: string }; base_resp?: unknown };
      const hex = j?.data?.audio;
      if (!hex) return NextResponse.json({ error: "no audio returned", detail: j?.base_resp ?? j }, { status: 502 });

      await mkdir(dirs.voice, { recursive: true });
      const name = `${ts}-${slug}.mp3`;
      await writeFile(path.join(dirs.voice, name), Buffer.from(hex, "hex"));
      return NextResponse.json({ ok: true, kind, name, prompt, url: `/api/hermes/preview/${PREVIEW_BUCKET.voice}/${encodeURIComponent(name)}` });
    }

    if (kind === "video") {
      const r = await fetch(`${MINIMAX_BASE}/video_generation`, {
        method: "POST", headers: H,
        body: JSON.stringify({ model: "MiniMax-Hailuo-2.3", prompt, duration: 6, resolution: "768P" }),
      });
      const j = await r.json() as { task_id?: string; base_resp?: unknown };
      const taskId = j?.task_id;
      if (!taskId) return NextResponse.json({ error: "no task_id", detail: j?.base_resp ?? j }, { status: 502 });
      // Video is async — client polls /api/hermes/studio/video-status?taskId=...
      return NextResponse.json({ ok: true, kind, status: "processing", taskId: String(taskId), slug, prompt });
    }
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
