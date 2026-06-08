import { RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { PortfolioStats } from './portfolio-stats';

interface PortfolioBarProps {
  stats: PortfolioStats;
  loading: boolean;
  onRefresh: () => void;
}

function Kpi({
  label,
  children,
  tone,
  loading,
}: {
  label: string;
  children: React.ReactNode;
  tone?: 'brand' | 'bearish';
  loading?: boolean;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-2xs uppercase tracking-widest text-fg-muted">
        {label}
      </span>
      <span
        className={cn(
          'font-mono text-lg font-semibold tabular-nums text-fg',
          !loading && tone === 'brand' && 'text-brand',
          !loading && tone === 'bearish' && 'text-bearish',
        )}
      >
        {loading ? '—' : children}
      </span>
    </div>
  );
}

export function PortfolioBar({ stats, loading, onRefresh }: PortfolioBarProps) {
  const capital = stats.capitalDeployed.toLocaleString('en-US', {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  });

  return (
    <section
      aria-label="Portfolio summary"
      className="card-coin98-flat relative flex flex-wrap items-center gap-x-8 gap-y-4 rounded-2xl px-6 py-5"
    >
      <div className="flex flex-col gap-0.5">
        <span className="text-2xs uppercase tracking-widest text-fg-muted">
          Capital deployed
        </span>
        <span
          className="font-mono text-3xl font-bold tabular-nums text-fg"
          style={{ textShadow: '0 0 28px rgba(240,185,11,0.18)' }}
        >
          {loading ? '—' : capital}{' '}
          <span className="text-base text-fg-muted">USDC</span>
        </span>
      </div>

      <div className="h-8 w-px bg-border-subtle" aria-hidden />

      <Kpi label="Active / Total" loading={loading}>
        {stats.active} / {stats.total}
      </Kpi>
      <Kpi label="Open trades" loading={loading}>
        {stats.openTrades}
      </Kpi>
      <Kpi label="Idle" loading={loading}>
        {stats.idle}
      </Kpi>
      <Kpi
        label="Transitioning"
        loading={loading}
        tone={stats.transitioning > 0 ? 'brand' : undefined}
      >
        {stats.transitioning}
      </Kpi>
      <Kpi
        label="Errors"
        loading={loading}
        tone={stats.error > 0 ? 'bearish' : undefined}
      >
        {stats.error}
      </Kpi>

      <Button
        variant="ghost"
        size="md"
        className="ml-auto"
        onClick={onRefresh}
        disabled={loading}
        aria-label="Refresh bots"
        title="Refresh"
      >
        <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
      </Button>
    </section>
  );
}
