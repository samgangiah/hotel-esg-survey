import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { hashToken } from "@/lib/auth/tokens";
import { setPlatformAdminSession } from "@/lib/auth/session";
import { audit } from "@/lib/audit";

const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;

function publicUrl(path: string, search?: Record<string, string>): URL {
  const base = process.env.APP_URL ?? "http://localhost:3000";
  const u = new URL(path, base);
  if (search) for (const [k, v] of Object.entries(search)) u.searchParams.set(k, v);
  return u;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const tokenHash = hashToken(token);

  const tokenRow = await db.platformAdminLoginToken.findUnique({
    where: { tokenHash },
  });

  if (
    !tokenRow ||
    tokenRow.consumedAt ||
    tokenRow.expiresAt < new Date()
  ) {
    return NextResponse.redirect(
      publicUrl("/admin/login", { err: "Link expired or already used." })
    );
  }

  const platformAdmin = await db.platformAdmin.findUnique({
    where: { email: tokenRow.email },
  });
  if (!platformAdmin) {
    return NextResponse.redirect(
      publicUrl("/admin/login", { err: "Account not found." })
    );
  }

  const userAgent = req.headers.get("user-agent") ?? null;
  const ip =
    req.headers.get("cf-connecting-ip") ??
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    null;

  const session = await db.$transaction(async (tx) => {
    await tx.platformAdminLoginToken.update({
      where: { id: tokenRow.id },
      data: { consumedAt: new Date() },
    });
    return tx.platformAdminSession.create({
      data: {
        platformAdminId: platformAdmin.id,
        ip,
        userAgent,
        expiresAt: new Date(Date.now() + TWENTY_FOUR_HOURS_MS),
      },
    });
  });

  await setPlatformAdminSession(session.id);
  await audit({
    actorType: "platform_admin",
    actorId: platformAdmin.id,
    action: "platform_admin.login.success",
    targetType: "PlatformAdminSession",
    targetId: session.id,
  });

  return NextResponse.redirect(publicUrl("/admin"));
}
