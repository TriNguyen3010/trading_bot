import { describe, it, expect } from 'vitest';
import { generateEventNarrations, bootstrapNarrative } from '../cypheusEvents';
import type { Fill, PerformanceSnapshot } from '../types';

const baseSnap: PerformanceSnapshot = {
  totalPnL: 1000,
  todayPnL: 100,
  todayPnLPct: 10,
  totalPct: 10,
  winRate: 0.6,
  totalTrades: 10,
  wins: 6,
  losses: 4,
  avgRR: 2.1,
  openPositions: 0,
  openExposure: 0,
  winStreak: 5,
  bestDay: 200,
  worstDay: -50,
};

const NOW = new Date('2026-05-06T10:00:00Z').getTime();

describe('cypheusEvents · generateEventNarrations', () => {
  it('emits scanning when phase=just-deployed', () => {
    const msgs = generateEventNarrations({
      prevSnap: null,
      nextSnap: baseSnap,
      prevFills: [],
      nextFills: [],
      phase: 'just-deployed',
      now: NOW,
    });
    expect(msgs.some((m) => m.type === 'scan')).toBe(true);
    // Should not emit other event types when scanning.
    expect(msgs.every((m) => m.type === 'scan')).toBe(true);
  });

  it('emits position.opened on new OPEN fill', () => {
    const fill: Fill = {
      id: 'f1',
      openedAt: NOW,
      closedAt: null,
      side: 'LONG',
      pair: 'BTC-USDC',
      entryPrice: 67000,
      exitPrice: null,
      pnl: 0,
      status: 'OPEN',
      cycleId: 1,
    };
    const msgs = generateEventNarrations({
      prevSnap: baseSnap,
      nextSnap: baseSnap,
      prevFills: [],
      nextFills: [fill],
      phase: 'mature',
      now: NOW,
    });
    const opened = msgs.find((m) => m.type === 'position-opened');
    expect(opened).toBeDefined();
    expect(opened!.text).toContain('LONG');
    expect(opened!.text).toContain('67,000');
  });

  it('emits tp-hit when fill closes profitable', () => {
    const openFill: Fill = {
      id: 'f2',
      openedAt: NOW - 10_000,
      closedAt: null,
      side: 'LONG',
      pair: 'BTC-USDC',
      entryPrice: 67000,
      exitPrice: null,
      pnl: 0,
      status: 'OPEN',
      cycleId: 2,
    };
    const closedFill: Fill = {
      ...openFill,
      closedAt: NOW,
      exitPrice: 67300,
      pnl: 150,
      status: 'TP1',
    };
    const msgs = generateEventNarrations({
      prevSnap: baseSnap,
      nextSnap: { ...baseSnap, totalPnL: 1150 },
      prevFills: [openFill],
      nextFills: [closedFill],
      phase: 'mature',
      now: NOW,
    });
    const tp = msgs.find((m) => m.type === 'tp-hit');
    expect(tp).toBeDefined();
    expect(tp!.text).toContain('TP1');
    expect(tp!.text).toContain('150');
  });

  it('emits sl-hit when fill closes at a loss', () => {
    const openFill: Fill = {
      id: 'f3',
      openedAt: NOW - 5_000,
      closedAt: null,
      side: 'LONG',
      pair: 'BTC-USDC',
      entryPrice: 67000,
      exitPrice: null,
      pnl: 0,
      status: 'OPEN',
      cycleId: 3,
    };
    const closedFill: Fill = {
      ...openFill,
      closedAt: NOW,
      exitPrice: 66800,
      pnl: -42,
      status: 'SL',
    };
    const msgs = generateEventNarrations({
      prevSnap: baseSnap,
      nextSnap: { ...baseSnap, totalPnL: 958 },
      prevFills: [openFill],
      nextFills: [closedFill],
      phase: 'mature',
      now: NOW,
    });
    const sl = msgs.find((m) => m.type === 'sl-hit');
    expect(sl).toBeDefined();
    expect(sl!.text).toContain('42');
  });

  it('emits streak-milestone when streak reaches new high', () => {
    const msgs = generateEventNarrations({
      prevSnap: { ...baseSnap, winStreak: 11 },
      nextSnap: { ...baseSnap, winStreak: 12 },
      prevFills: [],
      nextFills: [],
      phase: 'mature',
      now: NOW,
    });
    const streak = msgs.find((m) => m.type === 'streak-milestone');
    expect(streak).toBeDefined();
    expect(streak!.text).toContain('12');
  });

  it('emits anomaly on 3+ consecutive losses', () => {
    const losses: Fill[] = Array.from({ length: 3 }).map((_, i) => ({
      id: `l${i}`,
      openedAt: NOW - i * 1000,
      closedAt: NOW - i * 500,
      side: 'LONG' as const,
      pair: 'BTC-USDC',
      entryPrice: 67000,
      exitPrice: 66900,
      pnl: -50,
      status: 'SL' as const,
      cycleId: i,
    }));
    const msgs = generateEventNarrations({
      prevSnap: baseSnap,
      nextSnap: baseSnap,
      prevFills: [],
      nextFills: losses,
      phase: 'mature',
      now: NOW,
    });
    expect(msgs.some((m) => m.type === 'anomaly')).toBe(true);
  });

  it('emits pnl-milestone when crossing $1k threshold', () => {
    const msgs = generateEventNarrations({
      prevSnap: { ...baseSnap, totalPnL: 950 },
      nextSnap: { ...baseSnap, totalPnL: 1050 },
      prevFills: [],
      nextFills: [],
      phase: 'mature',
      now: NOW,
    });
    const milestone = msgs.find((m) => m.type === 'pnl-milestone');
    expect(milestone).toBeDefined();
    expect(milestone!.text).toContain('1,000');
  });

  it('emits no events when nothing changed', () => {
    const fills: Fill[] = [];
    const msgs = generateEventNarrations({
      prevSnap: baseSnap,
      nextSnap: baseSnap,
      prevFills: fills,
      nextFills: fills,
      phase: 'mature',
      now: NOW,
    });
    expect(msgs).toEqual([]);
  });
});

describe('cypheusEvents · bootstrapNarrative', () => {
  it('always emits a scan message', () => {
    const msgs = bootstrapNarrative(baseSnap, []);
    expect(msgs.some((m) => m.type === 'scan')).toBe(true);
  });

  it('emits streak milestone for active streaks', () => {
    const msgs = bootstrapNarrative({ ...baseSnap, winStreak: 12 }, []);
    expect(msgs.some((m) => m.type === 'streak-milestone')).toBe(true);
  });

  it('skips streak when below threshold', () => {
    const msgs = bootstrapNarrative({ ...baseSnap, winStreak: 2 }, []);
    expect(msgs.some((m) => m.type === 'streak-milestone')).toBe(false);
  });

  it('uses last closed fill for tp/sl bootstrap', () => {
    const winFill: Fill = {
      id: 'b1',
      openedAt: NOW - 60_000,
      closedAt: NOW - 30_000,
      side: 'LONG',
      pair: 'BTC-USDC',
      entryPrice: 67000,
      exitPrice: 67500,
      pnl: 250,
      status: 'TP1',
      cycleId: 1,
    };
    const msgs = bootstrapNarrative(baseSnap, [winFill]);
    expect(msgs.some((m) => m.type === 'tp-hit')).toBe(true);
  });
});
