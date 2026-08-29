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
    aiResult: AIAnalysisResult
  ): Promise<{ success: boolean; razorpayResponse?: any; error?: string }> {
    
    console.log(`[Execution Layer] Executing action: ${aiResult.recommended_action} for payment ${livePayment.id}`);

    try {
      if (aiResult.recommended_action === 'CREATE_RECOVERY_LINK') {
        // Cast payload to any to bypass SDK type strictness on 'methods'
        const payload: any = {
          amount: livePayment.amount,
          currency: livePayment.currency,
          accept_partial: false,
          description: `Recovery for failed payment ${livePayment.id}`,
          customer: {
            contact: livePayment.contact || undefined,
            email: livePayment.email || undefined,
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

        // Cast response to any to access short_url safely
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