import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { hashToken } from "@/lib/auth/tokens";
import { setOperatorSession } from "@/lib/auth/session";
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

  const tokenRow = await db.operatorLoginToken.findUnique({
    where: { tokenHash },
  });

  if (
    !tokenRow ||
    tokenRow.consumedAt ||
    tokenRow.expiresAt < new Date()
  ) {
    return NextResponse.redirect(
      publicUrl("/operator/login", { err: "Link expired or already used." })
    );
  }

  // Look up operator + create session.
  const operator = await db.operator.findUnique({
    where: { email: tokenRow.email },
  });
  if (!operator) {
    return NextResponse.redirect(
      publicUrl("/operator/login", { err: "Operator account not found." })
    );
  }

  // Mark token consumed and create session atomically.
  const userAgent = req.headers.get("user-agent") ?? null;
  const ip =
    req.headers.get("cf-connecting-ip") ??
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    null;

  const session = await db.$transaction(async (tx) => {
    await tx.operatorLoginToken.update({
      where: { id: tokenRow.id },
      data: { consumedAt: new Date() },
    });
    return tx.operatorSession.create({
      data: {
        operatorId: operator.id,
        ip,
        userAgent,
        expiresAt: new Date(Date.now() + TWENTY_FOUR_HOURS_MS),
      },
    });
  });

  await setOperatorSession(session.id);
  await audit({
    actorType: "operator",
    actorId: operator.id,
    action: "operator.login.success",
    targetType: "OperatorSession",
    targetId: session.id,
  });

  return NextResponse.redirect(publicUrl("/operator"));
}
