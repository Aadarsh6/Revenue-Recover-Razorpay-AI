-- AlterEnum
ALTER TYPE "RecoveryStatus" ADD VALUE 'RECOVERY_EXPIRED';

-- AlterTable
ALTER TABLE "AIAnalysis" ADD COLUMN     "completionTokens" INTEGER,
ADD COLUMN     "estimatedCost" DOUBLE PRECISION,
ADD COLUMN     "promptTokens" INTEGER,
ADD COLUMN     "totalTokens" INTEGER;

-- AlterTable
ALTER TABLE "RecoveryCase" ADD COLUMN     "amount" INTEGER,
ADD COLUMN     "recoveredAt" TIMESTAMP(3);
