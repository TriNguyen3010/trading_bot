import type { BuilderState } from '@/types/builder.types';
import { toPythonClassName } from '@/lib/serializer';
import { ruleCount } from '@/lib/condition-tree';

export interface DeploySummary {
  botName: string;
  /** Raw pair as stored, e.g. "SOL/USDC:USDC" */
  pair: string;
  /** Display pair without settlement suffix, e.g. "SOL/USDC" */
  pairDisplay: string;
  pairBase: string;
  pairQuote: string;
  timeframe: string;
  exchangeId: string;
  exchangeLabel: string;
  stakeAmount: number;
  stakeCurrency: string;
  maxOpenTrades: number;
  leverage: number;
  /** stakeAmount × maxOpenTrades — capital at full exposure */
  maxExposure: number;
  dryRun: boolean;
  dryRunWallet: number;
  marketType: 'spot' | 'futures';
  marginMode: 'cross' | 'isolated';
  /** Hard-coded in serializer at 0.05 = 5% */
  liquidationBuffer: number;
  direction: 'long' | 'short';
  canShort: boolean;
  strategyDisplayName: string;
  /** PascalCase Python-class id used by BE */
  strategyClassName: string;
  /** Short auto-generated description: counts of indicators, entry/exit
   * conditions, close-method type. Stays honest about what's configured. */
  strategyMeta: string;
}

const EXCHANGE_LABELS: Record<string, string> = {
  hyperliquid: 'Hyperliquid',
  binance: 'Binance',
  bybit: 'Bybit',
  okx: 'OKX',
};

function splitPair(pair: string): {
  base: string;
  quote: string;
  display: string;
} {
  const beforeSettlement = pair.split(':')[0] ?? pair;
  const [base = '', quote = ''] = beforeSettlement.split('/');
  return { base, quote, display: beforeSettlement || pair };
}

function describeCloseMethod(
  type: BuilderState['closeMethod']['type'],
): string {
  switch (type) {
    case 'tp_sl':
      return 'TP/SL';
    case 'roi':
      return 'ROI ladder';
    case 'indicator':
      return 'indicator exit';
    case 'manual':
      return 'manual';
    default:
      return type;
  }
}

export function getDeploySummary(state: BuilderState): DeploySummary {
  const c = state.botConfig;
  const { base, quote, display } = splitPair(c.pair);
  const direction = state.directionForm.direction;
  const closeType = state.closeMethod.type;

  const indicatorCount = state.strategy.indicators.length;
  const entryConditionCount = ruleCount(state.strategy.entryConditions);

  const metaParts: string[] = [];
  if (indicatorCount > 0) {
    metaParts.push(
      `${indicatorCount} indicator${indicatorCount === 1 ? '' : 's'}`,
    );
  }
  if (entryConditionCount > 0) {
    metaParts.push(
      `${entryConditionCount} entry condition${entryConditionCount === 1 ? '' : 's'}`,
    );
  }
  metaParts.push(`${describeCloseMethod(closeType)} exit`);

  return {
    botName: state.botName,
    pair: c.pair,
    pairDisplay: display,
    pairBase: base,
    pairQuote: quote,
    timeframe: c.timeframe,
    exchangeId: c.exchange,
    exchangeLabel: EXCHANGE_LABELS[c.exchange] ?? c.exchange,
    stakeAmount: c.stakeAmount,
    stakeCurrency: c.stakeCurrency,
    maxOpenTrades: c.maxOpenTrades,
    leverage: c.leverage,
    maxExposure: c.stakeAmount * c.maxOpenTrades,
    dryRun: c.tradingMode === 'dry-run',
    dryRunWallet: c.dryRunWallet,
    marketType: c.marketType,
    marginMode: c.marginMode,
    liquidationBuffer: 0.05,
    direction,
    canShort: direction === 'short',
    strategyDisplayName: state.strategy.name || state.botName,
    strategyClassName: toPythonClassName(state.strategy.name || state.botName),
    strategyMeta: metaParts.join(' · '),
  };
}
