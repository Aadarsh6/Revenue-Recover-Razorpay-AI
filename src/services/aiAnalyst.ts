import { GoogleGenerativeAI } from '@google/generative-ai';
import { AggregatedContext } from './contextAggregator';

export interface AIAnalysisResult {
  diagnosis: string;
  evidence: string[];
  recommended_action: 'CREATE_RECOVERY_LINK' | 'SEND_INVOICE_NOTIFICATION' | 'ESCALATE_HUMAN' | 'BLOCK';
  risk_level: 'LOW' | 'MEDIUM' | 'HIGH';
}

export class AIAnalystService {
  private genAI: GoogleGenerativeAI;
  private model: any;

  constructor() {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY is missing in environment variables');
    }
    this.genAI = new GoogleGenerativeAI(apiKey);
    
    this.model = this.genAI.getGenerativeModel({
      model: 'gemini-1.5-flash',
      generationConfig: {
        responseMimeType: 'application/json',
      },
    });
  }

  async analyzeFailure(context: AggregatedContext): Promise<AIAnalysisResult> {
    const prompt = this.constructPrompt(context);

    try {
      const result = await this.model.generateContent(prompt);
      const responseText = result.response.text();
      
      const parsedResult = JSON.parse(responseText) as AIAnalysisResult;

      if (!this.validateAIResult(parsedResult)) {
        console.warn('[AI Analyst] AI returned invalid action/risk level. Escalating to human.');
        return {
          diagnosis: 'ai_output_validation_failed',
          evidence: ['AI returned an out-of-bounds recommended_action or risk_level'],
          recommended_action: 'ESCALATE_HUMAN',
          risk_level: 'HIGH'
        };
      }

      return parsedResult;

    } catch (error) {
      console.error('[AI Analyst] Error calling Gemini API:', error);
      return {
        diagnosis: 'ai_analysis_exception',
        evidence: ['Gemini API call failed or returned malformed JSON'],
        recommended_action: 'ESCALATE_HUMAN',
        risk_level: 'HIGH'
      };
    }
  }

  private constructPrompt(context: AggregatedContext): string {
    return `
      You are an expert Fintech Revenue Recovery AI. 
      Analyze the following clean context JSON of a failed payment and diagnose the most likely reason for failure.
      Based on the customer's history, recommend a safe action to recover this revenue.

      CLEAN CONTEXT:
      ${JSON.stringify(context, null, 2)}

      INSTRUCTIONS:
      1. "diagnosis": Provide a short snake_case string identifying the issue (e.g., "payment_method_mismatch", "insufficient_funds", "transient_bank_error").
      2. "evidence": An array of strings explaining WHY you made this diagnosis based on the context.
      3. "recommended_action": MUST be exactly one of ["CREATE_RECOVERY_LINK", "SEND_INVOICE_NOTIFICATION", "ESCALATE_HUMAN", "BLOCK"]. If customer has a preferred method different from failed method, use "CREATE_RECOVERY_LINK".
      4. "risk_level": MUST be exactly one of ["LOW", "MEDIUM", "HIGH"]. Low if customer has good history, High if unknown or suspicious.

      OUTPUT FORMAT: Strict JSON matching this TypeScript interface:
      {
        "diagnosis": string,
        "evidence": string[],
        "recommended_action": "CREATE_RECOVERY_LINK" | "SEND_INVOICE_NOTIFICATION" | "ESCALATE_HUMAN" | "BLOCK",
        "risk_level": "LOW" | "MEDIUM" | "HIGH"
      }
    `;
  }

  private validateAIResult(result: any): result is AIAnalysisResult {
    const validActions = ['CREATE_RECOVERY_LINK', 'SEND_INVOICE_NOTIFICATION', 'ESCALATE_HUMAN', 'BLOCK'];
    const validRisks = ['LOW', 'MEDIUM', 'HIGH'];
    
    return (
      result &&
      typeof result.diagnosis === 'string' &&
      Array.isArray(result.evidence) &&
      validActions.includes(result.recommended_action) &&
      validRisks.includes(result.risk_level)
    );
  }
}