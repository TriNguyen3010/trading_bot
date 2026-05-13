import { AlertTriangle } from 'lucide-react';
import { useBuilderStore } from '@/features/bot-builder/store/builder.store';
import { useLayoutPrefsStore } from '@/features/layout-prefs/layout-prefs.store';
import { ReadOnlyChip } from './shared/ReadOnlyChip';
import { TokenIcon } from './shared/TokenIcon';
import { parseUiPair } from '@/lib/pair-format';

const HIGH_LEVERAGE_THRESHOLD = 10;

export function BotConfigSummary() {
  const botConfig = useBuilderStore((s) => s.botConfig);
  const mode = useLayoutPrefsStore((s) => s.summaryMode);
  const { pair, timeframe, leverage, tradingMode, stakeAmount, stakeCurrency } =
    botConfig;

  if (!pair) {
    return (
      <span className="text-xs italic text-fg-muted">No bot config yet</span>
    );
  }

  const parts = parseUiPair(pair);
  const baseSymbol = parts?.base ?? pair;
  const isHighLev = leverage > HIGH_LEVERAGE_THRESHOLD;
  const isLive = tradingMode === 'live';

  if (mode === 'narrative') {
    return (
      <p className="text-sm leading-relaxed text-fg-secondary">
        Trade{' '}
        <span className="inline-flex items-center gap-1 align-baseline">
          <TokenIcon symbol={baseSymbol} />
          <span className="font-semibold text-fg">{pair}</span>
        </span>{' '}
        on <span className="font-mono font-medium text-fg">{timeframe}</span>{' '}
        candles with{' '}
        <span
          className={
            isHighLev
              ? 'font-mono font-medium text-brand'
              : 'font-mono font-medium text-fg'
          }
        >
          {leverage}×
        </span>{' '}
        leverage in{' '}
        <span
          className={isLive ? 'font-medium text-bearish' : 'font-medium text-bullish'}
        >
          {isLive ? 'Live' : 'Dry-run'}
        </span>{' '}
        mode · stake{' '}
        <span className="font-mono font-medium text-fg">
          ${stakeAmount.toLocaleString()}{' '}
          <span className="text-xs text-fg-muted">{stakeCurrency}</span>
        </span>{' '}
        per position.
      </p>
    );
  }

  // Visual mode — hero stack (mockup B).
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-3">
        <span className="inline-flex items-center gap-2 text-md font-bold text-fg">
          <TokenIcon symbol={baseSymbol} />
          <span className="truncate">{pair}</span>
        </span>
        <ReadOnlyChip
          tone={isLive ? 'bearish' : 'bullish'}
          title={isLive ? 'Live trading — real money' : 'Dry-run — paper trading'}
        >
          {isLive ? 'Live' : 'Dry-run'}
        </ReadOnlyChip>
      </div>
      <div className="flex items-center gap-3 rounded-md border border-border-subtle bg-black/30 px-3 py-2">
        <Stat label="Timeframe" value={timeframe} />
        <Divider />
        <Stat
          label="Leverage"
          value={`${leverage}×`}
          warn={isHighLev}
          warnIcon={isHighLev}
        />
        <Divider />
        <Stat
          label="Stake / pos"
          value={`$${stakeAmount.toLocaleString()}`}
          unit={stakeCurrency}
        />
      </div>
    </div>
  );
}

function Stat({
  label, value, unit, warn, warnIcon,
}: {
  label: string;
  value: string;
  unit?: string;
  warn?: boolean;
  warnIcon?: boolean;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <span
        className={
          warn
            ? 'flex items-center gap-1 font-mono text-sm font-semibold text-brand'
            : 'font-mono text-sm font-semibold text-fg'
        }
      >
        {warnIcon ? <AlertTriangle className="h-3 w-3" aria-hidden="true" /> : null}
        {value}
        {unit ? <span className="ml-1 text-xs font-medium text-fg-muted">{unit}</span> : null}
      </span>
      <span className="text-2xs font-semibold uppercase tracking-wide text-fg-muted">
        {label}
      </span>
    </div>
  );
}

function Divider() {
  return <span aria-hidden="true" className="h-6 w-px bg-border-default" />;
}
