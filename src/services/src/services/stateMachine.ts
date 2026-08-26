
import dotenv from "dotenv"
import Razorpay from "razorpay"

dotenv.config()

const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID!,
    key_secret: process.env.RAZORPAY_KEY_SECRET!  //!  (meaning of !) Trust me. This definitely exists and is not undefined
});

export type StateDecision =
      "VALID_FAILURE"
    | "ALREADY_CAPTURED"
    | "ALREADY_REFUNDED"
    | "INVALID_STATE"
    | "NOT_FOUND";


export async function validateState(webhookPayload: any): Promise<{decision: StateDecision; livePayment?: any}>{
console.log("Running State Validator...");
  
  const eventType = webhookPayload.event;
  const paymentEntity = webhookPayload?.payload?.payment?.entity;

  if (!paymentEntity || !paymentEntity.id) {
    return { decision: "INVALID_STATE" };
  }

  // 1. Fetch the LIVE state from Razorpay API
  try {
    const livePayment = await razorpay.payments.fetch(paymentEntity.id);

    // 2. Explicit State Validation Switch
    switch (livePayment.status) {
      case 'failed':
        console.log("VALID_FAILURE: Webhook matches live Razorpay state.");
        return { decision: "VALID_FAILURE", livePayment };
        
      case 'captured':
        console.log("ALREADY_CAPTURED: Webhook is stale. Payment is already captured.");
        return { decision: "ALREADY_CAPTURED" };
        
      case 'refunded':
        console.log("ALREADY_REFUNDED: Payment was already refunded.");
        return { decision: "ALREADY_REFUNDED" };
        
      default:
        console.log(`INVALID_STATE: Live state is ${livePayment.status}, expected 'failed'.`);
        return { decision: "INVALID_STATE" };
    }
  } catch (error: any) {
    // Handle API errors (e.g., payment ID doesn't exist)
    if (error.statusCode === 400 || error.statusCode === 404) {
      console.log("NOT_FOUND: Payment ID does not exist in Razorpay.");
      return { decision: "NOT_FOUND" };
    }
    // Throw unexpected errors to be caught by our outer try/catch block
    throw error; 
  }
}