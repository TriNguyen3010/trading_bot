/**
 * High-Freq Scalping — BTC/USDC 1m.
 *
 * 1-minute candles, 20x leverage, two-tier tight TP, very tight SL.
 * RSI oversold + price above MA-20 (a momentum filter) ensures the
 * dip is a healthy correction, not a falling knife.
 */
import type { BotTemplate } from '../types';
import { TEMPLATE_SCHEMA_VERSION } from '../types';

const ID = 'scalping-btc-1m';

export const scalpingBtc1m: BotTemplate = {
  id: ID,
  name: 'High-Freq Scalping — BTC 1m',
  description:
    '1m timeframe, 20x leverage. RSI<25 + close above MA-20 — fast in, faster out.',
  longDescription:
    "Aggressive 1-minute scalp. Enters on deep RSI oversold (<25) BUT only when " +
    "price is still above the short MA-20 — meaning the dip is a correction inside " +
    "a healthy uptrend, not a top. Tight 0.5% / 1% TP and a hair-trigger 0.3% SL. " +
    "20x leverage. Not for the faint of heart.",
  tags: ['btc', 'scalping', '1m', 'high-leverage', 'futures', 'advanced'],
  difficulty: 'advanced',
  riskLevel: 'aggressive',

  state: {
    botName: 'BTC 1m Scalper',
    botConfig: {
      pair: 'BTC-USDC',
      timeframe: '1m',
      tradingMode: 'dry-run',
      leverage: 20,
      exchange: 'hyperliquid',
      marketType: 'futures',
      marginMode: 'cross',
      maxOpenTrades: 3,
      stakeCurrency: 'USDT',
      stakeAmount: 100,
      dryRunWallet: 1000,
    },
    strategy: {
      id: 'strategy-1',
      name: 'BTC 1m Scalper',
      candlestick: ['close', 'volume'],
      indicators: [
        {
          id: `${ID}-rsi`,
          name: 'RSI',
          type: 'talib',
          parameters: { timeperiod: 14 },
        },
        {
          id: `${ID}-ma20`,
          name: 'MA',
          type: 'talib',
          parameters: { timeperiod: 20, price: 'close' },
        },
      ],
      entryConditions: {
        logic: { type: 'AND', threshold: null },
        conditions: [
          {
            id: `${ID}-cond-1`,
            left: 'RSI-14',
            op: '<',
            right_type: 'number',
            right_number: 25,
            right_indicator: null,
            lookback: 0,
          },
          {
            id: `${ID}-cond-2`,
            left: 'candle.close',
            op: '>',
            right_type: 'indicator',
            right_number: null,
            right_indicator: 'MA-20',
            lookback: 0,
            operator: 'AND',
          },
        ],
      },
      startupCandleCount: 60,
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
        { profit: 0.5, amount: 70 },
        { profit: 1, amount: 30 },
      ],
      slEnabled: true,
      slValue: -0.3,
      trailingEnabled: false,
      trailingPositive: 0.1,
      trailingOffset: 0.2,
      roiSteps: [],
      exitConditions: { logic: { type: 'AND', threshold: null }, conditions: [] },
    },
  },

  meta: {
    author: 'Cypheus',
    schemaVersion: TEMPLATE_SCHEMA_VERSION,
    createdAt: '2026-04-30',
  },
};
