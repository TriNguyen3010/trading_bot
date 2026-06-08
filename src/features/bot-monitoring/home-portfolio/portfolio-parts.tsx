import { AlertCircle, Zap } from 'lucide-react';
import type { DashboardBot } from '../bot-list.helpers';
import type { BotPerformance } from '../bot-performance';
import type { PortfolioStats } from '../portfolio-stats';
import type { AgentInfoResponse } from '@/types/api-helpers';

export function truncateAddr(addr: string | null | undefined): string {
  if (!addr || addr.length < 12) return addr || '—';
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

export function fmtUsd(n: number): string {
  return n.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

const badgeClass: Record<string, string> = {
  LIVE: 'border-bullish/30 bg-bullish-subtle text-bullish',
  'DRY-RUN': 'border-brand/30 bg-brand-subtle text-brand',
  PAUSED: 'border-border-strong/40 bg-white/5 text-fg-muted',
  ERROR: 'border-bearish/40 bg-bearish-subtle text-bearish',
  STARTING: 'border-brand/30 bg-brand-subtle text-brand',
  STOPPING: 'border-border-strong/40 bg-white/5 text-fg-muted',
};

function LiveTick({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-bullish">
      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-bullish" />
      {label}
    </span>
  );
}

export function GoLiveBanner({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="mb-3 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-brand/25 bg-brand-subtle px-4 py-3">
      <div className="flex items-center gap-2.5">
        <span className="flex h-7 w-7 items-center justify-center rounded-md bg-brand/15 text-brand">
          <Zap className="h-3.5 w-3.5" />
        </span>
        <div className="text-sm">
          <span className="font-semibold text-fg">Dry-run only.</span>{' '}
          <span className="text-fg-secondary">
            Create a Hyperliquid trading wallet to run bots live.
          </span>
        </div>
      </div>
      <button
        type="button"
        onClick={onCreate}
        className="rounded-lg border border-brand/40 bg-brand/10 px-3 py-1.5 text-2xs font-bold uppercase tracking-wider text-brand transition hover:bg-brand/20"
      >
        Create trading wallet →
      </button>
    </div>
  );
}

function AgentChip({ agent }: { agent: AgentInfoResponse }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-md border border-bullish/25 bg-bullish-subtle px-2 py-1 text-2xs text-bullish">
      <span className="h-1.5 w-1.5 rounded-full bg-bullish" />
      Trading wallet active · {truncateAddr(agent.agent_address)}
    </span>
  );
}

export function MiniBotCard({
  bot,
  perf,
  onClick,
}: {
  bot: DashboardBot;
  perf: BotPerformance | undefined;
  onClick: () => void;
}) {
  const balance =
    perf && perf.balance != null ? `$${fmtUsd(perf.balance)}` : '—';
  return (
    <button
      type="button"
      onClick={onClick}
      className="card-coin98-flat cursor-pointer rounded-2xl p-4 text-left transition hover:brightness-110"
    >
      <span
        className={`inline-flex items-center rounded-sm border px-1.5 py-0.5 text-2xs font-bold uppercase ${badgeClass[bot.mode] ?? badgeClass.PAUSED}`}
      >
        {bot.mode}
      </span>
      <h3 className="mt-2 text-base font-semibold text-fg">{bot.name}</h3>
      <div className="text-xs text-fg-muted">
        {bot.pair} · {bot.timeframe}
      </div>
      <div className="mt-2 font-mono text-lg font-bold tabular-nums text-fg">
        {balance}
        <span className="ml-1 text-2xs font-normal text-fg-muted">balance</span>
      </div>
    </button>
  );
}

export function PortfolioSkeleton() {
  return (
    <section className="mt-8" data-testid="portfolio-skeleton">
      <div className="mb-3 h-3 w-28 animate-pulse rounded bg-surface" />
      <section className="card-coin98 relative overflow-hidden rounded-3xl p-8">
        <div className="h-3 w-40 animate-pulse rounded bg-surface" />
        <div className="mt-5 h-14 w-80 animate-pulse rounded bg-surface" />
        <div className="mt-6 flex gap-6">
          <div className="h-4 w-24 animate-pulse rounded bg-surface" />
          <div className="h-4 w-20 animate-pulse rounded bg-surface" />
          <div className="h-4 w-28 animate-pulse rounded bg-surface" />
        </div>
      </section>
    </section>
  );
}

export function PortfolioError({ onRetry }: { onRetry: () => void }) {
  return (
    <section className="mt-8" data-testid="portfolio-error">
      <div className="mb-3 flex items-baseline justify-between">
        <h2 className="text-2xs font-semibold uppercase tracking-wider text-fg-muted">
          Your portfolio
        </h2>
      </div>
      <section className="card-coin98 flex flex-col items-center gap-4 rounded-3xl p-10 text-center">
        <span className="flex h-12 w-12 items-center justify-center rounded-full border border-bearish/40 bg-bearish-subtle text-bearish">
          <AlertCircle className="h-6 w-6" />
        </span>
        <div className="text-md text-fg-secondary">
          Couldn&apos;t load your portfolio.
        </div>
        <button
          type="button"
          onClick={onRetry}
          className="rounded-xl border border-border-strong px-5 py-2.5 text-sm font-semibold text-fg transition hover:bg-surface-hover"
        >
          Retry
        </button>
      </section>
    </section>
  );
}

export function PortfolioEmpty({
  agent,
  walletAddress,
  onBuild,
  onImport,
  onCreateAgent,
}: {
  agent: AgentInfoResponse | null;
  walletAddress: string | null;
  onBuild: () => void;
  onImport: () => void;
  onCreateAgent: () => void;
}) {
  return (
    <section className="mt-8" data-testid="portfolio-empty">
      <div className="mb-3 flex items-baseline justify-between">
        <h2 className="text-2xs font-semibold uppercase tracking-wider text-fg-muted">
          Your portfolio
        </h2>
        <span className="font-mono text-2xs text-fg-muted">
          {truncateAddr(walletAddress)}
        </span>
      </div>
      {!agent && <GoLiveBanner onCreate={onCreateAgent} />}
      <section className="card-coin98 relative overflow-hidden rounded-3xl p-10 text-center">
        <div
          aria-hidden
          className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full opacity-25 blur-2xl"
          style={{
            background:
              'radial-gradient(circle, rgba(240,185,11,0.3), transparent 70%)',
          }}
        />
        <div className="relative flex flex-col items-center gap-4">
          <div className="font-mono text-5xl font-bold tabular-nums text-fg-muted">
            $0.00
          </div>
          <div className="text-md text-fg-secondary">
            No bots yet — your portfolio is empty.
          </div>
          <p className="max-w-sm text-sm text-fg-muted">
            Build your first bot and run it in dry-run for free. Capital you
            deploy will show up here live.
          </p>
          <div className="mt-1 flex gap-3">
            <button
              type="button"
              onClick={onBuild}
              className="rounded-xl bg-brand px-5 py-2.5 text-sm font-bold text-fg-inverse transition hover:bg-brand-hover"
            >
              Build a bot
            </button>
            <button
              type="button"
              onClick={onImport}
              className="rounded-xl border border-border-strong px-5 py-2.5 text-sm font-semibold text-fg transition hover:bg-surface-hover"
            >
              Import config
            </button>
          </div>
        </div>
      </section>
    </section>
  );
}

export function PortfolioHero({
  stats,
  agent,
  walletAddress,
  onCreateAgent,
}: {
  stats: PortfolioStats;
  agent: AgentInfoResponse | null;
  walletAddress: string | null;
  onCreateAgent: () => void;
}) {
  const zeroDeployed = stats.capitalDeployed === 0;
  return (
    <section className="mt-8" data-testid="portfolio-hero">
      <div className="mb-3 flex items-baseline justify-between">
        <h2 className="text-2xs font-semibold uppercase tracking-wider text-fg-muted">
          Your portfolio
        </h2>
        <span className="font-mono text-2xs tabular-nums text-fg-muted">
          <LiveTick label="" /> last update just now
        </span>
      </div>
      {!agent && <GoLiveBanner onCreate={onCreateAgent} />}
      <section className="card-coin98 relative grid grid-cols-1 gap-6 overflow-hidden rounded-3xl p-8 md:grid-cols-[1fr_auto]">
        <div
          aria-hidden
          className="pointer-events-none absolute -left-16 -top-24 h-80 w-80 rounded-full opacity-40 blur-2xl"
          style={{
            background:
              'radial-gradient(circle, rgba(240,185,11,0.25), transparent 70%)',
          }}
        />
        <div className="relative">
          <div className="mb-4 flex flex-wrap items-center gap-3 text-2xs uppercase tracking-widest text-fg-muted">
            <span>Capital deployed</span>
            <LiveTick label="Live" />
            <span className="text-border-strong">·</span>
            {agent ? (
              <AgentChip agent={agent} />
            ) : (
              <span className="text-fg-muted">
                {truncateAddr(walletAddress)}
              </span>
            )}
          </div>

          <div
            className="font-mono text-6xl font-bold tabular-nums tracking-tight text-fg"
            style={{ lineHeight: 1.0 }}
          >
            {fmtUsd(stats.capitalDeployed)}{' '}
            <span className="text-2xl text-fg-muted">USDC</span>
          </div>

          {zeroDeployed && (
            <div className="mt-2 text-sm text-fg-muted">
              Nothing deployed — {stats.idle} bot
              {stats.idle === 1 ? '' : 's'} paused. Resume one to put capital to
              work.
            </div>
          )}

          <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-fg-secondary">
            <span className="inline-flex items-center gap-1.5">
              <span className="text-bullish">▲</span>
              <span className="font-semibold tabular-nums text-fg">
                {stats.active}
              </span>
              <span className="text-fg-muted">
                active · {stats.total} total
              </span>
            </span>
            <span className="text-border-strong">·</span>
            <span className="inline-flex items-center gap-1.5">
              <span className="font-semibold tabular-nums text-fg-muted">
                {stats.idle}
              </span>
              <span className="text-fg-muted">paused</span>
            </span>
            {stats.error > 0 && (
              <>
                <span className="text-border-strong">·</span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="font-semibold tabular-nums text-bearish">
                    {stats.error}
                  </span>
                  <span className="text-fg-muted">error</span>
                </span>
              </>
            )}
            <span className="text-border-strong">·</span>
            <span className="inline-flex items-center gap-1.5">
              <span className="font-semibold tabular-nums text-fg">
                {stats.openTrades}
              </span>
              <span className="text-fg-muted">open trades</span>
            </span>
          </div>
        </div>

        <div className="relative flex w-40 flex-col justify-center gap-1 md:items-end md:text-right">
          <div className="font-mono text-3xl font-bold tabular-nums text-fg">
            {stats.active}
          </div>
          <div className="text-2xs uppercase tracking-widest text-fg-muted">
            running bots
          </div>
          <div className="mt-3 text-2xs text-fg-disabled">
            30D PnL not available yet
          </div>
        </div>
      </section>
    </section>
  );
}
