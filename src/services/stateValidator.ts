import Razorpay from 'razorpay';

export type LivePayment = {
  id: string;
  status: string;
  amount: number;
  currency: string;
  method: string;
  order_id: string | null;
  email?: string;
  contact?: string;
  error_reason?: string | null;
  notes?: any;
};

export type StateDecision = 
  | { decision: 'VALID_FAILURE'; livePayment: LivePayment }
  | { decision: 'VALID_CAPTURE'; livePayment: LivePayment }
  | { decision: 'ALREADY_CAPTURED'; livePayment: LivePayment }
  | { decision: 'INVALID_EVENT' }
  | { decision: 'INVALID_STATE' }
  | { decision: 'API_ERROR' };

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID!,
  key_secret: process.env.RAZORPAY_KEY_SECRET!
});

export async function validateState(eventType: string, paymentId: string): Promise<StateDecision> {
  // 1. Handle payment.failed
  if (eventType === 'payment.failed') {
    try {
      const livePayment = await razorpay.payments.fetch(paymentId) as LivePayment;
      
      if (livePayment.status === 'captured') {
        console.warn(`[StateValidator] 🛑 GUARD TRIGGERED: Webhook was payment.failed, but live state is captured for ${paymentId}`);
        return { decision: 'ALREADY_CAPTURED', livePayment };
      }
      if (livePayment.status === 'failed') {
        console.log(`[StateValidator] ✅ VALID_FAILURE confirmed for ${paymentId}`);
        return { decision: 'VALID_FAILURE', livePayment };
      }
      
      console.warn(`[StateValidator] Unexpected state '${livePayment.status}' for ${paymentId}`);
      return { decision: 'INVALID_STATE' };
    } catch (error) {
      console.error(`[StateValidator] Razorpay API error fetching ${paymentId}:`, error);
      return { decision: 'API_ERROR' };
    }
  }

  // 2. Handle payment.captured (Closing the Loop)
  if (eventType === 'payment.captured') {
    try {
      const livePayment = await razorpay.payments.fetch(paymentId) as LivePayment;
      if (livePayment.status === 'captured') {
        console.log(`[StateValidator] ✅ VALID_CAPTURE confirmed for ${paymentId}`);
        return { decision: 'VALID_CAPTURE', livePayment };
      }
      return { decision: 'INVALID_STATE' };
    } catch (error) {
      console.error(`[StateValidator] Razorpay API error fetching ${paymentId}:`, error);
      return { decision: 'API_ERROR' };
    }
  }

  // 3. Ignore other events for now
  console.log(`[StateValidator] Ignoring event type: ${eventType}`);
  return { decision: 'INVALID_EVENT' };
}