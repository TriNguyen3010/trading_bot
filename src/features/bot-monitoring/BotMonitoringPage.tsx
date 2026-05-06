import { useParams } from 'react-router-dom';
import { useEffect, useRef, useState } from 'react';
import {
  PanelLeftClose,
  PanelLeftOpen,
  Pause,
  Pencil,
  Sparkles,
  StopCircle,
} from 'lucide-react';
import {
  createChart,
  ColorType,
  LineStyle,
  type IChartApi,
  type ISeriesApi,
  type Time,
} from 'lightweight-charts';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { DotGridSpotlight } from '@/features/fx/DotGridSpotlight';
import { useLayoutPrefsStore } from '@/features/layout-prefs/layout-prefs.store';
import { cn } from '@/lib/utils';
import { botApi } from './mockBotData';
import { hlApi } from './hyperliquid.service';
import {
  bootstrapNarrative,
  generateEventNarrations,
  type CypheusMessage,
} from './cypheusEvents';
import type {
  BotMeta,
  BotPhase,
  DailyPnL,
  EquityPoint,
  ExecutionCycle,
  Fill,
  HLCandle,
  PerformanceSnapshot,
  TimeRange,
} from './types';

// ──────────────────────────────────────────────────────────────────────
// Design tokens (from src/styles/tokens.css) — used in chart configs
// where Tailwind classes aren't available (canvas-rendered libraries).
// ──────────────────────────────────────────────────────────────────────
const TOKEN = {
  bgSurface: '#14181f',
  borderSubtle: '#1e2329',
  borderDefault: '#2b3139',
  textMuted: '#848e9c',
  textSecondary: '#b7bdc6',
  bullish: '#0ecb81',
  bearish: '#f6465d',
  brand: '#f0b90b',
  bullishGlow: 'rgba(14, 203, 129, 0.25)',
  bullishFade: 'rgba(14, 203, 129, 0)',
} as const;

// === Hooks ===
function useBotMeta(id: string) {
  const [meta, setMeta] = useState<BotMeta | null>(null);
  useEffect(() => {
    botApi.getBotMeta(id).then(setMeta);
  }, [id]);
  return meta;
}

function useSnapshot(id: string, deployedAt: number | undefined) {
  const [snap, setSnap] = useState<PerformanceSnapshot | null>(null);
  useEffect(() => {
    if (deployedAt == null) return;
    botApi.getSnapshot(id, deployedAt).then(setSnap);
  }, [id, deployedAt]);
  return snap;
}

function useFills(id: string, deployedAt: number | undefined) {
  const [fills, setFills] = useState<Fill[]>([]);
  useEffect(() => {
    if (deployedAt == null) return;
    botApi.getFills(id, deployedAt).then(setFills);
  }, [id, deployedAt]);
  return fills;
}

function useEquityCurve(
  id: string,
  deployedAt: number | undefined,
  range: TimeRange,
) {
  const [data, setData] = useState<EquityPoint[]>([]);
  useEffect(() => {
    if (deployedAt == null) return;
    botApi.getEquityCurve(id, deployedAt, range).then(setData);
  }, [id, deployedAt, range]);
  return data;
}

function useDailyPnL(
  id: string,
  deployedAt: number | undefined,
  days: number,
) {
  const [data, setData] = useState<DailyPnL[]>([]);
  useEffect(() => {
    if (deployedAt == null) return;
    botApi.getDailyPnL(id, deployedAt, days).then(setData);
  }, [id, deployedAt, days]);
  return data;
}

function useCycle(id: string) {
  const [cycle, setCycle] = useState<ExecutionCycle | null>(null);
  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    const tick = () => {
      botApi.getCycle(id).then((c) => {
        if (!cancelled) setCycle(c);
      });
    };
    tick();
    const handle = setInterval(tick, 500);
    return () => {
      cancelled = true;
      clearInterval(handle);
    };
  }, [id]);
  return cycle;
}

const MAX_NARRATIVE = 24;
const NARRATIVE_THROTTLE_MS = 3_000;

function useCypheusMonitoringNarrative(
  fills: Fill[],
  snap: PerformanceSnapshot | null,
  phase: BotPhase,
): CypheusMessage[] {
  const [messages, setMessages] = useState<CypheusMessage[]>([]);
  const prevRef = useRef<{
    snap: PerformanceSnapshot | null;
    fills: Fill[];
  }>({ snap: null, fills: [] });
  const lastPushRef = useRef<number>(0);
  const bootstrappedRef = useRef(false);

  // Bootstrap once per snap+fill load
  useEffect(() => {
    if (!snap) return;
    if (bootstrappedRef.current) return;
    if (phase === 'just-deployed' || fills.length === 0) {
      // Defer bootstrap until phase transitions to mature; just-deployed
      // path handled by generateEventNarrations.
      const seed = generateEventNarrations({
        prevSnap: null,
        nextSnap: snap,
        prevFills: [],
        nextFills: fills,
        phase,
      });
      if (seed.length > 0) {
        setMessages(seed);
        bootstrappedRef.current = true;
      }
      return;
    }
    setMessages(bootstrapNarrative(snap, fills));
    bootstrappedRef.current = true;
    prevRef.current = { snap, fills };
  }, [snap, fills, phase]);

  // Diff prev/next on each update
  useEffect(() => {
    if (!snap) return;
    if (!bootstrappedRef.current) return;
    if (Date.now() - lastPushRef.current < NARRATIVE_THROTTLE_MS) {
      // throttle; still update the prev ref so future diffs are accurate
      prevRef.current = { snap, fills };
      return;
    }
    const newMsgs = generateEventNarrations({
      prevSnap: prevRef.current.snap,
      nextSnap: snap,
      prevFills: prevRef.current.fills,
      nextFills: fills,
      phase,
    });
    if (newMsgs.length > 0) {
      setMessages((prev) => [...newMsgs, ...prev].slice(0, MAX_NARRATIVE));
      lastPushRef.current = Date.now();
    }
    prevRef.current = { snap, fills };
  }, [snap, fills, phase]);

  return messages;
}

// Cache HL candles in-module to avoid hammering the API on remounts.
const candleCache = new Map<string, { data: HLCandle[]; ts: number }>();

function useHyperliquidCandles(
  coin: string,
  interval: '1m' | '5m' | '15m' | '1h' | '1d',
) {
  const [candles, setCandles] = useState<HLCandle[]>([]);
  useEffect(() => {
    if (!coin) return;
    const key = `${coin}:${interval}`;
    let cancelled = false;

    const load = (force = false) => {
      const cached = candleCache.get(key);
      if (!force && cached && Date.now() - cached.ts < 30_000) {
        if (!cancelled) setCandles(cached.data);
        return;
      }
      const now = Date.now();
      const startTime = now - 4 * 60 * 60 * 1000; // last 4h window
      hlApi
        .getCandleSnapshot(coin, interval, startTime, now)
        .then((data) => {
          candleCache.set(key, { data, ts: Date.now() });
          if (!cancelled) setCandles(data);
        })
        .catch((err) => console.warn('HL candle fetch:', err));
    };

    load();
    const handle = setInterval(() => {
      if (document.hidden) return;
      load(true);
    }, 30_000);
    return () => {
      cancelled = true;
      clearInterval(handle);
    };
  }, [coin, interval]);
  return candles;
}

function computeBotPhase(deployedAt: number, totalTrades: number): BotPhase {
  const hours = (Date.now() - deployedAt) / 3_600_000;
  if (hours < 24 || totalTrades === 0) return 'just-deployed';
  if (hours < 24 * 14) return 'collecting';
  return 'mature';
}

function useBotMaturity(
  deployedAt: number | undefined,
  totalTrades: number,
): BotPhase {
  return deployedAt
    ? computeBotPhase(deployedAt, totalTrades)
    : 'just-deployed';
}

function formatUptime(deployedAt: number) {
  const ms = Date.now() - deployedAt;
  const days = Math.floor(ms / 86_400_000);
  const hours = Math.floor((ms % 86_400_000) / 3_600_000);
  if (days > 0) return `${days}d ${hours}h`;
  return `${hours}h`;
}

// ──────────────────────────────────────────────────────────────────────
// Header (mirrors HeaderToolbar styling: dense top bar, semantic tokens)
// ──────────────────────────────────────────────────────────────────────
function MonitoringHeader({ meta }: { meta: BotMeta }) {
  const uptime = formatUptime(meta.deployedAt);
  const isLive = meta.mode === 'live';

  return (
    <header className="flex h-[var(--layout-header,56px)] flex-shrink-0 items-center justify-between gap-4 border-b border-border-subtle bg-canvas px-4">
      <div className="flex items-center gap-3 min-w-0">
        {/* Bot identity */}
        <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md bg-brand-subtle text-brand">
          <Sparkles className="h-4 w-4" aria-hidden="true" />
        </div>
        <div className="flex flex-col min-w-0">
          <h1 className="truncate text-sm font-semibold text-fg">{meta.name}</h1>
          <div className="flex items-center gap-1.5 text-xs text-fg-muted">
            <code className="text-fg-secondary">{meta.pair}</code>
            <span className="text-border-strong">·</span>
            <span>{meta.timeframe}</span>
            <span className="text-border-strong">·</span>
            <span>{meta.exchange}</span>
            <span className="text-border-strong">·</span>
            <span>Up {uptime}</span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2">
        {/* Status pill */}
        <span
          className={cn(
            'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-2xs font-semibold uppercase tracking-wider',
            isLive
              ? 'bg-bullish-subtle text-bullish'
              : 'bg-brand-subtle text-brand',
          )}
        >
          <span
            className={cn(
              'h-1.5 w-1.5 rounded-full animate-pulse',
              isLive ? 'bg-bullish' : 'bg-brand',
            )}
          />
          {isLive ? 'Live' : 'Dry-run'}
        </span>

        {/* Actions */}
        <Button variant="ghost" size="sm" className="text-fg-muted hover:text-fg">
          <Pause className="h-3.5 w-3.5 mr-1.5" aria-hidden="true" />
          Pause
        </Button>
        <Button variant="ghost" size="sm" className="text-bearish hover:bg-bearish-subtle hover:text-bearish-hover">
          <StopCircle className="h-3.5 w-3.5 mr-1.5" aria-hidden="true" />
          Stop
        </Button>
        <Button variant="ghost" size="sm" className="text-fg-muted hover:text-fg">
          <Pencil className="h-3.5 w-3.5 mr-1.5" aria-hidden="true" />
          Edit
        </Button>
      </div>
    </header>
  );
}

// ──────────────────────────────────────────────────────────────────────
// Cypheus rail — narrative messages from event mapper, latest on top.
// Mirrors CypheusPanel structure: collapse toggle + scrolling content.
// ──────────────────────────────────────────────────────────────────────
const CYPHEUS_TYPE_META: Record<
  CypheusMessage['type'],
  { label: string; icon: string; color: string }
> = {
  scan: { label: 'Scanning', icon: '📡', color: 'text-info' },
  'position-opened': { label: 'Position opened', icon: '↗', color: 'text-fg-secondary' },
  'tp-hit': { label: 'TP hit', icon: '🎯', color: 'text-bullish' },
  'sl-hit': { label: 'SL hit', icon: '✕', color: 'text-bearish' },
  'streak-milestone': { label: 'Win streak', icon: '🏆', color: 'text-warning' },
  'pnl-milestone': { label: 'Milestone', icon: '📈', color: 'text-brand' },
  anomaly: { label: 'Anomaly', icon: '⚠', color: 'text-warning' },
  idle: { label: 'Quiet', icon: '⏸', color: 'text-fg-muted' },
};

function relativeTimeLabel(ts: number): string {
  const diff = Date.now() - ts;
  if (diff < 30_000) return 'just now';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return `${Math.floor(diff / 86_400_000)}d ago`;
}

function CypheusRail({ messages = [] }: { messages?: CypheusMessage[] }) {
  const collapsed = useLayoutPrefsStore((s) => s.leftPanelCollapsed);
  const toggleCollapse = useLayoutPrefsStore((s) => s.toggleLeftPanel);

  // Sync the layout CSS var so main reflows in step with collapse toggle
  useEffect(() => {
    document.documentElement.style.setProperty(
      '--layout-left-panel',
      collapsed ? '48px' : '320px',
    );
  }, [collapsed]);

  return (
    <TooltipProvider delayDuration={collapsed ? 100 : 250}>
      <aside
        className={cn(
          'flex h-full flex-shrink-0 flex-col border-r border-border-subtle bg-canvas',
          'transition-[width] duration-fast ease-out-quick',
        )}
        style={{ width: 'var(--layout-left-panel)' }}
        aria-label="Cypheus monitoring rail"
      >
        {/* Header */}
        <header
          className={cn(
            'flex items-center border-b border-border-subtle',
            collapsed
              ? 'justify-center px-1.5 py-2'
              : 'justify-between gap-2 px-3 py-2',
          )}
        >
          {!collapsed && (
            <h2 className="truncate text-2xs font-semibold uppercase tracking-wider text-fg-muted">
              Cypheus
            </h2>
          )}
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={toggleCollapse}
                aria-label={collapsed ? 'Expand panel' : 'Collapse panel'}
                aria-expanded={!collapsed}
                className={cn(
                  'inline-flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md text-fg-muted',
                  'transition-colors duration-fast hover:bg-surface-hover hover:text-fg',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand',
                )}
              >
                {collapsed ? (
                  <PanelLeftOpen className="h-4 w-4" aria-hidden="true" />
                ) : (
                  <PanelLeftClose className="h-4 w-4" aria-hidden="true" />
                )}
              </button>
            </TooltipTrigger>
            <TooltipContent side="right">
              {collapsed ? 'Show Cypheus' : 'Hide Cypheus'}
            </TooltipContent>
          </Tooltip>
        </header>

        {/* Content (only when expanded) */}
        {!collapsed && (
          <div className="flex flex-1 flex-col gap-2 overflow-y-auto p-3">
            <div className="flex items-center gap-2 rounded-md bg-surface p-2.5">
              <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md bg-brand-subtle text-brand">
                <Sparkles className="h-4 w-4" aria-hidden="true" />
              </div>
              <div className="min-w-0">
                <div className="text-xs font-semibold text-fg">Watching bot</div>
                <div className="text-2xs text-bullish flex items-center gap-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-bullish animate-pulse" />
                  Live
                </div>
              </div>
            </div>

            <div className="text-2xs uppercase tracking-wider text-fg-muted px-1 mt-2">
              Live narrative
            </div>

            {messages.length === 0 ? (
              <article className="rounded-md border border-border-subtle bg-surface p-2.5">
                <div className="text-2xs uppercase tracking-wider text-fg-muted mb-1">
                  ⏸ Quiet
                </div>
                <p className="text-xs text-fg-secondary leading-relaxed">
                  Waiting for bot to do something interesting.
                </p>
              </article>
            ) : (
              messages.map((m, idx) => {
                const meta = CYPHEUS_TYPE_META[m.type];
                const isLatest = idx === 0;
                return (
                  <article
                    key={m.id}
                    className={cn(
                      'rounded-md border bg-surface p-2.5 transition-colors',
                      isLatest
                        ? 'border-bullish/40 shadow-[0_0_0_1px_rgba(14,203,129,0.3),0_0_12px_rgba(14,203,129,0.15)]'
                        : 'border-border-subtle',
                    )}
                  >
                    <div
                      className={cn(
                        'text-2xs uppercase tracking-wider mb-1 inline-flex items-center gap-1',
                        meta.color,
                      )}
                    >
                      <span aria-hidden="true">{meta.icon}</span>
                      <span>{meta.label}</span>
                    </div>
                    <p className="text-xs text-fg-secondary leading-relaxed">
                      {m.text}
                    </p>
                    <div className="text-2xs text-fg-disabled mt-1.5">
                      {isLatest ? 'just now' : relativeTimeLabel(m.ts)}
                    </div>
                  </article>
                );
              })
            )}
          </div>
        )}
      </aside>
    </TooltipProvider>
  );
}

// ──────────────────────────────────────────────────────────────────────
// Hero — Today PnL with Win Streak gauge
// ──────────────────────────────────────────────────────────────────────
function WinStreakGauge({ streak }: { streak: number }) {
  const pct = Math.min(streak / 15, 1);
  const dash = pct * 264;
  const colorVar = streak > 0 ? 'var(--color-bullish)' : 'var(--color-text-disabled)';

  return (
    <div className="flex flex-col items-center justify-center w-32">
      <div className="relative">
        <svg width="96" height="96" viewBox="0 0 100 100" aria-hidden="true">
          <circle
            cx="50"
            cy="50"
            r="42"
            fill="none"
            stroke="var(--color-border-default)"
            strokeWidth="4"
          />
          <circle
            cx="50"
            cy="50"
            r="42"
            fill="none"
            stroke={colorVar}
            strokeWidth="4"
            strokeDasharray={`${dash} 264`}
            strokeLinecap="round"
            transform="rotate(-90 50 50)"
            style={{ filter: streak > 0 ? `drop-shadow(0 0 6px ${colorVar})` : undefined }}
          />
        </svg>
        <div
          className={cn(
            'absolute inset-0 flex items-center justify-center font-pixel text-2xl',
            streak > 0 ? 'text-bullish' : 'text-fg-disabled',
          )}
        >
          {streak}
        </div>
      </div>
      <div className="mt-2 text-2xs uppercase tracking-widest text-fg-muted text-center leading-relaxed">
        <span className={streak > 0 ? 'text-bullish font-semibold' : ''}>
          Win Streak
        </span>
        <br />
        Next in 4m
      </div>
    </div>
  );
}

function HeroPnL({ snap }: { snap: PerformanceSnapshot }) {
  const isPositive = snap.todayPnL >= 0;
  const pnlColor = isPositive ? 'text-bullish' : 'text-bearish';
  const pnlGlow = isPositive
    ? '0 0 30px rgba(14, 203, 129, 0.35)'
    : '0 0 30px rgba(246, 70, 93, 0.35)';
  const sign = isPositive ? '+' : '';

  return (
    <section
      aria-labelledby="hero-pnl-label"
      className="relative grid grid-cols-[1fr_auto] gap-6 overflow-hidden rounded-xl border border-border-subtle bg-surface p-6"
    >
      {/* Subtle gradient halo behind hero number */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-24 -right-24 h-72 w-72 rounded-full opacity-20"
        style={{
          background: `radial-gradient(circle, ${
            isPositive ? 'var(--color-bullish)' : 'var(--color-bearish)'
          }, transparent 70%)`,
        }}
      />

      <div className="relative">
        <div
          id="hero-pnl-label"
          className="mb-3 flex items-center gap-3 text-2xs uppercase tracking-widest text-fg-muted"
        >
          <span>Today · Realized PnL</span>
          <span className="inline-flex items-center gap-1.5 text-bullish">
            <span className="h-1.5 w-1.5 rounded-full bg-bullish animate-pulse" />
            Live
          </span>
          <span className="text-border-strong">·</span>
          <span>Updated 14s ago</span>
        </div>

        <div
          className={cn('font-pixel text-4xl tabular-nums', pnlColor)}
          style={{ textShadow: pnlGlow, lineHeight: 1.05 }}
        >
          ${sign}
          {Math.abs(snap.todayPnL).toLocaleString(undefined, {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-fg-secondary">
          <span className="inline-flex items-center gap-1.5">
            <span className="text-bullish">▲</span>
            <span className="text-fg font-semibold tabular-nums">{snap.totalTrades}</span>
            <span className="text-fg-muted">trades</span>
          </span>
          <span className="text-border-strong">·</span>
          <span className="inline-flex items-center gap-1.5">
            <span className="text-bullish font-semibold tabular-nums">
              {(snap.winRate * 100).toFixed(1)}%
            </span>
            <span className="text-fg-muted">win</span>
          </span>
          <span className="text-border-strong">·</span>
          <span className="inline-flex items-center gap-1.5">
            <span className="text-fg font-semibold tabular-nums">{snap.openPositions}</span>
            <span className="text-fg-muted">open</span>
          </span>
          <span className="text-border-strong">·</span>
          <span className="inline-flex items-center gap-1.5 text-fg-muted">
            <span>Total</span>
            <span
              className={cn(
                'font-semibold tabular-nums',
                snap.totalPnL >= 0 ? 'text-bullish' : 'text-bearish',
              )}
            >
              ${snap.totalPnL >= 0 ? '+' : ''}
              {snap.totalPnL.toLocaleString(undefined, { maximumFractionDigits: 2 })}
            </span>
          </span>
        </div>
      </div>

      <WinStreakGauge streak={snap.winStreak} />
    </section>
  );
}

// ──────────────────────────────────────────────────────────────────────
// Section card primitive — semantic chrome shared by chart sections.
// Header strip + dense content body, matches Builder card pattern.
// ──────────────────────────────────────────────────────────────────────
function SectionCard({
  title,
  meta,
  rightSlot,
  children,
}: {
  title: React.ReactNode;
  meta?: React.ReactNode;
  rightSlot?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border border-border-subtle bg-surface overflow-hidden">
      <header className="flex items-center justify-between gap-3 border-b border-border-subtle px-4 py-2.5">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-2xs font-semibold uppercase tracking-wider text-fg-muted">
            {title}
          </span>
          {meta && (
            <span className="text-xs text-fg-secondary truncate">{meta}</span>
          )}
        </div>
        {rightSlot}
      </header>
      {children}
    </section>
  );
}

// ──────────────────────────────────────────────────────────────────────
// EquityCurve — area chart (cumulative bot PnL over selected range)
// ──────────────────────────────────────────────────────────────────────
const EQUITY_RANGES: TimeRange[] = ['1D', '7D', '30D', 'all'];

function EquityCurve({
  data,
  range,
  onRangeChange,
  total,
}: {
  data: EquityPoint[];
  range: TimeRange;
  onRangeChange: (r: TimeRange) => void;
  total: number;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<'Area'> | null>(null);
  const [chartError, setChartError] = useState<string | null>(null);

  // Create chart once
  useEffect(() => {
    if (!containerRef.current) return;
    let chart: IChartApi;
    try {
      chart = createChart(containerRef.current, {
        layout: {
          background: { type: ColorType.Solid, color: 'transparent' },
          textColor: TOKEN.textMuted,
          fontFamily:
            'Inter, -apple-system, BlinkMacSystemFont, system-ui, sans-serif',
          fontSize: 11,
        },
        grid: {
          vertLines: { color: TOKEN.borderSubtle, style: LineStyle.Dotted },
          horzLines: { color: TOKEN.borderSubtle, style: LineStyle.Dotted },
        },
        timeScale: {
          borderColor: TOKEN.borderSubtle,
          timeVisible: false,
          secondsVisible: false,
        },
        rightPriceScale: { borderColor: TOKEN.borderSubtle },
        crosshair: {
          vertLine: {
            color: TOKEN.borderDefault,
            width: 1,
            style: LineStyle.Dashed,
          },
          horzLine: {
            color: TOKEN.borderDefault,
            width: 1,
            style: LineStyle.Dashed,
          },
        },
        width: containerRef.current.clientWidth,
        height: 180,
      });
    } catch (e) {
      console.error('EquityCurve chart init failed:', e);
      setChartError(e instanceof Error ? e.message : 'Chart init failed');
      return;
    }
    const series = chart.addAreaSeries({
      lineColor: TOKEN.bullish,
      topColor: TOKEN.bullishGlow,
      bottomColor: TOKEN.bullishFade,
      lineWidth: 2,
      priceFormat: { type: 'price', precision: 2, minMove: 0.01 },
    });
    chartRef.current = chart;
    seriesRef.current = series;
    const onResize = () => {
      if (containerRef.current && chartRef.current) {
        chartRef.current.applyOptions({
          width: containerRef.current.clientWidth,
        });
      }
    };
    window.addEventListener('resize', onResize);
    return () => {
      window.removeEventListener('resize', onResize);
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
    };
  }, []);

  // Update data when it changes
  useEffect(() => {
    if (!seriesRef.current) return;
    if (data.length === 0) {
      seriesRef.current.setData([]);
      return;
    }
    seriesRef.current.setData(
      data.map((p) => ({
        time: (Math.floor(p.t / 1000) as Time),
        value: p.equity,
      })),
    );
    chartRef.current?.timeScale().fitContent();
  }, [data]);

  return (
    <SectionCard
      title="PnL Curve"
      meta={
        <span className="tabular-nums">
          Total{' '}
          <b
            className={cn(
              total >= 0 ? 'text-bullish' : 'text-bearish',
              'font-semibold',
            )}
          >
            ${total >= 0 ? '+' : ''}
            {total.toLocaleString(undefined, { maximumFractionDigits: 2 })}
          </b>
        </span>
      }
      rightSlot={
        <div className="flex gap-0.5 rounded-md bg-canvas border border-border-subtle p-0.5">
          {EQUITY_RANGES.map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => onRangeChange(r)}
              className={cn(
                'rounded-sm px-2 py-0.5 text-2xs font-medium uppercase tracking-wider transition-colors',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand',
                r === range
                  ? 'bg-surface text-fg shadow-sm'
                  : 'text-fg-muted hover:text-fg',
              )}
            >
              {r}
            </button>
          ))}
        </div>
      }
    >
      {chartError ? (
        <div className="px-4 py-8 text-center text-xs text-bearish">
          Chart unavailable: {chartError}
        </div>
      ) : (
        <div ref={containerRef} className="h-[180px]" />
      )}
    </SectionCard>
  );
}

// ──────────────────────────────────────────────────────────────────────
// LiveSpotFeed — line/area chart of bot's pair close price (real Hyperliquid)
// + entry markers from bot fills + High/Low markers
// Coin98-style aesthetic: smooth bullish/bearish line, soft area gradient.
// ──────────────────────────────────────────────────────────────────────
function LiveSpotFeed({
  coin,
  candles,
  fills,
  watchingFor,
}: {
  coin: string;
  candles: HLCandle[];
  fills: Fill[];
  watchingFor?: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<'Area'> | null>(null);
  const [chartError, setChartError] = useState<string | null>(null);

  // Create chart once
  useEffect(() => {
    if (!containerRef.current) return;
    let chart: IChartApi;
    try {
      chart = createChart(containerRef.current, {
        layout: {
          background: { type: ColorType.Solid, color: 'transparent' },
          textColor: TOKEN.textMuted,
          fontFamily:
            'Inter, -apple-system, BlinkMacSystemFont, system-ui, sans-serif',
          fontSize: 11,
        },
        grid: {
          vertLines: { color: 'transparent' },
          horzLines: { color: TOKEN.borderSubtle, style: LineStyle.Dotted },
        },
        timeScale: {
          borderColor: TOKEN.borderSubtle,
          timeVisible: true,
          secondsVisible: false,
        },
        rightPriceScale: { borderColor: TOKEN.borderSubtle },
        crosshair: {
          vertLine: {
            color: TOKEN.borderDefault,
            width: 1,
            style: LineStyle.Dashed,
          },
          horzLine: {
            color: TOKEN.borderDefault,
            width: 1,
            style: LineStyle.Dashed,
          },
        },
        width: containerRef.current.clientWidth,
        height: 220,
      });
    } catch (e) {
      console.error('LiveSpotFeed chart init failed:', e);
      setChartError(e instanceof Error ? e.message : 'Chart init failed');
      return;
    }
    const series = chart.addAreaSeries({
      lineColor: TOKEN.bullish,
      topColor: TOKEN.bullishGlow,
      bottomColor: TOKEN.bullishFade,
      lineWidth: 2,
      lineType: 2, // curved (bezier) for smoother Coin98 look
      crosshairMarkerVisible: true,
      crosshairMarkerRadius: 4,
      priceFormat: { type: 'price', precision: 2, minMove: 0.01 },
    });
    chartRef.current = chart;
    seriesRef.current = series;
    const onResize = () => {
      if (containerRef.current && chartRef.current) {
        chartRef.current.applyOptions({
          width: containerRef.current.clientWidth,
        });
      }
    };
    window.addEventListener('resize', onResize);
    return () => {
      window.removeEventListener('resize', onResize);
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
    };
  }, []);

  // Update line data + High/Low + entry markers when data changes
  useEffect(() => {
    if (!seriesRef.current) return;
    if (candles.length === 0) {
      seriesRef.current.setData([]);
      seriesRef.current.setMarkers([]);
      return;
    }
    // Plot close price as line
    seriesRef.current.setData(
      candles.map((c) => ({
        time: Math.floor(c.t / 1000) as Time,
        value: c.c,
      })),
    );

    // Build markers: High/Low extremes + recent entry/exit fills
    const highIdx = candles.reduce(
      (best, c, i) => (c.h > candles[best].h ? i : best),
      0,
    );
    const lowIdx = candles.reduce(
      (best, c, i) => (c.l < candles[best].l ? i : best),
      0,
    );
    const high = candles[highIdx];
    const low = candles[lowIdx];

    const markers: Parameters<typeof seriesRef.current.setMarkers>[0] = [];
    if (high && lowIdx !== highIdx) {
      markers.push({
        time: Math.floor(high.t / 1000) as Time,
        position: 'aboveBar',
        color: TOKEN.textSecondary,
        shape: 'circle',
        text: `High ${high.h.toLocaleString(undefined, {
          maximumFractionDigits: 2,
        })}`,
      });
    }
    if (low) {
      markers.push({
        time: Math.floor(low.t / 1000) as Time,
        position: 'belowBar',
        color: TOKEN.textSecondary,
        shape: 'circle',
        text: `Low ${low.l.toLocaleString(undefined, {
          maximumFractionDigits: 2,
        })}`,
      });
    }
    // Entry markers from fills (latest 6 to avoid clutter)
    const recentFills = fills.slice(-6);
    recentFills.forEach((f) => {
      markers.push({
        time: Math.floor(f.openedAt / 1000) as Time,
        position: f.side === 'LONG' ? 'belowBar' : 'aboveBar',
        color: f.side === 'LONG' ? TOKEN.bullish : TOKEN.bearish,
        shape: f.side === 'LONG' ? 'arrowUp' : 'arrowDown',
        text: f.side,
      });
    });
    // Markers must be sorted by time ascending
    markers.sort((a, b) => Number(a.time) - Number(b.time));
    seriesRef.current.setMarkers(markers);

    chartRef.current?.timeScale().fitContent();
  }, [candles, fills]);

  const last = candles[candles.length - 1];
  const first = candles[0];
  const pct = first && last ? ((last.c - first.o) / first.o) * 100 : 0;
  const pctPositive = pct >= 0;

  return (
    <SectionCard
      title={
        <span className="inline-flex items-center gap-2">
          <span className="inline-flex items-center gap-1 rounded border border-bearish/30 bg-bearish/10 px-1.5 py-0.5 text-[10px] font-bold tracking-wider text-bearish">
            <span className="h-1.5 w-1.5 rounded-full bg-bearish animate-pulse" />
            LIVE
          </span>
          <span>
            {coin} · 5m · Market Data
          </span>
        </span>
      }
      rightSlot={
        last && (
          <span className="tabular-nums text-sm font-semibold text-fg">
            ${last.c.toLocaleString(undefined, { maximumFractionDigits: 2 })}{' '}
            <span
              className={cn(
                'text-xs font-medium',
                pctPositive ? 'text-bullish' : 'text-bearish',
              )}
            >
              {pctPositive ? '+' : ''}
              {pct.toFixed(2)}%
            </span>
          </span>
        )
      }
    >
      {chartError ? (
        <div className="px-4 py-8 text-center text-xs text-bearish">
          Chart unavailable: {chartError}
        </div>
      ) : (
        <div ref={containerRef} className="h-[220px]" />
      )}
      {watchingFor && (
        <div className="flex items-center justify-between gap-3 border-t border-border-subtle px-4 py-2 text-xs text-fg-muted">
          <span className="inline-flex items-center gap-1.5 truncate">
            <span aria-hidden="true">📡</span>
            <span>Watching for {watchingFor}</span>
          </span>
          <span className="text-fg-secondary tabular-nums whitespace-nowrap">
            Next check in 12s
          </span>
        </div>
      )}
    </SectionCard>
  );
}

// ──────────────────────────────────────────────────────────────────────
// ActivityHeatmap — 47-day strip, 1 row of cells colored by daily PnL
// Coin98 / GitHub contribution-graph style.
// ──────────────────────────────────────────────────────────────────────
function colorForPnL(pnl: number, max: number, min: number): string {
  if (Math.abs(pnl) < 1) return TOKEN.borderSubtle; // idle/no-trade day
  if (pnl > 0) {
    const t = pnl / Math.max(max, 1);
    if (t > 0.7) return '#0ecb81'; // bullish strong
    if (t > 0.4) return '#10b981';
    return '#fbbf24'; // small profit
  }
  const tNeg = pnl / Math.min(min, -1);
  if (tNeg > 0.7) return '#7f1d1d'; // bearish strong
  if (tNeg > 0.4) return '#dc2626';
  return '#f59e0b'; // small loss
}

function ActivityHeatmap({
  daily,
  total,
  best,
  worst,
}: {
  daily: DailyPnL[];
  total: number;
  best: number;
  worst: number;
}) {
  const bestColor = total >= 0 ? 'text-bullish' : 'text-bearish';
  return (
    <SectionCard
      title="47-day Activity"
      meta={
        <span className="tabular-nums">
          <span className="text-fg-muted">BTC-USDC · all-time</span>
        </span>
      }
      rightSlot={
        <span className="text-2xs uppercase tracking-wider text-fg-muted tabular-nums normal-case">
          Total{' '}
          <b className={cn(bestColor, 'font-semibold')}>
            ${total >= 0 ? '+' : ''}
            {total.toLocaleString(undefined, { maximumFractionDigits: 2 })}
          </b>
          <span className="text-border-strong mx-2">·</span>
          Best{' '}
          <b className="text-bullish font-semibold">
            ${best.toFixed(0)}
          </b>
          <span className="text-border-strong mx-2">·</span>
          Worst{' '}
          <b className="text-bearish font-semibold">
            ${worst.toFixed(0)}
          </b>
        </span>
      }
    >
      <div className="px-4 py-4">
        <div className="grid grid-cols-[repeat(47,1fr)] gap-[3px] h-9">
          {daily.map((d, i) => (
            <div
              key={d.date}
              title={`${d.date}: $${d.pnl.toFixed(2)} (${d.trades} trades)`}
              className="rounded-sm transition-transform hover:scale-150 cursor-pointer"
              style={{
                background: colorForPnL(d.pnl, best, worst),
                boxShadow:
                  i === daily.length - 1
                    ? '0 0 8px rgba(14, 203, 129, 0.6)'
                    : undefined,
              }}
            />
          ))}
        </div>
        <div className="mt-2 flex items-center justify-between text-2xs text-fg-muted">
          <span>{daily[0]?.date ?? ''}</span>
          <span className="flex items-center gap-1.5">
            Less
            <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: TOKEN.borderSubtle }} />
            <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: '#fbbf24' }} />
            <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: '#10b981' }} />
            <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: '#0ecb81' }} />
            More
          </span>
          <span className="tabular-nums">{daily[daily.length - 1]?.date ?? ''}</span>
        </div>
      </div>
    </SectionCard>
  );
}

// ──────────────────────────────────────────────────────────────────────
// ExecutionPipeline — 6 stage cards (Scan → Detect → … → Settle) + budget
// Active stage glows bullish + pulse animation matching Builder card style.
// ──────────────────────────────────────────────────────────────────────
function ExecutionPipeline({ cycle }: { cycle: ExecutionCycle }) {
  const elapsedSec = (cycle.elapsedMs / 1000).toFixed(2);
  const budgetSec = (cycle.budgetMs / 1000).toFixed(1);
  const underBudget = cycle.elapsedMs <= cycle.budgetMs;
  return (
    <SectionCard
      title={
        <span className="inline-flex items-center gap-2">
          <span className="h-1.5 w-1.5 rounded-full bg-bullish animate-pulse" />
          <span>Execution Cycle</span>
        </span>
      }
      meta={
        <span className="tabular-nums text-fg-muted">
          Cycle{' '}
          <b className="text-fg-secondary">#{cycle.cycleId}</b>
        </span>
      }
      rightSlot={
        <span className="text-2xs uppercase tracking-wider text-fg-muted tabular-nums normal-case">
          Budget <b className="text-fg-secondary">{budgetSec}s</b>
          <span className="text-border-strong mx-2">·</span>
          Elapsed{' '}
          <b className={underBudget ? 'text-bullish' : 'text-bearish'}>
            {elapsedSec}s
          </b>
        </span>
      }
    >
      <div className="grid grid-cols-7 gap-2 p-3">
        {cycle.stages.map((s, i) => (
          <div
            key={s.id}
            className={cn(
              'rounded-md p-2 transition-all',
              s.status === 'active' &&
                'bg-bullish/10 border border-bullish ring-1 ring-bullish/40 shadow-[0_0_12px_rgba(14,203,129,0.25)]',
              s.status === 'done' &&
                'bg-bullish/5 border border-bullish/30',
              s.status === 'pending' &&
                'bg-canvas border border-border-subtle',
            )}
          >
            <div
              className={cn(
                'text-[9px] font-semibold tracking-wider',
                s.status === 'active'
                  ? 'text-bullish'
                  : s.status === 'done'
                    ? 'text-bullish/70'
                    : 'text-fg-muted',
              )}
            >
              {String(i + 1).padStart(2, '0')}
              {s.status === 'active' && ' · ACT'}
            </div>
            <div className="text-xs font-semibold text-fg mt-0.5">{s.label}</div>
            <div
              className={cn(
                'text-xs font-bold tabular-nums mt-0.5',
                s.status === 'active'
                  ? 'text-bullish'
                  : s.status === 'done'
                    ? 'text-bullish/70'
                    : 'text-fg-disabled',
              )}
            >
              {s.durationMs > 0 ? `${s.durationMs}ms` : '—'}
            </div>
          </div>
        ))}
        {/* Budget summary card */}
        <div
          className={cn(
            'rounded-md p-2 border',
            underBudget
              ? 'bg-warning/10 border-warning/30'
              : 'bg-bearish/10 border-bearish/30',
          )}
        >
          <div
            className={cn(
              'text-[9px] font-semibold tracking-wider',
              underBudget ? 'text-warning' : 'text-bearish',
            )}
          >
            FILL TIME
          </div>
          <div
            className={cn(
              'text-xs font-bold tabular-nums mt-0.5',
              underBudget ? 'text-warning' : 'text-bearish',
            )}
          >
            {elapsedSec}s
          </div>
          <div
            className={cn(
              'text-2xs uppercase tracking-wider mt-0.5',
              underBudget ? 'text-warning/80' : 'text-bearish/80',
            )}
          >
            {underBudget ? 'Under' : 'Over'}
          </div>
        </div>
      </div>
    </SectionCard>
  );
}

// ──────────────────────────────────────────────────────────────────────
// RecentFills — table of last N fills with side/PnL/status pills
// LIVE row at top with red border-left when an OPEN fill exists.
// ──────────────────────────────────────────────────────────────────────
function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  if (diff < 60_000) return `${Math.floor(diff / 1000)}s`;
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h`;
  return `${Math.floor(diff / 86_400_000)}d`;
}

function RecentFills({ fills }: { fills: Fill[] }) {
  // Show latest 7, newest first. OPEN sticks at top.
  const sorted = [...fills].sort((a, b) => {
    if (a.status === 'OPEN' && b.status !== 'OPEN') return -1;
    if (b.status === 'OPEN' && a.status !== 'OPEN') return 1;
    return (b.closedAt ?? b.openedAt) - (a.closedAt ?? a.openedAt);
  });
  const recent = sorted.slice(0, 7);

  const lastHrPnL = fills
    .filter((f) => f.closedAt && Date.now() - f.closedAt < 3_600_000)
    .reduce((s, f) => s + f.pnl, 0);
  const lastHrPositive = lastHrPnL >= 0;

  return (
    <SectionCard
      title={
        <span className="inline-flex items-center gap-2">
          <span className="inline-flex items-center gap-1 rounded border border-bearish/30 bg-bearish/10 px-1.5 py-0.5 text-[10px] font-bold tracking-wider text-bearish">
            <span className="h-1.5 w-1.5 rounded-full bg-bearish animate-pulse" />
            LIVE
          </span>
          <span>Recent Fills</span>
        </span>
      }
      rightSlot={
        <span
          className={cn(
            'text-2xs uppercase tracking-wider tabular-nums normal-case',
            lastHrPositive ? 'text-bullish' : 'text-bearish',
          )}
        >
          {lastHrPositive ? '▲' : '▼'} ${Math.abs(lastHrPnL).toFixed(2)}{' '}
          <span className="text-fg-muted">last hr</span>
        </span>
      }
    >
      <table className="w-full text-xs">
        <tbody>
          {recent.map((f) => {
            const pillStyle =
              f.side === 'LONG'
                ? 'bg-bullish/10 text-bullish'
                : 'bg-bearish/10 text-bearish';
            const statusStyle =
              f.status === 'OPEN'
                ? 'bg-info/15 text-info'
                : f.status === 'TP1' || f.status === 'TP2'
                  ? 'bg-bullish/10 text-bullish'
                  : f.status === 'SL'
                    ? 'bg-bearish/10 text-bearish'
                    : 'bg-surface-hover text-fg-muted';
            return (
              <tr
                key={f.id}
                className={cn(
                  'border-b border-border-subtle last:border-b-0 hover:bg-surface-hover/40 transition-colors',
                  f.status === 'OPEN' && 'border-l-2 border-l-bearish',
                )}
              >
                <td className="px-3 py-2.5 text-fg-muted text-2xs uppercase tabular-nums">
                  {f.status === 'OPEN' ? (
                    <span className="inline-flex items-center gap-1 text-warning">
                      <span className="h-1.5 w-1.5 rounded-full bg-warning animate-pulse" />
                      Pending
                    </span>
                  ) : (
                    timeAgo(f.closedAt!)
                  )}
                </td>
                <td className="px-3 py-2.5">
                  <span
                    className={cn(
                      'rounded px-1.5 py-0.5 text-[10px] font-semibold tracking-wider',
                      pillStyle,
                    )}
                  >
                    {f.side}
                  </span>{' '}
                  <span className="text-fg font-semibold">{f.pair}</span>{' '}
                  <span className="text-fg-muted">· 5m</span>
                </td>
                <td className="px-3 py-2.5 text-fg-muted text-2xs tabular-nums">
                  {new Date(f.openedAt)
                    .toLocaleTimeString(undefined, {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}{' '}
                  · {f.entryPrice.toLocaleString()}
                  {f.exitPrice ? (
                    <>
                      {' '}
                      <span className="text-border-strong">→</span>{' '}
                      {f.exitPrice.toLocaleString()}
                    </>
                  ) : (
                    <>
                      {' '}
                      <span className="text-border-strong">→</span> live
                    </>
                  )}
                </td>
                <td className="px-3 py-2.5 text-right">
                  {f.status === 'OPEN' ? (
                    <b className="text-warning">FILLING…</b>
                  ) : (
                    <>
                      <span
                        className={cn(
                          'font-semibold tabular-nums',
                          f.pnl >= 0 ? 'text-bullish' : 'text-bearish',
                        )}
                      >
                        {f.pnl >= 0 ? '+' : ''}
                        ${f.pnl.toFixed(2)}
                      </span>{' '}
                      <span
                        className={cn(
                          'rounded px-1.5 py-0.5 text-[10px] font-semibold tracking-wider',
                          statusStyle,
                        )}
                      >
                        {f.status}
                      </span>
                    </>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <div className="border-t border-border-subtle px-3 py-2 text-center text-2xs uppercase tracking-wider text-fg-muted">
        View all {fills.length} trades →
      </div>
    </SectionCard>
  );
}

// ──────────────────────────────────────────────────────────────────────
// Placeholder cards (M4 fill these in)
// ──────────────────────────────────────────────────────────────────────
function PlaceholderCard({ label, plannedIn }: { label: string; plannedIn: string }) {
  return (
    <div
      className={cn(
        'rounded-lg border border-dashed border-border-default bg-surface/40 p-8',
        'flex flex-col items-center justify-center gap-1 text-center',
      )}
    >
      <div className="text-xs font-semibold text-fg-secondary">{label}</div>
      <div className="text-2xs uppercase tracking-wider text-fg-muted">
        arrives in {plannedIn}
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────
// Main page
// ──────────────────────────────────────────────────────────────────────
export function BotMonitoringPage() {
  const { id = '' } = useParams<{ id: string }>();
  const meta = useBotMeta(id);
  const snap = useSnapshot(id, meta?.deployedAt);
  const fills = useFills(id, meta?.deployedAt);
  const [range, setRange] = useState<TimeRange>('30D');
  const equity = useEquityCurve(id, meta?.deployedAt, range);
  const daily = useDailyPnL(id, meta?.deployedAt, 47);
  const cycle = useCycle(id);
  const coin = meta?.pair?.split('-')[0] ?? 'BTC';
  const candles = useHyperliquidCandles(coin, '5m');
  const phase = useBotMaturity(meta?.deployedAt, snap?.totalTrades ?? 0);
  const cypheusMessages = useCypheusMonitoringNarrative(fills, snap, phase);

  if (!meta || !snap) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-canvas text-fg-muted">
        <span className="text-sm">Loading bot…</span>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-screen flex-col bg-canvas text-fg">
      <MonitoringHeader meta={meta} />

      <div className="flex flex-1 overflow-hidden">
        <CypheusRail messages={cypheusMessages} />

        {/* Subtle dot-grid texture matching Builder */}
        <DotGridSpotlight
          className="fixed pointer-events-none z-0"
          style={{
            top: 'var(--layout-header, 56px)',
            left: 'var(--layout-left-panel, 320px)',
            right: '280px',
            bottom: 0,
          }}
          dimmed={false}
        />

        <main className="relative z-10 flex-1 overflow-y-auto">
          <div className="mx-auto flex max-w-6xl flex-col gap-3 px-6 py-5">
            <HeroPnL snap={snap} />

            <div className="grid grid-cols-1 gap-3">
              <ActivityHeatmap
                daily={daily}
                total={snap.totalPnL}
                best={snap.bestDay}
                worst={snap.worstDay}
              />
              <EquityCurve
                data={equity}
                range={range}
                onRangeChange={setRange}
                total={snap.totalPnL}
              />
              <PlaceholderCard label="Order Book L2 · BTC" plannedIn="M4" />
              <LiveSpotFeed
                coin={coin}
                candles={candles}
                fills={fills}
                watchingFor="Bollinger upper band cross + RSI < 70"
              />
              {cycle && <ExecutionPipeline cycle={cycle} />}
              <RecentFills fills={fills} />
            </div>
          </div>
        </main>

        <aside className="relative z-10 w-[280px] flex-shrink-0 border-l border-border-subtle bg-canvas">
          <div className="p-3">
            <PlaceholderCard label="Hyperliquid Markets" plannedIn="M4" />
          </div>
        </aside>
      </div>
    </div>
  );
}
