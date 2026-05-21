import { Zap } from 'lucide-react';
import { cn } from '@/lib/utils';
import { CloseMethodSummary } from '@/features/bot-builder/components/summaries/CloseMethodSummary';
import { DirectionSummary } from '@/features/bot-builder/components/summaries/DirectionSummary';
import { EntryStrategySummary } from '@/features/bot-builder/components/summaries/EntryStrategySummary';
import type { DeploySummary as Summary } from './deploy-summary';

interface DeploySummaryProps {
  summary: Summary;
}

/**
 * Left pane of the deploy modal — visual snapshot of "what bot will run".
 *
 * Pair tokens · 2×2 stats grid · mode badges · strategy block.
 * No actions live here; actions are owned by the parent ExportDialog footer
 * and the JSON action group in the header.
 */
export function DeploySummary({ summary }: DeploySummaryProps) {
  return (
    <div className="flex flex-col gap-3 p-4">
      {/* Bot identity + mode badges (DRY-RUN/LIVE + margin mode). FUTURES
       *  is the only market type today so we don't surface it as a badge. */}
      <div className="flex items-center gap-2.5">
        <PairTokens base={summary.pairBase} quote={summary.pairQuote} />
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold leading-tight tracking-tight text-fg">
            {summary.botName}
          </div>
          <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-fg-muted">
            <span className="font-medium text-fg-secondary">
              {summary.pair}
            </span>
            <span className="text-fg-disabled">·</span>
            <span>{summary.exchangeLabel}</span>
            <span className="text-fg-disabled">·</span>
            <span className="font-mono tabular-nums">{summary.timeframe}</span>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {summary.dryRun ? (
            <Badge tone="warn">
              <Zap className="h-3 w-3" />
              DRY-RUN
            </Badge>
          ) : (
            <Badge tone="danger">LIVE</Badge>
          )}
          {summary.marketType === 'futures' ? (
            <Badge>{summary.marginMode.toUpperCase()}</Badge>
          ) : null}
        </div>
      </div>

      {/* 4-column stats strip (compact) */}
      <div className="grid grid-cols-4 overflow-hidden rounded-lg border border-border bg-border [&>div]:bg-surface-elevated">
        <Stat
          label="Stake"
          value={summary.stakeAmount}
          unit={summary.stakeCurrency}
        />
        <Stat label="Max pos." value={summary.maxOpenTrades} />
        <Stat label="Leverage" value={summary.leverage} unit="×" />
        <Stat
          label="Exposure"
          value={summary.maxExposure}
          unit={summary.stakeCurrency}
        />
      </div>

      {/* Strategy block — reuses the same summaries shown on the builder
       *  canvas so what user reviews matches what they configured. Pulls
       *  from useBuilderStore() internally. */}
      <div>
        <SectionLabel>Strategy</SectionLabel>
        <div className="flex flex-col gap-2.5 rounded-lg border border-border bg-surface-elevated p-3">
          <EntryStrategySummary />
          <div className="-mx-3 border-t border-border" />
          <DirectionSummary />
          <div className="-mx-3 border-t border-border" />
          <CloseMethodSummary />
        </div>
      </div>
    </div>
  );
}

/* ─── Internals ──────────────────────────────────────────────────── */

function PairTokens({ base, quote }: { base: string; quote: string }) {
  return (
    <div className="flex shrink-0 items-center">
      <TokenOrb symbol={base} variant="base" />
      <TokenOrb symbol={quote} variant="quote" className="-ml-2" />
    </div>
  );
}

const ORB_PRESETS: Record<string, string> = {
  SOL: 'bg-[linear-gradient(135deg,#9945FF,#14F195)] text-white',
  BTC: 'bg-[linear-gradient(135deg,#F7931A,#FFB75E)] text-white',
  ETH: 'bg-[linear-gradient(135deg,#627EEA,#3C3C3D)] text-white',
  BNB: 'bg-[linear-gradient(135deg,#F0B90B,#F3BA2F)] text-fg-inverse',
  USDT: 'bg-[#26A17B] text-white',
  USDC: 'bg-[#2775CA] text-white',
};

function TokenOrb({
  symbol,
  variant,
  className,
}: {
  symbol: string;
  variant: 'base' | 'quote';
  className?: string;
}) {
  const upper = symbol.toUpperCase();
  const preset = ORB_PRESETS[upper] ?? 'bg-surface-hover text-fg-secondary';
  const glyph = (() => {
    if (upper === 'USDT' || upper === 'USDC' || upper === 'DAI') return '$';
    return upper.slice(0, variant === 'base' ? 3 : 1);
  })();

  return (
    <span
      aria-hidden
      className={cn(
        'inline-flex h-7 w-7 items-center justify-center rounded-full border-2 border-surface-elevated text-[10px] font-bold leading-none',
        preset,
        className,
      )}
    >
      {glyph}
    </span>
  );
}

function Stat({
  label,
  value,
  unit,
}: {
  label: string;
  value: number | string;
  unit?: string;
}) {
  return (
    <div className="px-2.5 py-2">
      <div className="text-[9.5px] font-medium uppercase tracking-[0.12em] text-fg-muted">
        {label}
      </div>
      <div className="mt-0.5 font-mono text-[14px] font-medium tabular-nums leading-snug text-fg">
        {value}
        {unit ? (
          <span className="ml-0.5 font-sans text-[10px] font-normal text-fg-muted">
            {unit}
          </span>
        ) : null}
      </div>
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-1.5 text-[9.5px] font-semibold uppercase tracking-[0.16em] text-fg-muted">
      {children}
    </div>
  );
}

function Badge({
  children,
  tone = 'neutral',
}: {
  children: React.ReactNode;
  tone?: 'neutral' | 'warn' | 'bull' | 'danger';
}) {
  const toneCls = {
    neutral: 'border-border bg-white/[0.03] text-fg-secondary',
    warn: 'border-warning/35 bg-warning/15 text-warning font-semibold',
    bull: 'border-bullish/35 bg-bullish-subtle text-bullish',
    danger: 'border-bearish/40 bg-bearish-subtle text-bearish font-semibold',
  }[tone];
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-[5px] border px-2 py-0.5 text-[10.5px] font-medium tracking-wide',
        toneCls,
      )}
    >
      {children}
    </span>
  );
}
