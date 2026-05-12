/**
 * Pure cadence logic for auto-reminders. Kept separate from DB / mailer so we
 * can unit-test the decision rules without IO. The cron driver in
 * `app/api/cron/reminders/route.ts` does the actual fetch + send + write.
 *
 * Cadence:
 *   tier 1 — gentle nudge        at  ≥ 5 days since the invitation was sent
 *   tier 2 — firmer reminder     at  ≥ 10 days
 *   tier 3 — final notice        at  ≥ 21 days
 *
 * Resending an invitation creates a new Invitation row with remindersSent=0,
 * so the cadence resets naturally — no need to special-case the resend path.
 *
 * Idempotency: any single Invitation gets at most one reminder per 24 hours,
 * so the cron job can run hourly or daily without ever double-sending.
 */

export type ReminderTier = 1 | 2 | 3;

export const REMINDER_DAYS: Record<ReminderTier, number> = {
  1: 5,
  2: 10,
  3: 21,
};

export const REMINDER_SUBJECTS: Record<ReminderTier, string> = {
  1: "A quick nudge on your energy survey",
  2: "Could you spare 30 minutes for the energy survey?",
  3: "Final reminder — energy survey closing soon",
};

const DAY_MS = 24 * 60 * 60 * 1000;
const MIN_REMINDER_GAP_MS = 23 * 60 * 60 * 1000; // floor at 23 h to absorb cron drift

export interface ReminderCandidate {
  invitationSentAt: Date;
  remindersSent: number;
  lastReminderAt: Date | null;
}

/**
 * Decide whether to send a reminder right now, and which tier.
 * Returns the tier (1/2/3) to send, or `null` to skip.
 */
export function nextReminderTier(
  c: ReminderCandidate,
  now: Date = new Date()
): ReminderTier | null {
  // Don't send two reminders within 24 hours, no matter what.
  if (
    c.lastReminderAt &&
    now.getTime() - c.lastReminderAt.getTime() < MIN_REMINDER_GAP_MS
  ) {
    return null;
  }

  const daysSinceSent = (now.getTime() - c.invitationSentAt.getTime()) / DAY_MS;

  if (daysSinceSent >= REMINDER_DAYS[3] && c.remindersSent < 3) return 3;
  if (daysSinceSent >= REMINDER_DAYS[2] && c.remindersSent < 2) return 2;
  if (daysSinceSent >= REMINDER_DAYS[1] && c.remindersSent < 1) return 1;

  return null;
}
