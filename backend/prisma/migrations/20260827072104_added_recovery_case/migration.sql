-- CreateEnum
CREATE TYPE "RecoveryStatus" AS ENUM ('OPEN', 'AI_PROCESSING', 'PENDING_HUMAN_REVIEW', 'AUTO_RECOVERED', 'BLOCKED', 'FAILED');

-- CreateEnum
CREATE TYPE "WebhookEventStatus" AS ENUM ('PENDING', 'PROCESSED', 'IGNORED', 'FAILED');

-- CreateTable
CREATE TABLE "RecoveryCase" (
    "id" SERIAL NOT NULL,
    "paymentId" TEXT NOT NULL,
    "webhookEventId" INTEGER NOT NULL,
    "status" "RecoveryStatus" NOT NULL DEFAULT 'OPEN',
    "liveState" TEXT NOT NULL,
    "aiDiagnosis" TEXT,
    "aiAction" TEXT,
    "policyDecision" TEXT,
    "ceratedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RecoveryCase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WebhookEvent" (
    "id" SERIAL NOT NULL,
    "eventId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "status" "WebhookEventStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),

    CONSTRAINT "WebhookEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RecoveryCase_paymentId_key" ON "RecoveryCase"("paymentId");

-- CreateIndex
CREATE UNIQUE INDEX "RecoveryCase_webhookEventId_key" ON "RecoveryCase"("webhookEventId");

-- CreateIndex
CREATE UNIQUE INDEX "WebhookEvent_eventId_key" ON "WebhookEvent"("eventId");

-- AddForeignKey
ALTER TABLE "RecoveryCase" ADD CONSTRAINT "RecoveryCase_webhookEventId_fkey" FOREIGN KEY ("webhookEventId") REFERENCES "WebhookEvent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
