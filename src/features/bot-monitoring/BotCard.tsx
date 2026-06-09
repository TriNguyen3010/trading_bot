import { type ReactNode } from 'react';
import { AlertTriangle, Info, Loader2, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { OpenTradesGauge } from './OpenTradesGauge';
import { StatusBadge } from './status-badge';
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
  /** Underlying lifecycle mode (from deriveMode) — drives Start/Stop. `state`
   * is the presentational overlay (badge / empty hints). */
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
  onRemove: () => void;
  onBacktest: () => void;
}

const RUNNING = new Set<PresentationalState>(['LIVE', 'DRY-RUN']);
const STRIP_STATES = new Set<PresentationalState>([
  'LIVE',
  'DRY-RUN',
  'PAUSED',
  'STARTING',
  'STOPPING',
]);

const GAUGE_PLACEHOLDER: Partial<Record<PresentationalState, string>> = {
  PAUSED: '— paused',
  BACKTEST_FAILED: '— paused',
  STARTING: 'spinning up…',
  STOPPING: '— stopping',
  NEW: 'not started',
  BACKTESTING: '—',
  ERROR: '— stopped',
};

const fmtBalance = (n: number | null) =>
  n == null
    ? null
    : n.toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });

function fmtNet(n: number | null): string {
  if (n == null) return '—';
  const s = n.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return n >= 0 ? `+${s}` : s; // negatives already carry '-'
}

export function BotCard({
  bot,
  onClick,
  onStart,
  onStop,
  onRemove,
  onBacktest,
}: BotCardProps) {
  const s = bot.state;
  const running = RUNNING.has(s);
  const balance = running ? fmtBalance(bot.balance) : null;

  return (
    <article
      role="link"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        // Only the card itself navigates — a keydown bubbling up from a footer
        // button (Enter/Space on Start/Stop/Backtest) must NOT navigate.
        if (e.target !== e.currentTarget) return;
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick();
        }
      }}
      className={cn(
        'card-coin98-flat flex h-full min-h-[318px] cursor-pointer flex-col rounded-[18px] border border-border-subtle p-[18px] transition duration-150 hover:-translate-y-[3px] hover:border-border-strong hover:shadow-[0_10px_30px_-12px_rgba(0,0,0,0.7)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand',
        s === 'ERROR' && 'border-bearish/35',
      )}
    >
      {/* Head */}
      <div className="mb-3.5 flex items-center justify-between">
        <StatusBadge state={s} />
      </div>

      {/* Identity */}
      <h3 className="text-[17px] font-bold tracking-[-0.2px] text-fg">
        {bot.name}
      </h3>
      <div className="mt-[3px] flex items-center gap-[7px] font-mono text-sm text-fg-muted">
        {bot.pair}
        <span className="text-border-strong">·</span>
        {bot.timeframe}
      </div>

      {/* Balance */}
      <div className="mt-4">
        <div className="flex items-center text-[10.5px] font-semibold uppercase tracking-[0.6px] text-fg-muted">
          Balance
          {s === 'DRY-RUN' && (
            <span className="ml-1.5 rounded-[4px] border border-border px-1 py-px text-[9px] font-bold tracking-[0.5px] text-fg-disabled">
              paper
            </span>
          )}
        </div>
        <div
          className={cn(
            'font-mono text-[22px] font-semibold tabular-nums leading-[1.1] tracking-[-0.5px]',
            balance ? 'text-fg' : 'text-fg-disabled',
          )}
        >
          {balance ?? '—'}
          <span className="ml-1 text-sm font-medium text-fg-muted">USDC</span>
        </div>
      </div>

      {/* Micro row */}
      <div className="mt-4 flex gap-[18px]">
        <div className="flex min-w-0 flex-col gap-[5px]">
          <span className="text-2xs font-semibold uppercase tracking-[0.5px] text-fg-muted">
            Open trades
          </span>
          <OpenTradesGauge
            open={bot.openTrades}
            max={bot.maxOpenTrades}
            tone={s === 'DRY-RUN' ? 'dryrun' : 'live'}
            placeholder={running ? undefined : GAUGE_PLACEHOLDER[s]}
          />
        </div>
        <Micro
          label="Stake"
          value={bot.stakeAmount == null ? '—' : String(bot.stakeAmount)}
        />
        <Micro label="TF" value={bot.timeframe} />
      </div>

      {/* Divider */}
      <div className="mb-3.5 mt-4 h-px bg-border-subtle" />

      {/* Backtest area — mt-auto pins this + footer to the card bottom */}
      <div className="mt-auto">
        <BacktestArea bot={bot} />
      </div>

      {/* Footer */}
      <Footer
        bot={bot}
        onStart={onStart}
        onStop={onStop}
        onRemove={onRemove}
        onBacktest={onBacktest}
      />
    </article>
  );
}

function Micro({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-[5px]">
      <span className="text-2xs font-semibold uppercase tracking-[0.5px] text-fg-muted">
        {label}
      </span>
      <span className="font-mono text-[13px] font-medium tabular-nums text-fg-secondary">
        {value}
      </span>
    </div>
  );
}

function BtStat({
  label,
  value,
  cls = 'text-fg',
}: {
  label: string;
  value: string;
  cls?: string;
}) {
  return (
    <div className="flex flex-1 flex-col gap-0.5">
      <span className="text-2xs text-fg-muted">{label}</span>
      <span
        className={cn('font-mono text-base font-semibold tabular-nums', cls)}
      >
        {value}
      </span>
    </div>
  );
}

function NoteRow({
  icon,
  text,
  tone,
  alignTop = false,
}: {
  icon: ReactNode;
  text: string;
  tone: string;
  alignTop?: boolean;
}) {
  return (
    <div
      className={cn(
        'flex min-h-[44px] gap-2 py-2.5 text-[12.5px]',
        alignTop ? 'items-start' : 'items-center',
        tone,
      )}
    >
      {icon}
      <span className={alignTop ? 'leading-[1.35]' : undefined}>{text}</span>
    </div>
  );
}

function BacktestArea({ bot }: { bot: BotCardData }) {
  const s = bot.state;
  const head = s === 'ERROR' ? 'Status' : 'Last backtest';
  const Head = (
    <div className="mb-2 text-2xs font-semibold uppercase tracking-[0.6px] text-fg-muted">
      {head}
    </div>
  );

  if (s === 'NEW') {
    return (
      <div>
        {Head}
        <NoteRow
          tone="text-fg-secondary"
          icon={<Info className="h-4 w-4 shrink-0 text-brand" />}
          text="No backtest yet — run one before going live."
        />
      </div>
    );
  }
  if (s === 'BACKTESTING') {
    return (
      <div>
        {Head}
        <NoteRow
          tone="text-fg-muted"
          icon={
            <Loader2 className="h-4 w-4 shrink-0 animate-spin-fast text-brand" />
          }
          text="Backtesting… crunching historical data."
        />
      </div>
    );
  }
  if (s === 'BACKTEST_FAILED') {
    return (
      <div>
        {Head}
        <NoteRow
          tone="text-fg-muted"
          icon={<AlertTriangle className="h-4 w-4 shrink-0 text-fg-muted" />}
          text="Backtest failed. Retry below."
        />
      </div>
    );
  }
  if (s === 'ERROR') {
    return (
      <div>
        {Head}
        <NoteRow
          tone="text-bearish"
          alignTop
          icon={<AlertTriangle className="h-4 w-4 shrink-0 text-bearish" />}
          text={bot.errorMsg ?? 'Bot stopped with an error.'}
        />
      </div>
    );
  }

  // Strip states (LIVE / DRY-RUN / PAUSED / STARTING / STOPPING)
  if (STRIP_STATES.has(s) && bot.lastBacktest) {
    const bt = bot.lastBacktest;
    return (
      <div>
        {Head}
        <div className="flex">
          <BtStat
            label="Win rate"
            value={bt.winRate == null ? '—' : `${Math.round(bt.winRate)}%`}
          />
          <BtStat
            label="Trades"
            value={bt.trades == null ? '—' : String(bt.trades)}
          />
          <BtStat
            label="Net"
            value={fmtNet(bt.netAbs)}
            cls={(bt.netAbs ?? 0) >= 0 ? 'text-bullish' : 'text-bearish'}
          />
        </div>
      </div>
    );
  }

  // Running/paused bot with no backtest history → blank (footer still pinned).
  return null;
}

const CARD_BTN_BASE =
  'inline-flex items-center justify-center gap-[7px] rounded-[10px] py-2 text-[12.5px] font-semibold transition active:translate-y-px disabled:cursor-not-allowed disabled:opacity-50';

const CARD_BTN_VARIANT: Record<string, string> = {
  ghost:
    'border border-border bg-transparent text-fg-secondary hover:border-border-strong hover:bg-surface hover:text-fg',
  primary: 'bg-brand text-[#1a1500] hover:bg-brand-hover',
  soft: 'border border-border bg-surface text-fg-secondary',
  stop: 'border border-bearish/40 bg-transparent text-bearish hover:border-bearish hover:bg-bearish-subtle',
  start:
    'border border-bullish/40 bg-transparent text-bullish hover:border-bullish hover:bg-bullish-subtle',
  del: 'text-fg-muted hover:bg-bearish-subtle hover:text-bearish',
};

function CardButton({
  variant,
  grow,
  iconOnly,
  disabled,
  spinner,
  onClick,
  ariaLabel,
  children,
}: {
  variant: keyof typeof CARD_BTN_VARIANT;
  grow?: boolean;
  iconOnly?: boolean;
  disabled?: boolean;
  spinner?: boolean;
  onClick?: () => void;
  ariaLabel?: string;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      aria-label={ariaLabel}
      onClick={onClick}
      className={cn(
        CARD_BTN_BASE,
        CARD_BTN_VARIANT[variant],
        iconOnly ? 'w-9 px-0' : grow ? 'flex-1 px-2.5' : 'flex-none px-2.5',
      )}
    >
      {spinner && <Loader2 className="h-3.5 w-3.5 animate-spin-fast" />}
      {children}
    </button>
  );
}

function Footer({
  bot,
  onStart,
  onStop,
  onRemove,
  onBacktest,
}: Omit<BotCardProps, 'onClick'>) {
  const s = bot.state;
  const m = bot.mode;
  const transitioning = m === 'STARTING' || m === 'STOPPING';
  const backtesting = s === 'BACKTESTING';
  const isRunningMode = m === 'LIVE' || m === 'DRY-RUN';
  // Lifecycle button is omitted for NEW (must backtest first) and for a
  // backtesting bot that is NOT running (matches mockup card 8).
  const showLifecycle = s !== 'NEW' && !(backtesting && !isRunningMode);

  return (
    <div className="mt-4 flex gap-2" onClick={(e) => e.stopPropagation()}>
      {/* Slot 1 — primary (grow) */}
      {backtesting ? (
        <CardButton variant="soft" grow disabled spinner>
          Running…
        </CardButton>
      ) : s === 'NEW' ? (
        <CardButton variant="primary" grow onClick={onBacktest}>
          Run first backtest
        </CardButton>
      ) : (
        <CardButton
          variant="ghost"
          grow
          disabled={transitioning}
          onClick={onBacktest}
        >
          {s === 'BACKTEST_FAILED' ? 'Retry backtest' : 'Backtest'}
        </CardButton>
      )}

      {/* Slot 2 — lifecycle (by mode) */}
      {showLifecycle &&
        (m === 'STARTING' ? (
          <CardButton variant="soft" disabled spinner>
            Starting
          </CardButton>
        ) : m === 'STOPPING' ? (
          <CardButton variant="soft" disabled spinner>
            Stopping
          </CardButton>
        ) : isRunningMode ? (
          <CardButton variant="stop" onClick={onStop}>
            Stop
          </CardButton>
        ) : (
          <CardButton variant="start" onClick={onStart}>
            Start
          </CardButton>
        ))}

      {/* Slot 3 — delete */}
      <CardButton
        variant="del"
        iconOnly
        disabled={transitioning || backtesting}
        ariaLabel="Delete bot"
        onClick={onRemove}
      >
        <Trash2 className="h-3.5 w-3.5" />
      </CardButton>
    </div>
  );
}
