import prisma from '../lib/prismaClient';

export async function logAudit(event: string, caseId?: number, metadata?: any): Promise<{ id: number } | null> {
  try {
    const row = await prisma.auditLog.create({
      data: {
        event,
        caseId,
        metadata: metadata || undefined
      }
    });
    return { id: row.id };
  } catch (error) {
    console.error("Failed to write audit log:", error);
    return null;
  }
}