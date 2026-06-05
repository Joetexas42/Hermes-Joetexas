import { NextResponse } from "next/server";
import { listStudio } from "@/lib/hermesStudio";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const [images, voices, videos] = await Promise.all([
    listStudio("image", 20),
    listStudio("voice", 20),
    listStudio("video", 20),
  ]);
  return NextResponse.json({ images, voices, videos });
}
