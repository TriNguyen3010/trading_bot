import { useEffect, useMemo, useRef, useState } from 'react';
import {
  createChart,
  type IChartApi,
  type ISeriesApi,
} from 'lightweight-charts';
import { botApi } from '../bot.api';
import type { BacktestTrade } from '../backtest-results';
import {
  candlesToSeries,
  tradesToMarkers,
  tradesOutsideCandleRange,
  tradesVisibleRange,
} from '../backtest-chart';
import { formatBackendError } from '@/lib/format-error';

export function BacktestChart({
  backtestId,
  trades,
  showExits,
  focusTrades = false,
  height = 360,
}: {
  backtestId: number;
  trades: BacktestTrade[];
  showExits: boolean;
  /** Zoom the time scale to the trades' padded window instead of fitContent. */
  focusTrades?: boolean;
  height?: number;
}) {
  const elRef = useRef<HTMLDivElement | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'empty' | 'error'>(
    'loading',
  );
  const [error, setError] = useState<string | null>(null);
  const [series, setSeries] = useState<ReturnType<
    typeof candlesToSeries
  > | null>(null);

  // Memoized so a fresh `trades` array identity per render (e.g. the detail
  // page's block.trades) can never retrigger the chart-build effect: when
  // focusTrades is off (detail page) this is always null.
  const focusRange = useMemo(
    () => (focusTrades ? tradesVisibleRange(trades) : null),
    [focusTrades, trades],
  );

  // BE's /candles can return a window narrower than the trades' span (e.g. a
  // multi-day 1m run), so entries before the first candle have no bar to pin a
  // marker to and silently vanish. Surface a count so a missing entry marker
  // isn't misread as "the bot never opened that trade".
  const outside = useMemo(
    () =>
      tradesOutsideCandleRange(
        trades,
        (series?.candles ?? []).map((c) => ({ time: Number(c.time) })),
      ),
    [trades, series],
  );

  // Lazy-fetch candles for the run (component only mounts on the Price tab).
  useEffect(() => {
    let cancelled = false;
    setStatus('loading');
    setError(null);
    void (async () => {
      try {
        const res = await botApi.getBacktestCandles(backtestId);
        if (cancelled) return;
        if (!res.candles?.length) {
          setSeries(null);
          setStatus('empty');
          return;
        }
        setSeries(candlesToSeries(res.candles));
        setStatus('ready');
      } catch (err) {
        if (cancelled) return;
        setError(formatBackendError(err));
        setStatus('error');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [backtestId]);

  // Build the chart once data is ready (rebuilds if the run's data changes).
  useEffect(() => {
    if (status !== 'ready' || !series || !elRef.current) return;
    const chart: IChartApi = createChart(elRef.current, {
      autoSize: true, // track container width (no manual ResizeObserver)
      height,
      layout: { background: { color: 'transparent' }, textColor: '#848e9c' },
      grid: {
        vertLines: { color: '#1e2329' },
        horzLines: { color: '#1e2329' },
      },
      timeScale: { timeVisible: true, borderColor: '#2b3139' },
      rightPriceScale: { borderColor: '#2b3139' },
    });
    const candleSeries = chart.addCandlestickSeries({
      upColor: '#0ecb81',
      downColor: '#f6465d',
      wickUpColor: '#0ecb81',
      wickDownColor: '#f6465d',
      borderVisible: false,
    });
    candleSeriesRef.current = candleSeries;
    candleSeries.setData(series.candles);
    const volSeries = chart.addHistogramSeries({
      priceScaleId: '',
      priceFormat: { type: 'volume' },
    });
    volSeries
      .priceScale()
      .applyOptions({ scaleMargins: { top: 0.8, bottom: 0 } });
    volSeries.setData(series.volumes);
    if (focusRange) chart.timeScale().setVisibleRange(focusRange);
    else chart.timeScale().fitContent();

    return () => {
      chart.remove();
      candleSeriesRef.current = null;
    };
  }, [status, series, focusRange, height]);

  // (Re)apply markers when the chart is built or trades/showExits change.
  // Must also fire on every rebuild trigger (focusRange, height): a rebuild
  // replaces the series, and markers would otherwise stay on the dead one.
  useEffect(() => {
    if (status !== 'ready' || !candleSeriesRef.current) return;
    candleSeriesRef.current.setMarkers(tradesToMarkers(trades, { showExits }));
  }, [status, series, trades, showExits, focusRange, height]);

  // Placeholders reserve the chart's height so the embedding container (e.g.
  // the backtest dialog) doesn't jump as the state moves loading→ready/error.
  if (status !== 'ready') {
    const message =
      status === 'loading'
        ? 'Loading chart…'
        : status === 'empty'
          ? 'No candle data'
          : (error ?? "Couldn't load candles");
    return (
      <div
        className={`grid place-items-center text-center text-sm ${
          status === 'error' ? 'text-bearish' : 'text-fg-muted'
        }`}
        style={{ height }}
      >
        {message}
      </div>
    );
  }
  return (
    <>
      {outside.entriesOutside > 0 && (
        <p className="mb-2 text-2xs text-fg-muted" role="note">
          ⚠️ {outside.entriesOutside}/{outside.total} trade
          {outside.total === 1 ? '' : 's'} fall outside the loaded price range —
          their entry markers aren't shown on the chart.
        </p>
      )}
      <div
        ref={elRef}
        className="w-full"
        // autoSize only seeds the initial size from the option; an explicit
        // container height keeps the ResizeObserver reporting the right box.
        style={{ height }}
        role="img"
        aria-label="Backtest price chart with trade entry (B) and exit (S) markers"
      />
    </>
  );
}
