import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getPlatformAdminSessionId } from "@/lib/auth/session";

export interface PlatformAdminAuth {
  platformAdminId: string;
  email: string;
  name: string;
}

/**
 * Resolve the active Platform Admin from the signed cookie + DB session row.
 * Server-only. Redirects to /admin/login if no valid session.
 */
export async function requirePlatformAdmin(): Promise<PlatformAdminAuth> {
  const sessionId = await getPlatformAdminSessionId();
  if (!sessionId) redirect("/admin/login");

  const session = await db.platformAdminSession.findUnique({
    where: { id: sessionId },
    include: { platformAdmin: true },
  });
  if (!session || session.expiresAt < new Date()) {
    redirect("/admin/login");
  }

  await db.platformAdminSession.update({
    where: { id: sessionId },
    data: { lastSeenAt: new Date() },
  });

  return {
    platformAdminId: session.platformAdmin.id,
    email: session.platformAdmin.email,
    name: session.platformAdmin.name,
  };
}

/** Look up the configured platform-admin email. Accepts either env var as a transition aid. */
export function platformAdminEmail(): string | undefined {
  return process.env.PLATFORM_ADMIN_EMAIL ?? process.env.OPERATOR_EMAIL;
}
