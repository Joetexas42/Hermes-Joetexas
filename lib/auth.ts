/**
 * Single-user auth. The password lives in the AGENTIC_OS_PASSWORD env var.
 * On login we set a signed cookie (HMAC) that middleware verifies on every
 * request. No DB, no library — small surface, easy to audit.
 *
 * On a fresh deploy with no AGENTIC_OS_PASSWORD set, auth is DISABLED
 * (so localhost dev keeps working without ceremony).
 */
import crypto from "node:crypto";

export const COOKIE_NAME = "agentic-os-session";

function secret(): string {
  return process.env.AGENTIC_OS_SECRET ?? process.env.AGENTIC_OS_PASSWORD ?? "dev-secret-do-not-use-in-prod";
}

/** Auth is only required when AGENTIC_OS_PASSWORD is set. */
export function authRequired(): boolean {
  return Boolean(process.env.AGENTIC_OS_PASSWORD);
}

function sign(payload: string): string {
  return crypto.createHmac("sha256", secret()).update(payload).digest("hex");
}

/** Issue a signed cookie value: <issuedAt>.<hmac> */
export function issueToken(): string {
  const issuedAt = Date.now().toString(36);
  return `${issuedAt}.${sign(issuedAt)}`;
}

/** Verify a cookie value. Expires after 30 days. */
export function verifyToken(token: string | undefined | null): boolean {
  if (!token) return false;
  const [issuedAt, mac] = token.split(".");
  if (!issuedAt || !mac) return false;
  const expected = sign(issuedAt);
  // constant-time compare
  if (mac.length !== expected.length) return false;
  if (!crypto.timingSafeEqual(Buffer.from(mac), Buffer.from(expected))) return false;
  const issued = parseInt(issuedAt, 36);
  if (!Number.isFinite(issued)) return false;
  return Date.now() - issued < 30 * 24 * 60 * 60 * 1000;
}

export function checkPassword(input: string): boolean {
  const expected = process.env.AGENTIC_OS_PASSWORD ?? "";
  if (!expected) return true; // dev / unsecured
  if (input.length !== expected.length) return false;
  return crypto.timingSafeEqual(Buffer.from(input), Buffer.from(expected));
}
