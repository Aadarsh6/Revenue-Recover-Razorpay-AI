import { Bot, AlertTriangle, Clock, ShieldX, UserSearch } from 'lucide-react';
import type { RecoveryCase } from '../types';
import { layerDoneClass, stageNeutralClass, stageOverrideClass, stageLineClass, type PipelineLayer } from '../Theme';

export default function CaseDetails({ c }: { c: RecoveryCase }) {
  // Derived audit facts — MUST be at component body level, not inside formatTime
  const stateAudit = c.auditLogs?.find(l => l.event === 'STATE_VALIDATED');
  const stateDecision = (stateAudit?.metadata as { decision?: string } | undefined)?.decision;

  const policyAudit = c.auditLogs?.find(l => l.event === 'POLICY_DECIDED');
  const floorAudit = c.auditLogs?.find(l => l.event === 'ECONOMIC_FLOOR_BLOCKED');
  const floorMeta = floorAudit?.metadata as { amount?: number; floor?: number } | undefined;
  const policyReason = (policyAudit?.metadata as { reason?: string } | undefined)?.reason;

  const blockedReason = floorMeta
    ? `Amount ₹${((floorMeta.amount ?? 0) / 100).toLocaleString('en-IN')} is below the economic floor (₹${((floorMeta.floor ?? 0) / 100).toLocaleString('en-IN')}). AI analysis skipped — recovery would cost more than it's worth.`
    : stateDecision === 'ALREADY_CAPTURED'
      ? 'Live payment was already captured on Razorpay (race condition guard).'
      : policyReason || 'Policy Engine blocked this recovery before execution.';

  const humanReason =
    stateDecision === 'API_ERROR'
      ? 'Live Razorpay state could not be verified (API error). System failed safe to human review.'
      : policyReason || 'AI flagged HIGH risk or requested escalation.';

  const has = (e: string) => c.auditLogs?.some(l => l.event === e);

  // Each stage carries the pipeline "layer" it belongs to, so the stepper
  // visually tells the recommend -> decide -> execute story, not just a
  // generic progress bar.
  const stages: { label: string; layer: PipelineLayer; done: boolean }[] = [
    { label: 'Webhook',   layer: 'system',  done: !!has('WEBHOOK_RECEIVED') },
    { label: 'State',     layer: 'system',  done: !!has('STATE_VALIDATED') },
    { label: 'AI',        layer: 'ai',      done: !!has('AI_ANALYSIS_COMPLETED') },
    { label: 'Policy',    layer: 'policy',  done: !!has('POLICY_DECIDED') || !!floorMeta },
    { label: 'Execute',   layer: 'execute', done: !!has('RECOVERY_LINK_CREATED') },
    { label: 'Recovered', layer: 'execute', done: c.status === 'AUTO_RECOVERED' },
  ];

  const overrideCls = stageOverrideClass(c.status);
  const lineCls = stageLineClass(c.status);

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  const haltNote =
    c.status === 'BLOCKED' ? 'Pipeline halted — guard fired, no money moved'
    : c.status === 'PENDING_HUMAN_REVIEW' ? 'Pipeline paused — awaiting human review'
    : c.status === 'RECOVERY_EXPIRED' ? 'Recovery opportunity expired'
    : c.status === 'FAILED' ? 'Execution failed — no money moved'
    : null;

  return (
    <tr className="bg-[#FAFBFC]">
      <td colSpan={7} className="p-6">
        <div className="grid grid-cols-2 gap-8">

          {/* Left Column: AI & Execution Details */}
          <div className="space-y-4 border-r border-[#EAECF0] pr-8">
            <div className="flex items-center gap-2">
              <span className="w-1 h-4 rounded-full" style={{ background: 'linear-gradient(180deg, #2872EF 0%, #6941C6 100%)' }} />
              <h3 className="text-sm font-semibold text-[#0B1120]">AI analysis &amp; execution</h3>
            </div>

            <div className="flex items-center gap-1 mb-4 flex-wrap">
              {stages.map((s, i) => (
                <div key={s.label} className="flex items-center gap-1">
                  {i > 0 && <div className={`w-4 h-px ${s.done ? lineCls : 'bg-[#EAECF0]'}`} />}
                  <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
                    s.done ? (overrideCls ?? layerDoneClass(s.layer)) : stageNeutralClass
                  }`}>{s.label}</span>
                </div>
              ))}
            </div>

            {haltNote && <div className="text-xs text-[#667085] -mt-2 mb-2">{haltNote}</div>}

            {/* SPECIAL CASE: BLOCKED */}
            {c.status === 'BLOCKED' && (
              <div className="bg-[#FEF3F2] border border-[#FECDCA] rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <ShieldX size={16} className="text-[#D92D20]" />
                  <span className="font-semibold text-[#912018] text-sm">Recovery blocked before execution</span>
                </div>
                <div className="text-xs text-[#B42318]">
                  <strong>Reason:</strong> {blockedReason}
                </div>
                <div className="text-xs text-[#B42318] mt-1">
                  {floorMeta
                    ? 'No AI cost incurred. No money moved.'
                    : stateDecision === 'ALREADY_CAPTURED'
                      ? 'No AI analysis was performed. No money moved.'
                      : 'No money moved.'}
                </div>
              </div>
            )}

            {/* SPECIAL CASE: PENDING HUMAN REVIEW */}
            {c.status === 'PENDING_HUMAN_REVIEW' && (
              <div className="bg-[#FFFAEB] border border-[#FEDF89] rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <UserSearch size={16} className="text-[#DC6803]" />
                  <span className="font-semibold text-[#93370D] text-sm">Escalated to human review</span>
                </div>
                <div className="text-xs text-[#B54708]">
                  <strong>Reason:</strong> {humanReason}
                </div>
                <div className="text-xs text-[#B54708] mt-1">
                  {stateDecision === 'API_ERROR'
                    ? 'AI analysis was not performed (upstream API failure). No money moved.'
                    : 'No autonomous recovery action was executed.'}
                </div>
              </div>
            )}

            {/* NORMAL CASE: AI ANALYSIS EXISTS */}
            {c.aiAnalysis && c.aiAnalysis.length > 0 && (
              <div className="bg-[#F4F3FF] border border-[#D9D6FE] rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Bot size={16} className="text-[#6941C6]" />
                  <span className="font-semibold text-[#42307D] text-sm">{c.aiAnalysis[0].diagnosis}</span>
                </div>
                <div className="text-xs text-[#5925DC] mb-2">
                  Recommended: <span className="font-mono font-semibold">{c.aiAnalysis[0].recommendedAction}</span>
                  <span className="mx-2">•</span>
                  Risk: <span className="font-mono font-semibold">{c.aiAnalysis[0].riskLevel}</span>
                </div>
                {c.aiAnalysis[0].evidence && c.aiAnalysis[0].evidence.length > 0 && (
                  <div className="mt-2 text-xs text-[#667085]">
                    <strong className="text-[#344054]">Evidence:</strong>
                    <ul className="list-disc list-inside mt-1 space-y-1">
                      {c.aiAnalysis[0].evidence.map((ev, i) => <li key={i}>{ev}</li>)}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {/* EXECUTION DETAILS (Only show if attempt was made) */}
            {c.recoveryAttempt && (
              <div className="bg-white border border-[#EAECF0] rounded-lg p-4">
                <h4 className="text-xs font-semibold text-[#667085] mb-2">Recovery attempt</h4>
                <div className="text-sm text-[#344054] space-y-1">
                  <div>Status: <span className="font-semibold text-[#0B1120]">{c.recoveryAttempt.status}</span></div>
                  {c.recoveryAttempt.recoveryUrl && (
                    <div>URL: <a href={c.recoveryAttempt.recoveryUrl} target="_blank" rel="noreferrer" className="text-[#2872EF] hover:text-[#0E54CD] hover:underline text-xs">{c.recoveryAttempt.recoveryUrl}</a></div>
                  )}
                  {c.recoveryAttempt.errorMessage && (
                    <div className="text-[#D92D20] text-xs flex items-center gap-1 mt-2">
                      <AlertTriangle size={12} /> Error: {c.recoveryAttempt.errorMessage}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Right Column: Audit Timeline */}
          <div className="pl-4">
            <div className="flex items-center gap-2 mb-4">
              <span className="w-1 h-4 rounded-full" style={{ background: 'linear-gradient(180deg, #2872EF 0%, #6941C6 100%)' }} />
              <h3 className="text-sm font-semibold text-[#0B1120]">Audit timeline</h3>
            </div>
            {c.auditLogs && c.auditLogs.length > 0 ? (
              <div className="relative border-l-2 border-[#EAECF0] pl-4 space-y-6">
                {c.auditLogs.map((log) => (
                  <div key={log.id} className="relative">
                    <div className="absolute -left-[1.65rem] top-1 w-3 h-3 rounded-full bg-[#2872EF] border-2 border-white"></div>
                    <div className="text-xs text-[#98A2B3] flex items-center gap-1">
                      <Clock size={10} /> {formatTime(log.createdAt)}
                    </div>
                    <div className="text-sm font-medium text-[#0B1120]">{log.event.replace(/_/g, ' ')}</div>
                    {log.metadata && Object.keys(log.metadata).length > 0 && (
                      <div className="text-xs text-[#667085] mt-1 bg-[#F2F4F7] rounded px-2 py-1 inline-block font-mono">
                        {JSON.stringify(log.metadata)}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-xs text-[#D92D20] font-semibold italic flex items-center gap-1">
                <AlertTriangle size={12} /> No audit logs found in data
              </div>
            )}
          </div>

        </div>
      </td>
    </tr>
  );
}