"use server";

import { requirePlatformAdmin } from "@/lib/admin-auth";
import { runReminderPass } from "@/lib/run-reminders";

/**
 * Platform-admin "Run pass now" — invokes the same reminder logic as the
 * daily cron, but attributes the audit row to the admin who clicked it.
 */
export async function adminRunReminders(): Promise<
  | {
      ok: true;
      considered: number;
      sent: number;
      breakdown: Record<string, number>;
    }
  | { ok: false; error: string }
> {
  const me = await requirePlatformAdmin();
  try {
    const r = await runReminderPass({
      triggeredBy: "platform_admin",
      actorId: me.platformAdminId,
    });
    return {
      ok: true,
      considered: r.considered,
      sent: r.sent,
      breakdown: r.breakdown,
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "failed" };
  }
}
