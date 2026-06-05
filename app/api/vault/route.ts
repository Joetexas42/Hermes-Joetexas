import { NextResponse } from "next/server";
import { vaultStatus, setVaultConfig, saveEntry, type EntryKind } from "@/lib/vault";
import { isLocalRequest } from "@/lib/bridge";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(await vaultStatus());
}

export async function POST(req: Request) {
  if (!isLocalRequest(req)) {
    return NextResponse.json({ error: "Vault is localhost-only." }, { status: 403 });
  }
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;

  // Append an entry
  if (typeof body.kind === "string") {
    const result = await saveEntry({
      kind: body.kind as EntryKind,
      agent: body.agent as string | undefined,
      you: body.you as string | undefined,
      assistant: body.assistant as string | undefined,
      text: body.text as string | undefined,
      event: body.event as string | undefined,
    });
    return NextResponse.json(result, { status: result.ok ? 200 : 409 });
  }

  // Update config
  const next = await setVaultConfig({
    ...(typeof body.vaultDir === "string" ? { vaultDir: body.vaultDir } : {}),
    ...(typeof body.enabled === "boolean" ? { enabled: body.enabled } : {}),
  });
  return NextResponse.json(await vaultStatus().then((s) => ({ ...s, ...next })));
}
