import type { FinancialStats } from '../types';

export default function FinancialImpact({ stats }: { stats: FinancialStats }) {
  const fmt = (n: number) => `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;

  const items = [
    { label: 'Gross recovered', value: fmt(stats.grossRecovered), tone: '#4ADE80' },
    { label: 'AI compute cost', value: fmt(stats.aiComputeCost), tone: '#C4A8F5' },
    { label: 'Net recovery value', value: fmt(stats.netRecoveryValue), tone: '#7EABF7' },
    { label: 'AI calls avoided', value: String(stats.aiCallsAvoided), tone: '#C7CBD1' },
    { label: 'Avg. time to recovery', value: stats.avgRecoveryMinutes !== null ? `${stats.avgRecoveryMinutes} min` : '—', tone: '#C7CBD1' },
  ];

  return (
    <div className="mb-6">
      <div className="flex items-baseline justify-between mb-2 px-1">
        <span className="text-sm font-semibold text-[#0B1120]">Financial impact</span>
        <span className="text-xs text-[#9AA1AC]">AI recommendation ≠ AI authority — every rupee tracked</span>
      </div>
      <div className="bg-[#0B1120] rounded-2xl overflow-hidden">
        <div className="grid grid-cols-2 md:grid-cols-5 divide-x divide-white/[0.08]">
          {items.map(({ label, value, tone }) => (
            <div key={label} className="px-5 py-4">
              <div className="text-[11px] text-[#7C8494] mb-1.5">{label}</div>
              <div className="text-xl font-mono tabular-nums font-semibold" style={{ color: tone }}>
                {value}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}