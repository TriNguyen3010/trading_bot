import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Settings as SettingsIcon } from 'lucide-react';
import { ImportDialog } from '@/features/export-import/ImportDialog';
import { useRequireWallet } from '@/features/wallet-auth/RequireWalletProvider';
import { WalletChip } from '@/features/wallet-auth/WalletChip';

// =============================================================================
// MOCK DATA — Dashboard demo. Real impl will wire to botApi.list() via the
// existing `MyBotsDialog` logic (or a thin variant of it).
// =============================================================================
interface MockBot {
  id: number;
  name: string;
  pair: string;
  timeframe: string;
  uptime: string;
  mode: 'LIVE' | 'DRY-RUN' | 'PAUSED' | 'ERROR';
  pnl: string;
  pnlPct: string;
  pnlDirection: 'up' | 'down' | 'flat';
  badge?: string;
  trades?: number;
  winRate?: number;
  sharpe?: number;
  errorMsg?: string;
  sparkline?: number[];
}

const MOCK_BOTS: MockBot[] = [
  {
    id: 1,
    name: 'RSI Momentum Long',
    pair: 'ETH-USDC',
    timeframe: '5m',
    uptime: '5d 17h',
    mode: 'LIVE',
    pnl: '+$234.10',
    pnlPct: '+2.34%',
    pnlDirection: 'up',
    badge: '7-WIN STREAK',
    trades: 23,
    winRate: 78,
    sharpe: 2.14,
    sparkline: [42, 40, 32, 36, 24, 18, 8, 4],
  },
  {
    id: 2,
    name: 'MACD Cross',
    pair: 'SOL-USDC',
    timeframe: '1h',
    uptime: '12h paper',
    mode: 'DRY-RUN',
    pnl: '+$18.40',
    pnlPct: '+0.18%',
    pnlDirection: 'up',
    trades: 4,
    winRate: 75,
    sharpe: 1.42,
    sparkline: [35, 32, 28, 30, 24, 26, 18, 15],
  },
  {
    id: 3,
    name: 'BB Mean Revert',
    pair: 'BTC-USDC',
    timeframe: '15m',
    uptime: '2d 4h',
    mode: 'LIVE',
    pnl: '+$481.70',
    pnlPct: '+4.81%',
    pnlDirection: 'up',
    trades: 14,
    winRate: 71,
    sharpe: 1.78,
    sparkline: [80, 72, 65, 58, 52, 44, 30, 18],
  },
  {
    id: 4,
    name: 'ADX Trend Follow',
    pair: 'AVAX-USDC',
    timeframe: '4h',
    uptime: 'stopped 4m ago',
    mode: 'ERROR',
    pnl: '-$12.30',
    pnlPct: '-0.12%',
    pnlDirection: 'down',
    errorMsg: 'Hyperliquid rejected the last order signature.',
  },
  {
    id: 5,
    name: 'EMA Cross Short',
    pair: 'DOGE-USDC',
    timeframe: '15m',
    uptime: 'paused 1d ago',
    mode: 'PAUSED',
    pnl: '$0.00',
    pnlPct: '+0.00%',
    pnlDirection: 'flat',
  },
];

const PORTFOLIO_STATS = {
  pnl30d: '+$734.20',
  pnl30dPct: '+5.6%',
  activeBots: '5',
  totalBots: '8',
  capitalDeployed: '$3,420',
  capitalPairs: '3 pairs',
  tradesToday: '12',
  tradesNet: '+$23.10',
};

export function DashboardPage() {
  const navigate = useNavigate();
  const { requireWalletThen } = useRequireWallet();
  const [search, setSearch] = useState('');
  const [importOpen, setImportOpen] = useState(false);

  const filteredBots = search
    ? MOCK_BOTS.filter((b) =>
        b.name.toLowerCase().includes(search.toLowerCase()) ||
        b.pair.toLowerCase().includes(search.toLowerCase()),
      )
    : MOCK_BOTS;

  return (
    <div className="dot-canvas relative min-h-screen text-fg">
      {/* Header */}
      <header className="relative flex items-center justify-between border-b border-border-subtle bg-black/40 px-8 py-4 backdrop-blur">
        <div className="flex items-baseline gap-3">
          <button
            type="button"
            onClick={() => navigate('/')}
            className="font-pixel text-[9px] tracking-[0.2em] text-brand hover:brightness-110"
          >
            COIN98 BOT
          </button>
          <span className="h-3 w-px bg-border" />
          <span className="text-xs text-fg-muted">
            My bots · {MOCK_BOTS.length} total · 2 LIVE · 1 DRY-RUN
          </span>
        </div>
        <div className="flex items-center gap-3 text-[12px]">
          <button
            type="button"
            className="inline-flex items-center gap-1.5 text-fg-muted hover:text-fg"
            onClick={() => {
              /* TODO: /settings route */
            }}
          >
            <SettingsIcon className="h-3.5 w-3.5" />
            Settings
          </button>
          <WalletChip />
        </div>
      </header>

      <main className="relative mx-auto max-w-[1400px] px-8 py-6">
        {/* Cockpit strip + toolbar */}
        <div className="grid grid-cols-1 items-end gap-5 lg:grid-cols-[1fr_auto]">
          <div className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-border-subtle bg-border-subtle md:grid-cols-4">
            <PortfolioCell
              label="P&L · 30D"
              value={PORTFOLIO_STATS.pnl30d}
              valueClass="text-bullish"
              hint={
                <span className="text-bullish">
                  {PORTFOLIO_STATS.pnl30dPct}
                </span>
              }
            />
            <PortfolioCell
              label="Active bots"
              value={
                <>
                  {PORTFOLIO_STATS.activeBots}
                  <span className="text-base text-fg-muted">
                    {' '}
                    / {PORTFOLIO_STATS.totalBots}
                  </span>
                </>
              }
              hint="3 paused"
            />
            <PortfolioCell
              label="Capital deployed"
              value={PORTFOLIO_STATS.capitalDeployed}
              hint={`across ${PORTFOLIO_STATS.capitalPairs}`}
            />
            <PortfolioCell
              label="Trades today"
              value={PORTFOLIO_STATS.tradesToday}
              hint={
                <span className="text-bullish">
                  {PORTFOLIO_STATS.tradesNet} net
                </span>
              }
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-fg-muted" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search bots…"
                className="w-44 rounded-lg border border-border bg-input px-3 py-2 pl-8 text-sm text-fg placeholder:text-fg-muted focus:border-brand focus:outline-none"
              />
            </div>
            <button
              type="button"
              onClick={() =>
                requireWalletThen(() => setImportOpen(true))
              }
              className="rounded-lg border border-border bg-input px-3 py-2 text-sm text-fg hover:border-brand"
            >
              Import
            </button>
            <button
              type="button"
              onClick={() =>
                requireWalletThen(() => navigate('/builder'))
              }
              className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-black hover:brightness-110"
            >
              ＋ New bot
            </button>
          </div>
        </div>

        {/* Bot cards grid */}
        <div className="mt-6 grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
          {filteredBots.map((bot) => (
            <BotCard
              key={bot.id}
              bot={bot}
              onClick={() => navigate(`/bots/${bot.id}`)}
            />
          ))}

          {/* Add new bot tile spans remaining row(s) for visual weight */}
          <button
            type="button"
            onClick={() => requireWalletThen(() => navigate('/builder'))}
            className="flex min-h-[230px] flex-col items-center justify-center rounded-2xl border-2 border-dashed border-border-strong bg-transparent p-4 text-center transition hover:border-brand hover:bg-brand-soft"
          >
            <div className="text-2xl text-fg-muted">＋</div>
            <div className="mt-2 text-sm font-semibold text-fg-secondary">
              New bot
            </div>
            <div className="mt-1 text-[11px] text-fg-muted">
              Build from scratch or import
            </div>
          </button>
        </div>

        {filteredBots.length === 0 && (
          <div className="mt-6 rounded-xl border border-border-subtle bg-base p-10 text-center">
            <p className="text-sm font-semibold text-fg">No bots match "{search}"</p>
            <button
              type="button"
              onClick={() => setSearch('')}
              className="mt-2 text-[12px] text-brand hover:underline"
            >
              Clear search
            </button>
          </div>
        )}
      </main>

      <ImportDialog open={importOpen} onOpenChange={setImportOpen} />
    </div>
  );
}

// ----------------------------------------------------------------------------
// Sub-components
// ----------------------------------------------------------------------------

interface PortfolioCellProps {
  label: string;
  value: React.ReactNode;
  hint: React.ReactNode;
  valueClass?: string;
}

function PortfolioCell({ label, value, hint, valueClass }: PortfolioCellProps) {
  return (
    <div className="bg-base p-4">
      <div className="text-[9px] font-semibold uppercase tracking-[0.08em] text-fg-muted">
        {label}
      </div>
      <div
        className={`mt-1 font-mono text-2xl font-bold leading-tight tabular-nums text-fg ${valueClass ?? ''}`}
      >
        {value}
      </div>
      <div className="mt-0.5 text-[11px] text-fg-muted">{hint}</div>
    </div>
  );
}

interface BotCardProps {
  bot: MockBot;
  onClick: () => void;
}

function BotCard({ bot, onClick }: BotCardProps) {
  const modeStyle = {
    LIVE: 'border-bullish/30 bg-bullish/10 text-bullish',
    'DRY-RUN': 'border-cyan/30 bg-cyan/10 text-cyan',
    PAUSED: 'border-fg-muted/30 bg-fg-muted/10 text-fg-muted',
    ERROR: 'border-bearish/40 bg-bearish/15 text-bearish',
  }[bot.mode];

  const cardBorder = {
    LIVE: 'border-bullish/30',
    'DRY-RUN': 'border-cyan/30',
    PAUSED: 'border-border-subtle',
    ERROR: 'border-bearish/50',
  }[bot.mode];

  const pnlClass =
    bot.pnlDirection === 'up'
      ? 'text-bullish'
      : bot.pnlDirection === 'down'
        ? 'text-bearish'
        : 'text-fg-muted';

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
      className={`card-coin98 cursor-pointer rounded-2xl border p-4 transition hover:brightness-110 ${cardBorder}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            <span
              className={`inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[10px] font-bold ${modeStyle}`}
            >
              {bot.mode === 'LIVE' && (
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-bullish" />
              )}
              {bot.mode === 'DRY-RUN' && (
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-cyan" />
              )}
              {bot.mode === 'ERROR' && <span>⚠</span>}
              {bot.mode}
            </span>
            {bot.badge && (
              <span className="rounded bg-bullish-subtle px-1.5 py-0.5 text-[10px] font-bold text-bullish">
                {bot.badge}
              </span>
            )}
          </div>
          <h3 className="mt-2 truncate text-base font-semibold text-fg">
            {bot.name}
          </h3>
          <div className="text-[11px] text-fg-muted">
            {bot.pair} · {bot.timeframe} · {bot.uptime}
          </div>
        </div>
        <button
          type="button"
          onClick={(e) => e.stopPropagation()}
          className="text-fg-muted hover:text-fg"
          aria-label="More options"
        >
          ⋯
        </button>
      </div>

      {/* PnL hero */}
      <div className="mt-3 flex items-baseline gap-2">
        <span
          className={`font-mono text-2xl font-bold tabular-nums ${pnlClass}`}
        >
          {bot.pnl}
        </span>
        <span className={`text-sm ${pnlClass}`}>{bot.pnlPct}</span>
      </div>

      {/* Sparkline (mock) */}
      {bot.sparkline && bot.sparkline.length >= 2 && (
        <Sparkline values={bot.sparkline} color={bot.pnlDirection} />
      )}

      {/* Error message replaces stats */}
      {bot.mode === 'ERROR' && bot.errorMsg ? (
        <p className="mt-3 text-[12px] text-bearish/90">{bot.errorMsg}</p>
      ) : bot.trades != null ? (
        <div className="mt-3 grid grid-cols-3 gap-2 text-[10px]">
          <div>
            <div className="text-fg-muted">Trades</div>
            <div className="font-mono font-semibold tabular-nums text-fg">
              {bot.trades}
            </div>
          </div>
          {bot.winRate != null && (
            <div>
              <div className="text-fg-muted">Win rate</div>
              <div className="font-mono font-semibold tabular-nums text-fg">
                {bot.winRate}%
              </div>
            </div>
          )}
          {bot.sharpe != null && (
            <div>
              <div className="text-fg-muted">Sharpe</div>
              <div className="font-mono font-semibold tabular-nums text-fg">
                {bot.sharpe.toFixed(2)}
              </div>
            </div>
          )}
        </div>
      ) : null}

      {/* Actions */}
      <div className="mt-3 flex gap-1.5">
        {bot.mode === 'ERROR' ? (
          <button
            type="button"
            onClick={(e) => e.stopPropagation()}
            className="flex-1 rounded-md bg-brand py-1.5 text-[11px] font-semibold text-black"
          >
            Fix connection
          </button>
        ) : (
          <>
            <button
              type="button"
              onClick={(e) => e.stopPropagation()}
              className="flex-1 rounded-md border border-border bg-input py-1.5 text-[11px] text-fg-secondary"
            >
              Edit
            </button>
            <button
              type="button"
              onClick={(e) => e.stopPropagation()}
              className="flex-1 rounded-md border border-border bg-input py-1.5 text-[11px] text-fg-secondary"
            >
              {bot.mode === 'PAUSED' ? '▶ Resume' : '⏸ Pause'}
            </button>
            <button
              type="button"
              onClick={(e) => e.stopPropagation()}
              className="rounded-md border border-bearish/40 bg-bearish/10 px-2 py-1.5 text-[11px] text-bearish"
              aria-label="Stop bot"
            >
              ■
            </button>
          </>
        )}
      </div>
    </article>
  );
}

interface SparklineProps {
  values: number[];
  color: 'up' | 'down' | 'flat';
}

function Sparkline({ values, color }: SparklineProps) {
  const max = Math.max(...values);
  const min = Math.min(...values);
  const range = max - min || 1;

  const points = values
    .map((v, i) => {
      const x = (i / (values.length - 1)) * 200;
      const y = 50 - ((v - min) / range) * 42 - 2;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' L ');

  const stroke =
    color === 'up' ? '#0ECB81' : color === 'down' ? '#F6465D' : '#848e9c';
  const fill =
    color === 'up'
      ? 'rgba(14,203,129,0.15)'
      : color === 'down'
        ? 'rgba(246,70,93,0.15)'
        : 'rgba(132,142,156,0.10)';

  return (
    <svg
      viewBox="0 0 200 50"
      className="mt-2 h-10 w-full"
      preserveAspectRatio="none"
    >
      <path
        d={`M ${points} L 200,50 L 0,50 Z`}
        fill={fill}
        stroke="none"
      />
      <path d={`M ${points}`} fill="none" stroke={stroke} strokeWidth={2} />
    </svg>
  );
}
