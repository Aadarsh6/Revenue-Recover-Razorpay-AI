import { useEffect, useState, Fragment } from 'react';
import axios from 'axios';
import { ShieldCheck, Bot, Activity, ChevronDown, ChevronUp, AlertTriangle, Clock } from 'lucide-react';

// TypeScript Interfaces
interface AuditLog { id: number; event: string; createdAt: string; metadata?: any; }
interface AIAnalysis { diagnosis: string; recommendedAction: string; riskLevel: string; evidence: string[]; }
interface RecoveryAttempt { recoveryUrl: string | null; status: string | null; errorMessage: string | null; }
interface RecoveryCase {
  id: number;
  paymentId: string;
  status: string;
  liveState: string;
  aiDiagnosis: string | null;
  aiAction: string | null;
  policyDecision: string | null;
  createdAt: string;
  aiAnalysis: AIAnalysis[] | null; // Can be null
  recoveryAttempt: RecoveryAttempt | null;
  auditLogs: AuditLog[]; // Should exist, but just in case
}

export default function App() {
  const [cases, setCases] = useState<RecoveryCase[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedCaseId, setExpandedCaseId] = useState<number | null>(null);

  useEffect(() => {
    axios.get('http://localhost:3000/api/cases')
      .then(res => {
        if (Array.isArray(res.data)) setCases(res.data);
        else setCases([]);
      })
      .catch(err => {
        console.error("Axios error:", err);
        setCases([]);
      })
      .finally(() => setLoading(false));
  }, []);

  const getStatusColor = (status: string) => {
    if (status === 'AUTO_RECOVERED') return 'bg-green-100 text-green-800 border-green-200';
    if (status === 'BLOCKED' || status === 'FAILED') return 'bg-red-100 text-red-800 border-red-200';
    if (status === 'PENDING_HUMAN_REVIEW') return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    return 'bg-blue-100 text-blue-800 border-blue-200';
  };

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-slate-800 flex items-center gap-2">
            <ShieldCheck className="text-blue-600" /> Revive AI Dashboard
          </h1>
          <p className="text-slate-500 mt-1">Autonomous Revenue Recovery & Policy Engine</p>
        </div>
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <Activity size={16} /> Live System Status
        </div>
      </div>

      {loading ? (
        <div className="text-center text-slate-500 py-10">Loading recovery cases...</div>
      ) : cases.length === 0 ? (
        <div className="text-center text-slate-500 py-10">No recovery cases found. Trigger a webhook to see magic happen!</div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                <th className="p-4 font-semibold text-slate-600 text-sm w-8"></th>
                <th className="p-4 font-semibold text-slate-600 text-sm">Case ID</th>
                <th className="p-4 font-semibold text-slate-600 text-sm">Payment ID</th>
                <th className="p-4 font-semibold text-slate-600 text-sm">AI Diagnosis</th>
                <th className="p-4 font-semibold text-slate-600 text-sm">Policy</th>
                <th className="p-4 font-semibold text-slate-600 text-sm">Status</th>
                <th className="p-4 font-semibold text-slate-600 text-sm">Recovery URL</th>
              </tr>
            </thead>
            <tbody>
              {cases.map((c) => (
                <Fragment key={c.id}>
                  <tr 
                    className="border-b border-slate-100 hover:bg-slate-50 cursor-pointer transition-colors"
                    onClick={() => setExpandedCaseId(expandedCaseId === c.id ? null : c.id)}
                  >
                    <td className="p-4 text-slate-400">
                      {expandedCaseId === c.id ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </td>
                    <td className="p-4 font-medium text-slate-800">#{c.id}</td>
                    <td className="p-4 font-mono text-xs text-slate-500">{c.paymentId}</td>
                    <td className="p-4 text-sm text-slate-600 flex items-center gap-1">
                      <Bot size={14} className="text-purple-500" />
                      {c.aiDiagnosis || 'N/A'}
                    </td>
                    <td className="p-4 text-sm text-slate-600">
                      <span className={`px-2 py-1 rounded-full text-xs font-semibold border ${c.policyDecision === 'AUTO' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-yellow-50 text-yellow-700 border-yellow-200'}`}>
                        {c.policyDecision || 'N/A'}
                      </span>
                    </td>
                    <td className="p-4">
                      <span className={`px-2 py-1 rounded-full text-xs font-semibold border ${getStatusColor(c.status)}`}>
                        {c.status}
                      </span>
                    </td>
                    <td className="p-4 text-sm">
                      {c.recoveryAttempt?.recoveryUrl ? (
                        <a href={c.recoveryAttempt.recoveryUrl} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline truncate block max-w-xs" onClick={(e) => e.stopPropagation()}>
                          {c.recoveryAttempt.recoveryUrl}
                        </a>
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </td>
                  </tr>
                  
                  {/* EXPANDED DETAILS ROW */}
                  {expandedCaseId === c.id && (
                    <tr className="bg-slate-50/50">
                      <td colSpan={7} className="p-6">
                        <div className="grid grid-cols-2 gap-8">
                          
                          {/* Left Column: AI & Execution Details */}
                          <div className="space-y-4">
                            <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wider">AI Analysis & Execution</h3>
                            
                            {c.aiAnalysis && c.aiAnalysis.length > 0 && (
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
                          <div>
                            <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wider mb-4">Audit Timeline</h3>
                            <div className="relative border-l-2 border-slate-200 pl-4 space-y-6">
                              {c.auditLogs?.map((log) => (
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
                          </div>

                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}