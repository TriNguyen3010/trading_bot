/**
 * 🧪 Test — Always-On BTC 1m.
 *
 * QA-only template, NOT a real strategy. Purpose: verify the live/dry-run
 * pipeline actually opens positions. The entry filter (RSI < 90) is true on
 * nearly every 1-minute candle, so the bot enters the moment it is flat; a
 * tight 0.5% take-profit + 2% stop-loss churns the position fast, so a new
 * trade opens right after each close → a steady stream of entries to confirm
 * the feature works. BTC/USDC is the most liquid Hyperliquid perp so fills
 * are reliable.
 *
 * Gated to dev builds only via `buildBuiltInTemplates()` in ../index.ts —
 * production builds strip it so a real user can never pick + Go Live on it.
 */
import type { BotTemplate } from '../types';
import { TEMPLATE_SCHEMA_VERSION } from '../types';

const ID = 'test-always-on-btc-1m';

export const testAlwaysOnBtc1m: BotTemplate = {
  id: ID,
  name: '🧪 Test — Always-On BTC 1m',
  description:
    'QA template: enters almost every 1m candle on BTC so you can verify the bot actually places trades. Not a real strategy.',
  longDescription:
    'Built to test the live/dry-run pipeline, not to make money. The entry ' +
    'filter "RSI < 90" is true on nearly every 1-minute candle, so the bot ' +
    'opens a long the moment it has no open trade. A tight 0.5% take-profit ' +
    '(closes 100%) and a 2% stop-loss churn the position quickly, so the next ' +
    'trade opens right after each close — giving a steady stream of entries to ' +
    'confirm the feature works end-to-end. BTC/USDC is the most liquid ' +
    'Hyperliquid perp, so fills are reliable. Low 2× leverage keeps it tame. ' +
    'Delete this template once testing is done.',
  tags: ['test', 'qa', 'debug', 'btc', '1m'],
  difficulty: 'beginner',
  riskLevel: 'aggressive',

  state: {
    botName: 'Test Always-On BTC',
    botConfig: {
      pair: 'BTC-USDC',
      timeframe: '1m',
      leverage: 2,
      exchange: 'hyperliquid',
      marketType: 'futures',
      marginMode: 'cross',
      maxOpenTrades: 1,
      stakeCurrency: 'USDC',
      stakeAmount: 100,
      dryRunWallet: 1000,
    },
    strategy: {
      id: 'strategy-1',
      name: 'Test Always-On',
      candlestick: ['close'],
      indicators: [
        {
          id: `${ID}-rsi`,
          name: 'RSI',
          type: 'talib',
          parameters: { timeperiod: 14 },
        },
      ],
      // "RSI < 90" is true on virtually every candle — the bot re-enters the
      // instant it is flat. This is deliberately a non-filter so trades fire
      // continuously; do NOT copy this into a real strategy.
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
                right_number: 90,
                right_indicator: null,
                lookback: 0,
              },
            ],
          },
        ],
      },
      startupCandleCount: 50,
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
      tpLevels: [{ profit: 0.5, amount: 100 }],
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
    createdAt: '2026-06-11',
  },
};
