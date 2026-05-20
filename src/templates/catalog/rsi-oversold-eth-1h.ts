/**
 * RSI Oversold — ETH/USDC 1h.
 *
 * Beginner-friendly mean-reversion. No leverage, single TP, fixed SL.
 * Designed as the most "boring" template in the catalog so first-time
 * users have somewhere safe to start.
 */
import type { BotTemplate } from '../types';
import { TEMPLATE_SCHEMA_VERSION } from '../types';

const ID = 'rsi-oversold-eth-1h';

export const rsiOversoldEth1h: BotTemplate = {
  id: ID,
  name: 'RSI Oversold — ETH/USDC 1h',
  description:
    'Buys ETH when RSI dips below 30 on the 1h chart. No leverage, simple TP/SL.',
  longDescription:
    'A classic mean-reversion play. The 1h timeframe smooths out noise ' +
    'and the RSI<30 threshold filters for genuine oversold dips. Single ' +
    '3% take-profit closes the whole position; a tight 2% stop-loss caps ' +
    'the downside. Suited to a beginner who wants to feel the basic flow ' +
    'before turning on leverage.',
  tags: ['eth', 'mean-reversion', 'rsi', 'futures', 'beginner'],
  difficulty: 'beginner',
  riskLevel: 'conservative',

  state: {
    botName: 'RSI Oversold ETH',
    botConfig: {
      pair: 'ETH-USDC',
      timeframe: '1h',
      tradingMode: 'dry-run',
      leverage: 1,
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
      name: 'RSI Oversold',
      candlestick: ['close'],
      indicators: [
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
                left: 'RSI-14',
                op: '<',
                right_type: 'number',
                right_number: 30,
                right_indicator: null,
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
      tpLevels: [{ profit: 3, amount: 100 }],
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
