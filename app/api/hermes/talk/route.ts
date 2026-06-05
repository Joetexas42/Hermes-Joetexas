import { NextResponse } from "next/server";
import { minimaxToken } from "@/lib/hermesStudio";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// One short spoken sentence — punchy and natural like a quick voice note.
const SYSTEM =
  "You are Hermes, a warm and witty voice assistant powered by MiniMax M3. " +
  "Reply in ONE short spoken sentence (max ~20 words) — natural, like a quick voice note. " +
  "Only go longer if explicitly asked. Never use markdown, lists, headings, or emoji.";

export async function POST(req: Request) {
  const { text, voiceId, history } = (await req.json()) as {
    text?: string;
    voiceId?: string;
    history?: { role: string; text: string }[];
  };

  if (!text?.trim()) return NextResponse.json({ error: "missing text" }, { status: 400 });

  const tok = minimaxToken();
  if (!tok) {
    return NextResponse.json({
      error: "MiniMax not connected. Run `hermes auth add minimax-oauth` in a terminal, then restart the dev server.",
    }, { status: 400 });
  }

  const H = { Authorization: `Bearer ${tok}`, "Content-Type": "application/json" };

  // Rolling context — last 6 turns for continuity
  const prior = Array.isArray(history) ? history.slice(-6) : [];
  const messages = [
    ...prior
      .filter((m) => (m.role === "user" || m.role === "assistant") && m.text)
      .map((m) => ({ role: m.role, content: String(m.text).slice(0, 1500) })),
    { role: "user", content: text.slice(0, 1500) },
  ];

  try {
    // 1) M3 reply — thinking disabled for low latency on short conversational turns
    const r = await fetch("https://api.minimax.io/anthropic/v1/messages", {
      method: "POST", headers: H,
      body: JSON.stringify({
        model: "MiniMax-M3",
        system: SYSTEM,
        max_tokens: 70,
        thinking: { type: "disabled" },
        messages,
      }),
    });
    const j = await r.json() as { content?: { type?: string; text?: string }[]; base_resp?: unknown };
    const blocks = Array.isArray(j?.content) ? j.content : [];
    const reply = blocks.filter((b) => b?.type === "text").map((b) => b.text ?? "").join(" ").trim();
    if (!reply) return NextResponse.json({ error: "no reply from MiniMax", detail: j?.base_resp ?? j }, { status: 502 });

    // 2) TTS — speech-02-turbo for lowest latency
    const vid = typeof voiceId === "string" && /^[a-z0-9_-]+$/i.test(voiceId) ? voiceId : "male-qn-qingse";
    let audio: string | null = null;
    try {
      const tr = await fetch("https://api.minimax.io/v1/t2a_v2", {
        method: "POST", headers: H,
        body: JSON.stringify({
          model: "speech-02-turbo",
          text: reply,
          stream: false,
          voice_setting: { voice_id: vid, speed: 1.05, vol: 1, pitch: 0 },
          audio_setting: { format: "mp3", sample_rate: 32000, bitrate: 128000 },
        }),
      });
      const tj = await tr.json() as { data?: { audio?: string } };
      const hex = tj?.data?.audio;
      if (hex) audio = `data:audio/mp3;base64,${Buffer.from(hex, "hex").toString("base64")}`;
    } catch { /* reply still returns without audio */ }

    return NextResponse.json({ reply, audio });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
