/**
 * Quick ROI Scalp — ETH/USDC 5m.
 *
 * The catalog's only ROI-exit example. Limit buys a hair below market to
 * catch small dips, then exits via a time-decaying ROI table instead of a
 * fixed TP/SL. 1× futures (no real leverage). Frequent small wins.
 *
 * (Replaces the old "stablecoin grid" template — Hyperliquid is perp-only
 * and has no USDC/USDT market, so that pair could never trade. ETH/USDC is
 * a real, liquid perp while keeping the same loose-entry + ROI-exit shape.)
 */
import type { BotTemplate } from '../types';
import { TEMPLATE_SCHEMA_VERSION } from '../types';

const ID = 'roi-scalp-eth-5m';

export const roiScalpEth5m: BotTemplate = {
  id: ID,
  name: 'Quick ROI Scalp — ETH/USDC 5m',
  description:
    'Limit-buys small ETH dips and exits via a time-decaying ROI table. Frequent small wins.',
  longDescription:
    'A gentle scalp built around the ROI close-method instead of TP/SL. A limit ' +
    'order 0.05% below market catches micro-dips, then the ROI table takes profit: ' +
    '0.5% immediately, easing to break-even after 2 hours so winners are not held ' +
    'too long. RSI<55 is a loose "not overbought" filter, not a strict signal — the ' +
    'point is to be in the market often. 1× leverage on ETH/USDC futures keeps risk ' +
    'low. The simplest way to see ROI-based exits in action.',
  tags: ['eth', 'roi', 'scalp', 'beginner'],
  difficulty: 'beginner',
  riskLevel: 'conservative',

  state: {
    botName: 'ETH ROI Scalp',
    botConfig: {
      pair: 'ETH-USDC',
      timeframe: '5m',
      leverage: 1,
      exchange: 'hyperliquid',
      marketType: 'futures',
      marginMode: 'cross',
      maxOpenTrades: 5,
      stakeCurrency: 'USDC',
      stakeAmount: 100,
      dryRunWallet: 1000,
    },
    strategy: {
      id: 'strategy-1',
      name: 'ETH ROI Scalp',
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
      // ROI scalps don't need a strict entry, just something that keeps the
      // bot in the market and satisfies the validator.
      entryConditions: {
        groupConnector: 'AND',
        groups: [
          {
            id: `${ID}-grp-1`,
            intraConnector: 'AND',
            rules: [
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
        ],
      },
      startupCandleCount: 100,
      informativeTimeframes: [],
    },
    directionForm: {
      direction: 'long',
      orderType: 'limit',
      limitOffsetPct: -0.05,
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
      // roi is a percentage in builder state (serializer divides by 100).
      // 0.5% / 0.3% / 0.1% targets — NOT 0.005 (which would ship 0.005%).
      roiSteps: [
        { minutes: 0, roi: 0.5 },
        { minutes: 30, roi: 0.3 },
        { minutes: 60, roi: 0.1 },
        { minutes: 120, roi: 0 },
      ],
      exitConditions: { groupConnector: 'AND', groups: [] },
    },
  },

  meta: {
    author: 'Cypheus',
    schemaVersion: TEMPLATE_SCHEMA_VERSION,
    createdAt: '2026-04-30',
    updatedAt: '2026-06-11',
  },
};
