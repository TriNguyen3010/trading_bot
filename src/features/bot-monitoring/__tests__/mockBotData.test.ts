import { describe, it, expect } from 'vitest';
import { generateMockFills, generateSnapshot } from '../mockBotData';

describe('mockBotData', () => {
  const botId = 'bot-1';
  const deployedAt = new Date('2026-04-23T00:00:00Z').getTime();
  const now = new Date('2026-05-05T14:32:00Z').getTime();

  it('produces deterministic fills for same seed', () => {
    const a = generateMockFills(botId, deployedAt, now);
    const b = generateMockFills(botId, deployedAt, now);
    expect(a).toEqual(b);
    expect(a.length).toBeGreaterThan(0);
  });

  it('different botId yields different fills', () => {
    const a = generateMockFills('bot-1', deployedAt, now);
    const b = generateMockFills('bot-2', deployedAt, now);
    expect(a[0]?.id).not.toEqual(b[0]?.id);
  });

  it('snapshot reflects fills', () => {
    const fills = generateMockFills(botId, deployedAt, now);
    const snap = generateSnapshot(fills, now);
    expect(snap.totalTrades).toBe(fills.filter(f => f.closedAt !== null).length);
    expect(snap.totalPnL).toBeCloseTo(fills.reduce((s, f) => s + f.pnl, 0), 2);
  });

  it('returns empty fills when bot just deployed', () => {
    const justDeployed = now - 60_000;  // 1m ago
    const fills = generateMockFills(botId, justDeployed, now);
    expect(fills).toEqual([]);
  });
});
