import { NextResponse } from "next/server";
import { buildVaultGraph } from "@/lib/vaultGraph";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// 30 s cache — re-tab-switches don't re-walk the whole vault.
let cache: { at: number; data: Awaited<ReturnType<typeof buildVaultGraph>> } | null = null;
const TTL = 30_000;

export async function GET() {
  const now = Date.now();
  if (cache && now - cache.at < TTL) return NextResponse.json(cache.data);
  const data = await buildVaultGraph();
  cache = { at: now, data };
  return NextResponse.json(data);
}
