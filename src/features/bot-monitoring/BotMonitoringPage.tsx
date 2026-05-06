import { useParams } from 'react-router-dom';
import { useEffect, useState } from 'react';
import {
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
import type { BotMeta, PerformanceSnapshot } from './types';

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
// Cypheus rail (placeholder — narrative wired in M3)
// Mirrors CypheusPanel structure: collapse toggle + content area.
// ──────────────────────────────────────────────────────────────────────
function CypheusRail() {
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

            <article className="rounded-md border border-border-subtle bg-surface p-2.5">
              <div className="text-2xs uppercase tracking-wider text-bullish mb-1">
                📡 Welcome
              </div>
              <p className="text-xs text-fg-secondary leading-relaxed">
                Bot monitoring view ready. Narrative engine arrives in M3.
              </p>
              <div className="text-2xs text-fg-disabled mt-1.5">just now</div>
            </article>

            <article className="rounded-md border border-border-subtle bg-surface p-2.5">
              <div className="text-2xs uppercase tracking-wider text-fg-muted mb-1">
                ⏸ Quiet
              </div>
              <p className="text-xs text-fg-secondary leading-relaxed">
                Charts, fills, and pipeline land in M2 + M3.
              </p>
              <div className="text-2xs text-fg-disabled mt-1.5">scheduled</div>
            </article>
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
// Placeholder cards (M2/M3/M4 fill these in)
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
        <CypheusRail />

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
              <PlaceholderCard label="47-day Activity Heatmap" plannedIn="M3" />
              <PlaceholderCard label="PnL Curve · 47 days" plannedIn="M2" />
              <PlaceholderCard label="Order Book L2 · BTC" plannedIn="M4" />
              <PlaceholderCard label="Live Spot Feed · BTC 5m" plannedIn="M2" />
              <PlaceholderCard label="Live Execution Cycle" plannedIn="M3" />
              <PlaceholderCard label="Recent Fills" plannedIn="M3" />
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
