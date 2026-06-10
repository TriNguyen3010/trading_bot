import type {
  CandlestickData,
  HistogramData,
  SeriesMarker,
  UTCTimestamp,
} from 'lightweight-charts';
import type { CandleRecord } from './bot.api';
import type { BacktestTrade } from './backtest-results';

const BULL = '#0ecb81';
const BEAR = '#f6465d';
const sec = (ms: number) => Math.floor(ms / 1000) as UTCTimestamp;

export function candlesToSeries(candles: CandleRecord[]): {
  candles: CandlestickData[];
  volumes: HistogramData[];
} {
  // dedupe by time (keep last), then sort ascending — lightweight-charts
  // requires series data to be ascending by unique time.
  const byTime = new Map<number, CandleRecord>();
  for (const c of candles) byTime.set(Math.floor(c.timestamp / 1000), c);
  const sorted = [...byTime.entries()].sort((a, b) => a[0] - b[0]);
  return {
    candles: sorted.map(([t, c]) => ({
      time: t as UTCTimestamp,
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
    })),
    volumes: sorted.map(([t, c]) => ({
      time: t as UTCTimestamp,
      value: c.volume,
      color: c.close >= c.open ? BULL : BEAR,
    })),
  };
}

export interface MarkerOptions {
  showExits: boolean;
}

export function tradesToMarkers(
  trades: BacktestTrade[],
  { showExits }: MarkerOptions,
): SeriesMarker<UTCTimestamp>[] {
  // _leg is a transient sort key (0=entry, 1=exit) stripped before returning.
  const out: Array<SeriesMarker<UTCTimestamp> & { _leg: 0 | 1 }> = [];
  const leg = (
    text: 'B' | 'S',
    isBuy: boolean,
  ): Omit<SeriesMarker<UTCTimestamp>, 'time' | 'id'> => ({
    position: isBuy ? 'belowBar' : 'aboveBar',
    color: isBuy ? BULL : BEAR,
    shape: 'circle',
    size: 0.5,
    text,
  });
  trades.forEach((t, i) => {
    // entry: long → Buy(B); short → Sell(S)
    if (t.open_timestamp != null) {
      out.push({
        time: sec(t.open_timestamp),
        id: `t${i}-in`,
        _leg: 0,
        ...leg(t.is_short ? 'S' : 'B', !t.is_short),
      });
    }
    // exit: long → Sell(S); short → Buy(B)
    if (showExits && t.close_timestamp != null) {
      out.push({
        time: sec(t.close_timestamp),
        id: `t${i}-out`,
        _leg: 1,
        ...leg(t.is_short ? 'B' : 'S', !!t.is_short),
      });
    }
  });
  // ascending by time; entry(0) before exit(1) on ties. NOT deduped —
  // duplicate timestamps are valid (e.g. one trade's exit == next's entry).
  out.sort(
    (a, b) => (a.time as number) - (b.time as number) || a._leg - b._leg,
  );
  return out.map(({ _leg, ...m }) => {
    void _leg;
    return m;
  });
}

export function tradesVisibleRange(
  trades: BacktestTrade[],
  padFraction = 0.1,
): { from: UTCTimestamp; to: UTCTimestamp } | null {
  const ts: number[] = [];
  for (const t of trades) {
    if (t.open_timestamp != null) ts.push(sec(t.open_timestamp));
    if (t.close_timestamp != null) ts.push(sec(t.close_timestamp));
  }
  if (ts.length === 0) return null;
  const from = Math.min(...ts);
  const to = Math.max(...ts);
  const span = to - from;
  if (span <= 0) return null; // degenerate -> caller falls back to fitContent
  const pad = Math.round(span * padFraction);
  return { from: (from - pad) as UTCTimestamp, to: (to + pad) as UTCTimestamp };
}
