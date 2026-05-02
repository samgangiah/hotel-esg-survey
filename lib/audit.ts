import { db } from "@/lib/db";
import { headers } from "next/headers";
import type { Prisma } from "@prisma/client";

interface AuditArgs {
  actorType: "operator" | "respondent" | "system";
  actorId?: string | null;
  action: string;
  targetType: string;
  targetId: string;
  payload?: Prisma.InputJsonValue;
}

/** Write a single audit-log row. Resolves the request IP from headers when called inside a request. */
export async function audit(args: AuditArgs) {
  let ip: string | null = null;
  try {
    const h = await headers();
    ip =
      h.get("cf-connecting-ip") ??
      h.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      null;
  } catch {
    // headers() not available outside request scope — that's fine.
  }

  await db.auditLog.create({
    data: {
      actorType: args.actorType,
      actorId: args.actorId ?? null,
      action: args.action,
      targetType: args.targetType,
      targetId: args.targetId,
      payloadJson: args.payload ?? undefined,
      ip,
    },
  });
}
