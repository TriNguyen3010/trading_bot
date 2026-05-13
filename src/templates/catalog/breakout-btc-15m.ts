/**
 * Channel Breakout — BTC/USDC 15m.
 *
 * Trend + momentum entry: RSI > 60 AND price above the 50-period SMA.
 * Two-tier take-profit, mid-leverage. Bread-and-butter momentum trade.
 */
import type { BotTemplate } from '../types';
import { TEMPLATE_SCHEMA_VERSION } from '../types';

const ID = 'breakout-btc-15m';

export const breakoutBtc15m: BotTemplate = {
  id: ID,
  name: 'Channel Breakout — BTC/USDC 15m',
  description:
    'Goes long when RSI signals momentum AND price clears the 50-period SMA.',
  longDescription:
    "Classic breakout pattern. RSI above 60 means real buying pressure (not " +
    "just bouncing off oversold), and the candle closing above MA-50 confirms " +
    "the larger trend has flipped. Two-tier TP captures the breakout move " +
    "in halves; 5x leverage keeps risk in check while still punching meaningful PnL.",
  tags: ['btc', 'breakout', 'momentum', 'rsi', 'ma'],
  difficulty: 'intermediate',
  riskLevel: 'balanced',

  state: {
    botName: 'BTC Breakout',
    botConfig: {
      pair: 'BTC-USDC',
      timeframe: '15m',
      tradingMode: 'dry-run',
      leverage: 5,
      exchange: 'hyperliquid',
      marketType: 'futures',
      marginMode: 'cross',
      maxOpenTrades: 5,
      stakeCurrency: 'USDT',
      stakeAmount: 100,
      dryRunWallet: 1000,
    },
    strategy: {
      id: 'strategy-1',
      name: 'BTC Breakout',
      candlestick: ['close'],
      indicators: [
        {
          id: `${ID}-rsi`,
          name: 'RSI',
          type: 'talib',
          parameters: { timeperiod: 14 },
        },
        {
          id: `${ID}-ma`,
          name: 'MA',
          type: 'talib',
          parameters: { timeperiod: 50, price: 'close' },
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
                left: 'RSI-14',
                op: '>',
                right_type: 'number',
                right_number: 60,
                right_indicator: null,
                lookback: 0,
              },
              {
                id: `${ID}-cond-2`,
                left: 'candle.close',
                op: '>',
                right_type: 'indicator',
                right_number: null,
                right_indicator: 'MA-50',
                lookback: 0,
              },
            ],
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
        { profit: 4, amount: 50 },
        { profit: 8, amount: 50 },
      ],
      slEnabled: true,
      slValue: -2,
      trailingEnabled: false,
      trailingPositive: 1,
      trailingOffset: 1.5,
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
