import { spawn } from "node:child_process";
import { getBridgeState, resolveClaudeExe, isLocalRequest, buildChildEnv } from "@/lib/bridge";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST { prompt, sessionId? }  ->  Server-Sent Events
 *
 * Spawns the real Claude Code CLI in headless stream-json mode and relays its
 * output token-by-token. Runs in `plan` permission mode so a browser tab can
 * talk to Claude but cannot have it modify your machine. Off until armed.
 *
 * SSE event payloads (one JSON object per `data:` line):
 *   { type: "session", id }
 *   { type: "delta", text }
 *   { type: "done",   result, cost, durationMs }
 *   { type: "error",  message }
 */
export async function POST(req: Request) {
  if (!isLocalRequest(req)) {
    return sseError("Bridge is localhost-only.", 403);
  }

  const state = await getBridgeState();
  if (!state.armed) {
    return sseError("Bridge is disarmed. Flip it on in the top bar to talk to Claude.", 423);
  }

  const exe = resolveClaudeExe();
  if (!exe) {
    return sseError("Could not find the Claude Code CLI on this machine.", 501);
  }

  if (state.authMethod === "none" || !state.token) {
    return sseError(
      "No credential set. Open Bridge settings and add a setup-token or API key so the CLI can log in.",
      428,
    );
  }

  const { prompt, sessionId } = (await req.json().catch(() => ({}))) as {
    prompt?: string;
    sessionId?: string;
  };
  if (!prompt || !prompt.trim()) {
    return sseError("Empty prompt.", 400);
  }

  const args = [
    ...(sessionId ? ["--resume", sessionId] : []),
    "-p",
    "--output-format",
    "stream-json",
    "--include-partial-messages",
    "--verbose",
    "--permission-mode",
    "plan",
    "--model",
    "claude-opus-4-8",
  ];

  const started = Date.now();
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let closed = false;
      const send = (obj: unknown) => {
        if (closed) return;
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`));
      };
      const close = () => {
        if (closed) return;
        closed = true;
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      };

      const child = spawn(exe, args, {
        cwd: state.workingDir,
        windowsHide: true,
        env: buildChildEnv(state),
      });

      // Feed the prompt over stdin so quoting/length is never a problem.
      child.stdin.write(prompt);
      child.stdin.end();

      let resolvedSession = sessionId ?? "";
      let sawSession = false;
      let stdoutBuf = "";
      let stderrBuf = "";

      const handleLine = (line: string) => {
        const trimmed = line.trim();
        if (!trimmed) return;
        let evt: Record<string, unknown>;
        try {
          evt = JSON.parse(trimmed);
        } catch {
          return; // non-JSON noise
        }

        const sid = (evt.session_id as string) || "";
        if (sid && !sawSession) {
          sawSession = true;
          resolvedSession = sid;
          send({ type: "session", id: sid });
        }

        if (evt.type === "stream_event") {
          const inner = (evt.event as Record<string, unknown>) || {};
          if (inner.type === "content_block_delta") {
            const delta = (inner.delta as Record<string, unknown>) || {};
            if (delta.type === "text_delta" && typeof delta.text === "string") {
              send({ type: "delta", text: delta.text });
            }
          }
        } else if (evt.type === "result") {
          send({
            type: "done",
            result: typeof evt.result === "string" ? evt.result : "",
            cost: (evt.total_cost_usd as number) ?? null,
            durationMs: Date.now() - started,
            sessionId: resolvedSession,
          });
        }
      };

      child.stdout.on("data", (chunk: Buffer) => {
        stdoutBuf += chunk.toString("utf8");
        let idx: number;
        while ((idx = stdoutBuf.indexOf("\n")) !== -1) {
          const line = stdoutBuf.slice(0, idx);
          stdoutBuf = stdoutBuf.slice(idx + 1);
          handleLine(line);
        }
      });

      child.stderr.on("data", (chunk: Buffer) => {
        stderrBuf += chunk.toString("utf8");
      });

      child.on("error", (err) => {
        send({ type: "error", message: `Failed to launch CLI: ${err.message}` });
        close();
      });

      child.on("close", (code) => {
        if (stdoutBuf.trim()) handleLine(stdoutBuf);
        if (code !== 0) {
          send({
            type: "error",
            message: stderrBuf.trim() || `Claude CLI exited with code ${code}.`,
          });
        }
        close();
      });

      // If the browser navigates away, kill the child.
      req.signal.addEventListener("abort", () => {
        child.kill();
        close();
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}

function sseError(message: string, status: number) {
  const body = `data: ${JSON.stringify({ type: "error", message })}\n\n`;
  return new Response(body, {
    status,
    headers: { "Content-Type": "text/event-stream; charset=utf-8", "Cache-Control": "no-cache" },
  });
}
