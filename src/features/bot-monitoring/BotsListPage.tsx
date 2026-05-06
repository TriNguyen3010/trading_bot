import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BarChart2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { botApi } from './mockBotData';
import type { BotMeta, PerformanceSnapshot } from './types';

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────
function formatUptime(deployedAt: number): string {
  const ms = Date.now() - deployedAt;
  const d = Math.floor(ms / 86_400_000);
  const h = Math.floor((ms % 86_400_000) / 3_600_000);
  if (d > 0) return `Running ${d}d ${h}h`;
  return `Running ${h}h`;
}

function formatPnl(pnl: number): string {
  const sign = pnl >= 0 ? '+' : '';
  return `${sign}$${pnl.toFixed(2)}`;
}

// ─────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────
function ModeBadge({ mode }: { mode: BotMeta['mode'] }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold uppercase tracking-wide',
        mode === 'live'
          ? 'bg-bullish/15 text-bullish'
          : 'bg-brand/15 text-brand',
      )}
    >
      {mode === 'live' ? 'LIVE' : 'DRY-RUN'}
    </span>
  );
}

function BotCard({
  meta,
  snap,
}: {
  meta: BotMeta;
  snap: PerformanceSnapshot | null;
}) {
  const navigate = useNavigate();
  const todayPnl = snap?.todayPnL ?? 0;
  const winRate = snap?.winRate ?? 0;
  const totalTrades = snap?.totalTrades ?? 0;
  const pnlPositive = todayPnl >= 0;

  return (
    <div
      role="link"
      tabIndex={0}
      onClick={() => navigate(`/bots/${meta.id}`)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          navigate(`/bots/${meta.id}`);
        }
      }}
      className={cn(
        'flex flex-col gap-3 rounded-xl border border-border-subtle bg-surface p-4 cursor-pointer',
        'transition-all hover:border-border-default hover:bg-surface-hover',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand',
      )}
    >
      {/* Card header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className="flex-shrink-0 rounded-lg bg-brand/10 p-1.5">
            <BarChart2 className="h-4 w-4 text-brand" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-fg truncate">{meta.name}</p>
            <p className="text-xs text-fg-muted">
              <code className="text-fg-secondary">{meta.pair}</code>
              <span className="mx-1.5 text-border-strong">·</span>
              {meta.timeframe}
            </p>
          </div>
        </div>
        <ModeBadge mode={meta.mode} />
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-2 rounded-lg border border-border-subtle bg-canvas px-3 py-2">
        <div className="flex flex-col gap-0.5">
          <span className="text-2xs uppercase tracking-wider text-fg-muted">
            Today
          </span>
          <span
            className={cn(
              'text-sm font-semibold tabular-nums',
              pnlPositive ? 'text-bullish' : 'text-bearish',
            )}
          >
            {snap ? formatPnl(todayPnl) : '—'}
          </span>
        </div>
        <div className="flex flex-col gap-0.5">
          <span className="text-2xs uppercase tracking-wider text-fg-muted">
            Win
          </span>
          <span className="text-sm font-semibold tabular-nums text-fg">
            {snap ? `${(winRate * 100).toFixed(1)}%` : '—'}
          </span>
        </div>
        <div className="flex flex-col gap-0.5">
          <span className="text-2xs uppercase tracking-wider text-fg-muted">
            Trades
          </span>
          <span className="text-sm font-semibold tabular-nums text-fg">
            {snap ? totalTrades : '—'}
          </span>
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between">
        <span className="text-xs text-fg-muted">
          {formatUptime(meta.deployedAt)}
        </span>
        <span className="text-xs font-semibold text-brand">Monitor →</span>
      </div>
    </div>
  );
}

function EmptyState() {
  const navigate = useNavigate();
  return (
    <div className="flex flex-1 items-center justify-center">
      <div className="rounded-xl border border-border-subtle bg-surface p-10 flex flex-col items-center gap-4 text-center max-w-sm">
        <div className="rounded-full bg-brand/10 p-4">
          <BarChart2 className="h-8 w-8 text-brand" />
        </div>
        <div>
          <p className="text-base font-semibold text-fg">No bots yet</p>
          <p className="mt-1 text-sm text-fg-muted">
            Build your first strategy to start automating your trades.
          </p>
        </div>
        <Button onClick={() => navigate('/builder')}>
          Build your first strategy →
        </Button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────
interface BotRow {
  meta: BotMeta;
  snap: PerformanceSnapshot | null;
}

export function BotsListPage() {
  const navigate = useNavigate();
  const [rows, setRows] = useState<BotRow[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    botApi.listBots().then(async (metas) => {
      const seeded: BotRow[] = metas.map((m) => ({ meta: m, snap: null }));
      if (cancelled) return;
      setRows(seeded);
      const filled = await Promise.all(
        metas.map(async (m) => ({
          meta: m,
          snap: await botApi.getSnapshot(m.id, m.deployedAt),
        })),
      );
      if (!cancelled) setRows(filled);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="min-h-screen bg-canvas text-fg">
      {/* Header bar — matches Builder/Monitoring header height + tokens */}
      <header className="flex h-14 items-center justify-between border-b border-border-subtle bg-canvas px-6">
        <div>
          <h1 className="text-base font-semibold text-fg">My Bots</h1>
          <p className="text-2xs uppercase tracking-wider text-fg-muted">
            {rows == null
              ? 'Loading…'
              : `${rows.length} bot${rows.length === 1 ? '' : 's'}`}
          </p>
        </div>
        <Button onClick={() => navigate('/builder')}>+ New bot</Button>
      </header>

      <main className="p-6">
        {rows == null ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div
                key={i}
                className="h-44 animate-pulse rounded-xl border border-border-subtle bg-surface"
              />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {rows.map((r) => (
              <BotCard key={r.meta.id} meta={r.meta} snap={r.snap} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
