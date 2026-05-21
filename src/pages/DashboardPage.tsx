import { useEffect, useId, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, RefreshCw, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DotGridSpotlight } from '@/features/fx/DotGridSpotlight';
import { ImportDialog } from '@/features/export-import/ImportDialog';
import { useRequireWallet } from '@/features/wallet-auth/RequireWalletProvider';
import { botApi } from '@/features/bot-monitoring/bot.api';
import {
  zipBotsAndConfigs,
  type ConfigShape,
  type DashboardBot,
} from '@/features/bot-monitoring/bot-list.helpers';
import { formatBackendError } from '@/lib/format-error';
import { AppHeader } from './AppHeader';

// =============================================================================
// MOCK DATA — used as visual fallback in the empty state only (real bots = 0).
// Real bot list is fetched via botApi.list() / botApi.getConfig() per spec
// docs/superpowers/specs/2026-05-20-dashboard-real-bots-design.md.
// =============================================================================

/** Mock variant of DashboardBot used for the empty-state showcase. Same
 * shape as a real DashboardBot but with rich human-readable mock values for
 * fields the BE doesn't yet expose (pnl, trades, sparkline) and `isDemo: true`
 * so the BotCard renders the DEMO pill. */
type MockBot = Omit<DashboardBot, 'isDemo' | 'uptime'> & {
  isDemo: true;
  uptime: string;
};

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
    errorMsg: null,
    isDemo: true,
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
    errorMsg: null,
    isDemo: true,
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
    trades: null,
    winRate: null,
    sharpe: null,
    sparkline: null,
    errorMsg: 'Hyperliquid rejected the last order signature.',
    isDemo: true,
  },
];

export function DashboardPage() {
  const navigate = useNavigate();
  const { requireWalletThen } = useRequireWallet();
  const [search, setSearch] = useState('');
  const [importOpen, setImportOpen] = useState(false);

  // Real-bot fetch state. `realBots === null` means "not yet loaded";
  // empty array means "loaded, user has no bots" (we'll render the demo
  // fallback). Bump `refreshKey` to force the useEffect to re-run.
  const [realBots, setRealBots] = useState<DashboardBot[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      setLoading(true);
      setFetchError(null);
      try {
        const list = await botApi.list();
        if (cancelled) return;

        if (list.length === 0) {
          setRealBots([]);
          return;
        }

        const configs = await Promise.allSettled(
          list.map((b) => botApi.getConfig(b.id)),
        );
        if (cancelled) return;

        // Unwrap BotConfigOut → inner ConfigShape. `botApi.getConfig` returns
        // `{ config: { dry_run, timeframe, exchange, ... } }` (openapi
        // BotConfigOut). MyBotsDialog.tsx:217 does the same unwrap.
        const configsOrNull = configs.map((r) =>
          r.status === 'fulfilled' ? (r.value.config as ConfigShape) : null,
        );
        setRealBots(zipBotsAndConfigs(list, configsOrNull));
      } catch (err) {
        if (cancelled) return;
        setFetchError(formatBackendError(err));
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  const handleRefresh = () => setRefreshKey((k) => k + 1);

  // Show real bots when available; fall back to demo samples when the user
  // has no bots yet (empty state). Loading/error states render their own
  // UI below and bypass this entirely.
  const baseBots: (DashboardBot | MockBot)[] =
    realBots && realBots.length > 0 ? realBots : MOCK_BOTS;

  const filteredBots = search
    ? baseBots.filter(
        (b) =>
          b.name.toLowerCase().includes(search.toLowerCase()) ||
          b.pair.toLowerCase().includes(search.toLowerCase()),
      )
    : baseBots;

  const isEmptyReal = realBots !== null && realBots.length === 0;
  const isLoadedReal = realBots !== null && realBots.length > 0;

  // Hero counts derived from real bots when present; "—" placeholders for
  // P&L/capital/trades aggregate until the monitoring phase wires those.
  const portfolioStats = useMemo(() => {
    const source = realBots ?? [];
    const active = source.filter(
      (b) => b.mode === 'LIVE' || b.mode === 'DRY-RUN',
    ).length;
    const paused = source.filter((b) => b.mode === 'PAUSED').length;
    return {
      activeBots: String(active),
      totalBots: String(source.length),
      pausedBots: String(paused),
      pnl30d: '—',
      pnl30dPct: '—',
      capitalDeployed: '—',
      capitalPairs: '—',
      tradesToday: '—',
      tradesNet: '—',
    };
  }, [realBots]);

  return (
    <div className="flex h-screen w-screen flex-col bg-black text-fg">
      {/* Page-wide subtle yellow glow accents (Coin98 hero halos) —
          matches BotMonitoringPage exactly so route transitions feel
          continuous. */}
      <div
        className="pointer-events-none fixed -top-20 left-1/2 z-0 h-[420px] w-[700px] -translate-x-1/2 rounded-full opacity-50 blur-3xl"
        style={{
          background:
            'radial-gradient(ellipse at center, rgba(240,185,11,0.12), transparent 70%)',
        }}
        aria-hidden
      />
      {/* Dot-grid texture — starts at the viewport edge so it sits behind the
          fixed floating header instead of leaving a black strip. */}
      <DotGridSpotlight
        className="pointer-events-none fixed z-0"
        style={{
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
        }}
        dimmed={false}
      />

      <AppHeader />

      <main className="relative z-10 flex-1 overflow-y-auto">
        <div className="mx-auto flex max-w-6xl flex-col gap-5 px-8 py-7">
          {/* Hero portfolio — mirrors HeroPnL frame on the monitoring page */}
          <section
            aria-labelledby="portfolio-label"
            className="card-coin98-flat relative grid grid-cols-[1fr_auto] gap-6 overflow-hidden rounded-3xl p-8"
          >
            {/* Yellow halo behind the number — same as HeroPnL */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -left-16 -top-24 h-80 w-80 rounded-full opacity-40 blur-2xl"
              style={{
                background:
                  'radial-gradient(circle, rgba(240,185,11,0.25), transparent 70%)',
              }}
            />
            {/* Bullish-tinted halo on the right (since portfolio is up) */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full opacity-30 blur-2xl"
              style={{
                background:
                  'radial-gradient(circle, var(--color-bullish), transparent 70%)',
              }}
            />

            <div className="relative">
              <div
                id="portfolio-label"
                className="mb-4 flex items-center gap-3 text-2xs uppercase tracking-widest text-fg-muted"
              >
                <span>Portfolio · 30D</span>
                <span className="inline-flex items-center gap-1.5 text-bullish">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-bullish" />
                  Live
                </span>
                {isEmptyReal && (
                  <>
                    <span className="text-border-strong">·</span>
                    <span
                      className="rounded-sm border border-dashed border-fg-muted/40 px-1.5 py-0.5 text-fg-muted"
                      title="Hardcoded demo data — not from your wallet"
                    >
                      Demo
                    </span>
                  </>
                )}
              </div>

              <div
                className="font-mono text-6xl font-bold tabular-nums tracking-tight text-bullish"
                style={{
                  textShadow: '0 0 38px rgba(14, 203, 129, 0.45)',
                  lineHeight: 1.0,
                }}
              >
                {portfolioStats.pnl30d}
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-fg-secondary">
                <span className="inline-flex items-center gap-1.5">
                  <span className="text-bullish">▲</span>
                  <span className="font-semibold tabular-nums text-fg">
                    {portfolioStats.activeBots}
                  </span>
                  <span className="text-fg-muted">
                    active · {portfolioStats.totalBots} total
                  </span>
                </span>
                <span className="text-border-strong">·</span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="font-semibold tabular-nums text-fg-muted">
                    {portfolioStats.pausedBots}
                  </span>
                  <span className="text-fg-muted">paused</span>
                </span>
                <span className="text-border-strong">·</span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="font-semibold tabular-nums text-fg">
                    {portfolioStats.capitalDeployed}
                  </span>
                  <span className="text-fg-muted">
                    deployed across {portfolioStats.capitalPairs}
                  </span>
                </span>
                <span className="text-border-strong">·</span>
                <span className="inline-flex items-center gap-1.5 text-fg-muted">
                  <span className="font-semibold tabular-nums text-fg">
                    {portfolioStats.tradesToday}
                  </span>
                  <span>trades today</span>
                  <span className="font-semibold tabular-nums text-bullish">
                    {portfolioStats.tradesNet} net
                  </span>
                </span>
              </div>
            </div>

            {/* Right summary — 30D return % */}
            <div className="relative flex w-32 flex-col items-center justify-center">
              <div className="font-mono text-3xl font-bold tabular-nums text-bullish">
                {portfolioStats.pnl30dPct}
              </div>
              <div className="mt-2 text-2xs uppercase tracking-widest text-fg-muted">
                30-day return
              </div>
            </div>
          </section>

          {/* My bots — toolbar in header, grid below */}
          <section className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-2xs font-semibold uppercase tracking-widest text-fg-muted">
                My bots · {portfolioStats.totalBots} total
              </h2>
              <div className="flex items-center gap-2">
                {/* Search input only when loaded with real bots — empty/loading/
                    error states have nothing useful to search. */}
                {isLoadedReal && (
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-fg-muted" />
                    <input
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Search bots…"
                      className="h-9 w-44 rounded-md border border-border bg-input pl-8 pr-3 text-sm text-fg placeholder:text-fg-muted focus:border-brand focus:outline-none"
                    />
                  </div>
                )}
                {/* Refresh button visible whenever the fetch isn't mid-flight
                    or errored — including empty state so user can refetch
                    after creating a bot in another tab. */}
                {!loading && !fetchError && (
                  <Button
                    variant="ghost"
                    size="md"
                    onClick={handleRefresh}
                    aria-label="Refresh bots"
                    title="Refresh"
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                  </Button>
                )}
                {/* Both CTAs share min-w-[120px] so they line up at the same
                    width regardless of label length. The arrow on New bot
                    nudges right on hover for a subtle motion cue. */}
                <Button
                  variant="secondary"
                  size="md"
                  className="min-w-[120px]"
                  onClick={() => requireWalletThen(() => setImportOpen(true))}
                >
                  Import
                </Button>
                <Button
                  variant="primary"
                  size="md"
                  className="group min-w-[120px]"
                  onClick={() => requireWalletThen(() => navigate('/builder'))}
                >
                  New bot
                  <ArrowRight className="h-3.5 w-3.5 transition-transform duration-200 group-hover:translate-x-0.5" />
                </Button>
              </div>
            </div>

            {/* Four-state machine: loading / error / loaded-or-empty / search-miss. */}
            {loading ? (
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div
                    key={i}
                    className="card-coin98-flat min-h-[230px] animate-pulse rounded-2xl p-4"
                  >
                    <div className="h-4 w-16 rounded bg-fg-muted/15" />
                    <div className="mt-3 h-6 w-3/4 rounded bg-fg-muted/15" />
                    <div className="mt-2 h-3 w-1/2 rounded bg-fg-muted/15" />
                    <div className="mt-6 h-8 w-2/3 rounded bg-fg-muted/15" />
                  </div>
                ))}
              </div>
            ) : fetchError ? (
              <div className="card-coin98-flat rounded-2xl p-10 text-center">
                <p className="text-sm font-semibold text-bearish">
                  Couldn&apos;t load your bots
                </p>
                <p className="mt-1 text-xs text-fg-muted">{fetchError}</p>
                <Button
                  variant="secondary"
                  className="mt-4"
                  onClick={handleRefresh}
                >
                  Retry
                </Button>
              </div>
            ) : (
              <>
                {isEmptyReal && (
                  <div className="rounded-lg border border-info/30 bg-info/5 px-4 py-3 text-xs text-info">
                    You haven&apos;t built any bots yet. Below is a sample — try{' '}
                    <strong className="mx-1">New bot</strong> to create your
                    first one.
                  </div>
                )}

                <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
                  {filteredBots.map((bot) => (
                    <BotCard
                      key={bot.id}
                      bot={bot}
                      // Demo cards use mock ids (1/2/4) — navigating to
                      // /bots/{id} would 404. Route demos to /builder
                      // instead so the click is a useful conversion.
                      onClick={
                        bot.isDemo
                          ? () => requireWalletThen(() => navigate('/builder'))
                          : () => navigate(`/bots/${bot.id}`)
                      }
                    />
                  ))}

                  <button
                    type="button"
                    onClick={() =>
                      requireWalletThen(() => navigate('/builder'))
                    }
                    className="card-coin98-flat flex min-h-[230px] flex-col items-center justify-center rounded-2xl p-4 text-center transition hover:bg-brand-soft"
                  >
                    <div className="text-2xl text-fg-muted">＋</div>
                    <div className="mt-2 text-sm font-semibold text-fg-secondary">
                      New bot
                    </div>
                    <div className="mt-1 text-xs text-fg-muted">
                      Build from scratch or import
                    </div>
                  </button>
                </div>

                {filteredBots.length === 0 && (
                  <div className="card-coin98-flat rounded-2xl p-10 text-center">
                    <p className="text-sm font-semibold text-fg">
                      No bots match &quot;{search}&quot;
                    </p>
                    <button
                      type="button"
                      onClick={() => setSearch('')}
                      className="mt-2 text-xs text-brand hover:underline"
                    >
                      Clear search
                    </button>
                  </div>
                )}
              </>
            )}
          </section>
        </div>
      </main>

      <ImportDialog open={importOpen} onOpenChange={setImportOpen} />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────────

interface BotCardProps {
  bot: DashboardBot | MockBot;
  onClick: () => void;
}

function BotCard({ bot, onClick }: BotCardProps) {
  const modeStyle = {
    LIVE: 'border-bullish/30 bg-bullish-subtle text-bullish',
    'DRY-RUN': 'border-brand/30 bg-brand-subtle text-brand',
    PAUSED: 'border-fg-muted/30 bg-fg-muted/10 text-fg-muted',
    ERROR: 'border-bearish/40 bg-bearish-subtle text-bearish',
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
      className="card-coin98-flat cursor-pointer rounded-2xl p-4 transition hover:brightness-110"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            <span
              className={`inline-flex items-center gap-1 rounded-sm border px-1.5 py-0.5 text-2xs font-bold uppercase ${modeStyle}`}
            >
              {bot.mode === 'LIVE' && (
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-bullish" />
              )}
              {bot.mode === 'DRY-RUN' && (
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-brand" />
              )}
              {bot.mode === 'ERROR' && <span>!</span>}
              {bot.mode}
            </span>
            {bot.badge && (
              <span className="rounded-sm bg-bullish-subtle px-1.5 py-0.5 text-2xs font-bold text-bullish">
                {bot.badge}
              </span>
            )}
            {bot.isDemo && (
              <span
                className="rounded-sm border border-dashed border-fg-muted/40 px-1.5 py-0.5 text-2xs font-bold uppercase tracking-wider text-fg-muted"
                title="Hardcoded demo data — not from your wallet"
              >
                Demo
              </span>
            )}
          </div>
          <h3 className="mt-2 truncate text-md font-semibold text-fg">
            {bot.name}
          </h3>
          <div className="text-xs text-fg-muted">
            {bot.pair} · {bot.timeframe}
            {bot.uptime ? ` · ${bot.uptime}` : null}
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
          className={`font-mono text-xl font-bold tabular-nums ${pnlClass}`}
        >
          {bot.pnl}
        </span>
        <span className={`text-xs ${pnlClass}`}>{bot.pnlPct}</span>
      </div>

      {/* Sparkline */}
      {bot.sparkline && bot.sparkline.length >= 2 && (
        <Sparkline values={bot.sparkline} color={bot.pnlDirection} />
      )}

      {/* Error message replaces stats */}
      {bot.mode === 'ERROR' && bot.errorMsg ? (
        <p className="mt-3 text-xs text-bearish/90">{bot.errorMsg}</p>
      ) : bot.trades != null ? (
        <div className="mt-3 grid grid-cols-3 gap-2 text-2xs">
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
      <div className="mt-3 flex gap-1.5" onClick={(e) => e.stopPropagation()}>
        {bot.mode === 'ERROR' ? (
          <Button variant="primary" size="sm" className="flex-1">
            Fix connection
          </Button>
        ) : (
          <>
            <Button variant="secondary" size="sm" className="flex-1">
              Edit
            </Button>
            <Button variant="secondary" size="sm" className="flex-1">
              {bot.mode === 'PAUSED' ? 'Resume' : 'Pause'}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="px-2 text-bearish hover:bg-bearish-subtle"
              aria-label="Stop bot"
            >
              ■
            </Button>
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
  const id = useId().replace(/:/g, '');
  const max = Math.max(...values);
  const min = Math.min(...values);
  const range = max - min || 1;

  const points = values.map((v, i) => {
    const x = (i / (values.length - 1)) * 200;
    const y = 50 - ((v - min) / range) * 42 - 2;
    return { x, y };
  });

  const curve = buildRoundedSparklinePath(points);
  const area = `${curve} L 200,50 L 0,50 Z`;
  const end = points[points.length - 1];

  const stroke =
    color === 'up' ? '#0ECB81' : color === 'down' ? '#F6465D' : '#848e9c';
  const glow =
    color === 'up'
      ? 'rgba(14,203,129,0.42)'
      : color === 'down'
        ? 'rgba(246,70,93,0.42)'
        : 'rgba(132,142,156,0.34)';
  const fillStop =
    color === 'up'
      ? 'rgba(14,203,129,0.24)'
      : color === 'down'
        ? 'rgba(246,70,93,0.22)'
        : 'rgba(132,142,156,0.14)';

  return (
    <svg
      viewBox="0 0 200 50"
      className="mt-2 h-10 w-full overflow-visible"
      preserveAspectRatio="none"
    >
      <defs>
        <linearGradient id={`${id}-area`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={fillStop} />
          <stop offset="100%" stopColor={stroke} stopOpacity="0" />
        </linearGradient>
        <filter id={`${id}-glow`} x="-20%" y="-60%" width="140%" height="220%">
          <feGaussianBlur stdDeviation="1.6" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      <path d={area} fill={`url(#${id}-area)`} stroke="none" />
      <path
        d={curve}
        fill="none"
        stroke={stroke}
        strokeWidth={2.2}
        strokeLinecap="round"
        strokeLinejoin="round"
        filter={`url(#${id}-glow)`}
      />
      <circle cx={end.x} cy={end.y} r="5.5" fill={stroke} opacity="0.16" />
      <circle
        cx={end.x}
        cy={end.y}
        r="2.4"
        fill="white"
        stroke={stroke}
        strokeWidth="1.6"
        style={{ filter: `drop-shadow(0 0 5px ${glow})` }}
      />
    </svg>
  );
}

function buildRoundedSparklinePath(points: { x: number; y: number }[]) {
  if (points.length < 2) return '';

  const d = [`M ${points[0].x.toFixed(1)},${points[0].y.toFixed(1)}`];
  const tension = 0.5;

  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[Math.max(0, i - 1)];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[Math.min(points.length - 1, i + 2)];
    const cp1x = p1.x + ((p2.x - p0.x) / 6) * tension;
    const cp1y = p1.y + ((p2.y - p0.y) / 6) * tension;
    const cp2x = p2.x - ((p3.x - p1.x) / 6) * tension;
    const cp2y = p2.y - ((p3.y - p1.y) / 6) * tension;

    d.push(
      `C ${cp1x.toFixed(1)},${cp1y.toFixed(1)} ${cp2x.toFixed(1)},${cp2y.toFixed(1)} ${p2.x.toFixed(1)},${p2.y.toFixed(1)}`,
    );
  }

  return d.join(' ');
}
