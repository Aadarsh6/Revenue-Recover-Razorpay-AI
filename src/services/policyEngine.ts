import Razorpay from 'razorpay';
import { AIAnalysisResult } from './aiAnalyst';
import { LivePayment } from './stateValidator';
import prisma from '../lib/prismaClient';

export type PolicyDecision = 'AUTO' | 'HUMAN' | 'BLOCK';

export interface PolicyResult {
  decision: PolicyDecision;
  reason: string;
}

// The Explicit Policy Matrix
const POLICY_MATRIX: Record<AIAnalysisResult['recommended_action'], Record<AIAnalysisResult['risk_level'], PolicyDecision>> = {
  CREATE_RECOVERY_LINK: { LOW: 'AUTO', MEDIUM: 'AUTO', HIGH: 'HUMAN' },
  SEND_INVOICE_NOTIFICATION: { LOW: 'AUTO', MEDIUM: 'AUTO', HIGH: 'HUMAN' },
  ESCALATE_HUMAN: { LOW: 'HUMAN', MEDIUM: 'HUMAN', HIGH: 'HUMAN' },
  BLOCK: { LOW: 'BLOCK', MEDIUM: 'BLOCK', HIGH: 'BLOCK' }
};

export async function evaluatePolicy(
  recoveryCaseId: number,
  paymentId: string,
  aiResult: AIAnalysisResult
): Promise<PolicyResult> {
  
  // 1. 🔥 RE-FETCH LIVE RAZORPAY STATE IMMEDIATELY BEFORE EXECUTION
  try {
    const razorpay = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID!,
      key_secret: process.env.RAZORPAY_KEY_SECRET!
    });

    const freshLivePayment = await razorpay.payments.fetch(paymentId) as LivePayment;

    if (freshLivePayment.status !== 'failed') {
      return { 
        decision: 'BLOCK', 
        reason: `🛑 RACE CONDITION CAUGHT: Live payment status is now ${freshLivePayment.status}. Aborting to prevent duplicate collection.` 
      };
    }
   } catch (error: any) {
    console.error("[PolicyEngine] Razorpay API Error:", error.error?.description || error.message);
    return { decision: 'BLOCK', reason: 'Failed to re-fetch live state from Razorpay. Aborting for safety.' };
  }

  // 2. Check if we already attempted recovery
  const existingCase = await prisma.recoveryCase.findUnique({
    where: { id: recoveryCaseId }
  });

  if (existingCase && (existingCase.status === 'PENDING_EXECUTION' || existingCase.status === 'PENDING_HUMAN_REVIEW')) {
    return { 
      decision: 'BLOCK', 
      reason: `RecoveryCase ${recoveryCaseId} is already in status ${existingCase.status}.` 
    };
  }

  // 3. Evaluate using the Explicit Policy Matrix
  const decision = POLICY_MATRIX[aiResult.recommended_action][aiResult.risk_level];

  if (decision === 'AUTO') {
    return { decision: 'AUTO', reason: `Policy Matrix allows ${aiResult.recommended_action} with ${aiResult.risk_level} risk. Live state verified.` };
  } else if (decision === 'HUMAN') {
    return { decision: 'HUMAN', reason: `Policy Matrix requires human review for ${aiResult.recommended_action} with ${aiResult.risk_level} risk.` };
  } else {
    return { decision: 'BLOCK', reason: `Policy Matrix blocked action.` };
  }
}