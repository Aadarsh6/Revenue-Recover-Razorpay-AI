import { CheckCircle2, ShieldX, UserSearch, XCircle, ListChecks } from 'lucide-react';
import { RecoveryCase } from '../types';

export default function StatsCards({ cases }: { cases: RecoveryCase[] }) {
  const total = cases.length;
  const recovered = cases.filter(c => c.status === 'AUTO_RECOVERED').length;
  const blocked = cases.filter(c => c.status === 'BLOCKED').length;
  const human = cases.filter(c => c.status === 'PENDING_HUMAN_REVIEW').length;
  const failed = cases.filter(c => c.status === 'FAILED').length;

  const stats = [
    { label: 'Total Cases', value: total, icon: ListChecks, color: 'text-blue-600 bg-blue-50' },
    { label: 'Recovered', value: recovered, icon: CheckCircle2, color: 'text-green-600 bg-green-50' },
    { label: 'Blocked', value: blocked, icon: ShieldX, color: 'text-red-600 bg-red-50' },
    { label: 'Human Review', value: human, icon: UserSearch, color: 'text-yellow-600 bg-yellow-50' },
    { label: 'Failed', value: failed, icon: XCircle, color: 'text-slate-600 bg-slate-100' },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
      {stats.map((stat) => (
        <div key={stat.label} className="bg-white rounded-xl border border-slate-200 p-4 flex items-center gap-3 shadow-sm">
          <div className={`p-2 rounded-lg ${stat.color}`}>
            <stat.icon size={20} />
          </div>
          <div>
            <div className="text-2xl font-bold text-slate-800 leading-none">{stat.value}</div>
            <div className="text-xs text-slate-500 mt-1">{stat.label}</div>
          </div>
        </div>
      ))}
    </div>
  );
}