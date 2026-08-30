import prisma from '../lib/prismaClient';

export async function logAudit(event: string, caseId?: number, metadata?: any) {
  try {
    await prisma.auditLog.create({
      data: {
        event,
        caseId,
        metadata: metadata || undefined
      }
    });
  } catch (error) {
    console.error("Failed to write audit log:", error);
  }
}