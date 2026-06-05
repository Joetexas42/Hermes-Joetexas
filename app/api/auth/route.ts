import { NextResponse } from "next/server";
import { checkPassword, issueToken, COOKIE_NAME, authRequired } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** POST { password } → set session cookie */
export async function POST(req: Request) {
  if (!authRequired()) {
    return NextResponse.json({ ok: true, message: "auth disabled" });
  }
  const { password } = (await req.json().catch(() => ({}))) as { password?: string };
  if (typeof password !== "string" || !checkPassword(password)) {
    // Constant-ish failure latency
    await new Promise((r) => setTimeout(r, 400));
    return NextResponse.json({ error: "wrong password" }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(COOKIE_NAME, issueToken(), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 30 * 24 * 60 * 60, // 30 days
    path: "/",
  });
  return res;
}

/** DELETE → log out */
export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.delete(COOKIE_NAME);
  return res;
}
