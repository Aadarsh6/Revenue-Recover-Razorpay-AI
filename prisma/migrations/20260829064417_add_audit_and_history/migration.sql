-- CreateTable
CREATE TABLE "AIAnalysis" (
    "id" SERIAL NOT NULL,
    "recoveryCaseId" INTEGER NOT NULL,
    "diagnosis" TEXT NOT NULL,
    "evidence" TEXT[],
    "recommendedAction" TEXT NOT NULL,
    "riskLevel" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AIAnalysis_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentRecord" (
    "id" SERIAL NOT NULL,
    "paymentId" TEXT NOT NULL,
    "contact" TEXT,
    "email" TEXT,
    "amount" INTEGER NOT NULL,
    "currency" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaymentRecord_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AIAnalysis_recoveryCaseId_key" ON "AIAnalysis"("recoveryCaseId");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentRecord_paymentId_key" ON "PaymentRecord"("paymentId");

-- AddForeignKey
ALTER TABLE "AIAnalysis" ADD CONSTRAINT "AIAnalysis_recoveryCaseId_fkey" FOREIGN KEY ("recoveryCaseId") REFERENCES "RecoveryCase"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
