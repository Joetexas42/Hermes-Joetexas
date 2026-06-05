/**
 * Single-user auth. The password lives in the AGENTIC_OS_PASSWORD env var.
 * On login we set a signed cookie (HMAC-SHA256) that middleware verifies on
 * every request. No DB, no library — small surface, easy to audit.
 *
 * Uses the Web Crypto API (globalThis.crypto.subtle) so it works in both
 * the Edge middleware runtime AND the Node runtime. No `node:crypto`.
 *
 * On a fresh deploy with no AGENTIC_OS_PASSWORD set, auth is DISABLED
 * (so localhost dev keeps working without ceremony).
 */

export const COOKIE_NAME = "agentic-os-session";

function secret(): string {
  return (
    process.env.AGENTIC_OS_SECRET ??
    process.env.AGENTIC_OS_PASSWORD ??
    "dev-secret-do-not-use-in-prod"
  );
}

/** Auth is only required when AGENTIC_OS_PASSWORD is set. */
export function authRequired(): boolean {
  return Boolean(process.env.AGENTIC_OS_PASSWORD);
}

const enc = new TextEncoder();

/** Lazy-built HMAC key. Re-built per call because the secret might change
 *  at runtime in dev, and importKey is cheap. */
async function getKey(): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    enc.encode(secret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
}

function toHex(buf: ArrayBuffer): string {
  const arr = new Uint8Array(buf);
  let out = "";
  for (let i = 0; i < arr.length; i++) {
    out += arr[i].toString(16).padStart(2, "0");
  }
  return out;
}

async function signHex(payload: string): Promise<string> {
  const key = await getKey();
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(payload));
  return toHex(sig);
}

/** Constant-time string compare. Both strings must be the same length. */
function ctEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

/** Issue a signed cookie value: <issuedAt>.<hmac> */
export async function issueToken(): Promise<string> {
  const issuedAt = Date.now().toString(36);
  const mac = await signHex(issuedAt);
  return `${issuedAt}.${mac}`;
}

/** Verify a cookie value. Expires after 30 days. */
export async function verifyToken(token: string | undefined | null): Promise<boolean> {
  if (!token) return false;
  const [issuedAt, mac] = token.split(".");
  if (!issuedAt || !mac) return false;
  const expected = await signHex(issuedAt);
  if (!ctEqual(mac, expected)) return false;
  const issued = parseInt(issuedAt, 36);
  if (!Number.isFinite(issued)) return false;
  return Date.now() - issued < 30 * 24 * 60 * 60 * 1000;
}

/** Constant-time password check. */
export function checkPassword(input: string): boolean {
  const expected = process.env.AGENTIC_OS_PASSWORD ?? "";
  if (!expected) return true; // dev / unsecured
  return ctEqual(input, expected);
}
