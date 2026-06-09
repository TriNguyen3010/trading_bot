import { cn } from '@/lib/utils';
import type { PortfolioStats } from './portfolio-stats';

interface PortfolioBarProps {
  stats: PortfolioStats;
  loading: boolean;
}

function Kpi({
  label,
  divider,
  className,
  children,
}: {
  label: string;
  divider?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        'relative flex min-w-0 flex-col gap-1 px-[18px] py-[14px]',
        divider &&
          "before:absolute before:inset-y-[18%] before:left-0 before:w-px before:bg-border-subtle before:content-['']",
        className,
      )}
    >
      <span className="flex items-center gap-1.5 whitespace-nowrap text-xs font-semibold uppercase tracking-[0.6px] text-fg-muted">
        {label}
      </span>
      {children}
    </div>
  );
}

export function PortfolioBar({ stats, loading }: PortfolioBarProps) {
  const capital = stats.capitalDeployed.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  const d = (n: number) => (loading ? '—' : n);

  return (
    <section
      aria-label="Portfolio summary"
      className="flex flex-wrap items-stretch overflow-hidden rounded-[18px] border border-border-subtle bg-surface p-1"
    >
      <Kpi label="Capital deployed" className="flex-[1.6]">
        <span className="font-mono text-2xl font-semibold tabular-nums tracking-[-0.5px] text-fg">
          {loading ? '—' : capital}
          <span className="ml-1 text-sm font-medium text-fg-muted">USDC</span>
        </span>
      </Kpi>

      <Kpi label="Active / Total" divider className="flex-1">
        <span className="font-mono text-lg font-semibold tabular-nums text-fg">
          {loading ? '—' : `${stats.active} / ${stats.total}`}
        </span>
      </Kpi>

      <Kpi label="Open trades" divider className="flex-1">
        <span className="font-mono text-lg font-semibold tabular-nums text-fg">
          {d(stats.openTrades)}
        </span>
      </Kpi>

      <Kpi label="Fleet" divider className="flex-1">
        <div className="flex gap-3.5 font-mono text-sm tabular-nums text-fg-muted">
          <span>
            idle{' '}
            <b className="font-semibold text-fg-secondary">{d(stats.idle)}</b>
          </span>
          <span>
            working{' '}
            <b className="font-semibold text-fg-secondary">
              {d(stats.transitioning)}
            </b>
          </span>
          <span>
            err{' '}
            <b
              className={cn(
                'font-semibold',
                !loading && stats.error > 0
                  ? 'text-bearish'
                  : 'text-fg-secondary',
              )}
            >
              {d(stats.error)}
            </b>
          </span>
        </div>
      </Kpi>
    </section>
  );
}
