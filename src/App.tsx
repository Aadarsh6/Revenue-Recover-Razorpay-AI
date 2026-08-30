import { useEffect, useState } from 'react';
import axios from 'axios';
import { ShieldCheck, Bot, Activity } from 'lucide-react';

// TypeScript Interfaces for our API data
interface AuditLog { id: number; event: string; createdAt: string; }
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
  aiAnalysis: AIAnalysis[] | null;
  recoveryAttempt: RecoveryAttempt | null;
  auditLogs: AuditLog[];
}

export default function App() {
  const [cases, setCases] = useState<RecoveryCase[]>([]);
  const [loading, setLoading] = useState(true);

    useEffect(() => {
    axios.get('http://localhost:3000/api/cases')
      .then(res => {
        console.log("API Response:", res.data);
        if (Array.isArray(res.data)) {
          setCases(res.data);
        } else {
          setCases([]);
        }
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
                <tr key={c.id} className="border-b border-slate-100 hover:bg-slate-50">
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
                      <a href={c.recoveryAttempt.recoveryUrl} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline truncate block max-w-xs">
                        {c.recoveryAttempt.recoveryUrl}
                      </a>
                    ) : (
                      <span className="text-slate-300">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}