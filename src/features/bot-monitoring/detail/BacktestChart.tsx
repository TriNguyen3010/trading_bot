import { useEffect, useRef, useState } from 'react';
import {
  createChart,
  type IChartApi,
  type ISeriesApi,
} from 'lightweight-charts';
import { botApi } from '../bot.api';
import type { BacktestTrade } from '../backtest-results';
import { candlesToSeries, tradesToMarkers } from '../backtest-chart';
import { formatBackendError } from '@/lib/format-error';

export function BacktestChart({
  backtestId,
  trades,
  showExits,
}: {
  backtestId: number;
  trades: BacktestTrade[];
  showExits: boolean;
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
      height: 360,
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
    chart.timeScale().fitContent();

    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width;
      if (w) chart.applyOptions({ width: w });
    });
    ro.observe(elRef.current);
    return () => {
      ro.disconnect();
      chart.remove();
      candleSeriesRef.current = null;
    };
  }, [status, series]);

  // (Re)apply markers when the chart is built or trades/showExits change.
  useEffect(() => {
    if (status !== 'ready' || !candleSeriesRef.current) return;
    candleSeriesRef.current.setMarkers(tradesToMarkers(trades, { showExits }));
  }, [status, series, trades, showExits]);

  if (status === 'loading')
    return (
      <div className="py-10 text-center text-sm text-fg-muted">
        Loading chart…
      </div>
    );
  if (status === 'empty')
    return (
      <div className="py-10 text-center text-sm text-fg-muted">
        No candle data
      </div>
    );
  if (status === 'error')
    return (
      <div className="py-10 text-center text-sm text-bearish">
        {error ?? "Couldn't load candles"}
      </div>
    );
  return <div ref={elRef} className="w-full" />;
}
