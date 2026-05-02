-- Phase 0.E rename: Organisation → Operator, Operator → PlatformAdmin.
-- Preserves all data. Order matters: rename the OLD Operator first
-- (to PlatformAdmin) so that name is free when we rename Organisation.

-- ============================================================================
-- 1. OLD `Operator` → `PlatformAdmin`
-- ============================================================================

ALTER TABLE "Operator" RENAME TO "PlatformAdmin";
ALTER TABLE "PlatformAdmin" RENAME CONSTRAINT "Operator_pkey" TO "PlatformAdmin_pkey";
ALTER INDEX "Operator_email_key" RENAME TO "PlatformAdmin_email_key";

-- OperatorSession → PlatformAdminSession; column operatorId → platformAdminId
ALTER TABLE "OperatorSession" RENAME TO "PlatformAdminSession";
ALTER TABLE "PlatformAdminSession" RENAME COLUMN "operatorId" TO "platformAdminId";
ALTER TABLE "PlatformAdminSession" RENAME CONSTRAINT "OperatorSession_pkey" TO "PlatformAdminSession_pkey";
ALTER TABLE "PlatformAdminSession" RENAME CONSTRAINT "OperatorSession_operatorId_fkey" TO "PlatformAdminSession_platformAdminId_fkey";
ALTER INDEX "OperatorSession_operatorId_idx" RENAME TO "PlatformAdminSession_platformAdminId_idx";

-- OperatorLoginToken → PlatformAdminLoginToken
ALTER TABLE "OperatorLoginToken" RENAME TO "PlatformAdminLoginToken";
ALTER TABLE "PlatformAdminLoginToken" RENAME CONSTRAINT "OperatorLoginToken_pkey" TO "PlatformAdminLoginToken_pkey";
ALTER INDEX "OperatorLoginToken_tokenHash_key" RENAME TO "PlatformAdminLoginToken_tokenHash_key";
ALTER INDEX "OperatorLoginToken_email_idx" RENAME TO "PlatformAdminLoginToken_email_idx";

-- ============================================================================
-- 2. `Organisation` → `Operator` (now safe, the old Operator is gone)
-- ============================================================================

ALTER TABLE "Organisation" RENAME TO "Operator";
ALTER TABLE "Operator" RENAME CONSTRAINT "Organisation_pkey" TO "Operator_pkey";

-- Site.organisationId → Site.operatorId
ALTER TABLE "Site" RENAME COLUMN "organisationId" TO "operatorId";
ALTER TABLE "Site" RENAME CONSTRAINT "Site_organisationId_fkey" TO "Site_operatorId_fkey";
ALTER INDEX "Site_organisationId_idx" RENAME TO "Site_operatorId_idx";

-- Respondent.organisationId → Respondent.operatorId
-- Respondent.isSiteAdmin → Respondent.isOperatorAdmin
ALTER TABLE "Respondent" RENAME COLUMN "organisationId" TO "operatorId";
ALTER TABLE "Respondent" RENAME COLUMN "isSiteAdmin" TO "isOperatorAdmin";
ALTER TABLE "Respondent" RENAME CONSTRAINT "Respondent_organisationId_fkey" TO "Respondent_operatorId_fkey";
ALTER INDEX "Respondent_organisationId_idx" RENAME TO "Respondent_operatorId_idx";
ALTER INDEX "Respondent_organisationId_email_key" RENAME TO "Respondent_operatorId_email_key";

-- ============================================================================
-- 3. AuditLog actor type rename
--    Existing rows recorded `actorType: 'operator'` for what is now a platform admin.
--    Update them in place — text column, no FK.
-- ============================================================================

UPDATE "AuditLog" SET "actorType" = 'platform_admin' WHERE "actorType" = 'operator';
