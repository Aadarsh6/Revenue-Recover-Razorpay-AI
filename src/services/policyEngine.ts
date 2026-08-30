import { AIAnalysisResult } from './aiAnalyst';
import { LivePayment, PaymentStatus } from './stateValidator';
import Razorpay from 'razorpay';
import prisma from '../lib/prismaClient';

export type PolicyDecision = 'AUTO' | 'HUMAN' | 'BLOCK';

export interface PolicyResult {
  decision: PolicyDecision;
  reason: string;
}

// Explicit Action/State Compatibility Matrix
const ALLOWED_ACTIONS: Record<PaymentStatus, AIAnalysisResult['recommended_action'][]> = {
  failed: ['CREATE_RECOVERY_LINK', 'SEND_INVOICE_NOTIFICATION', 'ESCALATE_HUMAN', 'BLOCK'],
  captured: [], // No recovery actions allowed if already captured
  authorized: [],
  refunded: [],
  created: []
};

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
  
  // 1. 🔥 RE-FETCH LIVE RAZORPAY STATE
  let freshLivePayment: LivePayment;
  try {
    const razorpay = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID!,
      key_secret: process.env.RAZORPAY_KEY_SECRET!
    });
    freshLivePayment = await razorpay.payments.fetch(paymentId) as LivePayment;
  } catch (error) {
    return { decision: 'BLOCK', reason: 'Failed to re-fetch live state. Aborting.' };
  }

  // 2. ACTION-STATE COMPATIBILITY CHECK
  const allowed = ALLOWED_ACTIONS[freshLivePayment.status] || [];
  if (!allowed.includes(aiResult.recommended_action)) {
    return { 
      decision: 'BLOCK', 
      reason: `🛑 GUARD: Action ${aiResult.recommended_action} is not allowed for payment state ${freshLivePayment.status}.` 
    };
  }

  // 3. CHECK TERMINAL CASE STATUSES
  const existingCase = await prisma.recoveryCase.findUnique({ where: { id: recoveryCaseId } });
  if (existingCase && ['RECOVERY_LINK_CREATED', 'AUTO_RECOVERED', 'PENDING_HUMAN_REVIEW', 'BLOCKED'].includes(existingCase.status)) {
    return { decision: 'BLOCK', reason: `Case ${recoveryCaseId} already in terminal status ${existingCase.status}.` };
  }

  // 4. EVALUATE POLICY MATRIX
  const decision = POLICY_MATRIX[aiResult.recommended_action][aiResult.risk_level];

  if (decision === 'AUTO') return { decision: 'AUTO', reason: `Policy Matrix allows ${aiResult.recommended_action} with ${aiResult.risk_level} risk.` };
  if (decision === 'HUMAN') return { decision: 'HUMAN', reason: `Policy Matrix requires human review for ${aiResult.recommended_action} with ${aiResult.risk_level} risk.` };
  return { decision: 'BLOCK', reason: 'Policy Matrix blocked action.' };
}