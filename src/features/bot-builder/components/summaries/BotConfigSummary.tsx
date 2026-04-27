import { AlertTriangle } from 'lucide-react';
import { useBuilderStore } from '@/features/bot-builder/store/builder.store';
import { ReadOnlyChip } from './shared/ReadOnlyChip';
import { TokenIcon } from './shared/TokenIcon';
import { parseUiPair } from '@/lib/pair-format';

const HIGH_LEVERAGE_THRESHOLD = 10;

export function BotConfigSummary() {
  const botConfig = useBuilderStore((s) => s.botConfig);
  const { pair, timeframe, leverage, tradingMode, stakeAmount, stakeCurrency } =
    botConfig;

  if (!pair) {
    return (
      <span className="text-xs italic text-fg-muted">
        No bot config yet
      </span>
    );
  }

  const parts = parseUiPair(pair);
  const baseSymbol = parts?.base ?? pair;
  const isHighLev = leverage > HIGH_LEVERAGE_THRESHOLD;
  const isLive = tradingMode === 'live';

  const formattedStake = `${stakeAmount.toLocaleString()} ${stakeCurrency}`;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-fg">
        <TokenIcon symbol={baseSymbol} />
        <span className="truncate">{pair}</span>
      </span>

      <ReadOnlyChip tone="neutral" title={`Timeframe ${timeframe}`}>
        {timeframe}
      </ReadOnlyChip>

      <ReadOnlyChip
        tone={isHighLev ? 'warning' : 'neutral'}
        icon={isHighLev ? <AlertTriangle className="h-3 w-3" /> : null}
        title={
          isHighLev
            ? `${leverage}× leverage — high risk`
            : `${leverage}× leverage`
        }
      >
        {leverage}×
      </ReadOnlyChip>

      <ReadOnlyChip
        tone={isLive ? 'bearish' : 'bullish'}
        title={isLive ? 'Live trading — real money' : 'Dry-run — paper trading'}
      >
        {isLive ? 'Live' : 'Dry-run'}
      </ReadOnlyChip>

      <span
        className="font-mono tabular-nums text-xs text-fg-secondary"
        title={`Stake amount ${formattedStake}`}
      >
        ${stakeAmount.toLocaleString()}
        <span className="ml-0.5 text-fg-muted">{stakeCurrency}</span>
      </span>
    </div>
  );
}
