/**
 * Cypheus's default starter template — RSI Dip BTC.
 * The canonical starting point surfaced in the gallery.
 */
import type { BotTemplate } from '../types';
import { TEMPLATE_SCHEMA_VERSION } from '../types';

export const cypheusDefault: BotTemplate = {
  id: 'cypheus-default',
  name: 'RSI Dip — BTC/USDC 5m',
  description:
    "Cypheus's starter bot: goes long on BTC when RSI dips below 30 on the 5m chart.",
  longDescription:
    'A balanced demo strategy. Goes long when RSI dips below 30 (oversold) on the ' +
    '5-minute chart, then exits via a two-tier take-profit (5% / 10%) and a −3% ' +
    "stop-loss. Cypheus's recommended starting point — simple enough to read " +
    'end-to-end before you start customising.',
  tags: ['btc', 'futures', 'rsi', 'mean-reversion'],
  difficulty: 'intermediate',
  riskLevel: 'balanced',

  state: {
    botName: 'RSI Dip BTC',
    botConfig: {
      pair: 'BTC-USDC',
      timeframe: '5m',
      leverage: 20,
      // Defaults below — kept stable across template loads.
      exchange: 'hyperliquid',
      marketType: 'futures',
      marginMode: 'cross',
      maxOpenTrades: 10,
      stakeCurrency: 'USDC',
      stakeAmount: 100,
      dryRunWallet: 1000,
    },
    strategy: {
      id: 'strategy-1',
      name: 'RSI Dip',
      // 'volume' is exposed as a price channel but unused by the RSI-only
      // entry below — kept so the summary still lists it as available data.
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
        groupConnector: 'AND',
        groups: [
          {
            id: 'cypheus-default-grp-1',
            intraConnector: 'AND',
            rules: [
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
      exitConditions: { groupConnector: 'AND', groups: [] },
    },
  },

  meta: {
    author: 'Cypheus',
    schemaVersion: TEMPLATE_SCHEMA_VERSION,
    createdAt: '2026-04-30',
  },
};
