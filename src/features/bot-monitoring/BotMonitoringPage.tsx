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
import { hlApi, type MetaAndAssetCtxs } from './hyperliquid.service';
import {
  hierarchy as d3Hierarchy,
  pack as d3Pack,
  type HierarchyCircularNode,
} from 'd3-hierarchy';
import {
  bootstrapNarrative,
  generateEventNarrations,
  type CypheusMessage,
} from './cypheusEvents';
import type {
  BotMeta,
  BotPhase,
  EquityPoint,
  ExecutionCycle,
  Fill,
  HLAssetCtx,
  HLCandle,
  HLOrderBook,
  PerformanceSnapshot,
  TimeRange,
} from './types';

// ──────────────────────────────────────────────────────────────────────
// CountingNumber — interpolate from previous to next value over `duration`
// using rAF + ease-out. Used for slow-changing scoreboard numbers (PnL,
// trades, win streak) — gives a "live counting" feel between snapshot
// refreshes. Do NOT use for fast-tick values (orderbook prices/sizes)
// where the interpolation would lag behind the source.
// ──────────────────────────────────────────────────────────────────────
function CountingNumber({
  value,
  format,
  duration = 700,
  className,
}: {
  value: number;
  format: (v: number) => string;
  duration?: number;
  className?: string;
}) {
  const [display, setDisplay] = useState(value);
  const fromRef = useRef(value);
  const targetRef = useRef(value);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (value === targetRef.current && value === display) return;
    if (!Number.isFinite(value)) {
      setDisplay(value);
      return;
    }
    fromRef.current = display;
    targetRef.current = value;
    const start = performance.now();
    const from = fromRef.current;
    const to = value;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      // ease-out cubic — quick to start, settles smoothly
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(from + (to - from) * eased);
      if (t < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        rafRef.current = null;
      }
    };
    if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current != null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
    // We intentionally only re-run when `value` changes; `display` is the
    // ref-tracked starting point and reading it captures the current frame.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, duration]);

  return <span className={className}>{format(display)}</span>;
}

const fmtMoney = (precision = 2) => (v: number) =>
  v.toLocaleString(undefined, {
    minimumFractionDigits: precision,
    maximumFractionDigits: precision,
  });
const fmtInt = (v: number) => Math.round(v).toLocaleString();
const fmtPct = (v: number) => `${v.toFixed(1)}%`;

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
    let cancelled = false;
    const tick = () => {
      botApi.getSnapshot(id, deployedAt).then((s) => {
        if (!cancelled) setSnap(s);
      });
    };
    tick();
    // Refresh every 8s so the CountingNumber components have something to
    // animate to as the mock generator shifts (more fills accumulate over
    // time since `now` advances).
    const handle = setInterval(() => {
      if (document.hidden) return;
      tick();
    }, 8_000);
    return () => {
      cancelled = true;
      clearInterval(handle);
    };
  }, [id, deployedAt]);
  return snap;
}

function useFills(id: string, deployedAt: number | undefined) {
  const [fills, setFills] = useState<Fill[]>([]);
  useEffect(() => {
    if (deployedAt == null) return;
    let cancelled = false;
    const tick = () => {
      botApi.getFills(id, deployedAt).then((f) => {
        if (!cancelled) setFills(f);
      });
    };
    tick();
    const handle = setInterval(() => {
      if (document.hidden) return;
      tick();
    }, 12_000);
    return () => {
      cancelled = true;
      clearInterval(handle);
    };
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

function useHyperliquidMarkets() {
  const [data, setData] = useState<MetaAndAssetCtxs | null>(null);
  useEffect(() => {
    let cancelled = false;
    const load = (skipIfHidden: boolean) => {
      if (skipIfHidden && document.hidden) return;
      hlApi
        .getMetaAndAssetCtxs()
        .then((res) => {
          if (!cancelled) setData(res);
        })
        .catch((err) => console.warn('HL markets fetch:', err));
    };
    load(false); // always fetch once on mount
    const handle = setInterval(() => load(true), 10_000);
    return () => {
      cancelled = true;
      clearInterval(handle);
    };
  }, []);
  return data;
}

function useHyperliquidOrderBook(coin: string) {
  const [book, setBook] = useState<HLOrderBook | null>(null);
  useEffect(() => {
    if (!coin) return;
    let cancelled = false;
    const load = (skipIfHidden: boolean) => {
      if (skipIfHidden && document.hidden) return;
      hlApi
        .getL2Book(coin)
        .then((b) => {
          if (!cancelled) setBook(b);
        })
        .catch((err) => console.warn('HL orderbook fetch:', err));
    };
    load(false); // always fetch once on mount
    const handle = setInterval(() => load(true), 1000);
    return () => {
      cancelled = true;
      clearInterval(handle);
    };
  }, [coin]);
  return book;
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

// ── Multi-timeframe pct cache (module-level, keyed by "tf:cacheKey") ──
const tfPctCache = new Map<string, { data: Map<string, number>; ts: number }>();

// Timeframe → days to look back
const TF_DAYS: Record<string, number> = { '7D': 7, '30D': 30, '90D': 90 };

// Batch-fetch candleSnapshot pct changes for a list of coins.
// max 8 concurrent requests to avoid rate limiting.
function useHLTfPct(
  coins: string[],
  tf: '7D' | '30D' | '90D',
  enabled: boolean,
): Map<string, number> | null {
  const [result, setResult] = useState<Map<string, number> | null>(null);

  // Stable cache key — changes every 5 minutes
  const cacheKey = Math.floor(Date.now() / 300_000).toString();

  useEffect(() => {
    if (!enabled || coins.length === 0) return;

    const key = `${tf}:${cacheKey}`;
    const cached = tfPctCache.get(key);
    if (cached && Date.now() - cached.ts < 300_000) {
      setResult(cached.data);
      return;
    }

    let cancelled = false;
    setResult(null); // reset to loading state

    const days = TF_DAYS[tf];
    const now = Date.now();
    const startTime = now - days * 86_400_000;

    // Run in batches of 8
    async function fetchAll() {
      const map = new Map<string, number>();
      const BATCH = 8;
      for (let i = 0; i < coins.length; i += BATCH) {
        if (cancelled) return;
        const batch = coins.slice(i, i + BATCH);
        await Promise.all(
          batch.map(async (coin) => {
            try {
              const candles = await hlApi.getCandleSnapshot(coin, '1d', startTime, now);
              if (candles.length >= 2) {
                const first = candles[0];
                const last = candles[candles.length - 1];
                const pct = ((last.c - first.o) / first.o) * 100;
                map.set(coin, pct);
              }
            } catch {
              // skip coin on error
            }
          }),
        );
      }
      if (!cancelled) {
        tfPctCache.set(key, { data: map, ts: Date.now() });
        setResult(map);
      }
    }

    fetchAll().catch((err) => console.warn('useHLTfPct fetch failed:', err));

    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, tf, cacheKey, coins.join(',')]);

  return result;
}

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
            style={{
              filter: streak > 0 ? `drop-shadow(0 0 6px ${colorVar})` : undefined,
              transition:
                'stroke-dasharray 600ms cubic-bezier(0.2, 0.8, 0.2, 1)',
            }}
          />
        </svg>
        <div
          className={cn(
            'absolute inset-0 flex items-center justify-center font-pixel text-2xl tabular-nums',
            streak > 0 ? 'text-bullish' : 'text-fg-disabled',
          )}
        >
          <CountingNumber value={streak} format={fmtInt} duration={500} />
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

function HeroPnL({
  snap,
  phase,
}: {
  snap: PerformanceSnapshot;
  phase: BotPhase;
}) {
  if (phase === 'just-deployed') {
    return (
      <section
        aria-labelledby="hero-pnl-label"
        className="relative grid grid-cols-[1fr_auto] gap-6 overflow-hidden rounded-xl border border-border-subtle bg-surface p-6"
      >
        <div className="relative">
          <div
            id="hero-pnl-label"
            className="mb-3 flex items-center gap-3 text-2xs uppercase tracking-widest text-fg-muted"
          >
            <span>Today · Realized PnL</span>
            <span className="inline-flex items-center gap-1.5 text-info">
              <span className="h-1.5 w-1.5 rounded-full bg-info animate-pulse" />
              Scanning
            </span>
            <span className="text-border-strong">·</span>
            <span>0 trades yet</span>
          </div>
          <div
            className="font-pixel text-4xl tabular-nums text-fg-disabled"
            style={{ lineHeight: 1.05 }}
          >
            $0.00
          </div>
          <div className="mt-4 flex items-center gap-3 text-xs text-fg-muted">
            <span>
              <span aria-hidden="true">⏱ </span>
              Est. first signal in{' '}
              <b className="text-fg-secondary">1–3h</b>
            </span>
            <div className="relative h-1 w-48 overflow-hidden rounded-sm bg-canvas">
              <span className="absolute inset-y-0 -left-12 w-12 animate-[scan_2s_linear_infinite] bg-gradient-to-r from-transparent via-info to-transparent" />
            </div>
          </div>
        </div>
        <div className="flex flex-col items-center justify-center w-32 opacity-40">
          <svg width="96" height="96" viewBox="0 0 100 100" aria-hidden="true">
            <circle
              cx="50"
              cy="50"
              r="42"
              fill="none"
              stroke="var(--color-border-default)"
              strokeWidth="4"
            />
          </svg>
          <div className="-mt-[72px] font-pixel text-2xl text-fg-disabled">
            —
          </div>
          <div className="mt-8 text-2xs uppercase tracking-widest text-fg-muted text-center leading-relaxed">
            Build a streak
          </div>
        </div>
      </section>
    );
  }

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
          {sign === '+' ? '+' : '−'}$
          <CountingNumber
            value={Math.abs(snap.todayPnL)}
            format={fmtMoney(2)}
            duration={900}
          />
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-fg-secondary">
          <span className="inline-flex items-center gap-1.5">
            <span className="text-bullish">▲</span>
            <CountingNumber
              value={snap.totalTrades}
              format={fmtInt}
              duration={600}
              className="text-fg font-semibold tabular-nums"
            />
            <span className="text-fg-muted">trades</span>
          </span>
          <span className="text-border-strong">·</span>
          <span className="inline-flex items-center gap-1.5">
            <CountingNumber
              value={snap.winRate * 100}
              format={fmtPct}
              duration={600}
              className="text-bullish font-semibold tabular-nums"
            />
            <span className="text-fg-muted">win</span>
          </span>
          <span className="text-border-strong">·</span>
          <span className="inline-flex items-center gap-1.5">
            <CountingNumber
              value={snap.openPositions}
              format={fmtInt}
              duration={400}
              className="text-fg font-semibold tabular-nums"
            />
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
              {snap.totalPnL >= 0 ? '+' : '−'}$
              <CountingNumber
                value={Math.abs(snap.totalPnL)}
                format={fmtMoney(2)}
                duration={900}
              />
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

function EmptyStateCard({
  icon,
  title,
  body,
}: {
  icon: string;
  title: string;
  body: string;
}) {
  return (
    <section className="rounded-lg border border-border-subtle bg-surface p-8 text-center">
      <div className="mx-auto mb-2 h-10 w-10 rounded-md bg-canvas flex items-center justify-center text-lg">
        {icon}
      </div>
      <h4 className="m-0 text-sm font-semibold text-fg">{title}</h4>
      <p className="mt-1 text-2xs text-fg-muted">{body}</p>
    </section>
  );
}

function EquityCurve({
  data,
  range,
  onRangeChange,
  total,
  phase,
}: {
  data: EquityPoint[];
  range: TimeRange;
  onRangeChange: (r: TimeRange) => void;
  total: number;
  phase: BotPhase;
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
          attributionLogo: false,
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
      lineType: 2, // curved (bezier) — matches LiveSpotFeed Coin98 style
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

  if (phase === 'just-deployed' || data.length === 0) {
    return (
      <EmptyStateCard
        icon="📈"
        title="Equity curve will appear here"
        body="After your first closed trade · est. 1–3 hours"
      />
    );
  }

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
            {total >= 0 ? '+' : '−'}$
            <CountingNumber
              value={Math.abs(total)}
              format={fmtMoney(2)}
              duration={800}
            />
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
          attributionLogo: false,
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
// ExecutionPipeline — 6 stage cards (Scan → Detect → … → Settle) + budget
// Active stage glows bullish + pulse animation matching Builder card style.
// ──────────────────────────────────────────────────────────────────────
function ExecutionPipeline({
  cycle,
  phase,
}: {
  cycle: ExecutionCycle;
  phase: BotPhase;
}) {
  const elapsedSec = (cycle.elapsedMs / 1000).toFixed(2);
  const budgetSec = (cycle.budgetMs / 1000).toFixed(1);
  const underBudget = cycle.elapsedMs <= cycle.budgetMs;
  const isScanning = phase === 'just-deployed';
  return (
    <SectionCard
      title={
        <span className="inline-flex items-center gap-2">
          <span
            className={cn(
              'h-1.5 w-1.5 rounded-full animate-pulse',
              isScanning ? 'bg-info' : 'bg-bullish',
            )}
          />
          <span>Execution Cycle</span>
        </span>
      }
      meta={
        <span className="tabular-nums text-fg-muted">
          Cycle{' '}
          <b className="text-fg-secondary">
            {isScanning ? '#1 · scanning' : `#${cycle.cycleId}`}
          </b>
        </span>
      }
      rightSlot={
        isScanning ? (
          <span className="text-2xs uppercase tracking-wider text-fg-muted tabular-nums normal-case">
            Last scan <b className="text-info">12s ago</b>
            <span className="text-border-strong mx-2">·</span>
            No signal
          </span>
        ) : (
          <span className="text-2xs uppercase tracking-wider text-fg-muted tabular-nums normal-case">
            Budget <b className="text-fg-secondary">{budgetSec}s</b>
            <span className="text-border-strong mx-2">·</span>
            Elapsed{' '}
            <b className={underBudget ? 'text-bullish' : 'text-bearish'}>
              {elapsedSec}s
            </b>
          </span>
        )
      }
    >
      <div className="grid grid-cols-7 gap-2 p-3">
        {cycle.stages.map((s, i) => {
          // In scanning mode, only stage 1 (Scan) is highlighted blue;
          // all others stay pending.
          const status = isScanning
            ? i === 0
              ? 'active'
              : 'pending'
            : s.status;
          return (
          <div
            key={s.id}
            className={cn(
              'rounded-md p-2 transition-all',
              status === 'active' && isScanning &&
                'bg-info/10 border border-info ring-1 ring-info/40 shadow-[0_0_12px_rgba(59,130,246,0.25)]',
              status === 'active' && !isScanning &&
                'bg-bullish/10 border border-bullish ring-1 ring-bullish/40 shadow-[0_0_12px_rgba(14,203,129,0.25)]',
              status === 'done' &&
                'bg-bullish/5 border border-bullish/30',
              status === 'pending' &&
                'bg-canvas border border-border-subtle',
            )}
          >
            <div
              className={cn(
                'text-[9px] font-semibold tracking-wider',
                status === 'active' && isScanning
                  ? 'text-info'
                  : status === 'active'
                    ? 'text-bullish'
                    : status === 'done'
                      ? 'text-bullish/70'
                      : 'text-fg-muted',
              )}
            >
              {String(i + 1).padStart(2, '0')}
              {status === 'active' && ' · ACT'}
            </div>
            <div className="text-xs font-semibold text-fg mt-0.5">{s.label}</div>
            <div
              className={cn(
                'text-xs font-bold tabular-nums mt-0.5',
                status === 'active' && isScanning
                  ? 'text-info'
                  : status === 'active'
                    ? 'text-bullish'
                    : status === 'done'
                      ? 'text-bullish/70'
                      : 'text-fg-disabled',
              )}
            >
              {isScanning && i === 0
                ? 'live'
                : s.durationMs > 0
                  ? `${s.durationMs}ms`
                  : '—'}
            </div>
          </div>
          );
        })}
        {/* Budget summary / scan-counter card */}
        {isScanning ? (
          <div className="rounded-md p-2 border bg-info/10 border-info/30">
            <div className="text-[9px] font-semibold tracking-wider text-info">
              SCANS
            </div>
            <div className="text-xs font-bold tabular-nums mt-0.5 text-fg">
              3,247
            </div>
            <div className="text-2xs uppercase tracking-wider mt-0.5 text-info/80">
              Since deploy
            </div>
          </div>
        ) : (
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
        )}
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

function RecentFills({
  fills,
  phase,
}: {
  fills: Fill[];
  phase: BotPhase;
}) {
  if (phase === 'just-deployed' || fills.length === 0) {
    return (
      <EmptyStateCard
        icon="⏳"
        title="Waiting for first signal"
        body="Trades will stream here as they execute · est. first within 1–3 hours"
      />
    );
  }
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
// OrderBookL2 — depth table for bot's pair (real Hyperliquid l2Book)
// 2-column layout: asks (red) · spread/mid strip · bids (green)
// Smooth update strategy:
//  · stable rank-based keys (`ask-0`..`ask-5`) so DOM nodes persist between
//    polls — text/style updates animate instead of mount/unmount jumps
//  · CSS transition on bar width (600ms ease-out-quick)
//  · per-row flash highlight (500ms) when price changes
//  · spread/mid number gets a subtle scale pulse on update
// ──────────────────────────────────────────────────────────────────────
const OB_DEPTH = 6;

interface OBLevel {
  px: number;
  sz: number;
}

function OBRow({
  level,
  maxSize,
  side,
}: {
  level: OBLevel | null;
  maxSize: number;
  side: 'ask' | 'bid';
}) {
  const ref = useRef<HTMLDivElement>(null);
  const prevPxRef = useRef<number | null>(null);

  // Flash highlight on price change for this rank.
  useEffect(() => {
    if (!ref.current || level == null) return;
    const prev = prevPxRef.current;
    prevPxRef.current = level.px;
    if (prev == null || prev === level.px) return;
    const el = ref.current;
    const cls = side === 'ask' ? 'ob-flash-ask' : 'ob-flash-bid';
    el.classList.remove(cls);
    // Force reflow so re-adding the class restarts the animation
    void el.offsetWidth;
    el.classList.add(cls);
  }, [level?.px, side, level]);

  const widthPct = level ? Math.min(100, (level.sz / maxSize) * 100) : 0;
  const colorClass = side === 'ask' ? 'text-bearish' : 'text-bullish';
  const barGradient =
    side === 'ask'
      ? 'linear-gradient(90deg, transparent, rgba(246, 70, 93, 0.25))'
      : 'linear-gradient(90deg, transparent, rgba(14, 203, 129, 0.25))';

  return (
    <div
      ref={ref}
      className="ob-row grid grid-cols-[1fr_minmax(0,1fr)_auto] items-center gap-2 py-0.5 text-xs"
    >
      <span className={cn('font-semibold tabular-nums', colorClass)}>
        {level
          ? level.px.toLocaleString(undefined, {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })
          : '—'}
      </span>
      <div
        className="ob-bar h-3 rounded-sm"
        style={{
          width: `${widthPct}%`,
          background: barGradient,
        }}
      />
      <span className="text-2xs text-fg-muted text-right tabular-nums">
        {level ? level.sz.toFixed(3) : ''}
      </span>
    </div>
  );
}

function MidPriceDisplay({
  mid,
  spread,
  spreadPct,
}: {
  mid: number;
  spread: number;
  spreadPct: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const prevMidRef = useRef<number | null>(null);

  useEffect(() => {
    if (!ref.current || !Number.isFinite(mid)) return;
    const prev = prevMidRef.current;
    prevMidRef.current = mid;
    if (prev == null || prev === mid) return;
    const el = ref.current;
    el.classList.remove('ob-mid-pulse');
    void el.offsetWidth;
    el.classList.add('ob-mid-pulse');
  }, [mid]);

  return (
    <div
      ref={ref}
      className="text-base font-bold text-fg tabular-nums origin-center"
    >
      {Number.isFinite(mid)
        ? mid.toLocaleString(undefined, { maximumFractionDigits: 2 })
        : '—'}
      <div className="mt-0.5 text-2xs text-warning tabular-nums font-normal">
        ${spread.toFixed(2)} · {spreadPct.toFixed(3)}%
      </div>
    </div>
  );
}

function OrderBookL2({ book, coin }: { book: HLOrderBook | null; coin: string }) {
  if (!book || book.levels[0].length === 0 || book.levels[1].length === 0) {
    return (
      <SectionCard
        title={
          <span className="inline-flex items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded border border-bullish/30 bg-bullish/10 px-1.5 py-0.5 text-[10px] font-bold tracking-wider text-bullish">
              <span className="h-1.5 w-1.5 rounded-full bg-bullish animate-pulse" />
              L2
            </span>
            <span>Order Book · {coin}</span>
          </span>
        }
      >
        <div className="px-4 py-8 text-center text-xs text-fg-muted">
          Loading order book…
        </div>
      </SectionCard>
    );
  }

  // HL returns levels[0]=asks (sells), levels[1]=bids (buys).
  // Pad to fixed length so the row count never jumps mid-update.
  const padTo = (arr: OBLevel[], cmp: (a: OBLevel, b: OBLevel) => number) => {
    const sorted = [...arr].sort(cmp).slice(0, OB_DEPTH);
    while (sorted.length < OB_DEPTH) sorted.push({ px: 0, sz: 0 });
    return sorted;
  };
  const asks = padTo(book.levels[0], (a, b) => a.px - b.px); // ascending
  const bids = padTo(book.levels[1], (a, b) => b.px - a.px); // descending
  // Asks display from spread outward → reverse so best ask sits at bottom
  // of asks column (closest to spread strip).
  const asksDisplay = [...asks].reverse();

  const bestAsk = asks[0]?.px ?? 0;
  const bestBid = bids[0]?.px ?? 0;
  const spread = bestAsk && bestBid ? bestAsk - bestBid : 0;
  const mid = bestAsk && bestBid ? (bestAsk + bestBid) / 2 : 0;
  const spreadPct = mid > 0 ? (spread / mid) * 100 : 0;

  const maxAsk = Math.max(...asks.map((l) => l.sz), 0.0001);
  const maxBid = Math.max(...bids.map((l) => l.sz), 0.0001);

  return (
    <SectionCard
      title={
        <span className="inline-flex items-center gap-2">
          <span className="inline-flex items-center gap-1 rounded border border-bullish/30 bg-bullish/10 px-1.5 py-0.5 text-[10px] font-bold tracking-wider text-bullish">
            <span className="h-1.5 w-1.5 rounded-full bg-bullish animate-pulse" />
            L2
          </span>
          <span>Order Book · {coin}</span>
        </span>
      }
      rightSlot={
        <span className="text-2xs text-fg-muted normal-case">
          Updates 1s
        </span>
      }
    >
      <div className="grid grid-cols-[1fr_auto_1fr]">
        {/* Asks (sells) */}
        <div className="px-4 py-3">
          <div className="mb-1 text-2xs uppercase tracking-wider text-fg-muted">
            Asks · sells
          </div>
          {asksDisplay.map((l, i) => (
            <OBRow
              key={`ask-${i}`}
              level={l.px > 0 ? l : null}
              maxSize={maxAsk}
              side="ask"
            />
          ))}
        </div>

        {/* Spread / mid strip */}
        <div className="border-x border-border-subtle bg-canvas px-4 py-3 flex flex-col items-center justify-center min-w-[140px]">
          <div className="text-2xs uppercase tracking-wider text-fg-muted">Spread</div>
          <div className="mt-1">
            <MidPriceDisplay
              mid={mid}
              spread={spread}
              spreadPct={spreadPct}
            />
          </div>
          <div className="mt-2 text-[9px] uppercase tracking-wider text-fg-disabled">
            Mid Price
          </div>
        </div>

        {/* Bids (buys) */}
        <div className="px-4 py-3">
          <div className="mb-1 text-2xs uppercase tracking-wider text-fg-muted">
            Bids · buys
          </div>
          {bids.map((l, i) => (
            <OBRow
              key={`bid-${i}`}
              level={l.px > 0 ? l : null}
              maxSize={maxBid}
              side="bid"
            />
          ))}
        </div>
      </div>
    </SectionCard>
  );
}

// ──────────────────────────────────────────────────────────────────────
// GainersLosersBubble — Hyperliquid market-wide top movers visualization.
// Visual ref: viz_pnl_dashboard.html — body radial gradient + halo glow +
// highlight + iridescent rim. Layout: d3.pack circle packing.
// 7D/30D/90D tabs are visual stubs for v1 (only 24H has real % change).
// ──────────────────────────────────────────────────────────────────────
type BubbleTimeframe = '24H' | '7D' | '30D' | '90D';
const VOL_FILTER_MIN = 100_000;
const BUBBLE_CANVAS_W = 256;
const BUBBLE_CANVAS_H = 540;
const BUBBLE_PAD = 4;
const BUBBLE_MAX = 18;

interface BubblePair {
  name: string;
  pct: number;
  vol: number;
  cx: number;
  cy: number;
  r: number;
}

function computeBubbles(ctxs: HLAssetCtx[]): BubblePair[] {
  const items = ctxs
    .filter((c) => c.dayNtlVlm >= VOL_FILTER_MIN && c.prevDayPx > 0)
    .map((c) => ({
      name: c.coin,
      pct: ((c.markPx - c.prevDayPx) / c.prevDayPx) * 100,
      vol: c.dayNtlVlm,
    }))
    .sort(
      (a, b) =>
        Math.abs(b.pct) * Math.log10(b.vol + 10) -
        Math.abs(a.pct) * Math.log10(a.vol + 10),
    );
  const top = items.slice(0, BUBBLE_MAX);
  if (top.length === 0) return [];

  // d3.pack circle-packing — value ∝ sqrt(|pct| · log(vol)) so radius
  // reads visually as magnitude weighted by liquidity.
  type Leaf = { name: string; pct: number; vol: number };
  type Datum = { name: string; pct?: number; vol?: number; children?: Leaf[] };
  const root: Datum = {
    name: 'root',
    children: top.map((p) => ({ name: p.name, pct: p.pct, vol: p.vol })),
  };
  const packed = d3Pack<Datum>()
    .size([BUBBLE_CANVAS_W, BUBBLE_CANVAS_H])
    .padding(BUBBLE_PAD)(
    d3Hierarchy<Datum>(root).sum((d) =>
      d.children
        ? 0
        : Math.sqrt(Math.abs(d.pct ?? 0)) * Math.log10((d.vol ?? 0) + 10),
    ),
  );

  return (packed.leaves() as HierarchyCircularNode<Datum>[]).map((node) => ({
    name: node.data.name,
    pct: node.data.pct ?? 0,
    vol: node.data.vol ?? 0,
    cx: node.x,
    cy: node.y,
    r: node.r,
  }));
}

interface BubbleStats {
  winners: number;
  losers: number;
  bestCoin: string | null;
  bestPct: number;
  worstCoin: string | null;
  worstPct: number;
}

function computeBubbleStats(ctxs: HLAssetCtx[]): BubbleStats {
  const filtered = ctxs.filter(
    (c) => c.dayNtlVlm >= VOL_FILTER_MIN && c.prevDayPx > 0,
  );
  let winners = 0;
  let losers = 0;
  let best: { coin: string; pct: number } | null = null;
  let worst: { coin: string; pct: number } | null = null;
  for (const c of filtered) {
    const pct = ((c.markPx - c.prevDayPx) / c.prevDayPx) * 100;
    if (pct > 0) winners++;
    else if (pct < 0) losers++;
    if (!best || pct > best.pct) best = { coin: c.coin, pct };
    if (!worst || pct < worst.pct) worst = { coin: c.coin, pct };
  }
  return {
    winners,
    losers,
    bestCoin: best?.coin ?? null,
    bestPct: best?.pct ?? 0,
    worstCoin: worst?.coin ?? null,
    worstPct: worst?.pct ?? 0,
  };
}

// ── Physics engine for GainersLosersBubble ────────────────────────────
// Matches viz_pnl_dashboard.html: Brownian noise + elastic collisions +
// jelly squash/spring + organic blob perimeter (Cardinal closed spline).
// All DOM updates are imperative via refs — zero React re-renders at 60fps.
// ──────────────────────────────────────────────────────────────────────

interface PhysBubble {
  id: string;
  pct: number;
  vol: number;
  x: number;
  y: number;
  r: number;
  vx: number;
  vy: number;
  mass: number;
  squashAmount: number;
  squashVel: number;
  squashAxis: number;
  phase: number; // per-bubble random phase for blob wobble
}

const PHYS = {
  thermal: 0.12,       // Brownian noise amplitude — higher = more lively drift
  centerPull: 0.0004,  // soft gravity toward canvas centre
  damping: 0.988,      // velocity drain per frame — slightly less drag
  restitution: 0.45,   // energy kept on bubble–bubble collision
  wallRestitution: 0.55,
  minSpeed: 0.08,      // velocity floor — keeps bubbles always drifting
} as const;

const JELLY = {
  springK: 0.20,       // restoring stiffness toward round shape
  springDamp: 0.50,    // squash velocity drain — decays in ~5 frames
  squashGain: 0.0006,  // collision → squash multiplier
  maxSquash: 0.025,    // max deformation (2.5 % of radius)
  wallSquashGain: 0.0005,
  perimAmp: 0.014,     // blob breathing amplitude
  perimVerts: 16,      // vertices for the organic outline
} as const;

function bRand(lo: number, hi: number) {
  return lo + Math.random() * (hi - lo);
}

function applySquashForce(b: PhysBubble, amount: number, axis: number) {
  b.squashAxis = axis;
  b.squashVel += amount;
  if (Math.abs(b.squashAmount) > JELLY.maxSquash) {
    b.squashAmount = Math.sign(b.squashAmount) * JELLY.maxSquash;
    b.squashVel *= 0.5;
  }
}

function stepPhysics(bubbles: PhysBubble[], W: number, H: number) {
  const cx = W / 2, cy = H / 2;

  // 1. Forces + Euler integration
  for (const b of bubbles) {
    b.vx += bRand(-PHYS.thermal, PHYS.thermal);
    b.vy += bRand(-PHYS.thermal, PHYS.thermal);
    b.vx += (cx - b.x) * PHYS.centerPull;
    b.vy += (cy - b.y) * PHYS.centerPull;
    b.vx *= PHYS.damping;
    b.vy *= PHYS.damping;
    // Velocity floor — bubble never fully stops
    const sp = Math.sqrt(b.vx * b.vx + b.vy * b.vy);
    if (sp < PHYS.minSpeed) {
      const ang = bRand(0, Math.PI * 2);
      b.vx += Math.cos(ang) * PHYS.minSpeed * 0.3;
      b.vy += Math.sin(ang) * PHYS.minSpeed * 0.3;
    }
    b.x += b.vx;
    b.y += b.vy;
  }

  // 2. Wall bounce + squash
  for (const b of bubbles) {
    if (b.x - b.r < 8) {
      applySquashForce(b, Math.abs(b.vx) * JELLY.wallSquashGain, 0);
      b.x = b.r + 8;
      b.vx = Math.abs(b.vx) * PHYS.wallRestitution;
    }
    if (b.x + b.r > W - 8) {
      applySquashForce(b, Math.abs(b.vx) * JELLY.wallSquashGain, 0);
      b.x = W - b.r - 8;
      b.vx = -Math.abs(b.vx) * PHYS.wallRestitution;
    }
    if (b.y - b.r < 8) {
      applySquashForce(b, Math.abs(b.vy) * JELLY.wallSquashGain, Math.PI / 2);
      b.y = b.r + 8;
      b.vy = Math.abs(b.vy) * PHYS.wallRestitution;
    }
    if (b.y + b.r > H - 8) {
      applySquashForce(b, Math.abs(b.vy) * JELLY.wallSquashGain, Math.PI / 2);
      b.y = H - b.r - 8;
      b.vy = -Math.abs(b.vy) * PHYS.wallRestitution;
    }
  }

  // 3. Pairwise elastic collisions
  for (let i = 0; i < bubbles.length; i++) {
    for (let j = i + 1; j < bubbles.length; j++) {
      const a = bubbles[i], bub = bubbles[j];
      const dx = bub.x - a.x, dy = bub.y - a.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const minD = a.r + bub.r + 2;
      if (dist < minD && dist > 0.01) {
        const overlap = (minD - dist) / 2;
        const nx = dx / dist, ny = dy / dist;
        a.x -= nx * overlap; a.y -= ny * overlap;
        bub.x += nx * overlap; bub.y += ny * overlap;
        const dvx = bub.vx - a.vx, dvy = bub.vy - a.vy;
        const vn = dvx * nx + dvy * ny;
        if (vn < 0) {
          const ma = a.mass, mb = bub.mass;
          const imp = -(1 + PHYS.restitution) * vn / (1 / ma + 1 / mb);
          const ix = imp * nx, iy = imp * ny;
          a.vx -= ix / ma; a.vy -= iy / ma;
          bub.vx += ix / mb; bub.vy += iy / mb;
          const cAxis = Math.atan2(ny, nx);
          applySquashForce(a, Math.abs(imp) * JELLY.squashGain / Math.sqrt(ma), cAxis);
          applySquashForce(bub, Math.abs(imp) * JELLY.squashGain / Math.sqrt(mb), cAxis);
        }
      }
    }
  }
}

function stepJelly(bubbles: PhysBubble[]) {
  for (const b of bubbles) {
    b.squashVel += -b.squashAmount * JELLY.springK;
    b.squashVel *= JELLY.springDamp;
    b.squashAmount += b.squashVel;
    if (Math.abs(b.squashAmount) > JELLY.maxSquash) {
      b.squashAmount = Math.sign(b.squashAmount) * JELLY.maxSquash;
      b.squashVel *= -0.4;
    }
  }
}

// Cardinal closed spline (equivalent to d3.curveCardinalClosed tension=0.5)
function cardinalClosed(pts: [number, number][], tension = 0.5): string {
  const N = pts.length;
  if (N < 3) return '';
  const α = (1 - tension) / 2;
  let d = `M${pts[0][0].toFixed(1)},${pts[0][1].toFixed(1)}`;
  for (let i = 0; i < N; i++) {
    const p0 = pts[(i - 1 + N) % N];
    const p1 = pts[i];
    const p2 = pts[(i + 1) % N];
    const p3 = pts[(i + 2) % N];
    const m1x = α * (p2[0] - p0[0]);
    const m1y = α * (p2[1] - p0[1]);
    const m2x = α * (p3[0] - p1[0]);
    const m2y = α * (p3[1] - p1[1]);
    const cp1x = (p1[0] + m1x / 3).toFixed(1);
    const cp1y = (p1[1] + m1y / 3).toFixed(1);
    const cp2x = (p2[0] - m2x / 3).toFixed(1);
    const cp2y = (p2[1] - m2y / 3).toFixed(1);
    d += `C${cp1x},${cp1y} ${cp2x},${cp2y} ${p2[0].toFixed(1)},${p2[1].toFixed(1)}`;
  }
  return d + 'Z';
}

// Organic blob path: multi-frequency sine wobble + jelly squash deformation
function makeBlobPath(
  px: number, py: number, r: number,
  squash: number, squashAxis: number,
  t: number, phase: number,
): string {
  const N = JELLY.perimVerts;
  const A = JELLY.perimAmp;
  const pts: [number, number][] = [];
  for (let i = 0; i < N; i++) {
    const ang = (i / N) * Math.PI * 2;
    const off =
      A * Math.sin(t * 0.6 + i * 0.5 + phase) * 0.55 +
      A * Math.sin(t * 1.0 + i * 0.9 + phase * 1.3) * 0.30 +
      A * Math.sin(t * 0.35 + i * 0.3 + phase * 0.7) * 0.18;
    // squash: compress along squashAxis, expand perpendicular
    const relAng = ang - squashAxis;
    const squashF = 1 + squash * Math.cos(2 * relAng);
    const rr = r * (1 + off) * squashF;
    pts.push([px + Math.cos(ang) * rr, py + Math.sin(ang) * rr]);
  }
  return cardinalClosed(pts);
}

// Imperative SVG helpers — avoids React re-render overhead at 60fps
const SVGNS = 'http://www.w3.org/2000/svg';

function svgEl(tag: 'circle', attrs: Record<string, string | number>): SVGCircleElement;
function svgEl(tag: 'path', attrs: Record<string, string | number>): SVGPathElement;
function svgEl(tag: 'text', attrs: Record<string, string | number>): SVGTextElement;
function svgEl(tag: string, attrs: Record<string, string | number>): SVGElement {
  const el = document.createElementNS(SVGNS, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, String(v));
  return el;
}

interface BubbleDOM {
  g: SVGGElement;
  halo: SVGCircleElement;
  rim: SVGCircleElement;
  body: SVGPathElement;
  hl: SVGPathElement;
  sym: SVGTextElement;
  pct: SVGTextElement | null;
  symFontSize: number;
}

interface BubbleHoverInfo {
  id: string;
  pct: number;
  vol: number;
  x: number;
  y: number;
}

function spawnBubbleDOM(
  b: PhysBubble,
  t: number,
  onHover?: (info: BubbleHoverInfo | null) => void,
): BubbleDOM {
  const variant = b.pct >= 0 ? 'gain' : 'loss';
  const sym = b.id.length > 5 ? b.id.slice(0, 5) : b.id;
  const symFontSize = Math.max(9, Math.min(b.r * 0.36, 16));
  const pctFontSize = Math.max(8, Math.min(b.r * 0.30, 14));

  const g = document.createElementNS(SVGNS, 'g') as SVGGElement;
  g.setAttribute('data-bid', b.id);
  g.style.cursor = 'pointer';

  if (onHover) {
    g.addEventListener('mouseenter', () => {
      const rect = g.getBoundingClientRect();
      onHover({ id: b.id, pct: b.pct, vol: b.vol, x: rect.left + rect.width / 2, y: rect.top - 8 });
    });
    g.addEventListener('mouseleave', () => onHover(null));
  }

  const halo = svgEl('circle', { cx: b.x, cy: b.y, r: b.r * 1.35, fill: `url(#hlHalo-${variant})` });
  const rim = svgEl('circle', { cx: b.x, cy: b.y, r: b.r, fill: 'none', stroke: 'url(#hlRim)', 'stroke-width': 1.2, opacity: 0.4 });
  const strokeColor = b.pct >= 0 ? 'rgba(14,203,129,0.55)' : 'rgba(246,70,93,0.55)';
  const body = svgEl('path', {
    d: makeBlobPath(b.x, b.y, b.r, 0, 0, t, b.phase),
    fill: `url(#hlBody-${variant})`,
    stroke: strokeColor,
    'stroke-width': 0.8,
  });
  const hl = svgEl('path', {
    d: makeBlobPath(b.x - b.r * 0.15, b.y - b.r * 0.2, b.r * 0.7, 0, 0, t, b.phase + 1),
    fill: 'url(#hlHighlight)',
    'pointer-events': 'none',
  });
  const symEl = svgEl('text', {
    x: b.x, y: b.y - 2,
    'font-family': 'Inter, sans-serif',
    'font-weight': 700,
    'font-size': symFontSize,
    fill: '#fff',
    'text-anchor': 'middle',
    'dominant-baseline': 'middle',
  });
  symEl.textContent = sym;

  let pctEl: SVGTextElement | null = null;
  if (b.r >= 18) {
    pctEl = svgEl('text', {
      x: b.x, y: b.y + symFontSize * 0.85,
      'font-family': 'JetBrains Mono, monospace',
      'font-weight': 600,
      'font-size': pctFontSize,
      fill: '#fff',
      'text-anchor': 'middle',
      'dominant-baseline': 'middle',
    });
    pctEl.textContent = `${b.pct >= 0 ? '+' : ''}${b.pct.toFixed(1)}%`;
  }

  g.appendChild(halo);
  g.appendChild(rim);
  g.appendChild(body);
  g.appendChild(hl);
  g.appendChild(symEl);
  if (pctEl) g.appendChild(pctEl);

  return { g, halo, rim, body, hl, sym: symEl, pct: pctEl, symFontSize };
}

// ── Component ──────────────────────────────────────────────────────────
function GainersLosersBubble({ ctxs }: { ctxs: HLAssetCtx[] }) {
  const [tf, setTf] = useState<BubbleTimeframe>('24H');
  const [tooltip, setTooltip] = useState<BubbleHoverInfo | null>(null);
  const stats = computeBubbleStats(ctxs);

  // Derive the top-coin list for multi-TF fetches (from 24H volume ranking)
  const topCoins = computeBubbles(ctxs).map((b) => b.name);

  const tfPctMap = useHLTfPct(
    topCoins,
    tf !== '24H' ? (tf as '7D' | '30D' | '90D') : '7D',
    tf !== '24H',
  );

  const svgRef = useRef<SVGSVGElement>(null);
  const physRef = useRef<PhysBubble[]>([]);
  const domCacheRef = useRef<Map<string, BubbleDOM>>(new Map());
  const rafRef = useRef<number>(0);
  const tRef = useRef(0);
  // Keep a stable ref to setTooltip so spawnBubbleDOM can close over it
  const setTooltipRef = useRef(setTooltip);
  setTooltipRef.current = setTooltip;

  // Sync physics state + SVG DOM when live data changes
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg || ctxs.length === 0) return;

    const packed = computeBubbles(ctxs);
    const existingPhys = new Map(physRef.current.map((b) => [b.id, b]));
    const domCache = domCacheRef.current;
    const incomingIds = new Set(packed.map((p) => p.name));

    // Remove stale bubbles
    for (const [id, dom] of domCache) {
      if (!incomingIds.has(id)) {
        dom.g.remove();
        domCache.delete(id);
      }
    }

    // Update existing / spawn new
    const newPhys: PhysBubble[] = packed.map((p) => {
      const prev = existingPhys.get(p.name);
      if (prev) {
        prev.pct = p.pct;
        prev.vol = p.vol;
        // Sync pct label text
        const dom = domCache.get(p.name);
        if (dom?.pct)
          dom.pct.textContent = `${p.pct >= 0 ? '+' : ''}${p.pct.toFixed(1)}%`;
        return prev;
      }
      // New bubble — initialise with d3.pack position + strong random kick
      const b: PhysBubble = {
        id: p.name, pct: p.pct, vol: p.vol,
        x: p.cx, y: p.cy, r: p.r,
        vx: bRand(-1.5, 1.5), vy: bRand(-1.5, 1.5),
        mass: p.r * p.r,
        squashAmount: 0, squashVel: 0, squashAxis: 0,
        phase: Math.random() * Math.PI * 2,
      };
      const dom = spawnBubbleDOM(b, tRef.current, (info) => setTooltipRef.current(info));
      domCache.set(p.name, dom);
      svg.appendChild(dom.g);
      return b;
    });
    physRef.current = newPhys;
  }, [ctxs]);

  // When multi-TF data arrives, update bubble pct values + DOM labels
  useEffect(() => {
    if (tf === '24H' || !tfPctMap) return;
    const domCache = domCacheRef.current;
    for (const b of physRef.current) {
      const newPct = tfPctMap.get(b.id);
      if (newPct == null) continue;
      b.pct = newPct;
      const dom = domCache.get(b.id);
      if (dom?.pct)
        dom.pct.textContent = `${newPct >= 0 ? '+' : ''}${newPct.toFixed(1)}%`;
    }
  }, [tf, tfPctMap]);

  // When switching back to 24H, restore original pct from ctxs
  useEffect(() => {
    if (tf !== '24H' || ctxs.length === 0) return;
    const ctxMap = new Map(ctxs.map((c) => [c.coin, c]));
    const domCache = domCacheRef.current;
    for (const b of physRef.current) {
      const c = ctxMap.get(b.id);
      if (!c) continue;
      const pct = ((c.markPx - c.prevDayPx) / c.prevDayPx) * 100;
      b.pct = pct;
      const dom = domCache.get(b.id);
      if (dom?.pct)
        dom.pct.textContent = `${pct >= 0 ? '+' : ''}${pct.toFixed(1)}%`;
    }
  }, [tf, ctxs]);

  // ~60fps animation loop via setInterval — runs even in background/hidden iframes.
  // Falls back gracefully when tab is throttled; RAF would pause in hidden contexts.
  useEffect(() => {
    function frame() {
      tRef.current += 1 / 60;
      const t = tRef.current;
      const bubbles = physRef.current;
      if (bubbles.length === 0) return;

      stepPhysics(bubbles, BUBBLE_CANVAS_W, BUBBLE_CANVAS_H);
      stepJelly(bubbles);

      const cache = domCacheRef.current;
      for (const b of bubbles) {
        const dom = cache.get(b.id);
        if (!dom) continue;

        const bx = b.x.toFixed(1);
        const by = b.y.toFixed(1);

        dom.halo.setAttribute('cx', bx);
        dom.halo.setAttribute('cy', by);

        dom.rim.setAttribute('cx', bx);
        dom.rim.setAttribute('cy', by);

        dom.body.setAttribute('d',
          makeBlobPath(b.x, b.y, b.r, b.squashAmount, b.squashAxis, t, b.phase),
        );
        dom.hl.setAttribute('d',
          makeBlobPath(b.x - b.r * 0.15, b.y - b.r * 0.2, b.r * 0.7,
            b.squashAmount * 0.5, b.squashAxis, t * 0.8, b.phase + 1),
        );

        dom.sym.setAttribute('x', bx);
        dom.sym.setAttribute('y', (b.y - 2).toFixed(1));

        if (dom.pct) {
          dom.pct.setAttribute('x', bx);
          dom.pct.setAttribute('y', (b.y + dom.symFontSize * 0.85).toFixed(1));
        }
      }
    }

    rafRef.current = window.setInterval(frame, 1000 / 60) as unknown as number;
    return () => window.clearInterval(rafRef.current);
  }, []);

  // Whether we're loading multi-TF data
  const isLoading = tf !== '24H' && tfPctMap === null && topCoins.length > 0;

  return (
    <section className="rounded-lg border border-border-subtle bg-surface p-3 sticky top-3">
      <header className="mb-2 flex items-center justify-between text-2xs uppercase tracking-wider text-fg-muted">
        <span className="font-semibold">Hyperliquid Markets</span>
        <span className="inline-flex items-center gap-1 normal-case tracking-normal text-bullish">
          <span className="h-1.5 w-1.5 rounded-full bg-bullish animate-pulse" />
          Live
        </span>
      </header>

      <div
        role="tablist"
        aria-label="Timeframe"
        className="mb-2.5 flex gap-0.5 rounded-md border border-border-subtle bg-canvas p-0.5"
      >
        {(['24H', '7D', '30D', '90D'] as BubbleTimeframe[]).map((t) => (
          <button
            key={t}
            type="button"
            role="tab"
            aria-selected={t === tf}
            onClick={() => setTf(t)}
            className={cn(
              'flex-1 rounded-sm py-1 text-2xs font-medium tracking-wider transition-colors',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand',
              t === tf ? 'bg-surface text-fg' : 'text-fg-muted hover:text-fg',
            )}
          >
            {t}
          </button>
        ))}
      </div>

      <div
        className="relative overflow-hidden rounded-md"
        style={{
          height: BUBBLE_CANVAS_H,
          background: 'radial-gradient(ellipse at center, rgba(14, 203, 129, 0.04), transparent 70%)',
        }}
      >
        {ctxs.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center text-2xs text-fg-muted">
            Waiting for HL data…
          </div>
        )}
        {/* Loading overlay for multi-TF fetches */}
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-canvas/40 z-10 text-2xs text-fg-muted">
            Loading {tf} data…
          </div>
        )}
        {/* SVG container — bubble <g> elements appended imperatively by physics loop */}
        <svg
          ref={svgRef}
          viewBox={`0 0 ${BUBBLE_CANVAS_W} ${BUBBLE_CANVAS_H}`}
          preserveAspectRatio="xMidYMid meet"
          className="absolute inset-0 h-full w-full"
          aria-label="Hyperliquid market gainers and losers bubble chart"
        >
          <defs>
            <radialGradient id="hlBody-gain" cx="38%" cy="35%" r="62%">
              <stop offset="0%" stopColor="#7CFFCB" stopOpacity="0.55" />
              <stop offset="35%" stopColor="#0ECB81" stopOpacity="0.45" />
              <stop offset="75%" stopColor="#0ECB81" stopOpacity="0.20" />
              <stop offset="100%" stopColor="#0ECB81" stopOpacity="0.55" />
            </radialGradient>
            <radialGradient id="hlBody-loss" cx="38%" cy="35%" r="62%">
              <stop offset="0%" stopColor="#FFAFB7" stopOpacity="0.55" />
              <stop offset="35%" stopColor="#F6465D" stopOpacity="0.45" />
              <stop offset="75%" stopColor="#F6465D" stopOpacity="0.20" />
              <stop offset="100%" stopColor="#F6465D" stopOpacity="0.55" />
            </radialGradient>
            <radialGradient id="hlHalo-gain" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#0ECB81" stopOpacity="0.22" />
              <stop offset="60%" stopColor="#0ECB81" stopOpacity="0.06" />
              <stop offset="100%" stopColor="#0ECB81" stopOpacity="0" />
            </radialGradient>
            <radialGradient id="hlHalo-loss" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#F6465D" stopOpacity="0.22" />
              <stop offset="60%" stopColor="#F6465D" stopOpacity="0.06" />
              <stop offset="100%" stopColor="#F6465D" stopOpacity="0" />
            </radialGradient>
            <radialGradient id="hlHighlight" cx="35%" cy="30%" r="30%">
              <stop offset="0%" stopColor="white" stopOpacity="0.85" />
              <stop offset="60%" stopColor="white" stopOpacity="0.15" />
              <stop offset="100%" stopColor="white" stopOpacity="0" />
            </radialGradient>
            <linearGradient id="hlRim" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#22D3EE" />
              <stop offset="33%" stopColor="#F472B6" />
              <stop offset="66%" stopColor="#FCD535" />
              <stop offset="100%" stopColor="#22D3A8" />
            </linearGradient>
          </defs>
        </svg>

        {/* Custom hover tooltip — fixed-position so it floats above the SVG */}
        {tooltip && (
          <div
            style={{
              position: 'fixed',
              left: tooltip.x,
              top: tooltip.y,
              transform: 'translate(-50%, -100%)',
              zIndex: 50,
            }}
            className="pointer-events-none rounded-lg border border-border-default bg-surface px-3 py-2 text-xs shadow-xl"
          >
            <div className="font-bold text-fg">{tooltip.id}</div>
            <div
              className={cn(
                'font-mono tabular-nums',
                tooltip.pct >= 0 ? 'text-bullish' : 'text-bearish',
              )}
            >
              {tooltip.pct >= 0 ? '+' : ''}
              {tooltip.pct.toFixed(2)}%
            </div>
            <div className="text-fg-muted">
              Vol $
              {tooltip.vol >= 1e9
                ? (tooltip.vol / 1e9).toFixed(1) + 'B'
                : tooltip.vol >= 1e6
                  ? (tooltip.vol / 1e6).toFixed(0) + 'M'
                  : (tooltip.vol / 1e3).toFixed(0) + 'K'}
            </div>
          </div>
        )}
      </div>

      <div className="mt-2 grid grid-cols-2 gap-2 border-t border-border-subtle pt-2 text-2xs uppercase tracking-wider text-fg-muted">
        <div>
          Winners
          <b className="block normal-case tracking-normal mt-0.5 text-xs text-bullish font-semibold tabular-nums">
            {stats.winners} pairs
          </b>
        </div>
        <div>
          Losers
          <b className="block normal-case tracking-normal mt-0.5 text-xs text-bearish font-semibold tabular-nums">
            {stats.losers} pairs
          </b>
        </div>
        <div>
          Best
          <b className="block normal-case tracking-normal mt-0.5 text-xs text-bullish font-semibold tabular-nums">
            {stats.bestCoin ? `${stats.bestCoin} +${stats.bestPct.toFixed(1)}%` : '—'}
          </b>
        </div>
        <div>
          Worst
          <b className="block normal-case tracking-normal mt-0.5 text-xs text-bearish font-semibold tabular-nums">
            {stats.worstCoin ? `${stats.worstCoin} ${stats.worstPct.toFixed(1)}%` : '—'}
          </b>
        </div>
      </div>
    </section>
  );
}


// ──────────────────────────────────────────────────────────────────────
// Main page
// ──────────────────────────────────────────────────────────────────────
function useDevDeployedOverride(originalDeployedAt: number | undefined) {
  const [override, setOverride] = useState<number | null>(null);
  useEffect(() => {
    // Listen to the dev-controls event so we don't pollute the URL.
    const onSet = (e: Event) => {
      const detail = (e as CustomEvent<number | null>).detail;
      setOverride(detail);
    };
    window.addEventListener('bot-monitoring:set-deployed', onSet);
    return () =>
      window.removeEventListener('bot-monitoring:set-deployed', onSet);
  }, []);
  return override ?? originalDeployedAt;
}

function DevControls() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    setOpen(new URLSearchParams(window.location.search).has('dev'));
  }, []);
  if (!open) return null;
  const dispatch = (offsetMs: number | null) => {
    const value =
      offsetMs == null ? null : Date.now() - offsetMs;
    window.dispatchEvent(
      new CustomEvent('bot-monitoring:set-deployed', { detail: value }),
    );
  };
  return (
    <div className="fixed bottom-4 right-4 z-50 rounded-md border border-warning/40 bg-surface p-3 shadow-lg">
      <div className="mb-2 text-2xs font-semibold uppercase tracking-wider text-warning">
        Dev controls
      </div>
      <div className="flex flex-col gap-1">
        <Button
          variant="ghost"
          size="sm"
          className="justify-start text-xs"
          onClick={() => dispatch(60_000)}
        >
          Reset to Day 0 (1m ago)
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="justify-start text-xs"
          onClick={() => dispatch(14 * 86_400_000)}
        >
          Skip to Day 14
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="justify-start text-xs"
          onClick={() => dispatch(47 * 86_400_000)}
        >
          Skip to Day 47
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="justify-start text-xs text-fg-muted"
          onClick={() => dispatch(null)}
        >
          Clear override
        </Button>
      </div>
    </div>
  );
}

export function BotMonitoringPage() {
  const { id = '' } = useParams<{ id: string }>();
  const metaRaw = useBotMeta(id);
  const effectiveDeployedAt = useDevDeployedOverride(metaRaw?.deployedAt);
  const meta =
    metaRaw && effectiveDeployedAt
      ? { ...metaRaw, deployedAt: effectiveDeployedAt }
      : metaRaw;
  const snap = useSnapshot(id, meta?.deployedAt);
  const fills = useFills(id, meta?.deployedAt);
  const [range, setRange] = useState<TimeRange>('30D');
  const equity = useEquityCurve(id, meta?.deployedAt, range);
  const cycle = useCycle(id);
  const coin = meta?.pair?.split('-')[0] ?? 'BTC';
  const candles = useHyperliquidCandles(coin, '5m');
  const phase = useBotMaturity(meta?.deployedAt, snap?.totalTrades ?? 0);
  const cypheusMessages = useCypheusMonitoringNarrative(fills, snap, phase);
  const orderBook = useHyperliquidOrderBook(coin);
  const markets = useHyperliquidMarkets();

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
            <HeroPnL snap={snap} phase={phase} />

            <div className="grid grid-cols-1 gap-3">
              {cycle && <ExecutionPipeline cycle={cycle} phase={phase} />}
              <EquityCurve
                data={equity}
                range={range}
                onRangeChange={setRange}
                total={snap.totalPnL}
                phase={phase}
              />
              <OrderBookL2 book={orderBook} coin={coin} />
              <LiveSpotFeed
                coin={coin}
                candles={candles}
                fills={fills}
                watchingFor="Bollinger upper band cross + RSI < 70"
              />
              <RecentFills fills={fills} phase={phase} />
            </div>
          </div>
        </main>

        <aside className="relative z-10 w-[280px] flex-shrink-0 border-l border-border-subtle bg-canvas overflow-y-auto">
          <div className="p-3">
            <GainersLosersBubble ctxs={markets?.ctxs ?? []} />
          </div>
        </aside>
      </div>
      <DevControls />
    </div>
  );
}
