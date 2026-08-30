import { Bot, AlertTriangle, Clock } from 'lucide-react';
import type { RecoveryCase } from '../types';

export default function CaseDetails({ c }: { c: RecoveryCase }) {
  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  return (
    <tr className="bg-slate-50/50">
      <td colSpan={7} className="p-6">
        {/* Strict 2-column grid */}
        <div className="grid grid-cols-2 gap-8">
          
          {/* Left Column */}
          <div className="space-y-4 border-r border-slate-200 pr-8">
            <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wider">AI Analysis & Execution</h3>
            
            {c.aiAnalysis && c.aiAnalysis.length > 0 ? (
              <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Bot size={16} className="text-purple-600" />
                  <span className="font-semibold text-purple-900 text-sm">{c.aiAnalysis[0].diagnosis}</span>
                </div>
                <div className="text-xs text-purple-700 mb-2">
                  Recommended: <span className="font-mono font-bold">{c.aiAnalysis[0].recommendedAction}</span>
                  <span className="mx-2">•</span>
                  Risk: <span className="font-mono font-bold">{c.aiAnalysis[0].riskLevel}</span>
                </div>
                {c.aiAnalysis[0].evidence && c.aiAnalysis[0].evidence.length > 0 && (
                  <div className="mt-2 text-xs text-slate-600">
                    <strong>Evidence:</strong>
                    <ul className="list-disc list-inside mt-1 space-y-1">
                      {c.aiAnalysis[0].evidence.map((ev, i) => <li key={i}>{ev}</li>)}
                    </ul>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-xs text-slate-400 italic">No AI analysis recorded.</div>
            )}

            {c.recoveryAttempt && (
              <div className="bg-white border border-slate-200 rounded-lg p-4">
                <h4 className="text-xs font-bold text-slate-600 uppercase mb-2">Recovery Attempt</h4>
                <div className="text-sm text-slate-700 space-y-1">
                  <div>Status: <span className="font-semibold">{c.recoveryAttempt.status}</span></div>
                  {c.recoveryAttempt.recoveryUrl && (
                    <div>URL: <a href={c.recoveryAttempt.recoveryUrl} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline text-xs">{c.recoveryAttempt.recoveryUrl}</a></div>
                  )}
                  {c.recoveryAttempt.errorMessage && (
                    <div className="text-red-600 text-xs flex items-center gap-1 mt-2">
                      <AlertTriangle size={12} /> Error: {c.recoveryAttempt.errorMessage}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Right Column: Audit Timeline */}
          <div className="pl-4">
            <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wider mb-4">Audit Timeline</h3>
            {c.auditLogs && c.auditLogs.length > 0 ? (
              <div className="relative border-l-2 border-slate-200 pl-4 space-y-6">
                {c.auditLogs.map((log) => (
                  <div key={log.id} className="relative">
                    <div className="absolute -left-[1.65rem] top-1 w-3 h-3 rounded-full bg-blue-500 border-2 border-white"></div>
                    <div className="text-xs text-slate-400 flex items-center gap-1">
                      <Clock size={10} /> {formatTime(log.createdAt)}
                    </div>
                    <div className="text-sm font-medium text-slate-800">{log.event.replace(/_/g, ' ')}</div>
                    {log.metadata && Object.keys(log.metadata).length > 0 && (
                      <div className="text-xs text-slate-500 mt-1 bg-slate-100 rounded px-2 py-1 inline-block">
                        {JSON.stringify(log.metadata)}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-xs text-red-500 font-bold italic flex items-center gap-1">
                <AlertTriangle size={12} /> NO AUDIT LOGS FOUND IN DATA
              </div>
            )}
          </div>

        </div>
      </td>
    </tr>
  );
}