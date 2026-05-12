/**
 * Cypheus's default starter template — Bollinger Breakout BTC.
 *
 * Historically this was the hard-coded `magic-build.script.ts` demo;
 * extracted into a template so users can pick it from the gallery and
 * snap-apply the same starter config.
 */
import type { BotTemplate } from '../types';
import { TEMPLATE_SCHEMA_VERSION } from '../types';

export const cypheusDefault: BotTemplate = {
  id: 'cypheus-default',
  name: 'Bollinger Breakout — BTC/USDC 5m',
  description:
    'Cypheus\'s starter bot: BTC/USDC scalping with RSI<30 entry on 5m.',
  longDescription:
    "A balanced demo strategy. Goes long when RSI dips below 30 (oversold) and " +
    "candle volume is rising. Exits via two-tier take-profit (5% / 10%) and a " +
    "−3% stop-loss. Cypheus's recommended starting point.",
  tags: ['btc', 'futures', 'breakout', 'rsi'],
  difficulty: 'intermediate',
  riskLevel: 'balanced',

  state: {
    botName: 'Bollinger Breakout',
    botConfig: {
      pair: 'BTC-USDC',
      timeframe: '5m',
      tradingMode: 'dry-run',
      leverage: 20,
      // Defaults below — kept stable across template loads.
      exchange: 'hyperliquid',
      marketType: 'futures',
      marginMode: 'cross',
      maxOpenTrades: 10,
      stakeCurrency: 'USDT',
      stakeAmount: 100,
      dryRunWallet: 1000,
    },
    strategy: {
      id: 'strategy-1',
      name: 'Bollinger Breakout',
      candlestick: ['close', 'volume'],
      indicators: [
        {
          id: 'cypheus-default-rsi-1',
          name: 'RSI',
          type: 'talib',
          parameters: { timeperiod: 14 },
        },
      ],
      entryConditions: {
        logic: { type: 'AND', threshold: null },
        conditions: [
          {
            id: 'cypheus-default-entry-1',
            left: 'RSI-14',
            op: '<',
            right_type: 'number',
            right_number: 30,
            right_indicator: null,
            lookback: 0,
          },
        ],
      },
      startupCandleCount: 200,
      informativeTimeframes: [],
    },
    directionForm: {
      direction: 'long',
      orderType: 'market',
      limitOffsetPct: null,
    },
    closeMethod: {
      type: 'tp_sl',
      tpEnabled: true,
      tpLevels: [
        { profit: 5, amount: 50 },
        { profit: 10, amount: 25 },
      ],
      slEnabled: true,
      slValue: -3,
      trailingEnabled: false,
      trailingPositive: 1,
      trailingOffset: 1.5,
      roiSteps: [],
      exitConditions: {
        logic: { type: 'AND', threshold: null },
        conditions: [],
      },
    },
  },

  meta: {
    author: 'Cypheus',
    schemaVersion: TEMPLATE_SCHEMA_VERSION,
    createdAt: '2026-04-30',
  },
};
