import type { RecoveryCase } from '../types';

export default function StatsCards({ cases }: { cases: RecoveryCase[] }) {
  const total = cases.length;
  const recovered = cases.filter(c => c.status === 'AUTO_RECOVERED').length;
  const blocked = cases.filter(c => c.status === 'BLOCKED').length;
  const human = cases.filter(c => c.status === 'PENDING_HUMAN_REVIEW').length;
  const failed = cases.filter(c => c.status === 'FAILED').length;

  const stats = [
    { label: 'Total cases', value: total, dot: '#2872EF' },
    { label: 'Recovered', value: recovered, dot: '#14804A' },
    { label: 'Blocked', value: blocked, dot: '#C4361D' },
    { label: 'Human review', value: human, dot: '#A15C00' },
    { label: 'Failed', value: failed, dot: '#9AA1AC' },
  ];

  return (
    <div className="flex flex-wrap items-center gap-x-7 gap-y-2 mb-6 px-1 py-1">
      {stats.map((s) => (
        <div key={s.label} className="flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: s.dot }} />
          <span className="text-base font-mono tabular-nums font-semibold text-[#0B1120]">{s.value}</span>
          <span className="text-sm text-[#5B6472]">{s.label}</span>
        </div>
      ))}
    </div>
  );
}