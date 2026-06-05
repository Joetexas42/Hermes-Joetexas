import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { readdir, stat } from "node:fs/promises";
import path from "node:path";
import { SITES } from "@/lib/seoPipeline";
import { startDeploy, finishDeploy } from "@/lib/seoHistory";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function mostRecentSlug(dir: string): Promise<string | undefined> {
  try {
    const items = await readdir(dir);
    const mds = items.filter((f) => /\.md$/i.test(f));
    const stats = await Promise.all(mds.map(async (f) => {
      try { const s = await stat(path.join(dir, f)); return { f, m: s.mtimeMs }; }
      catch { return { f, m: 0 }; }
    }));
    stats.sort((a, b) => b.m - a.m);
    return stats[0]?.f.replace(/\.md$/, "");
  } catch { return undefined; }
}

function findNetlifyUrl(text: string): string | undefined {
  for (const re of [
    /Website URL:\s*(https?:\/\/[^\s]+)/i,
    /Live URL:\s*(https?:\/\/[^\s]+)/i,
    /Unique deploy URL:\s*(https?:\/\/[^\s]+)/i,
  ]) {
    const m = text.match(re);
    if (m) return m[1];
  }
}

export async function POST(req: Request) {
  const { siteId } = await req.json() as { siteId: string };
  const site = SITES.find((s) => s.id === siteId);
  if (!site) return new Response("unknown site", { status: 400 });
  if (!existsSync(site.path)) return new Response(`site path not found: ${site.path}`, { status: 500 });

  const sitePath: string = site.path;
  const liveSlug = await mostRecentSlug(site.postsDir);
  const deploy = await startDeploy({ siteId: site.id, siteName: site.name, blogBaseUrl: site.url, liveSlug });

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(ctrl) {
      const emit = (obj: Record<string, unknown>) => ctrl.enqueue(encoder.encode(JSON.stringify(obj) + "\n"));
      let allOut = "", stderrTail = "";

      const runStep = (label: string, cmd: string, args: string[]) => new Promise<number>((res) => {
        emit({ type: "step", label });
        const env = { ...process.env, NO_COLOR: "1", CI: "1" };
        const p = spawn(cmd, args, { cwd: sitePath, env, windowsHide: true, shell: true });
        p.stdout.on("data", (b: Buffer) => { const t = b.toString(); allOut += t; emit({ type: "stdout", label, text: t }); });
        p.stderr.on("data", (b: Buffer) => { const t = b.toString(); allOut += t; stderrTail = (stderrTail + t).slice(-2000); emit({ type: "stderr", label, text: t }); });
        p.on("close", (code) => { emit({ type: "step_end", label, code }); res(code ?? 0); });
        p.on("error", (e) => { emit({ type: "error", label, text: String(e) }); res(1); });
      });

      try {
        emit({ type: "start", site: site.id, path: sitePath, liveSlug, deployId: deploy.id });
        const buildCode = await runStep("build (11ty)", "npx", ["@11ty/eleventy"]);
        if (buildCode !== 0) {
          await finishDeploy(deploy.id, { status: "failed", errorTail: stderrTail });
          emit({ type: "done", code: buildCode, ok: false, reason: "build failed" });
          ctrl.close(); return;
        }
        const deployCode = await runStep("deploy (netlify)", "netlify", ["deploy", "--prod", "--dir=_site"]);
        const netlifyUrl = findNetlifyUrl(allOut);
        await finishDeploy(deploy.id, { status: deployCode === 0 ? "ok" : "failed", netlifyUrl, errorTail: deployCode === 0 ? undefined : stderrTail });
        emit({ type: "done", code: deployCode, ok: deployCode === 0, netlifyUrl, liveUrl: liveSlug ? `${site.url}/blog/${liveSlug}/` : undefined, deployId: deploy.id });
      } catch (e) {
        await finishDeploy(deploy.id, { status: "failed", errorTail: String(e) });
        emit({ type: "error", text: String(e) });
      } finally { ctrl.close(); }
    },
  });

  return new Response(stream, { headers: { "Content-Type": "application/x-ndjson", "Cache-Control": "no-cache", "X-Accel-Buffering": "no" } });
}
