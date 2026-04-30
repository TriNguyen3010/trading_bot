/**
 * MACD Momentum — BNB/USDC 30m.
 *
 * Aggressive momentum chase: enters when MACD is positive (line above
 * the zero baseline), with 10x leverage. Two-tier TP, tight SL.
 */
import type { BotTemplate } from '../types';
import { TEMPLATE_SCHEMA_VERSION } from '../types';

const ID = 'macd-momentum-bnb';

export const macdMomentumBnb: BotTemplate = {
  id: ID,
  name: 'MACD Momentum — BNB/USDC 30m',
  description:
    'Long when MACD line is positive — riding the momentum wave on BNB.',
  longDescription:
    "MACD positive = bulls in control. We enter long when the 12/26/9 MACD line " +
    "is above zero on the 30-minute chart. 10x leverage punches harder PnL but " +
    "the 3% stop-loss kicks fast if the wave breaks. Best on BNB which moves a " +
    "lot but rarely violently.",
  tags: ['bnb', 'momentum', 'macd', 'futures'],
  difficulty: 'intermediate',
  riskLevel: 'aggressive',

  state: {
    botName: 'BNB MACD Momentum',
    botConfig: {
      pair: 'BNB-USDC',
      timeframe: '30m',
      tradingMode: 'dry-run',
      leverage: 10,
      exchange: 'binance',
      marketType: 'futures',
      marginMode: 'cross',
      maxOpenTrades: 4,
      stakeCurrency: 'USDT',
      stakeAmount: 100,
      dryRunWallet: 1000,
    },
    strategy: {
      id: 'strategy-1',
      name: 'BNB MACD Momentum',
      candlestick: ['close'],
      indicators: [
        {
          id: `${ID}-macd`,
          name: 'MACD',
          type: 'talib',
          parameters: { fastperiod: 12, slowperiod: 26, signalperiod: 9 },
        },
      ],
      entryConditions: {
        logic: { type: 'AND', threshold: null },
        conditions: [
          {
            id: `${ID}-cond-1`,
            left: 'MACD-12-26-9',
            op: '>',
            right_type: 'number',
            right_number: 0,
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
      orderType: 'market',
      limitOffsetPct: null,
      slippageTolerance: 0.5,
    },
    closeMethod: {
      type: 'tp_sl',
      tpEnabled: true,
      tpLevels: [
        { profit: 5, amount: 50 },
        { profit: 10, amount: 50 },
      ],
      slEnabled: true,
      slValue: -3,
      trailingEnabled: false,
      trailingPositive: 1,
      trailingOffset: 1.5,
      roiSteps: [],
      exitConditions: { logic: { type: 'AND', threshold: null }, conditions: [] },
    },
  },

  script: {
    intro: 'Time for some momentum. MACD on BNB.',
    phaseNarration: {
      strategy: {
        postEntry: 'MACD line above zero = bulls in control. Simple and effective.',
        postClose: '5% / 10% TPs in halves. 3% SL catches you if the wave breaks.',
      },
    },
  },

  meta: {
    author: 'Cypheus',
    schemaVersion: TEMPLATE_SCHEMA_VERSION,
    createdAt: '2026-04-30',
  },
};
