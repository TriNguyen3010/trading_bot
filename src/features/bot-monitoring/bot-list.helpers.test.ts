import { describe, it, expect } from 'vitest';
import {
  deriveMode,
  derivePair,
  deriveTimeframe,
  zipBotsAndConfigs,
  type ConfigShape,
} from './bot-list.helpers';
import type { BotOut } from './bot.api';

function makeBot(over: Partial<BotOut> = {}): BotOut {
  return {
    id: 1,
    status: 'stopped',
    bot_name: 'Test bot',
    desired_status: null,
    error_message: null,
    strategy_name: 'TestStrat',
    ...over,
  };
}

function makeConfig(over: Partial<ConfigShape> = {}): ConfigShape {
  return {
    dry_run: true,
    timeframe: '5m',
    exchange: { pair_whitelist: ['BTC/USDT'] },
    ...over,
  };
}

describe('deriveMode', () => {
  it('returns ERROR when error_message is present', () => {
    expect(
      deriveMode(makeBot({ error_message: 'rejected' }), makeConfig()),
    ).toBe('ERROR');
  });
  it('returns LIVE when running and dry_run=false', () => {
    expect(
      deriveMode(
        makeBot({ status: 'running' }),
        makeConfig({ dry_run: false }),
      ),
    ).toBe('LIVE');
  });
  it('returns DRY-RUN when running and dry_run=true', () => {
    expect(
      deriveMode(makeBot({ status: 'running' }), makeConfig({ dry_run: true })),
    ).toBe('DRY-RUN');
  });
  it('returns PAUSED for any other status', () => {
    expect(deriveMode(makeBot({ status: 'stopped' }), makeConfig())).toBe(
      'PAUSED',
    );
    expect(deriveMode(makeBot({ status: 'idle' }), makeConfig())).toBe(
      'PAUSED',
    );
  });
  it('handles null config (treats as PAUSED unless explicitly error)', () => {
    expect(deriveMode(makeBot({ status: 'running' }), null)).toBe('PAUSED');
    expect(deriveMode(makeBot({ error_message: 'x' }), null)).toBe('ERROR');
  });
});

describe('derivePair', () => {
  it('extracts and formats the first pair from pair_whitelist', () => {
    expect(
      derivePair(makeConfig({ exchange: { pair_whitelist: ['BTC/USDT'] } })),
    ).toBe('BTC-USDT');
  });
  it('returns "?" when pair_whitelist is missing', () => {
    expect(derivePair(makeConfig({ exchange: {} }))).toBe('?');
  });
  it('returns "?" when config is null', () => {
    expect(derivePair(null)).toBe('?');
  });
});

describe('deriveTimeframe', () => {
  it('returns config.timeframe when present', () => {
    expect(deriveTimeframe(makeConfig({ timeframe: '1h' }))).toBe('1h');
  });
  it('returns "?" when config is null', () => {
    expect(deriveTimeframe(null)).toBe('?');
  });
});

describe('zipBotsAndConfigs', () => {
  it('zips bots and configs into DashboardBot[]', () => {
    const bots = [
      makeBot({ id: 1 }),
      makeBot({ id: 2, status: 'running', error_message: null }),
    ];
    const configs = [
      makeConfig({ timeframe: '5m' }),
      makeConfig({ timeframe: '1h', dry_run: false }),
    ];

    const result = zipBotsAndConfigs(bots, configs);

    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({
      id: 1,
      name: 'Test bot',
      mode: 'PAUSED',
      pair: 'BTC-USDT',
      timeframe: '5m',
      isDemo: false,
    });
    expect(result[1].mode).toBe('LIVE');
  });

  it('falls back gracefully when a config is null', () => {
    const bots = [makeBot({ id: 5 })];
    const result = zipBotsAndConfigs(bots, [null]);
    expect(result[0].pair).toBe('?');
    expect(result[0].timeframe).toBe('?');
  });

  it('uses "Bot #<id>" when bot_name is null', () => {
    const bots = [makeBot({ id: 7, bot_name: null })];
    expect(zipBotsAndConfigs(bots, [null])[0].name).toBe('Bot #7');
  });
});
