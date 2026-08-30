export interface AuditLog {
  id: number;
  event: string;
  createdAt: string;
  metadata?: Record<string, unknown>;
}

export interface AIAnalysis {
  diagnosis: string;
  recommendedAction: string;
  riskLevel: string;
  evidence: string[];
}

export interface RecoveryAttempt {
  recoveryUrl: string | null;
  status: string | null;
  errorMessage: string | null;
}

export interface RecoveryCase {
  id: number;
  paymentId: string;
  status: string;
  liveState: string;
  aiDiagnosis: string | null;
  aiAction: string | null;
  policyDecision: string | null;
  createdAt: string;
  aiAnalysis: AIAnalysis[] | null;
  recoveryAttempt: RecoveryAttempt | null;
  auditLogs: AuditLog[];
}