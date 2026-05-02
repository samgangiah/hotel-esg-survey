import { cookies } from "next/headers";
import { createHmac, timingSafeEqual } from "node:crypto";

const RESPONDENT_COOKIE = "esg_session";
const OPERATOR_COOKIE = "esg_operator";
const NINETY_DAYS = 90 * 24 * 60 * 60;
const TWENTY_FOUR_HOURS = 24 * 60 * 60;

function signingKey(): string {
  const k = process.env.SESSION_SIGNING_KEY;
  if (!k || k === "dev-only-change-in-prod") {
    throw new Error("SESSION_SIGNING_KEY is not set to a real value");
  }
  return k;
}

function sign(value: string): string {
  return createHmac("sha256", signingKey()).update(value).digest("base64url");
}

function verify(value: string, sig: string): boolean {
  const expected = sign(value);
  if (sig.length !== expected.length) return false;
  try {
    return timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
  } catch {
    return false;
  }
}

function pack(id: string): string {
  return `${id}.${sign(id)}`;
}

function unpack(packed: string | undefined): string | null {
  if (!packed) return null;
  const dot = packed.lastIndexOf(".");
  if (dot < 0) return null;
  const id = packed.slice(0, dot);
  const sig = packed.slice(dot + 1);
  return verify(id, sig) ? id : null;
}

// --- Respondent session (90-day) -------------------------------------------

export async function setRespondentSession(sessionId: string) {
  const c = await cookies();
  c.set(RESPONDENT_COOKIE, pack(sessionId), {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: NINETY_DAYS,
  });
}

export async function getRespondentSessionId(): Promise<string | null> {
  const c = await cookies();
  return unpack(c.get(RESPONDENT_COOKIE)?.value);
}

export async function clearRespondentSession() {
  const c = await cookies();
  c.delete(RESPONDENT_COOKIE);
}

// --- Operator session (24-hour, shorter window — higher-trust account) -----

export async function setOperatorSession(sessionId: string) {
  const c = await cookies();
  c.set(OPERATOR_COOKIE, pack(sessionId), {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: TWENTY_FOUR_HOURS,
  });
}

export async function getOperatorSessionId(): Promise<string | null> {
  const c = await cookies();
  return unpack(c.get(OPERATOR_COOKIE)?.value);
}

export async function clearOperatorSession() {
  const c = await cookies();
  c.delete(OPERATOR_COOKIE);
}

// --- Edge-runtime-safe cookie name accessors (for middleware) --------------

export const COOKIE_NAMES = {
  respondent: RESPONDENT_COOKIE,
  operator: OPERATOR_COOKIE,
};
