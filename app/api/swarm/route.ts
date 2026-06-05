import { NextResponse } from "next/server";
import { getSwarm, setSwarm, resetStatuses, type SwarmState } from "@/lib/swarm";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(await getSwarm());
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as Partial<SwarmState> & { reset?: boolean };
  if (body.reset) {
    // reset statuses; optionally accept a new agents array at the same time
    const s = await resetStatuses();
    if (Array.isArray(body.agents)) return NextResponse.json(await setSwarm({ agents: body.agents }));
    return NextResponse.json(s);
  }
  const { reset: _r, ...patch } = body;
  return NextResponse.json(await setSwarm(patch));
}
