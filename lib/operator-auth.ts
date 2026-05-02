import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getOperatorSessionId } from "@/lib/auth/session";

export interface OperatorAuth {
  operatorId: string;
  email: string;
  name: string;
}

/**
 * Resolve the active operator from the signed cookie + DB session row.
 * Server-only. Redirects to /operator/login if no valid session.
 */
export async function requireOperator(): Promise<OperatorAuth> {
  const sessionId = await getOperatorSessionId();
  if (!sessionId) redirect("/operator/login");

  const session = await db.operatorSession.findUnique({
    where: { id: sessionId },
    include: { operator: true },
  });
  if (!session || session.expiresAt < new Date()) {
    redirect("/operator/login");
  }

  // Touch lastSeenAt
  await db.operatorSession.update({
    where: { id: sessionId },
    data: { lastSeenAt: new Date() },
  });

  return {
    operatorId: session.operator.id,
    email: session.operator.email,
    name: session.operator.name,
  };
}
