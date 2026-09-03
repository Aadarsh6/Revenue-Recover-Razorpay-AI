import Razorpay from 'razorpay';
import { AIAnalysisResult } from './aiAnalyst';
import { LivePayment } from './stateValidator';

export class ExecutionLayer {
  private razorpay: Razorpay;

  constructor() {
    this.razorpay = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID!,
      key_secret: process.env.RAZORPAY_KEY_SECRET!
    });
  }

  async executeAction(
    livePayment: LivePayment,
    aiResult: AIAnalysisResult,
    recoveryCaseId: number
  ): Promise<{ success: boolean; razorpayResponse?: any; error?: string }> {
    
    console.log(`[Execution Layer] Executing action: ${aiResult.recommended_action} for Case ${recoveryCaseId}`);
    try {
      if (aiResult.recommended_action === 'CREATE_RECOVERY_LINK') {
        const payload: any = {
          amount: livePayment.amount,
          currency: livePayment.currency,
          accept_partial: false,
          description: `Recovery for failed payment ${livePayment.id}`,
          customer: {
            contact: livePayment.contact || undefined,
            email: livePayment.email || undefined,
          },
          // STEP 7: Embed original payment ID and Case ID for tracking!
          notes: {
            original_failed_payment_id: livePayment.id,
            revive_recovery_case_id: recoveryCaseId.toString(),
            revive_ai_diagnosis: aiResult.diagnosis
          },
          options: {
            checkout: {
              methods: {
                upi: true,
                card: true,
                netbanking: true,
              }
            }
          }
        };

        // Configurable TTL so recovery opportunities expire (demo: lower in .env)
                const ttlMinutes = Number(process.env.RECOVERY_LINK_TTL_MINUTES || 60);
        console.log(`[Execution Layer] Recovery link TTL: ${ttlMinutes} min`);
        if (ttlMinutes > 0) {
          payload.expire_by = Math.floor(Date.now() / 1000) + ttlMinutes * 60;
        }


        const paymentLink: any = await this.razorpay.paymentLink.create(payload);
        
        console.log(`[Execution Layer] ✅ Recovery Link Created: ${paymentLink.short_url}`);
        return { success: true, razorpayResponse: paymentLink };

      } else if (aiResult.recommended_action === 'SEND_INVOICE_NOTIFICATION') {
        console.log(`[Execution Layer] ✅ Simulated Invoice Notification sent.`);
        return { success: true, razorpayResponse: { simulated: true } };
      } else {
        return { success: false, error: 'Action not supported by Execution Layer' };
      }

    } catch (error: any) {
      console.error(`[Execution Layer] ❌ Razorpay API Error:`, error.error?.description || error.message);
      return { success: false, error: error.error?.description || 'Razorpay API failed' };
    }
  }
}