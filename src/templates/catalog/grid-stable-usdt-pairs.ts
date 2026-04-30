/**
 * Grid Trading — USDC/USDT (stablecoin) 5m.
 *
 * Spot grid using the ROI close-method instead of TP/SL. Targets the
 * micro-spread on a stablecoin pair. No leverage, no SL, time-decaying
 * profit target — exits via ROI table after each step.
 */
import type { BotTemplate } from '../types';
import { TEMPLATE_SCHEMA_VERSION } from '../types';

const ID = 'grid-stable-usdt-pairs';

export const gridStableUsdtPairs: BotTemplate = {
  id: ID,
  name: 'Grid Trading — USDC/USDT 5m',
  description:
    'Spot stablecoin grid. Limit buys with a small offset, time-decaying ROI exit.',
  longDescription:
    "Grid bots farm tiny spreads on highly stable pairs. We use a limit order " +
    "0.05% below market to catch micro-dips, then exit via the ROI table — 0.5% " +
    "target immediately, falling to break-even after 2 hours. Spot only, no " +
    "leverage. Boring is the feature, not the bug.",
  tags: ['stable', 'grid', 'roi', 'spot', 'beginner'],
  difficulty: 'beginner',
  riskLevel: 'conservative',

  state: {
    botName: 'USDC/USDT Grid',
    botConfig: {
      pair: 'USDC-USDT',
      timeframe: '5m',
      tradingMode: 'dry-run',
      leverage: 1,
      exchange: 'binance',
      marketType: 'spot',
      marginMode: 'cross',
      maxOpenTrades: 10,
      stakeCurrency: 'USDT',
      stakeAmount: 100,
      dryRunWallet: 1000,
    },
    strategy: {
      id: 'strategy-1',
      name: 'Stable Grid',
      candlestick: ['close'],
      indicators: [
        {
          id: `${ID}-rsi`,
          name: 'RSI',
          type: 'talib',
          parameters: { timeperiod: 14 },
        },
      ],
      // Loose entry filter — RSI<55 is "anywhere except clearly overbought".
      // Grid bots don't really need a strict entry, just something that
      // satisfies the validator.
      entryConditions: {
        logic: { type: 'AND', threshold: null },
        conditions: [
          {
            id: `${ID}-cond-1`,
            left: 'RSI-14',
            op: '<',
            right_type: 'number',
            right_number: 55,
            right_indicator: null,
            lookback: 0,
          },
        ],
      },
      startupCandleCount: 100,
      informativeTimeframes: [],
    },
    directionForm: {
      direction: 'long',
      orderType: 'limit',
      limitOffsetPct: -0.05,
      slippageTolerance: 0.1,
    },
    closeMethod: {
      type: 'roi',
      tpEnabled: false,
      tpLevels: [],
      slEnabled: false,
      slValue: 0,
      // Trailing is OFF, but the values still flow through the serializer.
      // Keep them at the canonical defaults so they pass the Zod refinement
      // (`trailing_stop_positive_offset > trailing_stop_positive`).
      trailingEnabled: false,
      trailingPositive: 1,
      trailingOffset: 1.5,
      roiSteps: [
        { minutes: 0, roi: 0.005 },
        { minutes: 30, roi: 0.003 },
        { minutes: 60, roi: 0.001 },
        { minutes: 120, roi: 0 },
      ],
      exitConditions: { logic: { type: 'AND', threshold: null }, conditions: [] },
    },
  },

  meta: {
    author: 'Cypheus',
    schemaVersion: TEMPLATE_SCHEMA_VERSION,
    createdAt: '2026-04-30',
  },
};
