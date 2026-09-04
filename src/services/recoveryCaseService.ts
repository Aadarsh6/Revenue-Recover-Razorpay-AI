import prisma from '../lib/prismaClient';
import { StateDecision } from './stateValidator';
import { RecoveryStatus } from '../generated/prisma/client';
import { PrismaClientKnownRequestError } from '../generated/prisma/internal/prismaNamespace';
// import { PrismaClientKnownRequestError } from '@prisma/client/runtime/client';

const INITIAL_STATUS_MAP: Record<StateDecision['decision'], RecoveryStatus> = {
  VALID_FAILURE: 'OPEN',
  VALID_CAPTURE: 'OPEN', // We will handle this specially in server.ts
  ALREADY_CAPTURED: 'BLOCKED',
  API_ERROR: 'PENDING_HUMAN_REVIEW',
  INVALID_EVENT: 'BLOCKED',
  INVALID_STATE: 'BLOCKED',
};

export async function createRecoveryCase(
  webhookEventId: number,
  paymentId: string,
  stateResult: StateDecision
) {
  const liveState = 'livePayment' in stateResult 
    ? stateResult.livePayment.status 
    : 'unknown';

  // Use upsert to prevent crashing on duplicate payment webhooks
//!   create → always tries to insert a new row.
//!   upsert → update if the record exists, otherwise create it.
//! If the same webhook arrives again → updates the existing record instead of creating a duplicate.
//! That's one of the major reasons upsert is useful in backend systems.
  try {
    const recoveryCase = await prisma.recoveryCase.upsert({
      where: { paymentId },
      update: {},
      create: {
        paymentId,
        webhookEventId,
        status: INITIAL_STATUS_MAP[stateResult.decision],
        liveState,
      },
    });
    console.log(`[RecoveryCase] Case ${recoveryCase.id} for payment ${paymentId}. Status: ${recoveryCase.status}`);
    return recoveryCase;
  } catch (error) {
    if (error instanceof PrismaClientKnownRequestError && error.code === "P2002") {
      // Concurrent pipeline created the case first — attach to it; downstream guards handle the rest
      const existing = await prisma.recoveryCase.findUnique({ where: { paymentId } });
      console.log(`[RecoveryCase] Concurrent creation detected for ${paymentId} → attaching to Case ${existing?.id}`);
      return existing!;
    }
    throw error;
  }
}