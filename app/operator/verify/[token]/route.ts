import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { hashToken } from "@/lib/auth/tokens";
import { setOperatorSession } from "@/lib/auth/session";
import { audit } from "@/lib/audit";

const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const tokenHash = hashToken(token);

  const tokenRow = await db.operatorLoginToken.findUnique({
    where: { tokenHash },
  });

  const url = req.nextUrl.clone();

  if (
    !tokenRow ||
    tokenRow.consumedAt ||
    tokenRow.expiresAt < new Date()
  ) {
    url.pathname = "/operator/login";
    url.searchParams.set("err", "Link expired or already used.");
    return NextResponse.redirect(url);
  }

  // Look up operator + create session.
  const operator = await db.operator.findUnique({
    where: { email: tokenRow.email },
  });
  if (!operator) {
    url.pathname = "/operator/login";
    url.searchParams.set("err", "Operator account not found.");
    return NextResponse.redirect(url);
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

  url.pathname = "/operator";
  url.search = "";
  return NextResponse.redirect(url);
}
