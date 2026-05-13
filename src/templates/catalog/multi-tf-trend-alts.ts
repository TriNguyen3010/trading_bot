/**
 * Multi-TF Trend — SOL/USDC 4h with 1d informative.
 *
 * Advanced template: long-period MA (200) + RSI filter, plus the daily
 * informative timeframe so the strategy has higher-context awareness
 * when grading entries. Trailing stop locks in profits as the trend extends.
 */
import type { BotTemplate } from '../types';
import { TEMPLATE_SCHEMA_VERSION } from '../types';

const ID = 'multi-tf-trend-alts';

export const multiTfTrendAlts: BotTemplate = {
  id: ID,
  name: 'Multi-TF Trend — SOL/USDC 4h',
  description:
    'Long-period MA + RSI on the 4h chart with a 1d informative timeframe.',
  longDescription:
    "Built for swing-trading altcoins on the 4h. The 200-MA + 1d informative " +
    "context filters out chop, and only buys when both RSI and price are above " +
    "the longer-term trend. Two-tier TP plus a trailing stop captures most of " +
    "the move once it gets going.",
  tags: ['sol', 'altcoin', 'trend', 'multi-timeframe', 'futures', 'advanced'],
  difficulty: 'advanced',
  riskLevel: 'balanced',

  state: {
    botName: 'SOL Multi-TF Trend',
    botConfig: {
      pair: 'SOL-USDC',
      timeframe: '4h',
      tradingMode: 'dry-run',
      leverage: 3,
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
      name: 'SOL Multi-TF Trend',
      candlestick: ['close'],
      indicators: [
        {
          id: `${ID}-ma200`,
          name: 'MA',
          type: 'talib',
          parameters: { timeperiod: 200, price: 'close' },
        },
        {
          id: `${ID}-rsi`,
          name: 'RSI',
          type: 'talib',
          parameters: { timeperiod: 14 },
        },
      ],
      entryConditions: {
        groupConnector: 'AND',
        groups: [
          {
            id: `${ID}-grp-1`,
            intraConnector: 'AND',
            rules: [
              {
                id: `${ID}-cond-1`,
                left: 'candle.close',
                op: '>',
                right_type: 'indicator',
                right_number: null,
                right_indicator: 'MA-200',
                lookback: 0,
              },
              {
                id: `${ID}-cond-2`,
                left: 'RSI-14',
                op: '>',
                right_type: 'number',
                right_number: 50,
                right_indicator: null,
                lookback: 0,
              },
            ],
          },
        ],
      },
      startupCandleCount: 250,
      informativeTimeframes: ['1d'],
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
        { profit: 8, amount: 60 },
        { profit: 15, amount: 40 },
      ],
      slEnabled: true,
      slValue: -5,
      trailingEnabled: true,
      trailingPositive: 2,
      trailingOffset: 3,
      roiSteps: [],
      exitConditions: { groupConnector: 'AND', groups: [] },
    },
  },

  meta: {
    author: 'Cypheus',
    schemaVersion: TEMPLATE_SCHEMA_VERSION,
    createdAt: '2026-04-30',
  },
};
