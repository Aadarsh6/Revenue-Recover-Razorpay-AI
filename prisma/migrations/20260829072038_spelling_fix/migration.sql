/*
  Warnings:

  - You are about to drop the column `ceratedAt` on the `RecoveryCase` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "RecoveryCase" DROP COLUMN "ceratedAt",
ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
