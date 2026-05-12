/**
 * Steady DCA — BTC/USDC 1h.
 *
 * Spot, no leverage, tiny take-profit, deep stop-loss. The "buy the dip
 * and hold" philosophy expressed as a bot. Suited to people who think the
 * long-term BTC chart is up and to the right.
 */
import type { BotTemplate } from '../types';
import { TEMPLATE_SCHEMA_VERSION } from '../types';

const ID = 'conservative-dca-btc';

export const conservativeDcaBtc: BotTemplate = {
  id: ID,
  name: 'Steady DCA — BTC/USDC 1h',
  description:
    'Buys BTC dips on the 1h chart. Tiny TP, very wide SL — accumulate-then-hold.',
  longDescription:
    "Conservative dollar-cost-averaging. RSI<40 picks up dips that aren't quite " +
    "panic-level oversold. 1.5% take-profit sells partial gains; the deep -10% " +
    "stop-loss only triggers in a real crash, not on noise. Spot only — no " +
    "liquidation risk, no funding rates.",
  tags: ['btc', 'dca', 'spot', 'beginner'],
  difficulty: 'beginner',
  riskLevel: 'conservative',

  state: {
    botName: 'BTC Steady DCA',
    botConfig: {
      pair: 'BTC-USDC',
      timeframe: '1h',
      tradingMode: 'dry-run',
      leverage: 1,
      exchange: 'hyperliquid',
      marketType: 'spot',
      marginMode: 'cross',
      maxOpenTrades: 5,
      stakeCurrency: 'USDT',
      stakeAmount: 100,
      dryRunWallet: 1000,
    },
    strategy: {
      id: 'strategy-1',
      name: 'Steady DCA',
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
        logic: { type: 'AND', threshold: null },
        conditions: [
          {
            id: `${ID}-cond-1`,
            left: 'RSI-14',
            op: '<',
            right_type: 'number',
            right_number: 40,
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
      tpLevels: [{ profit: 1.5, amount: 100 }],
      slEnabled: true,
      slValue: -10,
      trailingEnabled: false,
      trailingPositive: 1,
      trailingOffset: 1.5,
      roiSteps: [],
      exitConditions: { logic: { type: 'AND', threshold: null }, conditions: [] },
    },
  },

  script: {
    intro: ['Steady wins the race.', 'Setting up a buy-the-dip DCA on BTC spot.'],
    phaseNarration: {
      botBasics: { post: 'Spot only. No leverage. No liquidation risk.' },
      strategy: {
        postClose:
          'Tiny 1.5% TP for frequent wins. Wide -10% SL only triggers in a real crash.',
      },
    },
  },

  meta: {
    author: 'Cypheus',
    schemaVersion: TEMPLATE_SCHEMA_VERSION,
    createdAt: '2026-04-30',
  },
};
