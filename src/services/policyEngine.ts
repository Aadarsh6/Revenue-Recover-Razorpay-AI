import { AIAnalysisResult } from './aiAnalyst';
import { LivePayment } from './stateValidator';
import prisma from '../lib/prismaClient';

export type PolicyDecision = 'AUTO' | 'HUMAN' | 'BLOCK';

export interface PolicyResult {
  decision: PolicyDecision;
  reason: string;
}

export async function evaluatePolicy(
  recoveryCaseId: number,
  livePayment: LivePayment,
  aiResult: AIAnalysisResult
): Promise<PolicyResult> {
  
  // 1. Guard Clause: Is the payment still actually failed?
  // The AI might have taken 2 seconds to respond. What if the customer paid in those 2 seconds?
  if (livePayment.status !== 'failed') {
    return { 
      decision: 'BLOCK', 
      reason: `Live payment status is now ${livePayment.status}. Aborting to prevent duplicate collection.` 
    };
  }

  // 2. Guard Clause: Has the AI recommended something unsafe?
  if (aiResult.recommended_action === 'BLOCK' || aiResult.recommended_action === 'ESCALATE_HUMAN') {
    return { 
      decision: 'HUMAN', 
      reason: `AI explicitly requested ${aiResult.recommended_action}.` 
    };
  }

  // 3. Guard Clause: Is the risk level too high for autonomous action?
  if (aiResult.risk_level === 'HIGH') {
    return { 
      decision: 'HUMAN', 
      reason: 'AI risk level is HIGH. Requires human review.' 
    };
  }

  // 4. Guard Clause: Have we already attempted recovery for this case?
  // (This prevents spamming the customer if we receive multiple webhooks for the same failure)
  const existingCase = await prisma.recoveryCase.findUnique({
    where: { id: recoveryCaseId }
  });

  if (existingCase && (existingCase.status === 'AUTO_RECOVERED' || existingCase.status === 'PENDING_HUMAN_REVIEW')) {
    return { 
      decision: 'BLOCK', 
      reason: `RecoveryCase ${recoveryCaseId} is already in status ${existingCase.status}.` 
    };
  }

  // 5. If all checks pass, authorize autonomous execution
  return { 
    decision: 'AUTO', 
    reason: `AI recommended ${aiResult.recommended_action} with ${aiResult.risk_level} risk. All policy checks passed.` 
  };
}