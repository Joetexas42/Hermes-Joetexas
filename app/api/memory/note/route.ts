import { NextResponse } from "next/server";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { getVaultConfig } from "@/lib/vault";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const notePath = searchParams.get("path") ?? "";
  if (!notePath) return NextResponse.json({ error: "no path" }, { status: 400 });

  const cfg = await getVaultConfig();

  // Sanitise: must resolve inside the vault root
  const abs = path.resolve(cfg.vaultDir, notePath);
  if (!abs.startsWith(path.resolve(cfg.vaultDir))) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  try {
    const content = await readFile(abs, "utf8");
    return NextResponse.json({ path: notePath, content });
  } catch {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
}
