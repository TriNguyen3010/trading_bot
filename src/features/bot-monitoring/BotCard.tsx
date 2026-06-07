import {
  FlaskConical,
  Play,
  StopCircle,
  RefreshCcw,
  Trash2,
  Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { DashboardBotMode } from './bot-list.helpers';
import type { PresentationalState } from './presentational-state';

export interface BotCardData {
  id: number;
  name: string;
  pair: string;
  timeframe: string;
  createdAt: string | null;
  stakeAmount: number | null;
  maxOpenTrades: number | null;
  balance: number | null;
  openTrades: number | null;
  /** Underlying lifecycle mode (from deriveMode) — drives Start/Stop/Fix
   * actions. `state` is the presentational overlay (badge/empty hints). */
  mode: DashboardBotMode;
  state: PresentationalState;
  errorMsg: string | null;
  lastBacktest: {
    winRate: number | null;
    trades: number | null;
    /** absolute net profit (USDC) from BacktestHistoryItem.total_profit —
     * history does not carry a % (would need the full results blob). */
    netAbs: number | null;
    status: string;
  } | null;
}

export interface BotCardProps {
  bot: BotCardData;
  onClick: () => void;
  onStart: () => void;
  onStop: () => void;
  onSync: () => void;
  onRemove: () => void;
  onBacktest: () => void;
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

const fmt = (n: number | null, d = 2) => (n == null ? '—' : n.toFixed(d));

export function BotCard({
  bot,
  onClick,
  onStart,
  onStop,
  onSync,
  onRemove,
  onBacktest,
}: BotCardProps) {
  const s = bot.state;
  const showsBalance = s !== 'ERROR' && s !== 'STARTING' && s !== 'STOPPING';
  const showsStrip =
    s !== 'NEW' &&
    s !== 'ERROR' &&
    s !== 'BACKTEST_FAILED' &&
    s !== 'BACKTESTING' &&
    bot.lastBacktest != null;

  return (
    <article
      role="link"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick();
        }
      }}
      className="card-coin98-flat cursor-pointer rounded-2xl p-4 transition hover:brightness-110"
    >
      <div className="min-w-0">
        <span
          className={`inline-flex items-center gap-1 rounded-sm border px-1.5 py-0.5 text-2xs font-bold uppercase ${badgeClass[s]}`}
        >
          {badgeLabel[s]}
        </span>
        <h3 className="mt-2 truncate text-md font-semibold text-fg">
          {bot.name}
        </h3>
        <div className="text-xs text-fg-muted">
          {bot.pair} · {bot.timeframe}
          {bot.createdAt ? ` · created ${bot.createdAt}` : ''}
        </div>
      </div>

      {showsBalance && (
        <div className="mt-3 font-mono text-xl font-bold tabular-nums text-fg">
          {fmt(bot.balance)} <span className="text-xs text-fg-muted">USDC</span>
        </div>
      )}

      {s !== 'ERROR' && (
        <div className="mt-3 grid grid-cols-3 gap-2 text-2xs">
          <Stat
            label="Open"
            value={`${bot.openTrades ?? 0}/${bot.maxOpenTrades ?? '—'}`}
          />
          <Stat label="Stake" value={fmt(bot.stakeAmount, 0)} />
          <Stat label="TF" value={bot.timeframe} />
        </div>
      )}

      {s === 'BACKTESTING' && (
        <div className="mt-3 flex items-center gap-2 text-2xs text-info">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          <span>Backtesting…</span>
        </div>
      )}

      {s === 'NEW' && (
        <p className="mt-3 text-2xs text-fg-muted">
          No backtest yet · run one before going live ↓
        </p>
      )}

      {showsStrip && bot.lastBacktest && (
        <div className="mt-3 flex items-center justify-between rounded-lg border border-border-subtle bg-black/20 px-2.5 py-2">
          <span className="text-2xs text-fg-muted">Last backtest</span>
          <div className="flex gap-3 text-right">
            <MiniStat
              k="Win"
              v={
                bot.lastBacktest.winRate == null
                  ? '—'
                  : `${bot.lastBacktest.winRate.toFixed(1)}%`
              }
            />
            <MiniStat k="Trades" v={String(bot.lastBacktest.trades ?? '—')} />
            <MiniStat
              k="Net"
              v={
                bot.lastBacktest.netAbs == null
                  ? '—'
                  : `${bot.lastBacktest.netAbs >= 0 ? '+' : ''}${bot.lastBacktest.netAbs.toFixed(2)}`
              }
              cls={
                (bot.lastBacktest.netAbs ?? 0) >= 0
                  ? 'text-bullish'
                  : 'text-bearish'
              }
            />
          </div>
        </div>
      )}

      {s === 'ERROR' && bot.errorMsg && (
        <p className="mt-3 text-xs text-bearish/90">
          <strong>error_message:</strong> {bot.errorMsg}
        </p>
      )}
      {s === 'BACKTEST_FAILED' && (
        <p className="mt-3 text-xs text-fg-muted">
          <strong>Backtest failed.</strong> Retry below.
        </p>
      )}

      <Actions
        bot={bot}
        onStart={onStart}
        onStop={onStop}
        onSync={onSync}
        onRemove={onRemove}
        onBacktest={onBacktest}
      />
    </article>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-fg-muted">{label}</div>
      <div className="font-mono font-semibold tabular-nums text-fg">
        {value}
      </div>
    </div>
  );
}

function MiniStat({
  k,
  v,
  cls = 'text-fg',
}: {
  k: string;
  v: string;
  cls?: string;
}) {
  return (
    <div>
      <div className="text-[9px] text-fg-muted">{k}</div>
      <div className={`font-mono text-xs font-semibold ${cls}`}>{v}</div>
    </div>
  );
}

function Actions({
  bot,
  onStart,
  onStop,
  onSync,
  onRemove,
  onBacktest,
}: Omit<BotCardProps, 'onClick'>) {
  const s = bot.state;
  // Start/Stop/Fix + transition spinner follow the underlying lifecycle MODE,
  // never the presentational overlay (a LIVE bot running a backtest must still
  // show Stop, not Start).
  const m = bot.mode;
  if (m === 'STARTING' || m === 'STOPPING') {
    return (
      <div className="mt-3" onClick={(e) => e.stopPropagation()}>
        <Button variant="secondary" size="sm" className="w-full" disabled>
          <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
          {m === 'STARTING' ? 'Starting…' : 'Stopping…'}
        </Button>
      </div>
    );
  }
  return (
    <div
      className="mt-3 flex flex-col gap-1.5"
      onClick={(e) => e.stopPropagation()}
    >
      <Button
        variant="ghost"
        size="sm"
        className="border border-border-subtle text-fg-secondary hover:text-fg"
        disabled={s === 'BACKTESTING'}
        onClick={onBacktest}
      >
        <FlaskConical className="mr-1.5 h-3.5 w-3.5" />
        {s === 'BACKTEST_FAILED'
          ? 'Retry backtest'
          : s === 'NEW'
            ? 'Run first backtest'
            : 'Backtest'}
      </Button>
      <div className="flex gap-1.5">
        {m === 'ERROR' ? (
          <Button
            variant="primary"
            size="sm"
            className="flex-1"
            onClick={onSync}
          >
            <RefreshCcw className="mr-1.5 h-3.5 w-3.5" />
            Fix connection
          </Button>
        ) : m === 'LIVE' || m === 'DRY-RUN' ? (
          <Button
            variant="secondary"
            size="sm"
            className="flex-1"
            onClick={onStop}
          >
            <StopCircle className="mr-1.5 h-3.5 w-3.5" />
            Stop
          </Button>
        ) : (
          <Button
            variant="primary"
            size="sm"
            className="flex-1"
            onClick={onStart}
          >
            <Play className="mr-1.5 h-3.5 w-3.5" />
            Start
          </Button>
        )}
        <Button
          variant="ghost"
          size="sm"
          className="px-2 text-bearish hover:bg-bearish-subtle"
          aria-label="Delete bot"
          onClick={onRemove}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}
