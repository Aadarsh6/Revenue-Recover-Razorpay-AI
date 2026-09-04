import { Fragment, useEffect, useRef, useState } from 'react';
import axios from 'axios';
import {
  ArrowUpRight, Bot, ChevronDown, ChevronUp, FlaskConical,
  LayoutDashboard, Scale, ShieldCheck,
} from 'lucide-react';

import type { FinancialStats, RecoveryCase } from './types';
import CaseDetails from './Components/CaseDetails';
import FinancialImpact from './Components/FinancialImpact';
import PolicyRules from './Components/PolicyRules';
import { policyBadgeClass, statusBadgeClass } from './Theme';

type Page = 'dashboard' | 'policy';

const FILTERS: { key: string; label: string }[] = [
  { key: 'ALL', label: 'All' },
  { key: 'AUTO_RECOVERED', label: 'Recovered' },
  { key: 'PENDING_HUMAN_REVIEW', label: 'Human review' },
  { key: 'BLOCKED', label: 'Blocked' },
  { key: 'FAILED', label: 'Failed' },
  { key: 'RECOVERY_EXPIRED', label: 'Expired' },
];

const NAV_ITEMS: { key: Page; label: string; icon: typeof LayoutDashboard }[] = [
  { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { key: 'policy', label: 'Policy Rules', icon: Scale },
];

export default function App() {
  const [cases, setCases] = useState<RecoveryCase[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedCaseId, setExpandedCaseId] = useState<number | null>(null);
  const [stats, setStats] = useState<FinancialStats | null>(null);

  // ── UI-only state (additive — no backend changes) ──────────────────
  const [fetchError, setFetchError] = useState(false);
  const [page, setPage] = useState<Page>('dashboard');
  const [filter, setFilter] = useState('ALL');
  const [flashIds, setFlashIds] = useState<Set<number>>(new Set());
  const knownIdsRef = useRef<Set<number>>(new Set());

  useEffect(() => {
    let cancelled = false;

    const fetchCases = async () => {
      try {
        const [casesRes, statsRes] = await Promise.all([
          axios.get('http://localhost:3000/api/cases'),
          axios.get('http://localhost:3000/api/stats'),
        ]);
        if (!cancelled) {
          const casesArr: RecoveryCase[] = Array.isArray(casesRes.data) ? casesRes.data : [];
          setCases(casesArr);
          setStats(statsRes.data ?? null);
          setFetchError(false);

          // New-row detection: IDs we haven't seen before get a brief highlight.
          const ids = new Set(casesArr.map(c => c.id));
          if (knownIdsRef.current.size > 0) {
            const fresh = [...ids].filter(id => !knownIdsRef.current.has(id));
            if (fresh.length > 0) {
              setFlashIds(new Set(fresh));
              window.setTimeout(() => setFlashIds(new Set()), 5000);
            }
          }
          knownIdsRef.current = ids;
        }
      } catch (err) {
        console.error("Fetch error:", err);
        if (!cancelled) setFetchError(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchCases();
    const interval = setInterval(fetchCases, 5000);
    return () => { cancelled = true; clearInterval(interval); };
  }, []);

  // Newest first, so a case born mid-demo lands at the TOP of the table.
  const sortedCases = [...cases].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
  const visibleCases = filter === 'ALL' ? sortedCases : sortedCases.filter(c => c.status === filter);
  const countFor = (key: string) =>
    key === 'ALL' ? cases.length : cases.filter(c => c.status === key).length;

  return (
    <div className="flex min-h-screen bg-white">

      {/* ── Sidebar — one dark control rail: brand, nav, live status, env ── */}
      <aside
        className="w-60 shrink-0 sticky top-0 h-screen flex flex-col"
        style={{ background: 'linear-gradient(180deg, #0B0F1A 0%, #10162A 100%)' }}
      >
        <div className="flex items-center gap-2.5 px-5 h-16 border-b border-white/[0.06]">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
            style={{ background: 'linear-gradient(135deg, #2872EF 0%, #6941C6 100%)' }}
          >
            <ShieldCheck size={16} className="text-white" strokeWidth={2.5} />
          </div>
          <span className="text-[15px] font-semibold text-white tracking-tight">Revive AI</span>
        </div>

        <nav className="flex-1 px-3 py-5 space-y-1">
          {NAV_ITEMS.map(item => {
            const active = page === item.key;
            return (
              <button
                key={item.key}
                onClick={() => setPage(item.key)}
                className={`relative w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors ${
                  active
                    ? 'bg-white/[0.07] text-white font-medium'
                    : 'text-[#8B93A7] hover:bg-white/[0.04] hover:text-white'
                }`}
              >
                {active && (
                  <span
                    className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-full"
                    style={{ background: 'linear-gradient(180deg, #2872EF 0%, #6941C6 100%)' }}
                  />
                )}
                <item.icon size={16} className={active ? 'text-[#7CAAF7]' : 'text-[#5D6579]'} />
                {item.label}
              </button>
            );
          })}
        </nav>

        <div className="px-5 py-4 border-t border-white/[0.06] space-y-3">
          <div className="flex items-center gap-1.5 text-xs">
            <span className={`w-1.5 h-1.5 rounded-full ${fetchError ? 'bg-[#F97066]' : 'bg-[#32D583] animate-pulse'}`} />
            <span className="text-[#8B93A7]">{fetchError ? 'Reconnecting…' : 'Live'}</span>
          </div>
          <div className="inline-flex items-center gap-1.5 text-[11px] font-medium text-[#F3C57E] bg-white/[0.05] border border-white/[0.08] px-2 py-1 rounded-md">
            <FlaskConical size={11} />
            Test mode
          </div>
        </div>
      </aside>

      {/* ── Main content ────────────────────────────────────────────── */}
      <main className="flex-1 min-w-0 bg-white">
        <div className="max-w-[1400px] mx-auto px-8 lg:px-12 py-8">
          {page === 'policy' && <PolicyRules />}

          {page === 'dashboard' && (
            <>
              {loading ? (
                <div className="text-center text-[#667085] py-10">Loading recovery cases…</div>
              ) : cases.length === 0 ? (
                <div className="text-center text-[#667085] py-10">
                  No recovery cases yet. Trigger a webhook to see it work.
                </div>
              ) : (
                <>
                  <div className="mb-6">
                    <h1 className="text-xl font-semibold text-[#0B1120] tracking-tight">Dashboard</h1>
                    <p className="text-sm text-[#667085] mt-0.5">
                      Autonomous revenue recovery for Razorpay merchants
                    </p>
                  </div>

                  {stats && <FinancialImpact stats={stats} />}

                  <div className="bg-white rounded-lg border border-[#EAECF0] overflow-hidden">
                    {/* Filter tabs */}
                    <div className="flex items-center gap-6 px-5 border-b border-[#EAECF0] overflow-x-auto">
                      {FILTERS.map(f => {
                        const active = filter === f.key;
                        return (
                          <button
                            key={f.key}
                            onClick={() => setFilter(f.key)}
                            className={`py-3 text-sm border-b-2 -mb-px whitespace-nowrap transition-colors ${
                              active
                                ? 'border-[#2872EF] text-[#0B1120] font-semibold'
                                : 'border-transparent text-[#667085] hover:text-[#0B1120]'
                            }`}
                          >
                            {f.label}
                            <span className={`ml-1.5 text-xs tabular-nums ${active ? 'text-[#2872EF]' : 'text-[#98A2B3]'}`}>
                              {countFor(f.key)}
                            </span>
                          </button>
                        );
                      })}
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="border-b border-[#EAECF0] bg-[#F9FAFB]">
                            <th className="px-4 py-2.5 font-medium text-xs text-[#667085] w-8"></th>
                            <th className="px-4 py-2.5 font-medium text-xs text-[#667085]">Case ID</th>
                            <th className="px-4 py-2.5 font-medium text-xs text-[#667085]">Payment ID</th>
                            <th className="px-4 py-2.5 font-medium text-xs text-[#667085]">AI diagnosis</th>
                            <th className="px-4 py-2.5 font-medium text-xs text-[#667085]">Policy</th>
                            <th className="px-4 py-2.5 font-medium text-xs text-[#667085]">Status</th>
                            <th className="px-4 py-2.5 font-medium text-xs text-[#667085]">Recovery link</th>
                          </tr>
                        </thead>
                        <tbody>
                          {visibleCases.map((c) => (
                            <Fragment key={c.id}>
                              <tr
                                className={`border-b border-[#F1F2F4] hover:bg-[#F9FAFB] cursor-pointer transition-colors ${
                                  flashIds.has(c.id) ? 'row-flash' : ''
                                }`}
                                onClick={() => setExpandedCaseId(expandedCaseId === c.id ? null : c.id)}
                              >
                                <td className="px-4 py-3 text-[#98A2B3]">
                                  {expandedCaseId === c.id ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                                </td>
                                <td className="px-4 py-3 text-sm font-medium text-[#0B1120]">#{c.id}</td>
                                <td className="px-4 py-3 font-mono text-xs text-[#667085]">{c.paymentId}</td>
                                <td className="px-4 py-3 text-sm text-[#344054]">
                                  <span className="flex items-center gap-1.5">
                                    <Bot size={14} className="text-[#6941C6] shrink-0" />
                                    {c.aiDiagnosis || 'N/A'}
                                  </span>
                                </td>
                                <td className="px-4 py-3 text-sm">
                                  <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${policyBadgeClass(c.policyDecision)}`}>
                                    {c.policyDecision || 'N/A'}
                                  </span>
                                </td>
                                <td className="px-4 py-3">
                                  <span className={`px-2.5 py-1 rounded-full text-xs font-semibold border ${statusBadgeClass(c.status)}`}>
                                    {c.status}
                                  </span>
                                </td>
                                <td className="px-4 py-3 text-sm">
                                  {c.recoveryAttempt?.recoveryUrl ? (
                                    <a
                                      href={c.recoveryAttempt.recoveryUrl}
                                      target="_blank"
                                      rel="noreferrer"
                                      onClick={(e) => e.stopPropagation()}
                                      className="inline-flex items-center gap-1 text-xs font-semibold text-white bg-[#2872EF] hover:bg-[#0E54CD] transition-colors px-3 py-1.5 rounded-md"
                                    >
                                      View link <ArrowUpRight size={12} />
                                    </a>
                                  ) : (
                                    <span className="text-[#D0D5DD]">—</span>
                                  )}
                                </td>
                              </tr>

                              {expandedCaseId === c.id && <CaseDetails c={c} />}
                            </Fragment>
                          ))}

                          {visibleCases.length === 0 && (
                            <tr>
                              <td colSpan={7} className="p-10 text-center text-sm text-[#98A2B3]">
                                No cases match this filter.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  );
}