"use server";

import { db } from "@/lib/db";
import { newToken } from "@/lib/auth/tokens";
import { sendOperatorLoginEmail } from "@/lib/mailer";
import { audit } from "@/lib/audit";

const FIFTEEN_MIN_MS = 15 * 60 * 1000;

export async function requestOperatorLogin(
  email: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const operatorEmail = process.env.OPERATOR_EMAIL;
  if (!operatorEmail) {
    return { ok: false, error: "Operator email not configured." };
  }

  const trimmed = email.trim().toLowerCase();
  const expected = operatorEmail.trim().toLowerCase();

  // Constant-friendly: always do the work, never reveal whether the email matched
  // by branching the visible response.
  const matches = trimmed === expected;

  if (matches) {
    // Upsert operator
    const operator = await db.operator.upsert({
      where: { email: expected },
      create: { email: expected, name: "Operator" },
      update: {},
    });

    const { token, hash } = newToken();
    await db.operatorLoginToken.create({
      data: {
        email: expected,
        tokenHash: hash,
        expiresAt: new Date(Date.now() + FIFTEEN_MIN_MS),
      },
    });

    const appUrl = process.env.APP_URL ?? "http://localhost:3000";
    const magicLink = `${appUrl}/operator/verify/${token}`;

    await sendOperatorLoginEmail({ email: expected, magicLink });
    await audit({
      actorType: "system",
      action: "operator.login.requested",
      targetType: "Operator",
      targetId: operator.id,
      payload: { email: expected },
    });
  }

  // Same response either way.
  return { ok: true };
}
