import { IndianRupee, Bot, TrendingUp, ShieldX, Timer } from 'lucide-react';
import type { FinancialStats } from '../types';

export default function FinancialImpact({ stats }: { stats: FinancialStats }) {
  const fmt = (n: number) => `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;

  const items = [
    { label: 'Gross Revenue Recovered', value: fmt(stats.grossRecovered), icon: IndianRupee, color: 'text-green-600 bg-green-50' },
    { label: 'Est. AI Compute Cost', value: fmt(stats.aiComputeCost), icon: Bot, color: 'text-purple-600 bg-purple-50' },
    { label: 'Net Recovery Value', value: fmt(stats.netRecoveryValue), icon: TrendingUp, color: 'text-blue-600 bg-blue-50' },
    { label: 'AI Calls Avoided', value: String(stats.aiCallsAvoided), icon: ShieldX, color: 'text-red-600 bg-red-50' },
    { label: 'Avg Time to Recovery', value: stats.avgRecoveryMinutes !== null ? `${stats.avgRecoveryMinutes} min` : '—', icon: Timer, color: 'text-slate-600 bg-slate-100' },
  ];

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 mb-6">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-bold text-slate-700 uppercase tracking-wider">Financial Impact</h2>
        <span className="text-xs text-slate-400">AI recommendation ≠ AI authority — every rupee tracked</span>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {items.map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${color}`}><Icon size={20} /></div>
            <div>
              <div className="text-xl font-bold text-slate-800 leading-none">{value}</div>
              <div className="text-xs text-slate-500 mt-1">{label}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}