import { describe, it, expect } from 'vitest';
import { summarizeHistory, pickDefaultRunId } from '../backtest-history';

const items = [
  {
    id: 200,
    status: 'completed',
    strategy_name: 'Gamma',
    timerange: '20260427-20260527',
    timeframe: '5m',
    trade_count: 104,
    win_rate: 44.23,
    total_profit: -36.59,
    started_at: '2026-05-27T07:27:25Z',
    completed_at: '2026-05-27T07:28:05Z',
  },
  {
    id: 312,
    status: 'running',
    timerange: '20260501-20260601',
    timeframe: '5m',
    trade_count: null,
    win_rate: null,
    total_profit: null,
    started_at: '2026-06-02T00:00:00Z',
    completed_at: null,
  },
  {
    id: 305,
    status: 'failed',
    timerange: '20260401-20260501',
    timeframe: '5m',
    trade_count: null,
    win_rate: null,
    total_profit: null,
    started_at: '2026-06-01T00:00:00Z',
    completed_at: null,
  },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
] as any;

describe('summarizeHistory', () => {
  it('maps each item to a row summary; date = completed_at ?? started_at; carries strategyName', () => {
    const rows = summarizeHistory(items);
    expect(rows).toHaveLength(3);
    const r200 = rows.find((r) => r.id === 200)!;
    expect(r200.status).toBe('completed');
    expect(r200.trades).toBe(104);
    expect(r200.winRatePct).toBe(44.23);
    expect(r200.netAbs).toBe(-36.59);
    expect(r200.date).toBe('2026-05-27T07:28:05Z'); // completed_at
    expect(r200.strategyName).toBe('Gamma');
    const r305 = rows.find((r) => r.id === 305)!;
    expect(r305.date).toBe('2026-06-01T00:00:00Z'); // started_at fallback
    expect(r305.trades).toBeNull();
  });

  it('returns rows newest-first by id', () => {
    expect(summarizeHistory(items).map((r) => r.id)).toEqual([312, 305, 200]);
  });
});

describe('pickDefaultRunId', () => {
  it('selects the most recent COMPLETED run (max id), ignoring running/failed', () => {
    expect(pickDefaultRunId(summarizeHistory(items))).toBe(200);
  });
  it('prefers the highest completed id when several completed exist', () => {
    const rows = summarizeHistory([
      { ...items[0], id: 200 },
      { ...items[0], id: 400 },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ] as any);
    expect(pickDefaultRunId(rows)).toBe(400);
  });
  it('falls back to the latest run overall when none completed', () => {
    const rows = summarizeHistory([items[1], items[2]]); // running 312, failed 305
    expect(pickDefaultRunId(rows)).toBe(312);
  });
  it('returns null for empty history', () => {
    expect(summarizeHistory([])).toEqual([]);
    expect(pickDefaultRunId([])).toBeNull();
  });
});
