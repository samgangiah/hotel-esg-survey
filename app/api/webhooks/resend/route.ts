import { NextRequest, NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "node:crypto";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/webhooks/resend
 *
 * Receives delivery events from Resend (via Svix) and:
 *  - writes an EmailEvent row tied to the most-recent Invitation for that
 *    recipient (so /admin/email-events lights up)
 *  - flags Respondent.emailInvalid=true on hard bounces / complaints (so the
 *    reminder cron stops nudging that address)
 *
 * Configure on Resend Dashboard → Webhooks:
 *   URL:    https://esg.digitalrain.cloud/api/webhooks/resend
 *   Events: email.delivered, email.bounced, email.complained,
 *           email.opened, email.failed, email.delivery_delayed
 * Then set `RESEND_WEBHOOK_SECRET` in the VPS .env to the Svix signing
 * secret shown in the dashboard.
 */
export async function POST(req: NextRequest) {
  const secret = process.env.RESEND_WEBHOOK_SECRET;
  if (!secret) {
    return NextResponse.json(
      { ok: false, error: "RESEND_WEBHOOK_SECRET not configured." },
      { status: 500 }
    );
  }

  const svixId = req.headers.get("svix-id");
  const svixTimestamp = req.headers.get("svix-timestamp");
  const svixSignatureHeader = req.headers.get("svix-signature");
  if (!svixId || !svixTimestamp || !svixSignatureHeader) {
    return NextResponse.json(
      { ok: false, error: "Missing Svix headers." },
      { status: 400 }
    );
  }

  // Read the raw body — required for signature verification.
  const rawBody = await req.text();

  if (!verifySvixSignature(secret, svixId, svixTimestamp, rawBody, svixSignatureHeader)) {
    return NextResponse.json({ ok: false, error: "Bad signature." }, { status: 401 });
  }

  // Reject replay attacks beyond a 5-minute window.
  const ts = Number.parseInt(svixTimestamp, 10);
  if (!Number.isFinite(ts) || Math.abs(Date.now() / 1000 - ts) > 5 * 60) {
    return NextResponse.json(
      { ok: false, error: "Stale webhook." },
      { status: 400 }
    );
  }

  let payload: ResendEventPayload;
  try {
    payload = JSON.parse(rawBody) as ResendEventPayload;
  } catch {
    return NextResponse.json(
      { ok: false, error: "Malformed JSON." },
      { status: 400 }
    );
  }

  const eventType = payload.type ?? "unknown";
  const recipients = Array.isArray(payload.data?.to)
    ? (payload.data?.to ?? []).filter((x): x is string => typeof x === "string")
    : typeof payload.data?.to === "string"
      ? [payload.data.to]
      : [];

  if (recipients.length === 0) {
    // Nothing we can match against — record it as orphaned so it's not lost.
    await audit({
      actorType: "system",
      action: "resend.webhook.orphan",
      targetType: "EmailEvent",
      targetId: svixId,
      payload: { eventType, raw: payload as never },
    });
    return NextResponse.json({ ok: true, matched: 0 });
  }

  let matchedCount = 0;
  const now = new Date();

  for (const rawRecipient of recipients) {
    const recipient = rawRecipient.trim().toLowerCase();
    if (!recipient) continue;

    // Find every respondent with this email — usually one, occasionally
    // two if a person is invited across operators.
    const respondents = await db.respondent.findMany({
      where: { email: recipient },
    });
    if (respondents.length === 0) continue;

    for (const r of respondents) {
      // Bind the event to the most recent invitation across this respondent's
      // assignments (best-effort — there's no Resend message-id stored).
      const inv = await db.invitation.findFirst({
        where: { assignment: { respondentId: r.id } },
        orderBy: { sentAt: "desc" },
      });
      if (!inv) continue;

      await db.emailEvent.create({
        data: {
          invitationId: inv.id,
          eventType,
          payloadJson: payload as never,
          occurredAt: payload.created_at ? new Date(payload.created_at) : now,
        },
      });
      matchedCount += 1;

      // Hard bounces and spam complaints → stop emailing this address.
      const isHardBounce =
        eventType === "email.bounced" &&
        (payload.data?.bounce?.type === "hard" ||
          payload.data?.bounce?.bounceType === "Permanent");
      const isComplaint = eventType === "email.complained";
      if ((isHardBounce || isComplaint) && !r.emailInvalid) {
        await db.respondent.update({
          where: { id: r.id },
          data: { emailInvalid: true },
        });
        await audit({
          actorType: "system",
          action: "respondent.emailInvalidated",
          targetType: "Respondent",
          targetId: r.id,
          payload: { reason: eventType, email: r.email },
        });
      }
    }
  }

  return NextResponse.json({ ok: true, matched: matchedCount });
}

// --- Svix signature verification --------------------------------------------

/**
 * Resend wraps webhook delivery in Svix. The signature header is a
 * space-separated list of `v1,base64sig` pairs; the body to sign is
 * `<svix-id>.<svix-timestamp>.<raw body>` under HMAC-SHA256 with the
 * webhook secret. Secrets start with `whsec_` and the base64-decoded
 * portion is the key.
 */
function verifySvixSignature(
  secret: string,
  svixId: string,
  svixTimestamp: string,
  body: string,
  header: string
): boolean {
  const keyMaterial = secret.startsWith("whsec_")
    ? Buffer.from(secret.slice("whsec_".length), "base64")
    : Buffer.from(secret, "utf8");

  const signedPayload = `${svixId}.${svixTimestamp}.${body}`;
  const expected = createHmac("sha256", keyMaterial)
    .update(signedPayload)
    .digest("base64");

  const provided = header
    .split(/\s+/)
    .map((p) => p.split(","))
    .filter((pair) => pair[0] === "v1" && typeof pair[1] === "string")
    .map((pair) => pair[1]);

  for (const sig of provided) {
    const sigBuf = Buffer.from(sig, "base64");
    const expBuf = Buffer.from(expected, "base64");
    if (sigBuf.length === expBuf.length && timingSafeEqual(sigBuf, expBuf)) {
      return true;
    }
  }
  return false;
}

// --- Resend event payload shape (loosely typed) -----------------------------

interface ResendEventPayload {
  type?: string;
  created_at?: string;
  data?: {
    email_id?: string;
    to?: string | string[];
    from?: string;
    subject?: string;
    bounce?: { type?: string; bounceType?: string; message?: string };
  };
}
