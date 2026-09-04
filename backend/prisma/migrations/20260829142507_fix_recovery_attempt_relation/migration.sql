/*
  Warnings:

  - The values [RECOVERY_ACTION_COMPLETED] on the enum `RecoveryStatus` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "RecoveryStatus_new" AS ENUM ('OPEN', 'AI_PROCESSING', 'PENDING_EXECUTION', 'EXECUTING', 'RECOVERY_LINK_CREATED', 'PENDING_HUMAN_REVIEW', 'BLOCKED', 'FAILED');
ALTER TABLE "public"."RecoveryCase" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "RecoveryCase" ALTER COLUMN "status" TYPE "RecoveryStatus_new" USING ("status"::text::"RecoveryStatus_new");
ALTER TYPE "RecoveryStatus" RENAME TO "RecoveryStatus_old";
ALTER TYPE "RecoveryStatus_new" RENAME TO "RecoveryStatus";
DROP TYPE "public"."RecoveryStatus_old";
ALTER TABLE "RecoveryCase" ALTER COLUMN "status" SET DEFAULT 'OPEN';
COMMIT;
