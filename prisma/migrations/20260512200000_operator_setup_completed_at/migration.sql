-- Tracks when the customer has finished the first-run setup wizard
-- (named their hotel + confirmed buildings).
ALTER TABLE "Operator" ADD COLUMN "setupCompletedAt" TIMESTAMP(3);

-- Existing operators are already set up — backfill so the wizard doesn't
-- show retroactively for the pilot tenants.
UPDATE "Operator" SET "setupCompletedAt" = "createdAt" WHERE "setupCompletedAt" IS NULL;
