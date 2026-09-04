import { Fragment, useEffect, useRef, useState } from 'react';
import axios from 'axios';
import {
  ArrowUpRight, Bot, ChevronDown, ChevronUp,
  LayoutDashboard, Scale, ShieldCheck,
} from 'lucide-react';

import type { FinancialStats, RecoveryCase } from './types';
// import AuditLogPage from './Components/AuditLogPage';
import CaseDetails from './Components/CaseDetails';
import FinancialImpact from './Components/FinancialImpact';
// import PolicyRules from './Components/PolicyRules';
import { policyBadgeClass, statusBadgeClass } from './Theme';
import PolicyRules from './Components/PolicyRules';

type Page = 'dashboard' | 'policy';

const FILTERS: { key: string; label: string }[] = [
  { key: 'ALL', label: 'All' },
  { key: 'AUTO_RECOVERED', label: 'Recovered' },
  { key: 'PENDING_HUMAN_REVIEW', label: 'Human review' },
  { key: 'BLOCKED', label: 'Blocked' },
  { key: 'FAILED', label: 'Failed' },
  { key: 'RECOVERY_EXPIRED', label: 'Expired' },
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
    <div className="min-h-screen bg-[#F7F7F7]">
      {/* ── Top bar (black, Razorpay shell style) ────────────────────── */}
      <header className="h-12 bg-[#000000] flex items-center justify-between px-4 lg:px-5 sticky top-0 z-20">
        <div className="flex items-center gap-2.5">
          <div className="w-6 h-6 rounded-md bg-[#2872EF] flex items-center justify-center">
            <ShieldCheck size={14} className="text-white" />
          </div>
          <span className="text-sm font-semibold text-white tracking-tight">Revive AI</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[10px] font-bold tracking-widest bg-[#FFD666] text-[#3A2E00] px-2 py-0.5 rounded-sm">
            TEST MODE
          </span>
          <div className="flex items-center gap-1.5 text-xs text-[#B8BDC4]">
            <span className={`w-1.5 h-1.5 rounded-full ${fetchError ? 'bg-[#F0704A]' : 'bg-[#33C27A] animate-pulse'}`} />
            {fetchError ? 'Reconnecting…' : 'Live'}
          </div>
        </div>
      </header>

      <div className="flex">
        {/* ── Sidebar (same gray as canvas, border-separated — Razorpay pattern) ── */}
        <aside className="w-56 shrink-0 border-r border-[#EDEEF1] sticky top-12 h-[calc(100vh-3rem)] px-3 py-4 hidden md:block">
          <nav className="space-y-1">
            {([
              { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
              { key: 'policy', label: 'Policy Rules', icon: Scale },
              // { key: 'audit', label: 'Audit Log', icon: ScrollText },
            ] as { key: Page; label: string; icon: typeof LayoutDashboard }[]).map(item => {
              const active = page === item.key;
              return (
                <button
                  key={item.key}
                  onClick={() => setPage(item.key)}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-colors ${
                    active
                      ? 'bg-white text-[#0B1120] font-semibold shadow-[0_1px_2px_rgba(11,17,32,0.08)]'
                      : 'text-[#58666E] hover:bg-white/70 hover:text-[#0B1120]'
                  }`}
                >
                  <item.icon size={16} className={active ? 'text-[#2872EF]' : 'text-[#9AA1AC]'} />
                  {item.label}
                </button>
              );
            })}
          </nav>
        </aside>

        {/* ── Main content ────────────────────────────────────────────── */}
        <main className="flex-1 min-w-0 px-6 lg:px-10 py-8">
          {page === 'policy' && <PolicyRules />}

          {page === 'dashboard' && (
            <>
              {loading ? (
                <div className="text-center text-[#58666E] py-10">Loading recovery cases…</div>
              ) : cases.length === 0 ? (
                <div className="text-center text-[#58666E] py-10">
                  No recovery cases yet. Trigger a webhook to see it work.
                </div>
              ) : (
                <>
                  <div className="mb-6">
                    <h1 className="text-xl font-semibold text-[#0B1120] tracking-tight">Dashboard</h1>
                    <p className="text-sm text-[#58666E] mt-0.5">
                      Autonomous revenue recovery for Razorpay merchants
                    </p>
                  </div>

                  {stats && <FinancialImpact stats={stats} />}

                  <div className="bg-white rounded-lg border border-[#EDEEF1] overflow-hidden">
                    {/* Filter tabs (replaces the old stats dots — now clickable) */}
                    <div className="flex items-center gap-6 px-5 border-b border-[#EDEEF1] overflow-x-auto">
                      {FILTERS.map(f => {
                        const active = filter === f.key;
                        return (
                          <button
                            key={f.key}
                            onClick={() => setFilter(f.key)}
                            className={`py-3 text-sm border-b-2 -mb-px whitespace-nowrap transition-colors ${
                              active
                                ? 'border-[#2872EF] text-[#0B1120] font-semibold'
                                : 'border-transparent text-[#58666E] hover:text-[#0B1120]'
                            }`}
                          >
                            {f.label}
                            <span className={`ml-1.5 text-xs tabular-nums ${active ? 'text-[#2872EF]' : 'text-[#9AA1AC]'}`}>
                              {countFor(f.key)}
                            </span>
                          </button>
                        );
                      })}
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="border-b border-[#EDEEF1] bg-[#F6F6F6]">
                            <th className="px-4 py-2.5 font-medium text-xs text-[#58666E] w-8"></th>
                            <th className="px-4 py-2.5 font-medium text-xs text-[#58666E]">Case ID</th>
                            <th className="px-4 py-2.5 font-medium text-xs text-[#58666E]">Payment ID</th>
                            <th className="px-4 py-2.5 font-medium text-xs text-[#58666E]">AI diagnosis</th>
                            <th className="px-4 py-2.5 font-medium text-xs text-[#58666E]">Policy</th>
                            <th className="px-4 py-2.5 font-medium text-xs text-[#58666E]">Status</th>
                            <th className="px-4 py-2.5 font-medium text-xs text-[#58666E]">Recovery link</th>
                          </tr>
                        </thead>
                        <tbody>
                          {visibleCases.map((c) => (
                            <Fragment key={c.id}>
                              <tr
                                className={`border-b border-[#F1F2F4] hover:bg-[#F7F7F7] cursor-pointer transition-colors ${
                                  flashIds.has(c.id) ? 'row-flash' : ''
                                }`}
                                onClick={() => setExpandedCaseId(expandedCaseId === c.id ? null : c.id)}
                              >
                                <td className="px-4 py-3 text-[#9AA1AC]">
                                  {expandedCaseId === c.id ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                                </td>
                                <td className="px-4 py-3 text-sm font-medium text-[#0B1120]">#{c.id}</td>
                                <td className="px-4 py-3 font-mono text-xs text-[#58666E]">{c.paymentId}</td>
                                <td className="px-4 py-3 text-sm text-[#374151]">
                                  <span className="flex items-center gap-1.5">
                                    <Bot size={14} className="text-[#6E42CB] shrink-0" />
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
                                    <span className="text-[#C7CBD1]">—</span>
                                  )}
                                </td>
                              </tr>

                              {expandedCaseId === c.id && <CaseDetails c={c} />}
                            </Fragment>
                          ))}

                          {visibleCases.length === 0 && (
                            <tr>
                              <td colSpan={7} className="p-10 text-center text-sm text-[#9AA1AC]">
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
        </main>
      </div>
    </div>
  );
}