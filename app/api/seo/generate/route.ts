import { readFile } from "node:fs/promises";
import path from "node:path";
import { SITES, BLOG_POST_SKILL, readTranscript } from "@/lib/seoPipeline";
import { startSession, appendArticle, finishSession, type ArticleWritten } from "@/lib/seoHistory";
import { spawnStream } from "@/lib/runner";
import { resolveClaudeExe } from "@/lib/bridge";
import { CLAUDE_MODEL } from "@/lib/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function articleFromPath(filePath: string, slug: string): ArticleWritten | null {
  for (const site of SITES) {
    if (filePath.startsWith(site.postsDir) || filePath.includes(site.postsDir)) {
      return { siteId: site.id, filePath, liveUrl: `${site.url}/blog/${slug}/` };
    }
  }
  return null;
}

export async function POST(req: Request) {
  const { keyword, slug, transcriptSlug, transcriptText } = await req.json() as {
    keyword?: string; slug?: string; transcriptSlug?: string; transcriptText?: string;
  };

  if (!keyword?.trim()) return new Response("missing keyword", { status: 400 });
  if (!slug?.trim() || !/^[a-z0-9-]{3,80}$/.test(slug))
    return new Response("invalid slug — use lowercase letters, numbers and dashes", { status: 400 });

  const claudeBin = resolveClaudeExe();
  if (!claudeBin) return new Response("Claude CLI not found", { status: 501 });

  // Read skill + transcript
  let skillBody = "";
  try { skillBody = await readFile(BLOG_POST_SKILL, "utf8"); }
  catch { /* skill missing — will warn in prompt */ }

  let transcriptBody = "", transcriptSource = "(none)";
  if (transcriptText?.trim()) {
    transcriptBody = transcriptText.slice(0, 500_000);
    transcriptSource = "(pasted)";
  } else if (transcriptSlug) {
    const t = await readTranscript(transcriptSlug);
    if (t) { transcriptBody = t; transcriptSource = transcriptSlug; }
  }

  const session = await startSession({ keyword: keyword.trim(), slug: slug.trim(), transcriptSource });

  const prompt = [
    skillBody
      ? `You are operating the "blog-post" skill defined below. Read it carefully and follow it exactly.\n\n<skill>\n${skillBody}\n</skill>\n`
      : `You are an expert SEO blog writer. Write unique, long-form SEO articles for multiple sites.\n`,
    `## Inputs for this run`,
    ``,
    `**Target keyword:** ${keyword.trim()}`,
    `**File slug:** ${slug}`,
    transcriptSource !== "(none)" ? `**Transcript:** ${transcriptSource}` : "**Transcript:** (none provided)",
    transcriptBody ? `\n<transcript>\n${transcriptBody}\n</transcript>\n` : "",
    ``,
    `## What to do now`,
    ``,
    `1. Use the Write tool to create ${SITES.length} unique long-form SEO articles at these exact paths:`,
    ...SITES.map((s) => `   - ${path.join(s.postsDir, `${slug}.md`)}`),
    `2. Each article must be unique with a different title, opening, structure, and CTAs. UK English. Include frontmatter.`,
    `3. Do NOT run any deploy commands — the dashboard handles deployment.`,
    `4. When finished, print a short summary listing each path written and its title.`,
    ``,
    `Begin now.`,
  ].join("\n");

  const child = spawnStream(claudeBin, [
    "-p",
    "--model", CLAUDE_MODEL,
    "--output-format=stream-json",
    "--include-partial-messages",
    "--verbose",
    "--dangerously-skip-permissions",
  ], { input: prompt });

  // Sniff for Write tool calls to log which articles landed
  let buf = "";
  function sniff(chunk: string) {
    buf += chunk;
    const lines = buf.split("\n"); buf = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const evt = JSON.parse(line) as { type?: string; message?: { content?: { type?: string; name?: string; input?: { file_path?: string } }[] } };
        if (evt.type === "assistant" && evt.message?.content) {
          for (const part of evt.message.content) {
            if (part.type === "tool_use" && part.name === "Write" && typeof part.input?.file_path === "string") {
              const article = articleFromPath(part.input.file_path, (slug ?? "").trim());
              if (article) appendArticle(session.id, article).catch(() => {});
            }
          }
        }
      } catch { /* not JSON */ }
    }
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(ctrl) {
      child.stdout?.on("data", (b: Buffer) => { const t = b.toString(); sniff(t); ctrl.enqueue(encoder.encode(t)); });
      child.stderr?.on("data", (b: Buffer) => ctrl.enqueue(encoder.encode(JSON.stringify({ type: "stderr", text: b.toString() }) + "\n")));
      child.on("close", async (code) => {
        await finishSession(session.id, code === 0 ? "completed" : "failed", code ?? undefined);
        ctrl.enqueue(encoder.encode(JSON.stringify({ type: "done", code, sessionId: session.id }) + "\n"));
        ctrl.close();
      });
      child.on("error", async (e) => {
        await finishSession(session.id, "failed");
        ctrl.enqueue(encoder.encode(JSON.stringify({ type: "error", message: String(e) }) + "\n"));
        ctrl.close();
      });
    },
    cancel() { try { child.kill("SIGTERM"); } catch {} finishSession(session.id, "aborted").catch(() => {}); },
  });

  return new Response(stream, { headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-cache", "X-Accel-Buffering": "no" } });
}
