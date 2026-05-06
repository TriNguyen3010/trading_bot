import { useNavigate } from 'react-router-dom';
import { BarChart2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────
interface BotSummary {
  id: string;
  name: string;
  pair: string;
  tf: string;
  mode: 'dry-run' | 'live';
  deployedAt: number;
  todayPnl: number;
  winRate: number;
  totalTrades: number;
}

// ─────────────────────────────────────────────
// Mock data
// ─────────────────────────────────────────────
const MOCK_BOTS: BotSummary[] = [
  {
    id: 'bot-1',
    name: 'Bollinger Breakout BTC',
    pair: 'BTC-USDC',
    tf: '5m',
    mode: 'dry-run',
    deployedAt: Date.now() - 12 * 86400000 - 4 * 3600000,
    todayPnl: 70.80,
    winRate: 0.651,
    totalTrades: 43,
  },
  {
    id: 'bot-2',
    name: 'RSI Mean Revert ETH',
    pair: 'ETH-USDC',
    tf: '15m',
    mode: 'dry-run',
    deployedAt: Date.now() - 3 * 86400000,
    todayPnl: -12.40,
    winRate: 0.48,
    totalTrades: 11,
  },
  {
    id: 'bot-3',
    name: 'EMA Cross SOL',
    pair: 'SOL-USDC',
    tf: '1h',
    mode: 'dry-run',
    deployedAt: Date.now() - 47 * 86400000,
    todayPnl: 142.30,
    winRate: 0.72,
    totalTrades: 201,
  },
];

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────
function formatUptime(deployedAt: number): string {
  const ms = Date.now() - deployedAt;
  const d = Math.floor(ms / 86400000);
  const h = Math.floor((ms % 86400000) / 3600000);
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
function ModeBadge({ mode }: { mode: 'dry-run' | 'live' }) {
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

function BotCard({ bot }: { bot: BotSummary }) {
  const navigate = useNavigate();
  const pnlPositive = bot.todayPnl >= 0;

  return (
    <div className="rounded-xl border border-border-subtle bg-surface p-4 flex flex-col gap-3 hover:border-border-default transition-colors">
      {/* Card header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className="flex-shrink-0 rounded-lg bg-brand/10 p-1.5">
            <BarChart2 className="h-4 w-4 text-brand" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-fg truncate">{bot.name}</p>
            <p className="text-xs text-fg-muted">
              {bot.pair} · {bot.tf}
            </p>
          </div>
        </div>
        <ModeBadge mode={bot.mode} />
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-2 rounded-lg border border-border-subtle bg-canvas px-3 py-2">
        <div className="flex flex-col gap-0.5">
          <span className="text-xs text-fg-muted">Today PnL</span>
          <span
            className={cn(
              'text-sm font-semibold tabular-nums',
              pnlPositive ? 'text-bullish' : 'text-bearish',
            )}
          >
            {formatPnl(bot.todayPnl)}
          </span>
        </div>
        <div className="flex flex-col gap-0.5">
          <span className="text-xs text-fg-muted">Win Rate</span>
          <span className="text-sm font-semibold tabular-nums text-fg">
            {(bot.winRate * 100).toFixed(1)}%
          </span>
        </div>
        <div className="flex flex-col gap-0.5">
          <span className="text-xs text-fg-muted">Trades</span>
          <span className="text-sm font-semibold tabular-nums text-fg">
            {bot.totalTrades}
          </span>
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between">
        <span className="text-xs text-fg-muted">{formatUptime(bot.deployedAt)}</span>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => navigate(`/bots/${bot.id}`)}
        >
          Monitor →
        </Button>
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
        <Button variant="primary" onClick={() => navigate('/builder')}>
          Build your first strategy →
        </Button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────
export function BotsListPage() {
  const navigate = useNavigate();
  const bots = MOCK_BOTS;

  return (
    <div className="min-h-screen bg-canvas text-fg p-6 flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-fg">My Bots</h1>
        <Button variant="primary" onClick={() => navigate('/builder')}>
          New Bot →
        </Button>
      </div>

      {/* Content */}
      {bots.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {bots.map((bot) => (
            <BotCard key={bot.id} bot={bot} />
          ))}
        </div>
      )}
    </div>
  );
}
