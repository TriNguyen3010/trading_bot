import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { BacktestChart } from '../BacktestChart';
import { botApi } from '../../bot.api';
import { HttpError } from '@/lib/http';

const candleSeries = { setData: vi.fn(), setMarkers: vi.fn() };
const volSeries = {
  setData: vi.fn(),
  priceScale: () => ({ applyOptions: vi.fn() }),
};
const chart = {
  addCandlestickSeries: vi.fn(() => candleSeries),
  addHistogramSeries: vi.fn(() => volSeries),
  remove: vi.fn(),
  applyOptions: vi.fn(),
  timeScale: () => ({ fitContent: vi.fn() }),
};
vi.mock('lightweight-charts', () => ({ createChart: vi.fn(() => chart) }));
vi.mock('../../bot.api', () => ({ botApi: { getBacktestCandles: vi.fn() } }));

const trades = [
  {
    open_timestamp: 1_000_000,
    close_timestamp: 2_000_000,
    open_rate: 100,
    close_rate: 110,
    is_short: false,
    profit_abs: 1,
  },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
] as any;

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(botApi.getBacktestCandles).mockResolvedValue({
    backtest_id: 200,
    pair: 'BTC/USDC:USDC',
    timeframe: '5m',
    range_start: 0,
    range_end: 0,
    candles: [
      {
        timestamp: 1_000_000,
        open: 9,
        high: 11,
        low: 8,
        close: 10,
        volume: 80,
      },
    ],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any);
});

describe('BacktestChart', () => {
  it('fetches candles and feeds candlestick + markers into the chart', async () => {
    render(<BacktestChart backtestId={200} trades={trades} showExits />);
    await waitFor(() => expect(candleSeries.setData).toHaveBeenCalled());
    expect(chart.addCandlestickSeries).toHaveBeenCalled();
    expect(candleSeries.setMarkers).toHaveBeenCalled();
    expect(candleSeries.setMarkers.mock.calls[0][0]).toHaveLength(2); // entry+exit
  });

  it('shows empty state when candles=[]', async () => {
    vi.mocked(botApi.getBacktestCandles).mockResolvedValue({
      backtest_id: 200,
      pair: 'X',
      timeframe: '5m',
      range_start: 0,
      range_end: 0,
      candles: [],
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);
    render(<BacktestChart backtestId={200} trades={[] as never} showExits />);
    expect(await screen.findByText(/No candle data/i)).toBeInTheDocument();
  });

  it('surfaces the BE error detail on failure', async () => {
    vi.mocked(botApi.getBacktestCandles).mockRejectedValue(
      new HttpError(404, JSON.stringify({ detail: 'run not found' })),
    );
    render(<BacktestChart backtestId={999} trades={[] as never} showExits />);
    // formatBackendError prefixes the status → "404: run not found"
    expect(await screen.findByText(/404.*run not found/i)).toBeInTheDocument();
  });

  it('re-applies markers (entry-only) when Show-exits toggles off', async () => {
    const { rerender } = render(
      <BacktestChart backtestId={200} trades={trades} showExits />,
    );
    await waitFor(() =>
      expect(candleSeries.setMarkers.mock.calls.at(-1)?.[0]).toHaveLength(2),
    );
    rerender(
      <BacktestChart backtestId={200} trades={trades} showExits={false} />,
    );
    await waitFor(() =>
      expect(candleSeries.setMarkers.mock.calls.at(-1)?.[0]).toHaveLength(1),
    );
  });

  it('removes the chart on unmount (no leak)', async () => {
    const { unmount } = render(
      <BacktestChart backtestId={200} trades={trades} showExits />,
    );
    await waitFor(() => expect(chart.addCandlestickSeries).toHaveBeenCalled());
    unmount();
    expect(chart.remove).toHaveBeenCalled();
  });
});
