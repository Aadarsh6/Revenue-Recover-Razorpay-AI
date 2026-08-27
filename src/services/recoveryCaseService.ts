import prisma from '../lib/prismaClient';
import { StateDecision } from './stateValidator';
import { RecoveryStatus } from '../generated/prisma/client';

const INITIAL_STATUS_MAP: Record<StateDecision['decision'], RecoveryStatus> = {
  VALID_FAILURE: 'OPEN',
  ALREADY_CAPTURED: 'BLOCKED',
  API_ERROR: 'FAILED',
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
  const recoveryCase = await prisma.recoveryCase.upsert({
    where: { paymentId },
    update: {}, // If it exists, don't change anything, just return it
    create: {
      paymentId,
      webhookEventId,
      status: INITIAL_STATUS_MAP[stateResult.decision],
      liveState,
    },
  });

  console.log(
    `[RecoveryCase] Case ${recoveryCase.id} for payment ${paymentId}. Status: ${recoveryCase.status}`
  );

  return recoveryCase;
}