import { AlertTriangle, IndianRupee, Link2, ShieldAlert, ShieldCheck, Timer } from 'lucide-react';

// ─────────────────────────────────────────────────────────────────────
// ⚠️ MIRROR OF BACKEND POLICY CONFIG — fill these 3 values with the
// REAL numbers from your engine so the UI never lies during judging.
// Also verify each rule below matches actual backend behavior.
// ─────────────────────────────────────────────────────────────────────
const ECONOMIC_FLOOR = '₹—';     // e.g. '₹50'
const LINK_EXPIRY_HOURS = '—';   // e.g. '24'
const MAX_RISK_FOR_AUTO = 'MEDIUM';

const RULES = [
  {
    icon: IndianRupee,
    name: 'Economic floor',
    rule: `Recoveries under ${ECONOMIC_FLOOR} are blocked`,
    detail: 'Below the floor, AI analysis is skipped entirely — recovery would cost more than the revenue it saves. Zero AI spend on low-value failures.',
  },
  {
    icon: ShieldCheck,
    name: 'Race-condition guard',
    rule: 'Live payment state is verified before any action',
    detail: 'If the original payment was captured after the failure webhook (a race), recovery is blocked — the customer is never charged twice.',
  },
  {
    icon: Link2,
    name: 'Single recovery link',
    rule: 'One active recovery link per failed payment',
    detail: 'A second link can never be generated for a case that already has one, making double-charging structurally impossible.',
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
    rule: `Recovery links expire after ${LINK_EXPIRY_HOURS} hours`,
    detail: 'Recovery opportunities close themselves. Expired cases are marked and archived — no stale links linger in customer inboxes.',
  },
];

export default function PolicyRules() {
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-[#0B1120] tracking-tight">Policy Rules</h1>
        <p className="text-sm text-[#58666E] mt-0.5">
          The AI recommends. The policy engine decides. Razorpay executes.
        </p>
      </div>

      <div className="bg-[#EAF1FE] border border-[#CFE0FB] rounded-lg p-4 mb-6 flex items-start gap-3">
        <ShieldCheck size={18} className="text-[#0E54CD] mt-0.5 shrink-0" />
        <p className="text-sm text-[#0E54CD]">
          Every recovery must pass all of these guardrails before a single rupee moves.
          The AI layer has no direct access to the Razorpay API — it can only suggest.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {RULES.map(r => (
          <div key={r.name} className="bg-white rounded-lg border border-[#EDEEF1] p-5">
            <div className="flex items-center gap-2.5 mb-3">
              <div className="w-7 h-7 rounded-md bg-[#F1F2F4] flex items-center justify-center shrink-0">
                <r.icon size={14} className="text-[#0E54CD]" />
              </div>
              <h2 className="text-sm font-semibold text-[#0B1120]">{r.name}</h2>
            </div>
            <div className="text-sm text-[#0B1120] font-medium mb-1.5">{r.rule}</div>
            <p className="text-xs text-[#58666E] leading-relaxed">{r.detail}</p>
          </div>
        ))}
      </div>
    </div>
  );
}