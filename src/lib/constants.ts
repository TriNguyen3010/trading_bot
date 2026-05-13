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

export const CANDLESTICK_OPTIONS: { value: 'open' | 'close' | 'high' | 'low' | 'volume'; label: string }[] = [
  { value: 'open', label: 'Open' },
  { value: 'close', label: 'Close' },
  { value: 'high', label: 'High' },
  { value: 'low', label: 'Low' },
  { value: 'volume', label: 'Volume' },
];

/** Pair suggestions until the CSV converter arrives from the user. */
export const PAIR_SUGGESTIONS = [
  'BTC-USDC',
  'BTC-USDT',
  'ETH-USDT',
  'ETH-USDC',
  'SOL-USDT',
  'BNB-USDT',
  'XRP-USDT',
];
