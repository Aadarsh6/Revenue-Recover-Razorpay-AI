import type { FinancialStats } from '../types';

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[11px] font-medium uppercase tracking-wider text-[#9AA1AC] mb-1">{label}</div>
      <div className="text-lg font-semibold text-[#0B1120] tabular-nums">{value}</div>
    </div>
  );
}

export default function FinancialImpact({ stats }: { stats: FinancialStats }) {
  const fmt = (n: number) => `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;

  return (
    <section className="bg-white rounded-lg border border-[#EDEEF1] p-6 mb-6">
      <div className="flex flex-wrap items-end gap-x-12 gap-y-6">
        {/* Hero — size is the hierarchy, ink is the color */}
        <div className="min-w-[240px]">
          <div className="text-[11px] font-medium uppercase tracking-wider text-[#9AA1AC] mb-1.5">
            Net recovery value
          </div>
          <div className="text-4xl font-semibold text-[#0B1120] tracking-tight tabular-nums">
            {fmt(stats.netRecoveryValue)}
          </div>
          <div className="text-sm text-[#58666E] mt-2">
            {fmt(stats.grossRecovered)} gross recovered − {fmt(stats.aiComputeCost)} AI compute
          </div>
        </div>

        <div className="hidden lg:block h-16 w-px bg-[#EDEEF1]" />

        {/* Supporting figures */}
        <div className="flex flex-wrap gap-x-12 gap-y-5">
          <Stat label="Cases processed" value={String(stats.casesProcessed)} />
          <Stat label="Guard blocks" value={String(stats.guardBlocks)} />
          <Stat label="AI calls avoided" value={String(stats.aiCallsAvoided)} />
          <Stat
            label="Avg. time to recovery"
            value={stats.avgRecoveryMinutes !== null ? `${stats.avgRecoveryMinutes} min` : '—'}
          />
        </div>
      </div>

      <div className="mt-5 pt-4 border-t border-[#EDEEF1] text-xs text-[#9AA1AC]">
        AI recommendation ≠ AI authority — every rupee is tracked through the policy engine.
      </div>
    </section>
  );
}