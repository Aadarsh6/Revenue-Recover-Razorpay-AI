import prisma from '../lib/prismaClient';
import { StateDecision } from './stateValidator';
import { RecoveryStatus } from '../generated/prisma/client';

const INITIAL_STATUS_MAP: Record<StateDecision['decision'], RecoveryStatus> = {
  VALID_FAILURE: 'OPEN',
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
  // Safely check if livePayment exists on this specific union branch
  const liveState = 'livePayment' in stateResult 
    ? stateResult.livePayment.status 
    : 'unknown';

  const recoveryCase = await prisma.recoveryCase.create({
    data: {
      paymentId,
      webhookEventId,
      status: INITIAL_STATUS_MAP[stateResult.decision],
      liveState,
    },
  });

  console.log(
    `[RecoveryCase] Created Case ${recoveryCase.id} for payment ${paymentId}. Status: ${recoveryCase.status}`
  );

  return recoveryCase;
}