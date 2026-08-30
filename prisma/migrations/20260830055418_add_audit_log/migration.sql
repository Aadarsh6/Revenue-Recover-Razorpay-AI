-- CreateTable
CREATE TABLE "AuditLog" (
    "id" SERIAL NOT NULL,
    "caseId" INTEGER,
    "event" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "RecoveryCase"("id") ON DELETE SET NULL ON UPDATE CASCADE;
