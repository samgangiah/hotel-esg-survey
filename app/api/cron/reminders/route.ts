import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { runReminderPass } from "@/lib/run-reminders";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/cron/reminders
 *
 * Drives the auto-reminder pass. Guarded by `CRON_SECRET`. Idempotent:
 * each invitation gets at most one reminder per 24h. The same logic is
 * exposed to platform admins via the "Run pass now" button on
 * /admin/reminders (which calls runReminderPass() directly inside an
 * authenticated server action).
 */
async function run(req: NextRequest) {
  const expected = process.env.CRON_SECRET;
  if (!expected || expected.length < 16) {
    return NextResponse.json(
      { ok: false, error: "CRON_SECRET not configured." },
      { status: 500 }
    );
  }

  const provided =
    req.headers.get("x-cron-secret") ??
    req.nextUrl.searchParams.get("secret") ??
    "";
  if (!timingSafeEqualString(provided, expected)) {
    return NextResponse.json({ ok: false, error: "Forbidden." }, { status: 403 });
  }

  const result = await runReminderPass({ triggeredBy: "cron" });
  return NextResponse.json({ ok: true, ...result });
}

export async function POST(req: NextRequest) {
  return run(req);
}
export async function GET(req: NextRequest) {
  return run(req);
}

function timingSafeEqualString(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  try {
    return timingSafeEqual(ab, bb);
  } catch {
    return false;
  }
}
