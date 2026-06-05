import { NextResponse } from "next/server";
import { getBridgeState, setBridgeState, resolveClaudeExe, isLocalRequest } from "@/lib/bridge";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Never return the raw token to the client. */
function safe(state: Awaited<ReturnType<typeof getBridgeState>>) {
  const exe = resolveClaudeExe();
  return {
    armed: state.armed,
    workingDir: state.workingDir,
    authMethod: state.authMethod,
    hasToken: Boolean(state.token),
    cliFound: Boolean(exe),
    cliPath: exe,
  };
}

export async function GET() {
  return NextResponse.json(safe(await getBridgeState()));
}

export async function POST(req: Request) {
  if (!isLocalRequest(req)) {
    return NextResponse.json({ error: "Bridge is localhost-only." }, { status: 403 });
  }
  const body = (await req.json().catch(() => ({}))) as {
    armed?: boolean;
    workingDir?: string;
    authMethod?: "oauth" | "apikey" | "none";
    token?: string;
  };
  const next = await setBridgeState({
    ...(typeof body.armed === "boolean" ? { armed: body.armed } : {}),
    ...(body.workingDir ? { workingDir: body.workingDir } : {}),
    ...(body.authMethod ? { authMethod: body.authMethod } : {}),
    ...(typeof body.token === "string" ? { token: body.token.trim() } : {}),
  });
  return NextResponse.json(safe(next));
}
