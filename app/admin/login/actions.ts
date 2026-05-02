"use server";

import { db } from "@/lib/db";
import { newToken } from "@/lib/auth/tokens";
import { sendOperatorLoginEmail } from "@/lib/mailer";
import { audit } from "@/lib/audit";
import { platformAdminEmail } from "@/lib/admin-auth";

const FIFTEEN_MIN_MS = 15 * 60 * 1000;

export async function requestPlatformAdminLogin(
  email: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const expected = platformAdminEmail();
  if (!expected) {
    return { ok: false, error: "Platform-admin email not configured." };
  }

  const trimmed = email.trim().toLowerCase();
  const matches = trimmed === expected.trim().toLowerCase();

  if (matches) {
    const platformAdmin = await db.platformAdmin.upsert({
      where: { email: trimmed },
      create: { email: trimmed, name: "Platform Admin" },
      update: {},
    });

    const { token, hash } = newToken();
    await db.platformAdminLoginToken.create({
      data: {
        email: trimmed,
        tokenHash: hash,
        expiresAt: new Date(Date.now() + FIFTEEN_MIN_MS),
      },
    });

    const appUrl = process.env.APP_URL ?? "http://localhost:3000";
    const magicLink = `${appUrl}/admin/verify/${token}`;

    await sendOperatorLoginEmail({ email: trimmed, magicLink });
    await audit({
      actorType: "system",
      action: "platform_admin.login.requested",
      targetType: "PlatformAdmin",
      targetId: platformAdmin.id,
      payload: { email: trimmed },
    });
  }

  // Same response either way — never confirm or deny who's a valid admin.
  return { ok: true };
}
