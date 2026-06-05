import { spawn, type ChildProcess } from "node:child_process";

/**
 * Spawn a CLI process and return the child immediately (streaming).
 * Callers read child.stdout / child.stderr and listen to "close".
 * Used by the SEO generate route to stream Claude's output to the browser.
 */
export function spawnStream(
  bin: string | null,
  args: string[],
  opts: { input?: string; cwd?: string } = {},
): ChildProcess {
  if (!bin) throw new Error("binary not configured");
  const child = spawn(bin, args, {
    cwd: opts.cwd ?? process.cwd(),
    windowsHide: true,
    env: { ...process.env },
  });
  if (opts.input !== undefined) {
    child.stdin.write(opts.input);
    child.stdin.end();
  }
  return child;
}

export interface RunResult {
  ok: boolean;
  stdout: string;
  stderr: string;
  exitCode: number | null;
  durationMs: number;
  timedOut: boolean;
}

/**
 * Spawn a CLI with a hard timeout. Returns stdout, stderr, exit code, and
 * wall-clock duration regardless of success or failure. Never throws.
 */
export function run(
  bin: string | null,
  args: string[],
  { timeoutMs = 8000, cwd }: { timeoutMs?: number; cwd?: string } = {},
): Promise<RunResult> {
  const t0 = Date.now();

  if (!bin) {
    return Promise.resolve({
      ok: false,
      stdout: "",
      stderr: "binary not configured",
      exitCode: null,
      durationMs: 0,
      timedOut: false,
    });
  }

  return new Promise((resolve) => {
    let out = "", err = "", timedOut = false;

    const child = spawn(bin, args, {
      cwd: cwd ?? process.cwd(),
      windowsHide: true,
      env: { ...process.env },
    });

    child.stdout.on("data", (d: Buffer) => { out += d.toString("utf8"); });
    child.stderr.on("data", (d: Buffer) => { err += d.toString("utf8"); });

    const timer = setTimeout(() => {
      timedOut = true;
      child.kill();
    }, timeoutMs);

    child.on("error", () => {
      clearTimeout(timer);
      resolve({ ok: false, stdout: out, stderr: err, exitCode: null, durationMs: Date.now() - t0, timedOut });
    });

    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({
        ok: !timedOut && code === 0,
        stdout: out,
        stderr: err,
        exitCode: code,
        durationMs: Date.now() - t0,
        timedOut,
      });
    });
  });
}
