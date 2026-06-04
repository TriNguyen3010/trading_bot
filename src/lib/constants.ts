/**
 * Static option lists used by the builder forms. Single source of truth
 * for the form selects.
 */

export const TIMEFRAMES = [
  { value: '1m', label: '1 minute' },
  { value: '5m', label: '5 minutes' },
  { value: '15m', label: '15 minutes' },
  { value: '30m', label: '30 minutes' },
  { value: '1h', label: '1 hour' },
  { value: '4h', label: '4 hours' },
  { value: '1d', label: '1 day' },
] as const;

export const STAKE_CURRENCIES = ['USDT', 'USDC', 'BUSD'] as const;

export const LEVERAGE_MIN = 1;
export const LEVERAGE_MAX = 50;

export const CANDLESTICK_OPTIONS: {
  value: 'open' | 'close' | 'high' | 'low' | 'volume';
  label: string;
}[] = [
  { value: 'open', label: 'Open' },
  { value: 'close', label: 'Close' },
  { value: 'high', label: 'High' },
  { value: 'low', label: 'Low' },
  { value: 'volume', label: 'Volume' },
];

/**
 * Pair suggestions = the BE-supported Hyperliquid top-100 perps (USDC-quoted).
 * Sourced from `BE/hyperliquid_top100_volume_by_dayNtlVlm.csv` via
 * `supported-pairs.ts`.
 */
export { SUPPORTED_PAIRS as PAIR_SUGGESTIONS } from './supported-pairs';
