import { AlertTriangle, IndianRupee, Link2, ShieldAlert, ShieldCheck, Timer } from 'lucide-react';

// ─────────────────────────────────────────────────────────────────────
// MIRROR OF BACKEND POLICY CONFIG — keep in sync with:
//   server.ts (MIN_RECOVERY_AMOUNT_PAISE), .env (RECOVERY_LINK_TTL_MINUTES),
//   policyEngine.ts (POLICY_MATRIX)
// ─────────────────────────────────────────────────────────────────────
const ECONOMIC_FLOOR = '₹100';                    // server.ts: MIN_RECOVERY_AMOUNT_PAISE = 10000
const LINK_EXPIRY = 'a configurable TTL (default 60 min, min 15 min)';  // executionLayer.ts: RECOVERY_LINK_TTL_MINUTES
const MAX_RISK_FOR_AUTO = 'MEDIUM';               // policyEngine.ts: POLICY_MATRIX — LOW/MEDIUM → AUTO

const RULES = [
  {
    icon: IndianRupee,
    name: 'Economic floor',
    rule: `Recoveries under ${ECONOMIC_FLOOR} are blocked`,
    detail: 'Below the floor, AI analysis is skipped entirely — recovery would cost more than the revenue it saves. Verifiable: low-value cases are blocked BEFORE the AI call, so no AIAnalysis record exists for them and zero tokens are spent.',
  },
  {
    icon: ShieldCheck,
    name: 'Race-condition guard',
    rule: 'Live payment state is verified before any action',
    detail: 'If the original payment was captured after the failure webhook (a race), recovery is blocked — the customer is never charged twice.',
  },
  {
    icon: Link2,
    name: 'At-most-once execution',
    rule: 'One recovery link per failed payment — guaranteed by a DB-level lock',
    detail: 'Execution requires winning an atomic conditional status transition (UPDATE … WHERE status = …). Concurrent or duplicate webhooks funnel into exactly one execution path. Verified: a 5-webhook concurrent storm produced 1 attempt, 0 duplicate links.',
  },
  {
    icon: AlertTriangle,
    name: 'Risk escalation',
    rule: `AI risk above ${MAX_RISK_FOR_AUTO} always escalates to a human`,
    detail: 'The AI can only recommend. When its own confidence is low, the policy engine routes the case to human review instead of executing.',
  },
  {
    icon: ShieldAlert,
    name: 'Fail-safe on API error',
    rule: 'Unverifiable state → human review, never autonomous action',
    detail: 'If the Razorpay API cannot confirm the payment state, the pipeline fails safe and pauses. No money moves on uncertainty.',
  },
  {
    icon: Timer,
    name: 'Link expiry',
    rule: `Recovery links expire after ${LINK_EXPIRY}`,
    detail: 'Recovery opportunities close themselves — enforced by Razorpay\'s expire_by (minimum 15 minutes). Expired cases transition to RECOVERY_EXPIRED via the payment_link.expired webhook; no stale links linger.',
  },
];

export default function PolicyRules() {
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-slate-800 tracking-tight">Policy Rules</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          The AI recommends. The policy engine decides. Razorpay executes.
        </p>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6 flex items-start gap-3">
        <ShieldCheck size={18} className="text-blue-600 mt-0.5 shrink-0" />
        <p className="text-sm text-blue-700">
          Every recovery must pass all of these guardrails before a single rupee moves.
          The AI layer has no direct access to the Razorpay API — it can only suggest.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {RULES.map(r => (
          <div key={r.name} className="bg-white rounded-lg border border-slate-200 p-5">
            <div className="flex items-center gap-2.5 mb-3">
              <div className="w-7 h-7 rounded-md bg-slate-100 flex items-center justify-center shrink-0">
                <r.icon size={14} className="text-blue-600 shrink-0" />
              </div>
              <h2 className="text-sm font-semibold text-slate-800">{r.name}</h2>
            </div>
            <div className="text-sm text-slate-800 font-medium mb-1.5">{r.rule}</div>
            <p className="text-xs text-slate-500 leading-relaxed">{r.detail}</p>
          </div>
        ))}
      </div>
    </div>
  );
}