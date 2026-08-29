import { AggregatedContext } from './contextAggregator';

export interface AIAnalysisResult {
  diagnosis: string;
  evidence: string[];
  recommended_action: 'CREATE_RECOVERY_LINK' | 'SEND_INVOICE_NOTIFICATION' | 'ESCALATE_HUMAN' | 'BLOCK';
  risk_level: 'LOW' | 'MEDIUM' | 'HIGH';
}

export class AIAnalystService {
  private apiKey: string;
  private endpoint = 'https://api.groq.com/openai/v1/chat/completions';
  private model = 'qwen/qwen3.6-27b';
  
  constructor() {
    this.apiKey = process.env.GROQ_API_KEY || '';
    if (!this.apiKey) {
      throw new Error('GROQ_API_KEY is missing in environment variables');
    }
  }

  



  async analyzeFailure(context: AggregatedContext): Promise<AIAnalysisResult> {
    const prompt = this.constructPrompt(context);

    try {
      const response = await fetch(this.endpoint, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: this.model,
          messages: [
            { role: "system", content: "You are an expert Fintech AI. You output ONLY valid JSON, with no markdown formatting." },
            { role: "user", content: prompt }
          ],
          // Removed response_format to prevent 400 API errors
          temperature: 0.1,
          max_tokens: 1024
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Groq API error: ${response.status} ${errorText}`);
      }

      const data = await response.json();
      let responseText = data.choices[0].message.content;

    //    console.log("[AI Analyst] Raw Groq Response:", responseText);

      // Manual extraction: find the LAST { and the LAST } to skip reasoning text
      const lastBrace = responseText.lastIndexOf('{');
      const lastClosingBrace = responseText.lastIndexOf('}');
      
      if (lastBrace !== -1 && lastClosingBrace !== -1) {
        responseText = responseText.substring(lastBrace, lastClosingBrace + 1);
      }

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
      console.error('[AI Analyst] Error calling Groq API:', error);
      return {
        diagnosis: 'ai_analysis_exception',
        evidence: ['Groq API call failed or returned malformed JSON'],
        recommended_action: 'ESCALATE_HUMAN',
        risk_level: 'HIGH'
      };
    }
  }

  private constructPrompt(context: AggregatedContext): string {
    return `
      Analyze the following clean context JSON of a failed payment and diagnose the most likely reason for failure.
      Based on the customer's history, recommend a safe action to recover this revenue.

      CLEAN CONTEXT:
      ${JSON.stringify(context, null, 2)}

      INSTRUCTIONS:
      1. "diagnosis": A short snake_case string identifying the issue (e.g., "payment_method_mismatch").
      2. "evidence": An array of SHORT strings explaining WHY (e.g., ["Failed via card", "4 past UPI successes"]).
      3. "recommended_action": MUST be exactly one of ["CREATE_RECOVERY_LINK", "SEND_INVOICE_NOTIFICATION", "ESCALATE_HUMAN", "BLOCK"].
      4. "risk_level": MUST be exactly one of ["LOW", "MEDIUM", "HIGH"].

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
      // Ensure every item in the array is a string
      result.evidence.every((item: any) => typeof item === 'string') &&
      validActions.includes(result.recommended_action) &&
      validRisks.includes(result.risk_level)
    );
  }
}