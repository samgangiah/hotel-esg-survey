-- Reminder cadence columns
ALTER TABLE "Invitation"
  ADD COLUMN "remindersSent"  INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "lastReminderAt" TIMESTAMP(3);
