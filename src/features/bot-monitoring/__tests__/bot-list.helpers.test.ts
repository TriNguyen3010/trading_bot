import { describe, it, expect } from 'vitest';
import { zipBotsAndConfigs } from '../bot-list.helpers';

const bot = {
  id: 86,
  bot_name: 'Gamma',
  status: 'running',
  error_message: null,
  strategy_name: 'Gamma',
  created_at: '2026-05-15T00:00:00Z',
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
} as any;
const config = {
  dry_run: true,
  timeframe: '5m',
  exchange: { pair_whitelist: ['BTC/USDC:USDC'] },
  leverage: 10,
  stake_amount: 100,
  max_open_trades: 10,
  trading_mode: 'futures',
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
} as any;

describe('zipBotsAndConfigs config extraction', () => {
  it('pulls leverage/stake/max/tradingMode + createdAt', () => {
    const [row] = zipBotsAndConfigs([bot], [config]);
    expect(row.leverage).toBe(10);
    expect(row.stakeAmount).toBe(100);
    expect(row.maxOpenTrades).toBe(10);
    expect(row.tradingMode).toBe('futures');
    expect(row.createdAt).toBe('2026-05-15T00:00:00Z');
  });
  it('null-fills when config missing', () => {
    const [row] = zipBotsAndConfigs([bot], [null]);
    expect(row.leverage).toBeNull();
    expect(row.maxOpenTrades).toBeNull();
  });
});
