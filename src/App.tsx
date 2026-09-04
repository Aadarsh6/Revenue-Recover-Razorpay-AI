import { useEffect, useState, Fragment } from 'react';
import axios from 'axios';
import { ShieldCheck, Bot, Activity, ChevronDown, ChevronUp, ArrowUpRight } from 'lucide-react';

import type { FinancialStats, RecoveryCase } from './types';
import CaseDetails from './Components/CaseDetails';
import StatsCards from './Components/StatsCards';
import FinancialImpact from './Components/FinancialImpact';
import { policyBadgeClass, statusBadgeClass } from './Theme';
// import { statusBadgeClass, policyBadgeClass } from './theme';

export default function App() {
  const [cases, setCases] = useState<RecoveryCase[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedCaseId, setExpandedCaseId] = useState<number | null>(null);

  const [stats, setStats] = useState<FinancialStats | null>(null);

  useEffect(() => {
    let cancelled = false;

    const fetchCases = async () => {
      try {
        const [casesRes, statsRes] = await Promise.all([
          axios.get('http://localhost:3000/api/cases'),
          axios.get('http://localhost:3000/api/stats'),
        ]);
        if (!cancelled) {
          setCases(Array.isArray(casesRes.data) ? casesRes.data : []);
          setStats(statsRes.data ?? null);
        }
      } catch (err) {
        console.error("Fetch error:", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchCases();
    const interval = setInterval(fetchCases, 5000);
    return () => { cancelled = true; clearInterval(interval); };
  }, []);

  return (
    <div className="min-h-screen bg-[#FFFFFF]">
      <div className="p-8 max-w-7xl mx-auto">

        {/* Header */}
        <div className="flex items-center justify-between mb-8 pb-6 border-b border-[#EDEEF1]">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-[#EAF1FE] flex items-center justify-center shrink-0">
              <ShieldCheck size={22} className="text-[#2872EF]" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold text-[#0B1120] tracking-tight">Revive AI</h1>
              <p className="text-sm text-[#5B6472] mt-0.5">Autonomous revenue recovery &amp; policy engine</p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-sm text-[#5B6472]">
            <Activity size={14} className="text-[#2872EF]" />
            Live system status
          </div>
        </div>

        {loading ? (
          <div className="text-center text-[#5B6472] py-10">Loading recovery cases…</div>
        ) : cases.length === 0 ? (
          <div className="text-center text-[#5B6472] py-10">No recovery cases yet. Trigger a webhook to see it work.</div>
        ) : (
          <>
            {stats && <FinancialImpact stats={stats} />}
            <StatsCards cases={cases} />

            <div className="bg-white rounded-xl shadow-sm border border-[#EDEEF1] overflow-hidden">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-[#EDEEF1] bg-[#F7F7F7]">
                    <th className="p-4 font-semibold text-[#5B6472] text-sm w-8"></th>
                    <th className="p-4 font-semibold text-[#5B6472] text-sm">Case ID</th>
                    <th className="p-4 font-semibold text-[#5B6472] text-sm">Payment ID</th>
                    <th className="p-4 font-semibold text-[#5B6472] text-sm">AI diagnosis</th>
                    <th className="p-4 font-semibold text-[#5B6472] text-sm">Policy</th>
                    <th className="p-4 font-semibold text-[#5B6472] text-sm">Status</th>
                    <th className="p-4 font-semibold text-[#5B6472] text-sm">Recovery link</th>
                  </tr>
                </thead>
                <tbody>
                  {cases.map((c) => (
                    <Fragment key={c.id}>
                      <tr
                        className="border-b border-[#F1F2F4] hover:bg-[#F7F7F7] cursor-pointer transition-colors"
                        onClick={() => setExpandedCaseId(expandedCaseId === c.id ? null : c.id)}
                      >
                        <td className="p-4 text-[#9AA1AC]">
                          {expandedCaseId === c.id ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                        </td>
                        <td className="p-4 font-medium text-[#0B1120]">#{c.id}</td>
                        <td className="p-4 font-mono text-xs text-[#5B6472]">{c.paymentId}</td>
                        <td className="p-4 text-sm text-[#374151] flex items-center gap-1.5">
                          <Bot size={14} className="text-[#6E42CB] shrink-0" />
                          {c.aiDiagnosis || 'N/A'}
                        </td>
                        <td className="p-4 text-sm">
                          <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${policyBadgeClass(c.policyDecision)}`}>
                            {c.policyDecision || 'N/A'}
                          </span>
                        </td>
                        <td className="p-4">
                          <span className={`px-2.5 py-1 rounded-full text-xs font-semibold border ${statusBadgeClass(c.status)}`}>
                            {c.status}
                          </span>
                        </td>
                        <td className="p-4 text-sm">
                          {c.recoveryAttempt?.recoveryUrl ? (
                            <a
                              href={c.recoveryAttempt.recoveryUrl}
                              target="_blank"
                              rel="noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="inline-flex items-center gap-1 text-xs font-semibold text-white bg-[#2872EF] hover:bg-[#0E54CD] transition-colors px-3 py-1.5 rounded-lg"
                            >
                              View link <ArrowUpRight size={12} />
                            </a>
                          ) : (
                            <span className="text-[#C7CBD1]">—</span>
                          )}
                        </td>
                      </tr>

                      {expandedCaseId === c.id && <CaseDetails c={c} />}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}