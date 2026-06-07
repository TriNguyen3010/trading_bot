import { Loader2, Play, RefreshCcw, RefreshCw, StopCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { DashboardBotMode } from '../bot-list.helpers';
import type { PresentationalState } from '../presentational-state';

export interface DetailHeroData {
  name: string;
  /** Underlying lifecycle mode — drives the action buttons. */
  mode: DashboardBotMode;
  /** Presentational overlay — drives the badge. */
  state: PresentationalState;
  pair: string;
  timeframe: string;
  exchange: string | null;
  tradingMode: string | null;
  createdAt: string | null;
  balance: number | null;
  openTrades: number | null;
  maxOpenTrades: number | null;
  lastBacktest: { winRate: number | null; netAbs: number | null } | null;
}

export interface DetailHeroProps {
  bot: DetailHeroData;
  /** True while a lifecycle request is in flight — disables action buttons. */
  pending?: boolean;
  onSync: () => void;
  onRestart: () => void;
  onStop: () => void;
  onStart: () => void;
}

const badgeClass: Record<PresentationalState, string> = {
  LIVE: 'border-bullish/30 bg-bullish-subtle text-bullish',
  'DRY-RUN': 'border-brand/30 bg-brand-subtle text-brand',
  PAUSED: 'border-fg-muted/30 bg-fg-muted/10 text-fg-muted',
  ERROR: 'border-bearish/40 bg-bearish-subtle text-bearish',
  STARTING: 'border-brand/20 bg-brand/5 text-brand/70',
  STOPPING: 'border-fg-muted/20 bg-fg-muted/5 text-fg-muted/70',
  NEW: 'border-dashed border-brand/35 bg-brand/5 text-brand',
  BACKTESTING: 'border-info/30 bg-info/10 text-info',
  BACKTEST_FAILED: 'border-fg-muted/30 bg-fg-muted/10 text-fg-muted',
};
const badgeLabel: Record<PresentationalState, string> = {
  LIVE: 'Live',
  'DRY-RUN': 'Dry-run',
  PAUSED: 'Paused',
  ERROR: '! Error',
  STARTING: 'Starting…',
  STOPPING: 'Stopping…',
  NEW: 'New',
  BACKTESTING: 'Backtesting',
  BACKTEST_FAILED: 'Paused',
};

const f = (n: number | null, d = 2) => (n == null ? '—' : n.toFixed(d));

export function DetailHero({
  bot,
  pending = false,
  onSync,
  onRestart,
  onStop,
  onStart,
}: DetailHeroProps) {
  const m = bot.mode;
  const bt = bot.lastBacktest;
  return (
    <section className="card-coin98-flat relative overflow-hidden rounded-3xl p-6">
      <div
        aria-hidden
        className="pointer-events-none absolute -left-16 -top-24 h-72 w-72 rounded-full opacity-40 blur-2xl"
        style={{
          background:
            'radial-gradient(circle, rgba(240,185,11,0.22), transparent 70%)',
        }}
      />
      <div className="relative flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-2xl font-bold text-fg">{bot.name}</h1>
            <span
              className={`rounded-sm border px-1.5 py-0.5 text-2xs font-bold uppercase ${badgeClass[bot.state]}`}
            >
              {badgeLabel[bot.state]}
            </span>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-x-3.5 gap-y-1 text-xs text-fg-secondary">
            <span className="font-semibold text-fg">{bot.pair}</span>
            <span>{bot.timeframe}</span>
            {bot.exchange && <span>{bot.exchange}</span>}
            {bot.tradingMode && <span>{bot.tradingMode}</span>}
            {bot.createdAt && (
              <span className="text-fg-muted">created {bot.createdAt}</span>
            )}
          </div>
        </div>
        <Actions
          mode={m}
          pending={pending}
          onSync={onSync}
          onRestart={onRestart}
          onStop={onStop}
          onStart={onStart}
        />
      </div>

      <div className="relative mt-6 grid grid-cols-2 gap-5 sm:grid-cols-4">
        <Kpi
          label="Balance"
          value={`${f(bot.balance)}`}
          unit={bot.balance == null ? undefined : 'USDC'}
        />
        <Kpi
          label="Open trades"
          value={`${bot.openTrades ?? '—'}`}
          unit={
            bot.openTrades != null && bot.maxOpenTrades != null
              ? `/ ${bot.maxOpenTrades}`
              : undefined
          }
        />
        <Kpi
          label="Win rate (bt)"
          value={bt?.winRate == null ? '—' : `${bt.winRate.toFixed(1)}%`}
        />
        <Kpi
          label="Net (bt)"
          value={
            bt?.netAbs == null
              ? '—'
              : `${bt.netAbs >= 0 ? '+' : ''}${bt.netAbs.toFixed(2)}`
          }
          tone={
            bt?.netAbs == null ? undefined : bt.netAbs >= 0 ? 'bull' : 'bear'
          }
        />
      </div>
    </section>
  );
}

function Kpi({
  label,
  value,
  unit,
  tone,
}: {
  label: string;
  value: string;
  unit?: string;
  tone?: 'bull' | 'bear';
}) {
  const cls =
    tone === 'bull'
      ? 'text-bullish'
      : tone === 'bear'
        ? 'text-bearish'
        : 'text-fg';
  return (
    <div>
      <div className="text-2xs uppercase tracking-widest text-fg-muted">
        {label}
      </div>
      <div className={`mt-1 font-mono text-2xl font-bold tabular-nums ${cls}`}>
        {value}
        {unit && <span className="ml-1 text-sm text-fg-muted">{unit}</span>}
      </div>
    </div>
  );
}

function Actions({
  mode,
  pending,
  onSync,
  onRestart,
  onStop,
  onStart,
}: {
  mode: DashboardBotMode;
  pending: boolean;
  onSync: () => void;
  onRestart: () => void;
  onStop: () => void;
  onStart: () => void;
}) {
  if (mode === 'STARTING' || mode === 'STOPPING') {
    return (
      <Button variant="secondary" size="md" disabled>
        <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
        {mode === 'STARTING' ? 'Starting…' : 'Stopping…'}
      </Button>
    );
  }
  const spin = <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />;
  if (mode === 'LIVE' || mode === 'DRY-RUN') {
    return (
      <div className="flex flex-wrap gap-2">
        <Button
          variant="secondary"
          size="md"
          onClick={onSync}
          disabled={pending}
        >
          {pending ? spin : <RefreshCw className="mr-1.5 h-3.5 w-3.5" />}
          Sync
        </Button>
        <Button
          variant="secondary"
          size="md"
          onClick={onRestart}
          disabled={pending}
        >
          {pending ? spin : <RefreshCcw className="mr-1.5 h-3.5 w-3.5" />}
          Restart
        </Button>
        <Button
          variant="secondary"
          size="md"
          onClick={onStop}
          disabled={pending}
        >
          {pending ? spin : <StopCircle className="mr-1.5 h-3.5 w-3.5" />}
          Stop
        </Button>
      </div>
    );
  }
  if (mode === 'ERROR') {
    return (
      <Button variant="primary" size="md" onClick={onSync} disabled={pending}>
        {pending ? spin : <RefreshCcw className="mr-1.5 h-3.5 w-3.5" />}
        Fix connection
      </Button>
    );
  }
  return (
    <Button variant="primary" size="md" onClick={onStart} disabled={pending}>
      {pending ? spin : <Play className="mr-1.5 h-3.5 w-3.5" />}
      Start
    </Button>
  );
}
