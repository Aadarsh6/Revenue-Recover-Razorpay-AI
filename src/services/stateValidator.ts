import Razorpay from 'razorpay';

// Fix 2: Strict typing for the live payment state
export type LivePayment = {
  id: string;
  status: string; // 'captured', 'failed', 'attempted', etc.
  amount: number; // in paise
  currency: string;
  method: string;
  order_id: string | null;
};

export type StateDecision = 
  | { decision: 'VALID_FAILURE'; livePayment: LivePayment }
  | { decision: 'ALREADY_CAPTURED'; livePayment: LivePayment }
  | { decision: 'INVALID_EVENT' }
  | { decision: 'INVALID_STATE' }
  | { decision: 'API_ERROR' };

// Initialize Razorpay instance
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID!,
  key_secret: process.env.RAZORPAY_KEY_SECRET!
});

// Fix 1 & 3: Standalone function acting as our State Validator
export async function validateState(eventType: string, paymentId: string): Promise<StateDecision> {
  // Explicit event routing
  if (eventType !== 'payment.failed') {
    console.log(`[StateValidator] Ignoring event type: ${eventType}`);
    return { decision: 'INVALID_EVENT' };
  }

  try {
    // Fetch live state from Razorpay API
    const livePayment = await razorpay.payments.fetch(paymentId) as LivePayment;

    // THE GUARD CASE: Webhook says failed, but Razorpay API says captured.
    if (livePayment.status === 'captured') {
      console.warn(`[StateValidator] 🛑 GUARD TRIGGERED: Webhook was payment.failed, but live state is captured for ${paymentId}`);
      return { decision: 'ALREADY_CAPTURED', livePayment };
    }

    // Happy path: Webhook says failed, Razorpay agrees
    if (livePayment.status === 'failed') {
      console.log(`[StateValidator] ✅ VALID_FAILURE confirmed for ${paymentId}`);
      return { decision: 'VALID_FAILURE', livePayment };
    }

    // If it's 'attempted' or any other state, it's not a confirmed failure. Do not process.
    console.warn(`[StateValidator] Unexpected state '${livePayment.status}' for ${paymentId}`);
    return { decision: 'INVALID_STATE' };

  } catch (error) {
    console.error(`[StateValidator] Razorpay API error fetching ${paymentId}:`, error);
    return { decision: 'API_ERROR' };
  }
}