import { useNavigate, useParams } from 'react-router-dom';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  PanelLeftClose,
  PanelLeftOpen,
  Pause,
  Pencil,
  Sparkles,
  StopCircle,
} from 'lucide-react';
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
  startFrom = 0,
}: {
  value: number;
  format: (v: number) => string;
  duration?: number;
  className?: string;
  /** Initial display value before the first animation runs. Default 0
   * gives a count-up-from-zero effect on mount; set to `value` to skip. */
  startFrom?: number;
}) {
  // We own the span's text content via ref + textContent. The span renders
  // *no React children* so React never reconciles them and never overwrites
  // our textContent mutations. Parent can re-render freely (Pipeline ticks
  // every 500ms cause grandparent re-renders) and our DOM mutations stick.
  const spanRef = useRef<HTMLSpanElement | null>(null);
  const displayedRef = useRef<number>(startFrom);
  // Stash format in a ref so we don't include it in effect deps. format is
  // typically a fresh closure every parent render (e.g. fmtMoney(2)), and
  // including it would re-run the effect on every render and cancel the
  // rAF before it could tick — animation would never advance.
  const formatRef = useRef(format);
  formatRef.current = format;

  const setSpan = useCallback((node: HTMLSpanElement | null) => {
    spanRef.current = node;
    // Paint initial text on first ref attachment, before any effect runs.
    if (node && node.textContent === '') {
      node.textContent = formatRef.current(displayedRef.current);
    }
  }, []);

  useEffect(() => {
    if (!spanRef.current) return;
    if (!Number.isFinite(value)) {
      displayedRef.current = value;
      spanRef.current.textContent = formatRef.current(value);
      return;
    }
    const from = displayedRef.current;
    if (from === value) return;
    const start = performance.now();
    let raf: number | null = null;
    // Fallback: if the tab is in the background, rAF is throttled/paused by
    // the browser so the animation would never advance. Use a setTimeout
    // fallback to snap-to-target after `duration + 50ms` so the displayed
    // value is at least correct when the user focuses the tab.
    const snapTimeout = window.setTimeout(() => {
      if (raf != null) cancelAnimationFrame(raf);
      displayedRef.current = value;
      if (spanRef.current)
        spanRef.current.textContent = formatRef.current(value);
    }, duration + 50);
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      // ease-out cubic — quick to start, settles smoothly
      const eased = 1 - Math.pow(1 - t, 3);
      const next = from + (value - from) * eased;
      displayedRef.current = next;
      if (spanRef.current)
        spanRef.current.textContent = formatRef.current(next);
      if (t < 1) {
        raf = requestAnimationFrame(tick);
      } else {
        raf = null;
        window.clearTimeout(snapTimeout);
      }
    };
    raf = requestAnimationFrame(tick);
    return () => {
      if (raf != null) cancelAnimationFrame(raf);
      window.clearTimeout(snapTimeout);
    };
  }, [value, duration]);

  return <span ref={setSpan} className={className} />;
}

const fmtMoney =
  (precision = 2) =>
  (v: number) =>
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
    // Poll faster than the per-stage duration (~250ms) so transitions
    // aren't aliased — every stage gets at least one render frame.
    const handle = setInterval(tick, 100);
    return () => {
      cancelled = true;
      clearInterval(handle);
    };
  }, [id]);
  return cycle;
}

const MAX_NARRATIVE = 24;

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
  const bootstrappedRef = useRef(false);
  // Stable IDs let us dedupe — the same event (e.g. SL on fill X) can be
  // re-emitted by every poll, but should only appear in the rail once.
  const seenIdsRef = useRef<Set<string>>(new Set());

  // Bootstrap once per snap+fill load
  useEffect(() => {
    if (!snap) return;
    if (bootstrappedRef.current) return;
    let seed: CypheusMessage[];
    if (phase === 'just-deployed' || fills.length === 0) {
      seed = generateEventNarrations({
        prevSnap: null,
        nextSnap: snap,
        prevFills: [],
        nextFills: fills,
        phase,
      });
    } else {
      seed = bootstrapNarrative(snap, fills);
    }
    if (seed.length > 0) {
      seed.forEach((m) => seenIdsRef.current.add(m.id));
      setMessages(seed);
      bootstrappedRef.current = true;
      prevRef.current = { snap, fills };
    }
  }, [snap, fills, phase]);

  // Diff prev/next on each update — emit only NEW (unseen) ids.
  useEffect(() => {
    if (!snap) return;
    if (!bootstrappedRef.current) return;
    const candidate = generateEventNarrations({
      prevSnap: prevRef.current.snap,
      nextSnap: snap,
      prevFills: prevRef.current.fills,
      nextFills: fills,
      phase,
    });
    const fresh = candidate.filter((m) => !seenIdsRef.current.has(m.id));
    if (fresh.length > 0) {
      fresh.forEach((m) => seenIdsRef.current.add(m.id));
      setMessages((prev) => [...fresh, ...prev].slice(0, MAX_NARRATIVE));
      // Cap the seen set so it can't grow unbounded across long sessions.
      if (seenIdsRef.current.size > 200) {
        seenIdsRef.current = new Set(
          Array.from(seenIdsRef.current).slice(-150),
        );
      }
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
              const candles = await hlApi.getCandleSnapshot(
                coin,
                '1d',
                startTime,
                now,
              );
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

    return () => {
      cancelled = true;
    };
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
  const navigate = useNavigate();
  const uptime = formatUptime(meta.deployedAt);
  const isLive = meta.mode === 'live';

  // Coin98 floating pill nav: header occupies the full row but the
  // visible chrome is a single rounded-full bar centred with max-w,
  // sitting on the pure black page so it visually "floats".
  return (
    <>
      <header className="fixed inset-x-0 top-0 z-30 flex h-[var(--layout-header,56px)] items-center px-3 pt-2">
        <div className="app-header-pill mx-auto flex h-16 w-full max-w-[1200px] items-center justify-between gap-3 rounded-full py-3 pl-4 pr-3">
          <div className="flex min-w-0 items-center gap-2 pl-1">
            {/* Back to dashboard */}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/dashboard')}
              className="rounded-full px-2.5 text-fg-muted hover:bg-black/40 hover:text-fg"
              aria-label="Back to dashboard"
            >
              <ArrowLeft className="mr-1 h-3.5 w-3.5" aria-hidden="true" />
              All bots
            </Button>
            <span className="text-border-strong">/</span>
            {/* Bot identity — circular brand badge */}
            <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-brand text-black shadow-[0_0_12px_rgba(240,185,11,0.5)]">
              <Sparkles className="h-4 w-4" aria-hidden="true" />
            </div>
            <div className="flex min-w-0 flex-col">
              <h1 className="truncate text-sm font-semibold text-fg">
                {meta.name}
              </h1>
              <div className="flex items-center gap-1.5 text-[11px] text-fg-muted">
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

          <div className="flex items-center gap-1.5 pr-1">
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
                  'h-1.5 w-1.5 animate-pulse rounded-full',
                  isLive ? 'bg-bullish' : 'bg-brand',
                )}
              />
              {isLive ? 'Live' : 'Dry-run'}
            </span>

            {/* Pill-shaped action buttons (Coin98 style) */}
            <Button
              variant="ghost"
              size="sm"
              className="rounded-full px-3 text-fg-muted hover:bg-black/40 hover:text-fg"
            >
              <Pause className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
              Pause
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                // TODO(wallet-team): wire to bot stop API + confirm modal.
                // For demo: stop confirmed → return to dashboard.
                navigate('/dashboard');
              }}
              className="rounded-full px-3 text-bearish hover:bg-bearish-subtle hover:text-bearish-hover"
            >
              <StopCircle className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
              Stop
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/builder')}
              className="rounded-full px-3 text-fg-muted hover:bg-black/40 hover:text-fg"
            >
              <Pencil className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
              Edit
            </Button>
          </div>
        </div>
      </header>
      <div
        aria-hidden="true"
        className="h-[var(--layout-header,56px)] flex-shrink-0"
      />
    </>
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
  'position-opened': {
    label: 'Position opened',
    icon: '↗',
    color: 'text-fg-secondary',
  },
  'tp-hit': { label: 'TP hit', icon: '🎯', color: 'text-bullish' },
  'sl-hit': { label: 'SL hit', icon: '✕', color: 'text-bearish' },
  'streak-milestone': {
    label: 'Win streak',
    icon: '🏆',
    color: 'text-warning',
  },
  'pnl-milestone': { label: 'Milestone', icon: '📈', color: 'text-brand' },
  anomaly: { label: 'Anomaly', icon: '⚠', color: 'text-warning' },
  idle: { label: 'Quiet', icon: '⏸', color: 'text-fg-muted' },
  volatility: { label: 'Volatility', icon: '🌪', color: 'text-info' },
  'session-summary': {
    label: 'Session',
    icon: '📊',
    color: 'text-fg-secondary',
  },
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
          'relative z-20 flex h-full flex-shrink-0 flex-col overflow-hidden rounded-3xl bg-black',
          'transition-[width] duration-fast ease-out-quick',
        )}
        style={{ width: 'var(--layout-left-panel)' }}
        aria-label="Cypheus monitoring rail"
      >
        {/* Header */}
        <header
          className={cn(
            'flex items-center',
            collapsed
              ? 'justify-center px-1.5 py-3'
              : 'justify-between gap-2 px-4 py-3',
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
                  'inline-flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-fg-muted',
                  'transition-colors duration-fast hover:bg-[#1a1a1f] hover:text-fg',
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
            <div className="card-coin98 flex items-center gap-2 rounded-2xl p-3">
              <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-brand text-black shadow-[0_0_10px_rgba(240,185,11,0.4)]">
                <Sparkles className="h-4 w-4" aria-hidden="true" />
              </div>
              <div className="min-w-0">
                <div className="text-xs font-semibold text-fg">
                  Watching bot
                </div>
                <div className="flex items-center gap-1 text-2xs text-bullish">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-bullish" />
                  Live
                </div>
              </div>
            </div>

            <div className="mt-2 px-1 text-2xs uppercase tracking-wider text-fg-muted">
              Live narrative
            </div>

            {messages.length === 0 ? (
              <article className="card-coin98 rounded-2xl p-3">
                <div className="mb-1 text-2xs uppercase tracking-wider text-fg-muted">
                  ⏸ Quiet
                </div>
                <p className="text-xs leading-relaxed text-fg-secondary">
                  Waiting for bot to do something interesting.
                </p>
              </article>
            ) : (
              messages.map((m, idx) => {
                const meta =
                  CYPHEUS_TYPE_META[m.type] ?? CYPHEUS_TYPE_META.idle;
                const isLatest = idx === 0;
                return (
                  <article
                    key={m.id}
                    className={cn(
                      'cy-msg card-coin98 rounded-2xl p-3 transition-colors',
                      isLatest &&
                        'cy-msg-latest shadow-[0_0_0_1px_rgba(14,203,129,0.4),0_0_16px_rgba(14,203,129,0.18)]',
                    )}
                  >
                    <div
                      className={cn(
                        'mb-1 inline-flex items-center gap-1 text-2xs uppercase tracking-wider',
                        meta.color,
                      )}
                    >
                      <span aria-hidden="true">{meta.icon}</span>
                      <span>{meta.label}</span>
                    </div>
                    <p className="text-xs leading-relaxed text-fg-secondary">
                      {m.text}
                    </p>
                    <div className="mt-1.5 text-2xs text-fg-disabled">
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
  const colorVar =
    streak > 0 ? 'var(--color-bullish)' : 'var(--color-text-disabled)';

  return (
    <div className="flex w-32 flex-col items-center justify-center">
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
              filter:
                streak > 0 ? `drop-shadow(0 0 6px ${colorVar})` : undefined,
              transition:
                'stroke-dasharray 600ms cubic-bezier(0.2, 0.8, 0.2, 1)',
            }}
          />
        </svg>
        <div
          className={cn(
            'absolute inset-0 flex items-center justify-center text-3xl font-bold tabular-nums',
            streak > 0 ? 'text-bullish' : 'text-fg-disabled',
          )}
        >
          <CountingNumber value={streak} format={fmtInt} duration={500} />
        </div>
      </div>
      <div className="mt-2 text-center text-2xs uppercase leading-relaxed tracking-widest text-fg-muted">
        <span className={streak > 0 ? 'font-semibold text-bullish' : ''}>
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
        className="card-coin98 relative grid grid-cols-[1fr_auto] gap-6 overflow-hidden rounded-3xl p-8"
      >
        <div className="relative">
          <div
            id="hero-pnl-label"
            className="mb-4 flex items-center gap-3 text-2xs uppercase tracking-widest text-fg-muted"
          >
            <span>Today · Realized PnL</span>
            <span className="inline-flex items-center gap-1.5 text-info">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-info" />
              Scanning
            </span>
            <span className="text-border-strong">·</span>
            <span>0 trades yet</span>
          </div>
          <div
            className="text-6xl font-bold tabular-nums tracking-tight text-fg-disabled"
            style={{ lineHeight: 1.0 }}
          >
            $0.00
          </div>
          <div className="mt-5 flex items-center gap-3 text-xs text-fg-muted">
            <span>
              <span aria-hidden="true">⏱ </span>
              Est. first signal in <b className="text-fg-secondary">1–3h</b>
            </span>
            <div className="relative h-1 w-48 overflow-hidden rounded-full bg-black">
              <span className="absolute inset-y-0 -left-12 w-12 animate-[scan_2s_linear_infinite] bg-gradient-to-r from-transparent via-info to-transparent" />
            </div>
          </div>
        </div>
        <div className="flex w-32 flex-col items-center justify-center opacity-40">
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
          <div className="-mt-[68px] text-2xl font-bold text-fg-disabled">
            —
          </div>
          <div className="mt-8 text-center text-2xs uppercase leading-relaxed tracking-widest text-fg-muted">
            Build a streak
          </div>
        </div>
      </section>
    );
  }

  const isPositive = snap.todayPnL >= 0;
  const pnlColor = isPositive ? 'text-bullish' : 'text-bearish';
  const pnlGlow = isPositive
    ? '0 0 38px rgba(14, 203, 129, 0.45)'
    : '0 0 38px rgba(246, 70, 93, 0.45)';
  const sign = isPositive ? '+' : '';

  return (
    <section
      aria-labelledby="hero-pnl-label"
      className="card-coin98 relative grid grid-cols-[1fr_auto] gap-6 overflow-hidden rounded-3xl p-8"
    >
      {/* Yellow halo (Coin98 brand glow) layered behind the number */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -left-16 -top-24 h-80 w-80 rounded-full opacity-40 blur-2xl"
        style={{
          background:
            'radial-gradient(circle, rgba(240,185,11,0.25), transparent 70%)',
        }}
      />
      {/* Performance-tinted halo on the right */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full opacity-30 blur-2xl"
        style={{
          background: `radial-gradient(circle, ${
            isPositive ? 'var(--color-bullish)' : 'var(--color-bearish)'
          }, transparent 70%)`,
        }}
      />

      <div className="relative">
        <div
          id="hero-pnl-label"
          className="mb-4 flex items-center gap-3 text-2xs uppercase tracking-widest text-fg-muted"
        >
          <span>Today · Realized PnL</span>
          <span className="inline-flex items-center gap-1.5 text-bullish">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-bullish" />
            Live
          </span>
          <span className="text-border-strong">·</span>
          <span>Updated 14s ago</span>
        </div>

        <div
          className={cn(
            'text-6xl font-bold tabular-nums tracking-tight',
            pnlColor,
          )}
          style={{ textShadow: pnlGlow, lineHeight: 1.0 }}
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
              className="font-semibold tabular-nums text-fg"
            />
            <span className="text-fg-muted">trades</span>
          </span>
          <span className="text-border-strong">·</span>
          <span className="inline-flex items-center gap-1.5">
            <CountingNumber
              value={snap.winRate * 100}
              format={fmtPct}
              duration={600}
              className="font-semibold tabular-nums text-bullish"
            />
            <span className="text-fg-muted">win</span>
          </span>
          <span className="text-border-strong">·</span>
          <span className="inline-flex items-center gap-1.5">
            <CountingNumber
              value={snap.openPositions}
              format={fmtInt}
              duration={400}
              className="font-semibold tabular-nums text-fg"
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
  // Coin98 style: pill-friendly large radius, no visible border (rely on
  // bg contrast against the pure-black canvas), header has no divider
  // — relies on whitespace.
  return (
    <section className="card-coin98 overflow-hidden rounded-3xl">
      <header className="flex items-center justify-between gap-3 px-5 pb-2 pt-4">
        <div className="flex min-w-0 items-center gap-2">
          <span className="text-2xs font-semibold uppercase tracking-wider text-fg-muted">
            {title}
          </span>
          {meta && (
            <span className="truncate text-xs text-fg-secondary">{meta}</span>
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
    <section className="card-coin98 rounded-3xl p-10 text-center">
      <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-black text-xl">
        {icon}
      </div>
      <h4 className="m-0 text-sm font-semibold text-fg">{title}</h4>
      <p className="mt-1 text-2xs text-fg-muted">{body}</p>
    </section>
  );
}

// Hand-rolled SVG equity curve with stroke-dashoffset draw-in animation.
// Replaces lightweight-charts here so we can use the canonical "trace from
// origin" effect (impossible in canvas-based libs) + match the Coin98 ref
// aesthetic: glowing bullish line, pulsing endpoint, value label floating
// at the leading edge.
const EQ_VIEW_W = 800;
const EQ_VIEW_H = 180;
const EQ_PAD_X = 14;
const EQ_PAD_TOP = 18;
const EQ_PAD_BOTTOM = 26;

interface EqGeometry {
  pathD: string;
  areaD: string;
  endX: number;
  endY: number;
  endValue: number;
  ticks: { x: number; label: string }[];
  yMin: number;
  yMax: number;
}

function buildEquityGeometry(data: EquityPoint[]): EqGeometry | null {
  if (data.length === 0) return null;
  const xs = data.map((d) => d.t);
  const ys = data.map((d) => d.equity);
  const minX = Math.min(...xs);
  let maxX = Math.max(...xs);
  let minY = Math.min(...ys);
  let maxY = Math.max(...ys);
  if (maxX === minX) maxX = minX + 1;
  // Expand y range by 8% top + bottom so line never touches edges.
  const yPad = (maxY - minY || 1) * 0.08;
  minY -= yPad;
  maxY += yPad;

  const sx = (x: number) =>
    EQ_PAD_X + ((x - minX) / (maxX - minX)) * (EQ_VIEW_W - EQ_PAD_X * 2);
  const sy = (y: number) =>
    EQ_PAD_TOP +
    (1 - (y - minY) / (maxY - minY)) * (EQ_VIEW_H - EQ_PAD_TOP - EQ_PAD_BOTTOM);

  const points = data.map((d) => ({ x: sx(d.t), y: sy(d.equity) }));

  // Catmull–Rom → cubic Bezier for smoother line (Coin98-y).
  // Tension 0.5 = balanced.
  const tension = 0.5;
  let pathD = `M ${points[0].x.toFixed(2)} ${points[0].y.toFixed(2)}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i - 1] ?? points[i];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] ?? p2;
    const cp1x = p1.x + ((p2.x - p0.x) / 6) * tension * 2;
    const cp1y = p1.y + ((p2.y - p0.y) / 6) * tension * 2;
    const cp2x = p2.x - ((p3.x - p1.x) / 6) * tension * 2;
    const cp2y = p2.y - ((p3.y - p1.y) / 6) * tension * 2;
    pathD += ` C ${cp1x.toFixed(2)} ${cp1y.toFixed(2)}, ${cp2x.toFixed(2)} ${cp2y.toFixed(2)}, ${p2.x.toFixed(2)} ${p2.y.toFixed(2)}`;
  }
  // Area: same path closed back along baseline
  const baseY = EQ_VIEW_H - EQ_PAD_BOTTOM;
  const areaD = `${pathD} L ${points[points.length - 1].x.toFixed(2)} ${baseY.toFixed(2)} L ${points[0].x.toFixed(2)} ${baseY.toFixed(2)} Z`;
  const endX = points[points.length - 1].x;
  const endY = points[points.length - 1].y;
  const endValue = ys[ys.length - 1];

  // Build ~5 evenly-spaced time ticks for the x-axis.
  const tickCount = 5;
  const ticks: { x: number; label: string }[] = [];
  for (let i = 0; i < tickCount; i++) {
    const t = minX + ((maxX - minX) * i) / (tickCount - 1);
    const date = new Date(t);
    const label =
      maxX - minX > 86_400_000
        ? `${date.getDate()}/${date.getMonth() + 1}`
        : `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
    ticks.push({ x: sx(t), label });
  }
  return { pathD, areaD, endX, endY, endValue, ticks, yMin: minY, yMax: maxY };
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
  const geometry = useMemo(() => buildEquityGeometry(data), [data]);
  const linePathRef = useRef<SVGPathElement | null>(null);
  const [pathLength, setPathLength] = useState<number>(0);
  // Live position of the endpoint dot — sampled along the path each
  // frame and kept perfectly in sync with the line's drawn portion.
  const [endPos, setEndPos] = useState<{ x: number; y: number } | null>(null);
  const EQ_DRAW_MS = 10000;

  // Measure the path length once geometry is ready. Used both for the
  // stroke-dasharray gate and as the upper bound for getPointAtLength.
  useEffect(() => {
    if (!linePathRef.current || !geometry) return;
    const len = linePathRef.current.getTotalLength();
    setPathLength(len);
    const start = linePathRef.current.getPointAtLength(0);
    setEndPos({ x: start.x, y: start.y });
  }, [geometry]);

  // JS-driven draw-in — single rAF timeline that mutates BOTH the
  // line's strokeDashoffset AND the endpoint position from the same
  // tick. Linear easing → uniform speed. No getComputedStyle reads,
  // no CSS animation, no possibility of the dot drifting from the tip.
  useEffect(() => {
    if (!pathLength || !linePathRef.current || !geometry) return;
    const path = linePathRef.current;
    const startT = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const elapsed = now - startT;
      const p = Math.min(1, elapsed / EQ_DRAW_MS); // linear: speed uniform
      const drawn = pathLength * p;
      path.style.strokeDashoffset = String(pathLength - drawn);
      const pt = path.getPointAtLength(drawn);
      setEndPos({ x: pt.x, y: pt.y });
      if (p < 1) raf = requestAnimationFrame(tick);
      else setEndPos({ x: geometry.endX, y: geometry.endY });
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [pathLength, geometry]);

  if (phase === 'just-deployed' || data.length === 0 || !geometry) {
    return (
      <EmptyStateCard
        icon="📈"
        title="Equity curve will appear here"
        body="After your first closed trade · est. 1–3 hours"
      />
    );
  }

  const totalPositive = total >= 0;
  const lineColor = totalPositive
    ? 'var(--color-bullish)'
    : 'var(--color-bearish)';
  // Force a new node identity per range so the draw animation re-runs
  // when user switches tabs (vs. silently refreshing on auto-poll).
  const animKey = `${range}-${data.length}`;

  return (
    <SectionCard
      title="PnL Curve"
      meta={
        <span className="tabular-nums">
          Total{' '}
          <b
            className={cn(
              totalPositive ? 'text-bullish' : 'text-bearish',
              'font-semibold',
            )}
          >
            {totalPositive ? '+' : '−'}$
            <CountingNumber
              value={Math.abs(total)}
              format={fmtMoney(2)}
              duration={800}
            />
          </b>
        </span>
      }
      rightSlot={
        <div className="flex gap-1 rounded-full bg-black p-1">
          {EQUITY_RANGES.map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => onRangeChange(r)}
              className={cn(
                'rounded-full px-3 py-1 text-2xs font-medium uppercase tracking-wider transition-colors',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand',
                r === range
                  ? 'bg-brand font-semibold text-black shadow-[0_0_10px_rgba(240,185,11,0.35)]'
                  : 'text-fg-muted hover:text-fg',
              )}
            >
              {r}
            </button>
          ))}
        </div>
      }
    >
      <div className="relative h-[180px] w-full">
        <svg
          key={animKey}
          viewBox={`0 0 ${EQ_VIEW_W} ${EQ_VIEW_H}`}
          preserveAspectRatio="none"
          className="absolute inset-0 h-full w-full overflow-visible"
        >
          <defs>
            <linearGradient id="eqArea" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={lineColor} stopOpacity="0.28" />
              <stop offset="100%" stopColor={lineColor} stopOpacity="0" />
            </linearGradient>
            <filter id="eqGlow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="2.5" result="b" />
              <feMerge>
                <feMergeNode in="b" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            {/* Clip rectangle that grows with the line tip — gradient
             * fill below the curve reveals exactly under the part
             * that's already been drawn. */}
            <clipPath id="eqAreaClip">
              <rect x="0" y="0" width={endPos?.x ?? 0} height={EQ_VIEW_H} />
            </clipPath>
          </defs>

          {/* Horizontal grid lines (3 dotted) */}
          {[0.25, 0.5, 0.75].map((p) => {
            const y = EQ_PAD_TOP + p * (EQ_VIEW_H - EQ_PAD_TOP - EQ_PAD_BOTTOM);
            return (
              <line
                key={p}
                x1={EQ_PAD_X}
                y1={y}
                x2={EQ_VIEW_W - EQ_PAD_X}
                y2={y}
                stroke={TOKEN.borderSubtle}
                strokeDasharray="2 4"
              />
            );
          })}

          {/* X-axis tick labels */}
          {geometry.ticks.map((tk, i) => (
            <text
              key={i}
              x={tk.x}
              y={EQ_VIEW_H - 8}
              textAnchor="middle"
              fontSize="10"
              fill={TOKEN.textMuted}
              fontFamily="Inter, system-ui, sans-serif"
            >
              {tk.label}
            </text>
          ))}

          {/* Area fill — clipped by a rectangle that grows with the
           * draw line's tip, so the gradient fills in progressively
           * underneath the line as it draws (not in one fade flash). */}
          <path
            d={geometry.areaD}
            fill="url(#eqArea)"
            clipPath="url(#eqAreaClip)"
          />

          {/* Line — strokeDashoffset is animated by JS rAF (linear,
           * 10s) so the endpoint sampling stays pixel-perfect. */}
          <path
            ref={linePathRef}
            d={geometry.pathD}
            fill="none"
            stroke={lineColor}
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            filter="url(#eqGlow)"
            strokeDasharray={pathLength || 1}
            strokeDashoffset={pathLength || 1}
          />

          {/* Endpoint pulse halo — reveals after line completes (4s) */}
          <circle
            cx={geometry.endX}
            cy={geometry.endY}
            r="10"
            fill={lineColor}
            opacity="0"
            style={{
              animation: 'eq-endpoint-halo 1.6s ease-in-out 10000ms infinite',
              transformOrigin: `${geometry.endX}px ${geometry.endY}px`,
            }}
          />
          {/* Endpoint dot + live value label — both travel with the
           * draw-in via rAF-sampled getPointAtLength. The value is
           * inverse-mapped from the dot's y so the number matches the
           * curve's height at every frame. */}
          {(() => {
            const ex = endPos?.x ?? geometry.endX;
            const ey = endPos?.y ?? geometry.endY;
            // Inverse map ey → equity value (reverse of sy() in geometry).
            const innerH = EQ_VIEW_H - EQ_PAD_TOP - EQ_PAD_BOTTOM;
            const liveVal =
              geometry.yMin +
              (1 - (ey - EQ_PAD_TOP) / innerH) *
                (geometry.yMax - geometry.yMin);
            const valPositive = liveVal >= 0;
            // Flip label to the left side near the right edge so it
            // doesn't clip out of the viewBox when the dot reaches the end.
            const flipLeft = ex > EQ_VIEW_W - 90;
            const labelX = flipLeft ? ex - 10 : ex + 10;
            const labelAnchor = flipLeft ? 'end' : 'start';
            return (
              <g>
                <circle
                  cx={ex}
                  cy={ey}
                  r="4"
                  fill="white"
                  stroke={lineColor}
                  strokeWidth="2"
                  style={{ filter: `drop-shadow(0 0 6px ${lineColor})` }}
                />
                <text
                  x={labelX}
                  y={ey - 8}
                  textAnchor={labelAnchor}
                  fontSize="12"
                  fontWeight="700"
                  fill={valPositive ? '#7CFFCB' : '#FFAFB7'}
                  fontFamily="JetBrains Mono, SF Mono, monospace"
                  style={{
                    fontVariantNumeric: 'tabular-nums',
                    filter: `drop-shadow(0 0 4px ${lineColor})`,
                  }}
                >
                  {valPositive ? '+' : '−'}$
                  {Math.abs(liveVal).toLocaleString(undefined, {
                    maximumFractionDigits: 0,
                  })}
                </text>
              </g>
            );
          })()}
        </svg>
      </div>
    </SectionCard>
  );
}

// ──────────────────────────────────────────────────────────────────────
// LiveSpotFeed — Coin98-style hand-rolled SVG chart of bot's pair close
// price (real Hyperliquid candles). Uses the same draw-in animation
// rules as the PnL Curve: stroke-dashoffset 10s line draw, area fade-in
// just before completion, traveling endpoint dot with live price label,
// + bot fill entry markers that pop in as the line sweeps past them.
// ──────────────────────────────────────────────────────────────────────
const SPOT_VIEW_W = 800;
const SPOT_VIEW_H = 220;
const SPOT_PAD_X = 14;
const SPOT_PAD_TOP = 18;
const SPOT_PAD_BOTTOM = 30;
const SPOT_DRAW_MS = 10000;

interface SpotGeometry {
  pathD: string;
  areaD: string;
  endX: number;
  endY: number;
  endValue: number;
  yMin: number;
  yMax: number;
  ticks: { x: number; label: string }[];
  highX: number;
  highY: number;
  highValue: number;
  lowX: number;
  lowY: number;
  lowValue: number;
  sx: (t: number) => number;
  sy: (p: number) => number;
  xMin: number;
  xMax: number;
}

function buildSpotGeometry(candles: HLCandle[]): SpotGeometry | null {
  if (candles.length < 2) return null;
  let highIdx = 0;
  let lowIdx = 0;
  for (let i = 1; i < candles.length; i++) {
    if (candles[i].h > candles[highIdx].h) highIdx = i;
    if (candles[i].l < candles[lowIdx].l) lowIdx = i;
  }
  const ys = candles.map((c) => c.c);
  const minX = candles[0].t;
  let maxX = candles[candles.length - 1].t;
  if (maxX === minX) maxX = minX + 1;
  let minY = Math.min(Math.min(...ys), candles[lowIdx].l);
  let maxY = Math.max(Math.max(...ys), candles[highIdx].h);
  const yPad = (maxY - minY || 1) * 0.1;
  minY -= yPad;
  maxY += yPad;

  const sx = (x: number) =>
    SPOT_PAD_X + ((x - minX) / (maxX - minX)) * (SPOT_VIEW_W - SPOT_PAD_X * 2);
  const sy = (y: number) =>
    SPOT_PAD_TOP +
    (1 - (y - minY) / (maxY - minY)) *
      (SPOT_VIEW_H - SPOT_PAD_TOP - SPOT_PAD_BOTTOM);

  const points = candles.map((c) => ({ x: sx(c.t), y: sy(c.c) }));

  // Catmull-Rom → cubic Bezier with tension 0.5 (same as EquityCurve).
  const tension = 0.5;
  let pathD = `M ${points[0].x.toFixed(2)} ${points[0].y.toFixed(2)}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i - 1] ?? points[i];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] ?? p2;
    const cp1x = p1.x + ((p2.x - p0.x) / 6) * tension * 2;
    const cp1y = p1.y + ((p2.y - p0.y) / 6) * tension * 2;
    const cp2x = p2.x - ((p3.x - p1.x) / 6) * tension * 2;
    const cp2y = p2.y - ((p3.y - p1.y) / 6) * tension * 2;
    pathD += ` C ${cp1x.toFixed(2)} ${cp1y.toFixed(2)}, ${cp2x.toFixed(2)} ${cp2y.toFixed(2)}, ${p2.x.toFixed(2)} ${p2.y.toFixed(2)}`;
  }
  const baseY = SPOT_VIEW_H - SPOT_PAD_BOTTOM;
  const last = points[points.length - 1];
  const areaD = `${pathD} L ${last.x.toFixed(2)} ${baseY.toFixed(2)} L ${points[0].x.toFixed(2)} ${baseY.toFixed(2)} Z`;

  // 5 evenly-spaced HH:MM ticks.
  const tickCount = 5;
  const ticks: { x: number; label: string }[] = [];
  for (let i = 0; i < tickCount; i++) {
    const t = minX + ((maxX - minX) * i) / (tickCount - 1);
    const date = new Date(t);
    const label = `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
    ticks.push({ x: sx(t), label });
  }

  return {
    pathD,
    areaD,
    endX: last.x,
    endY: last.y,
    endValue: ys[ys.length - 1],
    yMin: minY,
    yMax: maxY,
    ticks,
    highX: sx(candles[highIdx].t),
    highY: sy(candles[highIdx].h),
    highValue: candles[highIdx].h,
    lowX: sx(candles[lowIdx].t),
    lowY: sy(candles[lowIdx].l),
    lowValue: candles[lowIdx].l,
    sx,
    sy,
    xMin: minX,
    xMax: maxX,
  };
}

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
  const geometry = useMemo(() => buildSpotGeometry(candles), [candles]);
  const linePathRef = useRef<SVGPathElement | null>(null);
  const [pathLength, setPathLength] = useState<number>(0);
  // Live position of the endpoint dot — sampled along the path each
  // frame from the same rAF that drives the line's draw-in.
  const [endPos, setEndPos] = useState<{ x: number; y: number } | null>(null);
  // Linear progress 0..1 along the path. Used to gate fill markers so
  // they reveal exactly when the draw line passes their x-position.
  const [drawProgress, setDrawProgress] = useState<number>(0);

  useEffect(() => {
    if (!linePathRef.current || !geometry) return;
    const len = linePathRef.current.getTotalLength();
    setPathLength(len);
    const start = linePathRef.current.getPointAtLength(0);
    setEndPos({ x: start.x, y: start.y });
    setDrawProgress(0);
  }, [geometry]);

  // Single rAF timeline drives BOTH the line draw and the endpoint
  // dot — linear easing so the speed is uniform end-to-end and the
  // dot never drifts from the tip.
  useEffect(() => {
    if (!pathLength || !linePathRef.current || !geometry) return;
    const path = linePathRef.current;
    const startT = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const elapsed = now - startT;
      const p = Math.min(1, elapsed / SPOT_DRAW_MS); // linear
      const drawn = pathLength * p;
      path.style.strokeDashoffset = String(pathLength - drawn);
      const pt = path.getPointAtLength(drawn);
      setEndPos({ x: pt.x, y: pt.y });
      setDrawProgress(p);
      if (p < 1) raf = requestAnimationFrame(tick);
      else setEndPos({ x: geometry.endX, y: geometry.endY });
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [pathLength, geometry]);

  const last = candles[candles.length - 1];
  const first = candles[0];
  const pct = first && last ? ((last.c - first.o) / first.o) * 100 : 0;
  const pctPositive = pct >= 0;

  // Empty / loading state — keep header consistent with the live state.
  if (!geometry || candles.length < 2) {
    return (
      <SectionCard
        title={
          <span className="inline-flex items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded border border-bearish/30 bg-bearish/10 px-1.5 py-0.5 text-[10px] font-bold tracking-wider text-bearish">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-bearish" />
              LIVE
            </span>
            <span>{coin} · 5m · Market Data</span>
          </span>
        }
      >
        <div className="flex h-[220px] items-center justify-center text-xs text-fg-muted">
          Waiting for HL data…
        </div>
      </SectionCard>
    );
  }

  const lineColor = pctPositive
    ? 'var(--color-bullish)'
    : 'var(--color-bearish)';
  const labelTextColor = pctPositive ? '#7CFFCB' : '#FFAFB7';

  // Bot fill entry markers — only fills whose openedAt sits inside the
  // visible candle range. Limit to the most recent 6 to avoid clutter.
  // Each marker reveals exactly when drawProgress passes its
  // x-position along the path (gated by drawProgress, not setTimeout).
  const visibleFills = fills
    .filter((f) => f.openedAt >= geometry.xMin && f.openedAt <= geometry.xMax)
    .slice(-6);
  const totalDrawableX = SPOT_VIEW_W - SPOT_PAD_X * 2;
  const fillMarkers = visibleFills.map((f) => {
    const x = geometry.sx(f.openedAt);
    const y = geometry.sy(f.entryPrice);
    const progressAt = Math.max(
      0,
      Math.min(1, (x - SPOT_PAD_X) / totalDrawableX),
    );
    const revealed = drawProgress >= progressAt;
    return { f, x, y, revealed };
  });

  // Force a fresh node identity on coin/length change so the draw-in
  // animation re-triggers visibly (and the markers re-pop in sequence).
  const animKey = `${coin}-${candles.length}`;

  return (
    <SectionCard
      title={
        <span className="inline-flex items-center gap-2">
          <span className="inline-flex items-center gap-1 rounded border border-bearish/30 bg-bearish/10 px-1.5 py-0.5 text-[10px] font-bold tracking-wider text-bearish">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-bearish" />
            LIVE
          </span>
          <span>{coin} · 5m · Market Data</span>
        </span>
      }
      rightSlot={
        <span className="text-sm font-semibold tabular-nums text-fg">
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
      }
    >
      <div className="relative h-[220px] w-full">
        <svg
          key={animKey}
          viewBox={`0 0 ${SPOT_VIEW_W} ${SPOT_VIEW_H}`}
          preserveAspectRatio="none"
          className="absolute inset-0 h-full w-full overflow-visible"
        >
          <defs>
            <linearGradient id="spotArea" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={lineColor} stopOpacity="0.30" />
              <stop offset="100%" stopColor={lineColor} stopOpacity="0" />
            </linearGradient>
            <filter id="spotGlow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="2.5" result="b" />
              <feMerge>
                <feMergeNode in="b" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            {/* Clip rectangle that grows with the line tip — gradient
             * fill below the curve reveals progressively under the
             * already-drawn portion. */}
            <clipPath id="spotAreaClip">
              <rect x="0" y="0" width={endPos?.x ?? 0} height={SPOT_VIEW_H} />
            </clipPath>
          </defs>

          {/* Horizontal grid lines (3 dotted) */}
          {[0.25, 0.5, 0.75].map((p) => {
            const y =
              SPOT_PAD_TOP + p * (SPOT_VIEW_H - SPOT_PAD_TOP - SPOT_PAD_BOTTOM);
            return (
              <line
                key={p}
                x1={SPOT_PAD_X}
                y1={y}
                x2={SPOT_VIEW_W - SPOT_PAD_X}
                y2={y}
                stroke={TOKEN.borderSubtle}
                strokeDasharray="2 4"
              />
            );
          })}

          {/* X-axis HH:MM ticks */}
          {geometry.ticks.map((tk, i) => (
            <text
              key={i}
              x={tk.x}
              y={SPOT_VIEW_H - 10}
              textAnchor="middle"
              fontSize="10"
              fill={TOKEN.textMuted}
              fontFamily="Inter, system-ui, sans-serif"
            >
              {tk.label}
            </text>
          ))}

          {/* Area fill — clipped by a rectangle that grows with the
           * line tip, so the gradient fills progressively underneath
           * the curve while it draws (not in one fade flash). */}
          <path
            d={geometry.areaD}
            fill="url(#spotArea)"
            clipPath="url(#spotAreaClip)"
          />

          {/* Line — strokeDashoffset is animated by JS rAF (linear,
           * 10s) for uniform speed + perfect endpoint sync. */}
          <path
            ref={linePathRef}
            d={geometry.pathD}
            fill="none"
            stroke={lineColor}
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            filter="url(#spotGlow)"
            strokeDasharray={pathLength || 1}
            strokeDashoffset={pathLength || 1}
          />

          {/* High marker — pops in just before line completes */}
          <g
            opacity="0"
            style={{
              animation: 'eq-endpoint-pop 400ms ease-out 9500ms forwards',
            }}
          >
            <circle
              cx={geometry.highX}
              cy={geometry.highY}
              r="3.5"
              fill="white"
              stroke={TOKEN.textSecondary}
              strokeWidth="1.5"
            />
            <text
              x={geometry.highX}
              y={geometry.highY - 10}
              textAnchor="middle"
              fontSize="10"
              fontWeight="600"
              fill={TOKEN.textSecondary}
              fontFamily="JetBrains Mono, SF Mono, monospace"
              style={{ fontVariantNumeric: 'tabular-nums' }}
            >
              H {geometry.highValue.toFixed(2)}
            </text>
          </g>

          {/* Low marker */}
          <g
            opacity="0"
            style={{
              animation: 'eq-endpoint-pop 400ms ease-out 9500ms forwards',
            }}
          >
            <circle
              cx={geometry.lowX}
              cy={geometry.lowY}
              r="3.5"
              fill="white"
              stroke={TOKEN.textSecondary}
              strokeWidth="1.5"
            />
            <text
              x={geometry.lowX}
              y={geometry.lowY + 18}
              textAnchor="middle"
              fontSize="10"
              fontWeight="600"
              fill={TOKEN.textSecondary}
              fontFamily="JetBrains Mono, SF Mono, monospace"
              style={{ fontVariantNumeric: 'tabular-nums' }}
            >
              L {geometry.lowValue.toFixed(2)}
            </text>
          </g>

          {/* Bot fill entry markers — each reveals exactly when the
           * draw-line sweeps past its x-position (gated by
           * drawProgress, not setTimeout). Visual: full-height
           * dashed guide, glowing entry dot ON the line with an
           * infinite pulsing ring, and a colored side badge. */}
          {fillMarkers.map(({ f, x, y, revealed }) => {
            const isLong = f.side === 'LONG';
            const colorHex = isLong ? '#0ECB81' : '#F6465D';
            // Badge sits above for LONG (rising trade), below for SHORT.
            const badgeY = isLong ? y - 22 : y + 22;
            return (
              <g
                key={f.id}
                style={{
                  opacity: revealed ? 1 : 0,
                  transition: 'opacity 280ms ease-out',
                }}
              >
                {/* Vertical guide line — full chart height */}
                <line
                  x1={x}
                  y1={SPOT_PAD_TOP}
                  x2={x}
                  y2={SPOT_VIEW_H - SPOT_PAD_BOTTOM}
                  stroke={colorHex}
                  strokeWidth="1"
                  strokeDasharray="3 3"
                  opacity="0.32"
                />
                {/* Infinite pulsing halo around the entry dot */}
                <circle
                  cx={x}
                  cy={y}
                  r="11"
                  fill={colorHex}
                  opacity="0"
                  style={{
                    animation: 'eq-endpoint-halo 1.6s ease-in-out infinite',
                    transformOrigin: `${x}px ${y}px`,
                  }}
                />
                {/* Entry dot ON the line */}
                <circle
                  cx={x}
                  cy={y}
                  r="5"
                  fill={colorHex}
                  stroke="white"
                  strokeWidth="1.6"
                  style={{
                    filter: `drop-shadow(0 0 6px ${colorHex})`,
                  }}
                />
                {/* Side badge */}
                <g transform={`translate(${x},${badgeY})`}>
                  <rect
                    x="-26"
                    y="-9"
                    width="52"
                    height="18"
                    rx="3"
                    fill={colorHex}
                    style={{
                      filter: `drop-shadow(0 1px 4px rgba(0,0,0,0.5))`,
                    }}
                  />
                  <text
                    x="0"
                    y="1"
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fontSize="10"
                    fontWeight="700"
                    fill="white"
                    fontFamily="Inter, system-ui, sans-serif"
                    style={{ letterSpacing: '0.06em' }}
                  >
                    {isLong ? '▲ LONG' : '▼ SHORT'}
                  </text>
                </g>
                {/* Entry price label, smaller, near the dot */}
                <text
                  x={x + 9}
                  y={y + 4}
                  fontSize="9"
                  fontWeight="600"
                  fill={colorHex}
                  fontFamily="JetBrains Mono, SF Mono, monospace"
                  style={{
                    fontVariantNumeric: 'tabular-nums',
                    filter: `drop-shadow(0 0 3px ${colorHex})`,
                  }}
                >
                  $
                  {f.entryPrice.toLocaleString(undefined, {
                    maximumFractionDigits: 2,
                  })}
                </text>
              </g>
            );
          })}

          {/* Endpoint pulse halo — anchors at final position */}
          <circle
            cx={geometry.endX}
            cy={geometry.endY}
            r="10"
            fill={lineColor}
            opacity="0"
            style={{
              animation: `eq-endpoint-halo 1.6s ease-in-out ${SPOT_DRAW_MS}ms infinite`,
              transformOrigin: `${geometry.endX}px ${geometry.endY}px`,
            }}
          />

          {/* Endpoint dot + live price label — travel with the draw-in.
           * cx/cy come from rAF-sampled getPointAtLength. The price is
           * inverse-mapped from the dot's y so the number matches the
           * curve's height at every frame. */}
          {(() => {
            const ex = endPos?.x ?? geometry.endX;
            const ey = endPos?.y ?? geometry.endY;
            const innerH = SPOT_VIEW_H - SPOT_PAD_TOP - SPOT_PAD_BOTTOM;
            const liveVal =
              geometry.yMin +
              (1 - (ey - SPOT_PAD_TOP) / innerH) *
                (geometry.yMax - geometry.yMin);
            const flipLeft = ex > SPOT_VIEW_W - 110;
            const labelX = flipLeft ? ex - 10 : ex + 10;
            const labelAnchor = flipLeft ? 'end' : 'start';
            return (
              <g>
                <circle
                  cx={ex}
                  cy={ey}
                  r="4"
                  fill="white"
                  stroke={lineColor}
                  strokeWidth="2"
                  style={{ filter: `drop-shadow(0 0 6px ${lineColor})` }}
                />
                <text
                  x={labelX}
                  y={ey - 8}
                  textAnchor={labelAnchor}
                  fontSize="12"
                  fontWeight="700"
                  fill={labelTextColor}
                  fontFamily="JetBrains Mono, SF Mono, monospace"
                  style={{
                    fontVariantNumeric: 'tabular-nums',
                    filter: `drop-shadow(0 0 4px ${lineColor})`,
                  }}
                >
                  $
                  {liveVal.toLocaleString(undefined, {
                    maximumFractionDigits: 2,
                    minimumFractionDigits: 2,
                  })}
                </text>
              </g>
            );
          })()}
        </svg>
      </div>
      {watchingFor && (
        <div className="mx-5 mb-4 mt-2 flex items-center justify-between gap-3 rounded-2xl bg-black/40 px-4 py-2.5 text-xs text-fg-muted">
          <span className="inline-flex items-center gap-1.5 truncate">
            <span aria-hidden="true">📡</span>
            <span>Watching for {watchingFor}</span>
          </span>
          <span className="whitespace-nowrap tabular-nums text-fg-secondary">
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
              'h-1.5 w-1.5 animate-pulse rounded-full',
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
          <span className="text-2xs uppercase normal-case tabular-nums tracking-wider text-fg-muted">
            Last scan <b className="text-info">12s ago</b>
            <span className="mx-2 text-border-strong">·</span>
            No signal
          </span>
        ) : (
          <span className="text-2xs uppercase normal-case tabular-nums tracking-wider text-fg-muted">
            Budget <b className="text-fg-secondary">{budgetSec}s</b>
            <span className="mx-2 text-border-strong">·</span>
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
                'rounded-2xl p-2.5 transition-all',
                status === 'active' &&
                  isScanning &&
                  'bg-info/15 shadow-[0_0_18px_rgba(59,130,246,0.35)] ring-1 ring-info/50',
                status === 'active' &&
                  !isScanning &&
                  'bg-bullish/15 shadow-[0_0_18px_rgba(14,203,129,0.35)] ring-1 ring-bullish/50',
                status === 'done' && 'bg-bullish/8',
                status === 'pending' && 'bg-black',
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
              <div className="mt-0.5 text-xs font-semibold text-fg">
                {s.label}
              </div>
              <div
                className={cn(
                  'mt-0.5 text-xs font-bold tabular-nums',
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
          <div className="rounded-2xl bg-info/15 p-2.5 ring-1 ring-info/40">
            <div className="text-[9px] font-semibold tracking-wider text-info">
              SCANS
            </div>
            <div className="mt-0.5 text-xs font-bold tabular-nums text-fg">
              3,247
            </div>
            <div className="mt-0.5 text-2xs uppercase tracking-wider text-info/80">
              Since deploy
            </div>
          </div>
        ) : (
          <div
            className={cn(
              'rounded-2xl p-2.5',
              underBudget
                ? 'bg-warning/15 ring-1 ring-warning/40'
                : 'bg-bearish/15 ring-1 ring-bearish/40',
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
                'mt-0.5 text-xs font-bold tabular-nums',
                underBudget ? 'text-warning' : 'text-bearish',
              )}
            >
              {elapsedSec}s
            </div>
            <div
              className={cn(
                'mt-0.5 text-2xs uppercase tracking-wider',
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

function RecentFills({ fills, phase }: { fills: Fill[]; phase: BotPhase }) {
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
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-bearish" />
            LIVE
          </span>
          <span>Recent Fills</span>
        </span>
      }
      rightSlot={
        <span
          className={cn(
            'text-2xs uppercase normal-case tabular-nums tracking-wider',
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
                    : 'bg-black/40 text-fg-muted';
            return (
              <tr
                key={f.id}
                className={cn(
                  'transition-colors hover:bg-black/30',
                  f.status === 'OPEN' && 'border-l-2 border-l-bearish',
                )}
              >
                <td className="px-3 py-2.5 text-2xs uppercase tabular-nums text-fg-muted">
                  {f.status === 'OPEN' ? (
                    <span className="inline-flex items-center gap-1 text-warning">
                      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-warning" />
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
                  <span className="font-semibold text-fg">{f.pair}</span>{' '}
                  <span className="text-fg-muted">· 5m</span>
                </td>
                <td className="px-3 py-2.5 text-2xs tabular-nums text-fg-muted">
                  {new Date(f.openedAt).toLocaleTimeString(undefined, {
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
                        {f.pnl >= 0 ? '+' : ''}${f.pnl.toFixed(2)}
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
      <div className="cursor-pointer px-5 pb-4 pt-2 text-center text-2xs uppercase tracking-wider text-fg-muted transition-colors hover:text-brand">
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
      <span className="text-right text-2xs tabular-nums text-fg-muted">
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
      className="origin-center text-base font-bold tabular-nums text-fg"
    >
      {Number.isFinite(mid)
        ? mid.toLocaleString(undefined, { maximumFractionDigits: 2 })
        : '—'}
      <div className="mt-0.5 text-2xs font-normal tabular-nums text-warning">
        ${spread.toFixed(2)} · {spreadPct.toFixed(3)}%
      </div>
    </div>
  );
}

function OrderBookL2({
  book,
  coin,
}: {
  book: HLOrderBook | null;
  coin: string;
}) {
  if (!book || book.levels[0].length === 0 || book.levels[1].length === 0) {
    return (
      <SectionCard
        title={
          <span className="inline-flex items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded border border-bullish/30 bg-bullish/10 px-1.5 py-0.5 text-[10px] font-bold tracking-wider text-bullish">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-bullish" />
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
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-bullish" />
            L2
          </span>
          <span>Order Book · {coin}</span>
        </span>
      }
      rightSlot={
        <span className="text-2xs normal-case text-fg-muted">Updates 1s</span>
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
        <div className="mx-2 my-2 flex min-w-[140px] flex-col items-center justify-center rounded-2xl bg-black/40 px-4 py-3">
          <div className="text-2xs uppercase tracking-wider text-fg-muted">
            Spread
          </div>
          <div className="mt-1">
            <MidPriceDisplay mid={mid} spread={spread} spreadPct={spreadPct} />
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
const BUBBLE_CANVAS_H = 480;
const BUBBLE_PAD = 4;
const BUBBLE_MAX = 27;
// Scale all packed radii up so bubbles read bigger. Initial overlap
// is fine — soft physics + lifecycle anims spread them organically.
const BUBBLE_SIZE_BOOST = 1.35;
// Lifecycle durations (matches viz_pnl_dashboard.html rules).
const BUBBLE_BIRTH_MS = 900;
const BUBBLE_DEATH_SHRINK_MS = 500;
const BUBBLE_DEATH_FLOAT_MS = 700;
// Stagger between spawns so bubbles arrive one-after-another rather
// than all at once. Each new bubble's stateT is pushed `idx * BASE + rand(0, JITTER)`
// into the future; the lifecycle pass keeps it hidden until then.
// Tuning target: full spawn sequence (last bubble fully alive) ≈ 4s.
// With BUBBLE_MAX = 27 and BIRTH = 900ms, last spawn starts at
// 26 × 120 + 60 = ~3180ms → finishes at ~4080ms.
const BUBBLE_SPAWN_STAGGER_MS = 120;
const BUBBLE_SPAWN_JITTER_MS = 60;
// Number of distinct compass directions a new bubble can spawn from.
// 14 = 4 corners + 10 evenly distributed mid-edges, evenly spaced
// around the canvas perimeter (2π / 14 ≈ 25.7° per slot).
const BUBBLE_SPAWN_DIRS = 14;

// Single-glyph token icons — Unicode symbols where the coin has a
// recognisable mark, otherwise the first letter is used as a fallback.
const COIN_ICONS: Record<string, string> = {
  BTC: '₿',
  ETH: 'Ξ',
  SOL: '◎',
  DOGE: 'Ð',
  ADA: '₳',
  XRP: '✕',
  BNB: '⬣',
  AVAX: '▲',
  DOT: '●',
  LINK: '⬡',
  ATOM: '⚛',
  LTC: 'Ł',
  SUI: '◆',
  TAO: 'τ',
  NEAR: '◐',
  ICP: '∞',
  TRX: '✦',
  INJ: '⟡',
  SEI: '◈',
  TIA: '✧',
  ARB: '◇',
  OP: '◯',
  PEPE: '🐸',
  WIF: '🐶',
  BONK: '🐕',
  SHIB: 'Ѕ',
  JUP: 'J',
  WLD: 'W',
  PYTH: 'P',
  RNDR: 'R',
  AAVE: 'A',
  FET: 'F',
  ONDO: 'O',
  ORDI: 'O',
  JTO: 'J',
  LDO: 'L',
  UNI: 'U',
  MATIC: 'M',
  APT: 'A',
  TON: 'T',
};
function getCoinIcon(sym: string): string {
  return COIN_ICONS[sym] ?? sym.charAt(0);
}

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
    // Boost packed radius — physics handles the resulting overlap,
    // bubbles read visibly bigger.
    r: node.r * BUBBLE_SIZE_BOOST,
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

type BubbleLifecycle =
  | 'birth'
  | 'alive'
  | 'dying-shrink'
  | 'dying-float'
  | 'dead';

interface PhysBubble {
  id: string;
  pct: number;
  vol: number;
  x: number;
  y: number;
  r: number; // currently rendered radius (driven by lifecycle)
  targetR: number; // resting radius once ALIVE
  vx: number;
  vy: number;
  mass: number;
  squashAmount: number;
  squashVel: number;
  squashAxis: number;
  phase: number; // per-bubble random phase for blob wobble
  state: BubbleLifecycle;
  stateT: number; // performance.now() when current state began
  floatXdir?: number; // per-bubble drift direction during dying-float
  fragsEmitted?: boolean; // reserved for future fragment FX
}

const PHYS = {
  thermal: 0.12, // Brownian noise amplitude — higher = more lively drift
  centerPull: 0.0004, // soft gravity toward canvas centre
  damping: 0.988, // velocity drain per frame — slightly less drag
  restitution: 0.45, // energy kept on bubble–bubble collision
  wallRestitution: 0.55,
  minSpeed: 0.08, // velocity floor — keeps bubbles always drifting
} as const;

const JELLY = {
  springK: 0.2, // restoring stiffness toward round shape
  springDamp: 0.5, // squash velocity drain — decays in ~5 frames
  squashGain: 0.0006, // collision → squash multiplier
  maxSquash: 0.025, // max deformation (2.5 % of radius)
  wallSquashGain: 0.0005,
  perimAmp: 0.014, // blob breathing amplitude
  perimVerts: 16, // vertices for the organic outline
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
  const cx = W / 2,
    cy = H / 2;

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
      const a = bubbles[i],
        bub = bubbles[j];
      const dx = bub.x - a.x,
        dy = bub.y - a.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const minD = a.r + bub.r + 2;
      if (dist < minD && dist > 0.01) {
        const overlap = (minD - dist) / 2;
        const nx = dx / dist,
          ny = dy / dist;
        a.x -= nx * overlap;
        a.y -= ny * overlap;
        bub.x += nx * overlap;
        bub.y += ny * overlap;
        const dvx = bub.vx - a.vx,
          dvy = bub.vy - a.vy;
        const vn = dvx * nx + dvy * ny;
        if (vn < 0) {
          const ma = a.mass,
            mb = bub.mass;
          const imp = (-(1 + PHYS.restitution) * vn) / (1 / ma + 1 / mb);
          const ix = imp * nx,
            iy = imp * ny;
          a.vx -= ix / ma;
          a.vy -= iy / ma;
          bub.vx += ix / mb;
          bub.vy += iy / mb;
          const cAxis = Math.atan2(ny, nx);
          applySquashForce(
            a,
            (Math.abs(imp) * JELLY.squashGain) / Math.sqrt(ma),
            cAxis,
          );
          applySquashForce(
            bub,
            (Math.abs(imp) * JELLY.squashGain) / Math.sqrt(mb),
            cAxis,
          );
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
  px: number,
  py: number,
  r: number,
  squash: number,
  squashAxis: number,
  t: number,
  phase: number,
): string {
  const N = JELLY.perimVerts;
  const A = JELLY.perimAmp;
  const pts: [number, number][] = [];
  for (let i = 0; i < N; i++) {
    const ang = (i / N) * Math.PI * 2;
    const off =
      A * Math.sin(t * 0.6 + i * 0.5 + phase) * 0.55 +
      A * Math.sin(t * 1.0 + i * 0.9 + phase * 1.3) * 0.3 +
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

function svgEl(
  tag: 'circle',
  attrs: Record<string, string | number>,
): SVGCircleElement;
function svgEl(
  tag: 'path',
  attrs: Record<string, string | number>,
): SVGPathElement;
function svgEl(
  tag: 'text',
  attrs: Record<string, string | number>,
): SVGTextElement;
function svgEl(
  tag: string,
  attrs: Record<string, string | number>,
): SVGElement {
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
  birthRing: SVGCircleElement;
  icon: SVGTextElement;
  sym: SVGTextElement;
  pct: SVGTextElement;
  // Resting radius the labels were sized for. Used to detect when r
  // drifts far enough that we should re-size the labels.
  baseR: number;
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
  // r used for sizing here is the bubble's resting (target) radius, so
  // labels don't shrink while the bubble is birthing in.
  const baseR = b.targetR > 1 ? b.targetR : b.r;

  const g = document.createElementNS(SVGNS, 'g') as SVGGElement;
  g.setAttribute('data-bid', b.id);
  g.style.cursor = 'pointer';

  if (onHover) {
    g.addEventListener('mouseenter', () => {
      const rect = g.getBoundingClientRect();
      onHover({
        id: b.id,
        pct: b.pct,
        vol: b.vol,
        x: rect.left + rect.width / 2,
        y: rect.top - 8,
      });
    });
    g.addEventListener('mouseleave', () => onHover(null));
  }

  const halo = svgEl('circle', {
    cx: b.x,
    cy: b.y,
    r: b.r * 1.35,
    fill: `url(#hlHalo-${variant})`,
  });
  // Birth ring — expanding stroke that fades during BIRTH state.
  const ringStroke = b.pct >= 0 ? '#7CFFCB' : '#FFAFB7';
  const birthRing = svgEl('circle', {
    cx: b.x,
    cy: b.y,
    r: b.r,
    fill: 'none',
    stroke: ringStroke,
    'stroke-width': 1.5,
    opacity: 0,
    'pointer-events': 'none',
  });
  const rim = svgEl('circle', {
    cx: b.x,
    cy: b.y,
    r: b.r,
    fill: 'none',
    stroke: 'url(#hlRim)',
    'stroke-width': 1.2,
    opacity: 0.4,
  });
  const strokeColor =
    b.pct >= 0 ? 'rgba(14,203,129,0.55)' : 'rgba(246,70,93,0.55)';
  const body = svgEl('path', {
    d: makeBlobPath(b.x, b.y, b.r, 0, 0, t, b.phase),
    fill: `url(#hlBody-${variant})`,
    stroke: strokeColor,
    'stroke-width': 0.8,
  });
  const hl = svgEl('path', {
    d: makeBlobPath(
      b.x - b.r * 0.15,
      b.y - b.r * 0.2,
      b.r * 0.7,
      0,
      0,
      t,
      b.phase + 1,
    ),
    fill: 'url(#hlHighlight)',
    'pointer-events': 'none',
  });
  // Three label rows — Icon (top), Symbol (middle), %Change (bottom).
  // Font sizes scale with bubble radius and clamp into a legible range.
  const iconFont = Math.max(11, Math.min(baseR * 0.55, 26));
  const symFont = Math.max(9, Math.min(baseR * 0.26, 13));
  const pctFont = Math.max(9, Math.min(baseR * 0.24, 12));

  const iconEl = svgEl('text', {
    x: b.x,
    y: b.y - baseR * 0.3,
    'font-family': 'Inter, sans-serif',
    'font-weight': 700,
    'font-size': iconFont,
    fill: '#fff',
    'text-anchor': 'middle',
    'dominant-baseline': 'middle',
    'pointer-events': 'none',
  });
  iconEl.textContent = getCoinIcon(sym);

  const symEl = svgEl('text', {
    x: b.x,
    y: b.y + baseR * 0.1,
    'font-family': 'Inter, sans-serif',
    'font-weight': 700,
    'font-size': symFont,
    fill: '#fff',
    'text-anchor': 'middle',
    'dominant-baseline': 'middle',
    opacity: 0.92,
    'pointer-events': 'none',
  });
  symEl.textContent = sym;

  const pctEl = svgEl('text', {
    x: b.x,
    y: b.y + baseR * 0.42,
    'font-family': 'JetBrains Mono, monospace',
    'font-weight': 600,
    'font-size': pctFont,
    fill: b.pct >= 0 ? '#7CFFCB' : '#FFAFB7',
    'text-anchor': 'middle',
    'dominant-baseline': 'middle',
    'pointer-events': 'none',
  });
  pctEl.textContent = `${b.pct >= 0 ? '+' : ''}${b.pct.toFixed(1)}%`;

  g.appendChild(halo);
  g.appendChild(birthRing);
  g.appendChild(rim);
  g.appendChild(body);
  g.appendChild(hl);
  g.appendChild(iconEl);
  g.appendChild(symEl);
  g.appendChild(pctEl);

  return {
    g,
    halo,
    rim,
    body,
    hl,
    birthRing,
    icon: iconEl,
    sym: symEl,
    pct: pctEl,
    baseR,
  };
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

  // Sync physics state + SVG DOM when live data changes.
  // Lifecycle-aware: absent bubbles transition to a dying state (float
  // or shrink) instead of being yanked from the DOM. New bubbles spawn
  // from outside the canvas with a BIRTH ramp.
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg || ctxs.length === 0) return;

    const now = performance.now();
    const packed = computeBubbles(ctxs);
    const existingPhys = new Map(physRef.current.map((b) => [b.id, b]));
    const incomingIds = new Set(packed.map((p) => p.name));

    // Mark stale bubbles as dying (they remain in physRef until DEAD).
    for (const b of physRef.current) {
      if (
        !incomingIds.has(b.id) &&
        !b.state.startsWith('dying') &&
        b.state !== 'dead'
      ) {
        // Coin-flip between float-up and shrink-out for visual variety.
        b.state = Math.random() < 0.65 ? 'dying-float' : 'dying-shrink';
        b.stateT = now;
        if (b.state === 'dying-float') {
          b.floatXdir = Math.random() < 0.5 ? -1 : 1;
        }
      }
    }

    // Update existing or spawn new.
    const survivors = physRef.current.filter((b) => b.state !== 'dead');

    // Pass 1 — refresh existing bubbles (revive if dying, sync labels).
    const newcomers: typeof packed = [];
    for (const p of packed) {
      const prev = existingPhys.get(p.name);
      if (prev && prev.state !== 'dead') {
        prev.pct = p.pct;
        prev.vol = p.vol;
        prev.targetR = p.r;
        prev.mass = p.r * p.r;
        if (prev.state.startsWith('dying')) {
          prev.state = 'birth';
          prev.stateT = now;
        }
        const dom = domCacheRef.current.get(p.name);
        if (dom?.pct) {
          dom.pct.textContent = `${p.pct >= 0 ? '+' : ''}${p.pct.toFixed(1)}%`;
          dom.pct.setAttribute('fill', p.pct >= 0 ? '#7CFFCB' : '#FFAFB7');
        }
        continue;
      }
      newcomers.push(p);
    }

    // Shuffle newcomers so spawn order is random (not tier-by-tier
    // which is how computeBubbles ranks them).
    for (let i = newcomers.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [newcomers[i], newcomers[j]] = [newcomers[j], newcomers[i]];
    }

    // Pass 2 — stagger the spawn so bubbles arrive one after another.
    // Each gets a future stateT; the lifecycle pass keeps r=0 +
    // opacity=0 until that moment arrives.
    newcomers.forEach((p, idx) => {
      // Spawn from one of BUBBLE_SPAWN_DIRS evenly distributed compass
      // directions around the canvas centre, projected outside the
      // perimeter. Small ±jitter on the angle keeps consecutive spawns
      // from the same dir from stacking on the exact same line.
      const dirIdx = Math.floor(Math.random() * BUBBLE_SPAWN_DIRS);
      const angle =
        (dirIdx / BUBBLE_SPAWN_DIRS) * Math.PI * 2 + bRand(-0.06, 0.06);
      const cxC = BUBBLE_CANVAS_W / 2;
      const cyC = BUBBLE_CANVAS_H / 2;
      // Spawn radius — past the corner of the canvas so the bubble is
      // fully off-screen regardless of which side it comes from.
      const spawnDist = Math.hypot(BUBBLE_CANVAS_W, BUBBLE_CANVAS_H) / 2 + 40;
      const sx = cxC + Math.cos(angle) * spawnDist;
      const sy = cyC + Math.sin(angle) * spawnDist;
      // Velocity points back toward the centre (with target jitter so
      // bubbles converge on a small zone rather than a single point).
      const targetCx = cxC + bRand(-14, 14);
      const targetCy = cyC + bRand(-14, 14);
      const dxc = targetCx - sx;
      const dyc = targetCy - sy;
      const dlen = Math.sqrt(dxc * dxc + dyc * dyc) || 1;
      const speed = bRand(1.2, 1.8);
      const delay =
        idx * BUBBLE_SPAWN_STAGGER_MS + Math.random() * BUBBLE_SPAWN_JITTER_MS;
      const b: PhysBubble = {
        id: p.name,
        pct: p.pct,
        vol: p.vol,
        x: sx,
        y: sy,
        r: 0,
        targetR: p.r,
        vx: (dxc / dlen) * speed,
        vy: (dyc / dlen) * speed,
        mass: p.r * p.r,
        squashAmount: 0,
        squashVel: 0,
        squashAxis: 0,
        phase: Math.random() * Math.PI * 2,
        state: 'birth',
        stateT: now + delay, // future timestamp = pre-birth (hidden)
      };
      const dom = spawnBubbleDOM(b, tRef.current, (info) =>
        setTooltipRef.current(info),
      );
      // Hide immediately so pre-birth bubbles aren't drawn at the corner.
      dom.g.style.opacity = '0';
      domCacheRef.current.set(p.name, dom);
      svg.appendChild(dom.g);
      survivors.push(b);
    });
    physRef.current = survivors;
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
      if (dom?.pct) {
        dom.pct.textContent = `${newPct >= 0 ? '+' : ''}${newPct.toFixed(1)}%`;
        dom.pct.setAttribute('fill', newPct >= 0 ? '#7CFFCB' : '#FFAFB7');
      }
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
      if (dom?.pct) {
        dom.pct.textContent = `${pct >= 0 ? '+' : ''}${pct.toFixed(1)}%`;
        dom.pct.setAttribute('fill', pct >= 0 ? '#7CFFCB' : '#FFAFB7');
      }
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

      // Lifecycle pass — drives r + opacity from state, marks DEAD,
      // gives ALIVE bubbles their resting radius for physics.
      const now = performance.now();
      const cache = domCacheRef.current;
      const renderOpacity = new Map<string, number>();
      const renderExtraTrans = new Map<string, string>();

      for (const b of bubbles) {
        if (b.state === 'birth') {
          const elapsed = now - b.stateT;
          if (elapsed < 0) {
            // Pre-birth — scheduled for the future. Keep invisible at
            // the corner spawn position; no physics, no render.
            b.r = 0;
            renderOpacity.set(b.id, 0);
            continue;
          }
          const p = Math.min(1, elapsed / BUBBLE_BIRTH_MS);
          const eased = 1 - Math.pow(1 - p, 3);
          const overshoot = 1 + 0.18 * Math.sin(p * Math.PI);
          b.r = Math.max(1, b.targetR * eased * overshoot);
          renderOpacity.set(b.id, eased);
          // Birth ring: expanding circle that fades.
          const dom = cache.get(b.id);
          if (dom) {
            const ringR = b.targetR * (1 + p * 1.5);
            dom.birthRing.setAttribute('r', ringR.toFixed(1));
            dom.birthRing.setAttribute('opacity', ((1 - p) * 0.7).toFixed(2));
          }
          if (p >= 1) {
            b.state = 'alive';
            b.stateT = now;
            if (dom) dom.birthRing.setAttribute('opacity', '0');
          }
        } else if (b.state === 'alive') {
          // Smooth approach to target radius (handles small targetR shifts).
          b.r += (b.targetR - b.r) * 0.06;
          renderOpacity.set(b.id, 1);
        } else if (b.state === 'dying-shrink') {
          const p = Math.min(1, (now - b.stateT) / BUBBLE_DEATH_SHRINK_MS);
          b.r = b.targetR * (1 - p);
          renderOpacity.set(b.id, 1 - p);
          if (p >= 1) b.state = 'dead';
        } else if (b.state === 'dying-float') {
          const p = Math.min(1, (now - b.stateT) / BUBBLE_DEATH_FLOAT_MS);
          const eased = 1 - Math.pow(1 - p, 2);
          b.r = b.targetR * (1 - eased * 0.3);
          renderOpacity.set(b.id, 1 - eased);
          const yOff = -eased * 60;
          const xOff = eased * 12 * (b.floatXdir ?? 1);
          renderExtraTrans.set(
            b.id,
            `translate(${xOff.toFixed(1)},${yOff.toFixed(1)})`,
          );
          if (p >= 1) b.state = 'dead';
        }
      }

      // Drop DEAD bubbles from physRef + DOM cache.
      const live: PhysBubble[] = [];
      for (const b of bubbles) {
        if (b.state === 'dead') {
          const dom = cache.get(b.id);
          if (dom) {
            dom.g.remove();
            cache.delete(b.id);
          }
          continue;
        }
        live.push(b);
      }
      physRef.current = live;

      // Physics only acts on ALIVE bubbles — dying ones drift by their
      // own transform offset; birth ones are still ramping in size and
      // shouldn't body-check live siblings.
      const activeBubbles = live.filter((b) => b.state === 'alive');
      if (activeBubbles.length > 0) {
        stepPhysics(activeBubbles, BUBBLE_CANVAS_W, BUBBLE_CANVAS_H);
        stepJelly(activeBubbles);
      }

      // Birth bubbles: travel in a straight line toward the centre,
      // with a gentle gravity-like pull so they don't overshoot. Light
      // damping keeps the initial corner-aimed velocity dominant for
      // most of the journey before ALIVE physics takes over.
      // Pre-birth (future stateT) bubbles are skipped — they sit at
      // the corner until their scheduled birth moment.
      const cx = BUBBLE_CANVAS_W / 2,
        cy = BUBBLE_CANVAS_H / 2;
      for (const b of live) {
        if (b.state === 'birth' && now >= b.stateT) {
          b.vx += (cx - b.x) * 0.004;
          b.vy += (cy - b.y) * 0.004;
          b.vx *= 0.985;
          b.vy *= 0.985;
          b.x += b.vx;
          b.y += b.vy;
        }
      }

      for (const b of live) {
        const dom = cache.get(b.id);
        if (!dom) continue;

        const bx = b.x.toFixed(1);
        const by = b.y.toFixed(1);
        const op = renderOpacity.get(b.id) ?? 1;
        const extraTrans = renderExtraTrans.get(b.id) ?? '';

        // Apply group-level transform for floating offsets + opacity.
        if (extraTrans) {
          dom.g.setAttribute('transform', extraTrans);
        } else {
          dom.g.removeAttribute('transform');
        }
        dom.g.style.opacity = String(op);

        dom.halo.setAttribute('cx', bx);
        dom.halo.setAttribute('cy', by);
        dom.halo.setAttribute('r', (b.r * 1.35).toFixed(1));

        dom.birthRing.setAttribute('cx', bx);
        dom.birthRing.setAttribute('cy', by);

        dom.rim.setAttribute('cx', bx);
        dom.rim.setAttribute('cy', by);
        dom.rim.setAttribute('r', b.r.toFixed(1));

        dom.body.setAttribute(
          'd',
          makeBlobPath(b.x, b.y, b.r, b.squashAmount, b.squashAxis, t, b.phase),
        );
        dom.hl.setAttribute(
          'd',
          makeBlobPath(
            b.x - b.r * 0.15,
            b.y - b.r * 0.2,
            b.r * 0.7,
            b.squashAmount * 0.5,
            b.squashAxis,
            t * 0.8,
            b.phase + 1,
          ),
        );

        // Three label rows positioned proportionally to baseR so they
        // hold their layout while the bubble breathes/squashes.
        const lr = dom.baseR;
        dom.icon.setAttribute('x', bx);
        dom.icon.setAttribute('y', (b.y - lr * 0.3).toFixed(1));
        dom.sym.setAttribute('x', bx);
        dom.sym.setAttribute('y', (b.y + lr * 0.1).toFixed(1));
        dom.pct.setAttribute('x', bx);
        dom.pct.setAttribute('y', (b.y + lr * 0.42).toFixed(1));
      }
    }

    rafRef.current = window.setInterval(frame, 1000 / 60) as unknown as number;
    return () => window.clearInterval(rafRef.current);
  }, []);

  // Whether we're loading multi-TF data
  const isLoading = tf !== '24H' && tfPctMap === null && topCoins.length > 0;

  return (
    <section className="card-coin98 sticky top-3 rounded-3xl p-4">
      <header className="mb-3 flex items-center justify-between text-2xs uppercase tracking-wider text-fg-muted">
        <span className="font-semibold">Hyperliquid Markets</span>
        <span className="inline-flex items-center gap-1 normal-case tracking-normal text-bullish">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-bullish" />
          Live
        </span>
      </header>

      <div
        role="tablist"
        aria-label="Timeframe"
        className="mb-3 flex gap-1 rounded-full bg-black p-1"
      >
        {(['24H', '7D', '30D', '90D'] as BubbleTimeframe[]).map((t) => (
          <button
            key={t}
            type="button"
            role="tab"
            aria-selected={t === tf}
            onClick={() => setTf(t)}
            className={cn(
              'flex-1 rounded-full py-1 text-2xs font-medium tracking-wider transition-colors',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand',
              t === tf
                ? 'bg-brand font-semibold text-black shadow-[0_0_10px_rgba(240,185,11,0.35)]'
                : 'text-fg-muted hover:text-fg',
            )}
          >
            {t}
          </button>
        ))}
      </div>

      <div
        className="relative overflow-hidden rounded-2xl"
        style={{
          height: BUBBLE_CANVAS_H,
          background:
            'radial-gradient(ellipse at center, rgba(14, 203, 129, 0.04), transparent 70%)',
        }}
      >
        {ctxs.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center text-2xs text-fg-muted">
            Waiting for HL data…
          </div>
        )}
        {/* Loading overlay for multi-TF fetches */}
        {isLoading && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/40 text-2xs text-fg-muted">
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
            className="card-coin98 pointer-events-none rounded-2xl px-3 py-2 text-xs shadow-2xl"
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

      <div className="mt-3 grid grid-cols-2 gap-2 pt-3 text-2xs uppercase tracking-wider text-fg-muted">
        <div>
          Winners
          <b className="mt-0.5 block text-xs font-semibold normal-case tabular-nums tracking-normal text-bullish">
            {stats.winners} pairs
          </b>
        </div>
        <div>
          Losers
          <b className="mt-0.5 block text-xs font-semibold normal-case tabular-nums tracking-normal text-bearish">
            {stats.losers} pairs
          </b>
        </div>
        <div>
          Best
          <b className="mt-0.5 block text-xs font-semibold normal-case tabular-nums tracking-normal text-bullish">
            {stats.bestCoin
              ? `${stats.bestCoin} +${stats.bestPct.toFixed(1)}%`
              : '—'}
          </b>
        </div>
        <div>
          Worst
          <b className="mt-0.5 block text-xs font-semibold normal-case tabular-nums tracking-normal text-bearish">
            {stats.worstCoin
              ? `${stats.worstCoin} ${stats.worstPct.toFixed(1)}%`
              : '—'}
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
    const value = offsetMs == null ? null : Date.now() - offsetMs;
    window.dispatchEvent(
      new CustomEvent('bot-monitoring:set-deployed', { detail: value }),
    );
  };
  return (
    <div className="card-coin98 fixed bottom-4 right-4 z-50 rounded-2xl p-3 shadow-2xl ring-1 ring-warning/40">
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
      <div className="flex h-screen w-screen items-center justify-center bg-black text-fg-muted">
        <span className="text-sm">Loading bot…</span>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-screen flex-col bg-black text-fg">
      {/* Page-wide subtle yellow glow accents (Coin98 hero halos) */}
      <div
        className="pointer-events-none fixed -top-20 left-1/2 z-0 h-[420px] w-[700px] -translate-x-1/2 rounded-full opacity-50 blur-3xl"
        style={{
          background:
            'radial-gradient(ellipse at center, rgba(240,185,11,0.12), transparent 70%)',
        }}
        aria-hidden="true"
      />
      <MonitoringHeader meta={meta} />

      <div className="flex flex-1 overflow-hidden">
        <CypheusRail messages={cypheusMessages} />

        {/* Subtle dot-grid texture matching Builder */}
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

        <main className="relative z-10 flex-1 overflow-y-auto">
          <div className="mx-auto flex max-w-6xl flex-col gap-5 px-8 py-7">
            <HeroPnL snap={snap} phase={phase} />

            <div className="grid grid-cols-1 gap-5">
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

        <aside className="relative z-10 w-[280px] flex-shrink-0 overflow-y-auto bg-black">
          <div className="p-3">
            <GainersLosersBubble ctxs={markets?.ctxs ?? []} />
          </div>
        </aside>
      </div>
      <DevControls />
    </div>
  );
}
