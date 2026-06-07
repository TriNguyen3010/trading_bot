import { describe, it, expect } from 'vitest';
import { candlesToSeries, tradesToMarkers } from '../backtest-chart';

const candles = [
  { timestamp: 2_000_000, open: 10, high: 12, low: 9, close: 11, volume: 100 },
  { timestamp: 1_000_000, open: 9, high: 11, low: 8, close: 10, volume: 80 }, // out of order
  { timestamp: 2_000_000, open: 10, high: 13, low: 9, close: 9, volume: 120 }, // dup time → keep last
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
] as any;

describe('candlesToSeries', () => {
  it('maps ms→s, sorts ascending, dedupes by time (keep last), colors volume', () => {
    const { candles: c, volumes: v } = candlesToSeries(candles);
    expect(c.map((x) => x.time)).toEqual([1000, 2000]); // seconds, sorted, deduped
    expect(c[1].close).toBe(9); // last dup wins
    expect(v).toHaveLength(2);
    expect(v[0].value).toBe(80);
  });
  it('empty → empty', () => {
    expect(candlesToSeries([])).toEqual({ candles: [], volumes: [] });
  });
});

const mk = (over: Record<string, unknown>) =>
  ({
    open_timestamp: 1_000_000,
    close_timestamp: 2_000_000,
    open_rate: 100,
    close_rate: 110,
    is_short: false,
    profit_abs: 1,
    ...over,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  }) as any;

describe('tradesToMarkers', () => {
  it('long → B(belowBar,green)@open + S(aboveBar,red)@close', () => {
    const m = tradesToMarkers([mk({})], { showExits: true });
    expect(m).toHaveLength(2);
    expect(m[0]).toMatchObject({ time: 1000, position: 'belowBar', text: 'B' });
    expect(m[1]).toMatchObject({ time: 2000, position: 'aboveBar', text: 'S' });
  });
  it('short → S@open + B@close', () => {
    const m = tradesToMarkers([mk({ is_short: true })], { showExits: true });
    expect(m[0]).toMatchObject({ text: 'S', position: 'aboveBar' });
    expect(m[1]).toMatchObject({ text: 'B', position: 'belowBar' });
  });
  it('showExits:false → entry markers only', () => {
    const m = tradesToMarkers([mk({})], { showExits: false });
    expect(m).toHaveLength(1);
    expect(m[0].text).toBe('B');
  });
  it('sorts ascending, entry-before-exit tiebreak, does NOT dedupe colliding times', () => {
    // Synthetic-but-deterministic collision; mirrors the 6 real collisions in
    // backtest_200.json. A.exit and B.entry both land on t=2000.
    const a = mk({ open_timestamp: 1_000_000, close_timestamp: 2_000_000 });
    const b = mk({ open_timestamp: 2_000_000, close_timestamp: 3_000_000 });
    const m = tradesToMarkers([a, b], { showExits: true });
    expect(m.filter((x) => x.time === 2000)).toHaveLength(2); // both kept
    expect(m.map((x) => x.time)).toEqual([1000, 2000, 2000, 3000]); // sorted
    expect(new Set(m.map((x) => x.id)).size).toBe(m.length); // unique ids
  });
  it('omits the entry marker when open_timestamp is missing', () => {
    const m = tradesToMarkers([mk({ open_timestamp: undefined })], {
      showExits: true,
    });
    expect(m).toHaveLength(1);
    expect(m[0].text).toBe('S'); // only the exit
  });
  it('empty → []', () => {
    expect(tradesToMarkers([], { showExits: true })).toEqual([]);
  });
});
