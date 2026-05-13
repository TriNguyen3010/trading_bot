/**
 * Composite narrative for Phase 2 — Strategy.
 *
 * Reads from 4 slices (strategy, directionForm, closeMethod, botConfig)
 * and emits ONE prose paragraph that flows naturally:
 *
 *   "When RSI-14 < 40 on Close of a 1h candle, enter a Long position
 *    at Market price. Take profit at +1.5% (100% of size). Stop loss
 *    at −10%."
 *
 * Rendered by StrategyCard when summaryMode === 'narrative' (replaces
 * the 3 stacked sub-summaries).
 *
 * NOTE: ConditionRow uses a flat shape —
 *   left: string (e.g. "RSI-14" or "candle.close")
 *   right_type: 'indicator' | 'number' | 'none'
 *   right_number: number | null
 *   right_indicator: string | null
 * NOT the {kind, id, value} object assumed in the original plan.
 */
import { useBuilderStore } from '@/features/bot-builder/store/builder.store';
import { indicatorOutputId } from '@/features/indicators/indicator-registry';
import type { CloseMethodForm, ConditionRow } from '@/types/builder.types';

const CANDLE_LABEL: Record<string, string> = {
  open: 'Open',
  close: 'Close',
  high: 'High',
  low: 'Low',
  volume: 'Volume',
};

export function StrategyNarrativeSummary() {
  const strategy = useBuilderStore((s) => s.strategy);
  const directionForm = useBuilderStore((s) => s.directionForm);
  const closeMethod = useBuilderStore((s) => s.closeMethod);
  const timeframe = useBuilderStore((s) => s.botConfig.timeframe);

  const conditions = strategy.entryConditions.conditions;
  const isLong = directionForm.direction === 'long';
  const isLimit = directionForm.orderType === 'limit';
  const orderLabel = isLimit ? 'Limit' : 'Market';

  // Prefer Close channel; fall back to first enabled; else generic label.
  const candleSource =
    strategy.candlestick.find((c) => c === 'close') ??
    strategy.candlestick[0] ??
    null;
  const candleText = candleSource ? (CANDLE_LABEL[candleSource] ?? candleSource) : 'the candle';

  // First entry condition as headline trigger; mention extras as a count.
  const firstCond = conditions[0];
  const moreCount = Math.max(0, conditions.length - 1);
  const logicWord = strategy.entryConditions.logic.type === 'OR' ? 'or' : 'and';

  const triggerText = firstCond
    ? `${firstCond.left} ${firstCond.op} ${describeRight(firstCond)}`
    : 'no rule yet';

  const indicatorList = strategy.indicators
    .map((ind) => indicatorOutputId(ind))
    .join(', ');

  const exitNode = renderExitNarrative(closeMethod);

  return (
    <p className="text-sm leading-relaxed text-fg-secondary">
      When{' '}
      <span className="font-mono font-medium text-fg">{triggerText}</span>
      {moreCount > 0 ? (
        <span className="text-fg-muted">
          {' '}
          ({logicWord} {moreCount} more)
        </span>
      ) : null}{' '}
      on <span className="font-medium text-fg">{candleText}</span> of a{' '}
      <span className="font-mono font-medium text-fg">{timeframe}</span>{' '}
      candle, enter a{' '}
      <span
        className={
          isLong ? 'font-semibold text-bullish' : 'font-semibold text-bearish'
        }
      >
        {isLong ? 'Long' : 'Short'}
      </span>{' '}
      position at <span className="font-medium text-fg">{orderLabel}</span>{' '}
      price.
      {indicatorList ? (
        <>
          {' '}
          <span className="text-fg-muted">
            Indicators:{' '}
            <span className="font-mono text-brand">{indicatorList}</span>.
          </span>
        </>
      ) : null}{' '}
      {exitNode}
    </p>
  );
}

/** Render the right-hand side of a ConditionRow as readable text. */
function describeRight(cond: ConditionRow): string {
  if (cond.right_type === 'number' && cond.right_number !== null) {
    return String(cond.right_number);
  }
  if (cond.right_type === 'indicator' && cond.right_indicator !== null) {
    return cond.right_indicator;
  }
  return '';
}

/** Exit-clause text varies by close-method type. */
function renderExitNarrative(closeMethod: CloseMethodForm) {
  const {
    type,
    tpEnabled,
    tpLevels,
    slEnabled,
    slValue,
    trailingEnabled,
    roiSteps,
    exitConditions,
  } = closeMethod;

  if (type === 'manual') {
    return (
      <span>
        Close trades <span className="font-medium text-fg">manually</span> —
        bot won&apos;t auto-exit.
      </span>
    );
  }

  if (type === 'tp_sl') {
    const firstTp = tpLevels[0];
    const totalTp = tpLevels.reduce((s, l) => s + (l.amount ?? 0), 0);
    return (
      <>
        {tpEnabled && firstTp ? (
          <>
            Take profit at{' '}
            <span className="font-mono font-medium text-bullish">
              +{firstTp.profit}%
            </span>{' '}
            ({firstTp.amount}% of size)
            {tpLevels.length > 1 ? (
              <span className="text-fg-muted">
                {' '}
                with {tpLevels.length - 1} more level
                {tpLevels.length - 1 === 1 ? '' : 's'} ({totalTp}% total)
              </span>
            ) : null}
            .{' '}
          </>
        ) : (
          <>Take profit is off.{' '}</>
        )}
        {slEnabled ? (
          <>
            Stop loss at{' '}
            <span className="font-mono font-medium text-bearish">
              {slValue}%
            </span>
            {trailingEnabled ? (
              <span className="text-fg-muted"> (trailing)</span>
            ) : null}
            .
          </>
        ) : (
          <>Stop loss is off.</>
        )}
      </>
    );
  }

  if (type === 'indicator') {
    const count = exitConditions.conditions.length;
    return (
      <>
        Exit when{' '}
        <span className="font-mono font-medium text-fg">
          {count} indicator rule{count === 1 ? '' : 's'}
        </span>{' '}
        fire.
      </>
    );
  }

  // roi
  return (
    <>
      Exit by ROI table with{' '}
      <span className="font-mono font-medium text-fg">{roiSteps.length}</span>{' '}
      step{roiSteps.length === 1 ? '' : 's'}.
    </>
  );
}
