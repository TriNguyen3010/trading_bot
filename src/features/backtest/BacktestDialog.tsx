import { useEffect, useMemo, useRef, useState } from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { AlertTriangle, Eye, Loader2, Rocket, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { BacktestChart } from '@/features/bot-monitoring/detail/BacktestChart';
import { formatBackendError } from '@/lib/format-error';
import { backtestApi } from './backtest.api';
import { useBacktestPoll } from './useBacktestPoll';
import {
  buildBacktestRequest,
  isBacktestFailed,
  extractMetrics,
  extractTrades,
  formatTradeTime,
  formatWinRate,
  formatTotalProfit,
  quoteCurrencyFromPair,
} from './backtest-helpers';

export interface BacktestBot {
  id: number;
  name: string;
  strategyName: string | null;
  pair: string;
  timeframe: string;
}

export interface BacktestDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bot: BacktestBot | null;
  /** Fired once when a run terminates (success or fail) — the bot's backtest
   * history has changed, so callers can refetch instead of forcing a reload. */
  onComplete?: () => void;
  /** Open straight into the running phase for an externally-started run
   * (LaunchpadModal starts the backtest itself). Also used as a test seam. */
  initialBacktestId?: number | null;
  /** Fired when the user clicks View bot details — the caller closes the
   * dialog and navigates. Omit it when already on the detail page (button
   * hidden). */
  onViewDetails?: () => void;
}

type Step = 'setup' | 'running' | 'result';

const RANGE_PRESETS = [
  { label: '1 day', days: 1 },
  { label: '7 days', days: 7 },
  { label: '30 days', days: 30 },
  { label: '90 days', days: 90 },
] as const;

export function BacktestDialog({
  open,
  onOpenChange,
  bot,
  onComplete,
  initialBacktestId = null,
  onViewDetails,
}: BacktestDialogProps) {
  const [days, setDays] = useState<number>(7);
  const [stake, setStake] = useState<string>('100');
  const [wallet, setWallet] = useState<string>('1000');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [backtestId, setBacktestId] = useState<number | null>(
    initialBacktestId,
  );
  const [step, setStep] = useState<Step>(
    initialBacktestId ? 'running' : 'setup',
  );
  const [showExits, setShowExits] = useState(true);

  const poll = useBacktestPoll(step === 'running' ? backtestId : null);

  // Advance to result when the poll reports terminal.
  useEffect(() => {
    if (step === 'running' && poll.done) {
      if (poll.error) {
        setError(poll.error);
        setStep('setup');
      } else {
        setStep('result');
      }
      // The run terminated — its result is now in the bot's backtest history.
      // Let the parent refetch so the detail screen updates without a reload.
      onComplete?.();
    }
  }, [step, poll.done, poll.error, onComplete]);

  // Reset to a clean setup state each time the dialog re-opens.
  useEffect(() => {
    if (open && !initialBacktestId) {
      setStep('setup');
      setBacktestId(null);
      setError(null);
      setSubmitting(false);
      setShowExits(true);
    }
  }, [open, initialBacktestId]);

  // The launchpad can start the run itself and only then open this dialog —
  // initialBacktestId may arrive on any open, not just the first mount.
  // Each id is consumed exactly ONCE (tracked in a ref): on a mount-time
  // render the useState initializers already adopted it, and re-asserting
  // 'running' later would clobber the poll-advance transition to
  // result/setup and bounce "Run again" straight back to running.
  const consumedInitialIdRef = useRef<number | null>(initialBacktestId);
  useEffect(() => {
    if (
      open &&
      initialBacktestId != null &&
      initialBacktestId !== consumedInitialIdRef.current
    ) {
      consumedInitialIdRef.current = initialBacktestId;
      setBacktestId(initialBacktestId);
      setError(null);
      setSubmitting(false);
      setResultTab('summary');
      setStep('running');
    }
  }, [open, initialBacktestId]);

  const failed = poll.item ? isBacktestFailed(poll.item) : false;

  const metrics = useMemo(
    () => (poll.item ? extractMetrics(poll.item) : null),
    [poll.item],
  );

  const trades = useMemo(
    () => (poll.item ? extractTrades(poll.item) : []),
    [poll.item],
  );

  if (!bot) return null;

  // Stake/profit currency is the pair's quote (USDC on Hyperliquid), not a
  // hardcoded "USDT". BE also returns `results.strategy[name].stake_currency`,
  // but the pair is available before results land (for the setup-form labels).
  const currency = quoteCurrencyFromPair(bot.pair);

  const runBacktest = async () => {
    setSubmitting(true);
    setError(null);
    const payload = buildBacktestRequest(bot, { days, stake, wallet });
    try {
      const res = await backtestApi.start(payload);
      setBacktestId(res.backtest_id);
      setStep('running');
    } catch (err) {
      setError(formatBackendError(err));
    } finally {
      setSubmitting(false);
    }
  };

  const cancelRunning = async () => {
    if (backtestId != null) {
      try {
        await backtestApi.cancel(backtestId);
      } catch {
        /* best-effort */
      }
    }
    onOpenChange(false);
  };

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-40 bg-black/60 backdrop-blur-[2px] data-[state=open]:animate-fade-in" />
        <DialogPrimitive.Content className="fixed left-1/2 top-1/2 z-50 w-[680px] max-w-[calc(100vw-32px)] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-2xl border border-border-strong bg-surface-elevated shadow-lg data-[state=open]:animate-fade-in">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-border bg-canvas/40 px-5 py-3">
            <div className="min-w-0">
              <DialogPrimitive.Title className="truncate text-sm font-semibold text-fg">
                Backtest <span className="text-brand">{bot.name}</span>
              </DialogPrimitive.Title>
              <DialogPrimitive.Description className="text-2xs text-fg-muted">
                {bot.pair} · {bot.timeframe}
              </DialogPrimitive.Description>
            </div>
            <DialogPrimitive.Close
              className="grid h-8 w-8 place-items-center rounded-lg border border-border text-fg-muted hover:text-fg"
              aria-label="Close"
            >
              <X className="h-3.5 w-3.5" />
            </DialogPrimitive.Close>
          </div>

          <div className="max-h-[calc(100vh-160px)] overflow-y-auto p-5">
            {step === 'setup' && (
              <div className="space-y-5">
                {error && (
                  <div className="rounded-lg border border-bearish/40 bg-bearish-subtle p-3 text-xs text-bearish">
                    {error}
                  </div>
                )}
                {!bot.strategyName && (
                  <div className="border-annotation/40 bg-annotation/10 text-annotation rounded-lg border p-3 text-xs">
                    This bot has no strategy name from the backend — the
                    backtest may be rejected.
                  </div>
                )}

                <div>
                  <label className="mb-2 block text-xs font-medium text-fg-secondary">
                    Timerange
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {RANGE_PRESETS.map((r) => (
                      <button
                        key={r.days}
                        type="button"
                        onClick={() => setDays(r.days)}
                        className={`rounded-full px-3.5 py-1.5 text-xs transition-colors ${
                          days === r.days
                            ? 'bg-brand font-semibold text-fg-inverse'
                            : 'bg-surface-hover text-fg-secondary hover:text-fg'
                        }`}
                      >
                        {r.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <label className="block">
                    <span className="mb-1.5 block text-xs font-medium text-fg-secondary">
                      Dry-run wallet ({currency})
                    </span>
                    <input
                      value={wallet}
                      onChange={(e) => setWallet(e.target.value)}
                      inputMode="numeric"
                      className="h-9 w-full rounded-md border border-border bg-input px-3 text-sm text-fg focus:border-brand focus:outline-none"
                    />
                  </label>
                  <label className="block">
                    <span className="mb-1.5 block text-xs font-medium text-fg-secondary">
                      Stake / trade ({currency})
                    </span>
                    <input
                      value={stake}
                      onChange={(e) => setStake(e.target.value)}
                      inputMode="numeric"
                      className="h-9 w-full rounded-md border border-border bg-input px-3 text-sm text-fg focus:border-brand focus:outline-none"
                    />
                  </label>
                </div>

                <div className="flex justify-end gap-2 border-t border-border pt-4">
                  <Button
                    variant="ghost"
                    size="md"
                    onClick={() => onOpenChange(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="primary"
                    size="md"
                    disabled={
                      submitting ||
                      !(Number(stake) > 0) ||
                      !(Number(wallet) > 0)
                    }
                    onClick={runBacktest}
                    aria-label="Run backtest"
                  >
                    {submitting ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Rocket className="h-4 w-4" />
                    )}
                    Run
                  </Button>
                </div>
              </div>
            )}

            {step === 'running' && (
              <div className="flex flex-col items-center py-10 text-center">
                <Loader2 className="h-10 w-10 animate-spin text-brand" />
                <h3 className="mt-4 text-lg font-bold text-fg">
                  Crunching the numbers…
                </h3>
                <p className="mt-1 text-sm text-fg-secondary">
                  Backtest #{backtestId} · {bot.pair} {bot.timeframe} · status:{' '}
                  {poll.item?.status ?? 'queued'}
                </p>
                <button
                  type="button"
                  onClick={cancelRunning}
                  className="mt-6 text-xs text-fg-muted underline-offset-4 hover:text-fg hover:underline"
                >
                  Cancel and go back
                </button>
              </div>
            )}

            {step === 'result' && failed && (
              <div className="flex flex-col items-center gap-3 py-10 text-center">
                <AlertTriangle className="h-10 w-10 text-bearish" />
                <h3 className="text-lg font-bold text-fg">Backtest failed</h3>
                <p className="max-w-sm text-sm text-fg-secondary">
                  The backend returned no result for {bot.pair} ·{' '}
                  {bot.timeframe} in this range. Usually the backend has no
                  historical data for this pair/timeframe, or the strategy made
                  no trades. Try another pair, timeframe or range.
                </p>
                <button
                  type="button"
                  onClick={() => setStep('setup')}
                  className="mt-2 text-xs text-fg-muted underline-offset-4 hover:text-fg hover:underline"
                >
                  Try again
                </button>
              </div>
            )}

            {step === 'result' && !failed && metrics && (
              <div className="space-y-4">
                <label className="flex w-fit items-center gap-1.5 text-2xs text-fg-muted">
                  <input
                    type="checkbox"
                    checked={showExits}
                    onChange={(e) => setShowExits(e.target.checked)}
                  />
                  Show exits
                </label>

                {backtestId != null && (
                  <BacktestChart
                    backtestId={backtestId}
                    trades={trades}
                    showExits={showExits}
                    focusTrades
                    height={240}
                  />
                )}

                <div className="grid grid-cols-3 gap-3">
                  <ResultMetric
                    label="Trades"
                    value={metrics.trades?.toString() ?? '—'}
                  />
                  <ResultMetric
                    label="Net profit"
                    value={formatTotalProfit(metrics.totalProfit, currency)}
                    tone={
                      (metrics.totalProfit ?? 0) >= 0 ? 'bullish' : 'bearish'
                    }
                  />
                  <ResultMetric
                    label="Win rate"
                    value={formatWinRate(metrics.winRate)}
                  />
                  <ResultMetric
                    label="Max drawdown"
                    value={
                      metrics.maxDrawdownPct != null
                        ? `${metrics.maxDrawdownPct.toFixed(1)}%`
                        : '—'
                    }
                    tone="bearish"
                  />
                  <ResultMetric
                    label="Sharpe"
                    value={
                      metrics.sharpe != null ? metrics.sharpe.toFixed(2) : '—'
                    }
                  />
                  <ResultMetric
                    label="Avg trade"
                    value={metrics.avgTrade ?? '—'}
                  />
                </div>
                <p className="text-2xs text-fg-muted">
                  Drawdown / Sharpe / avg trade come from <code>results</code> —
                  shown as "—" if the backend hasn't returned those fields yet.
                </p>

                <div className="text-2xs uppercase tracking-widest text-fg-muted">
                  Trades ({trades.length})
                </div>
                {trades.length === 0 ? (
                  <p className="py-10 text-center text-sm text-fg-muted">
                    No trades in this time range.
                  </p>
                ) : (
                  <div className="max-h-[320px] overflow-y-auto rounded-xl border border-border-subtle">
                    <table className="w-full text-xs">
                      <thead className="sticky top-0 bg-surface-elevated">
                        <tr className="border-b border-border-subtle text-left text-fg-muted">
                          <th className="px-3 py-2 font-medium">Open</th>
                          <th className="px-3 py-2 font-medium">Close</th>
                          <th className="px-3 py-2 font-medium">Dir</th>
                          <th className="px-3 py-2 text-right font-medium">{`P/L (${currency})`}</th>
                          <th className="px-3 py-2 text-right font-medium">
                            P/L %
                          </th>
                          <th className="px-3 py-2 font-medium">Exit</th>
                        </tr>
                      </thead>
                      <tbody>
                        {trades.map((t, i) => {
                          const plSign = t.profit_abs >= 0 ? '+' : '';
                          const plCls =
                            t.profit_abs >= 0 ? 'text-bullish' : 'text-bearish';
                          const pctSign = t.profit_ratio >= 0 ? '+' : '';
                          return (
                            <tr
                              key={i}
                              className="border-b border-border-subtle/50 last:border-0 hover:bg-surface-hover/40"
                            >
                              <td className="px-3 py-2 tabular-nums text-fg-secondary">
                                {formatTradeTime(t.open_timestamp)}
                              </td>
                              <td className="px-3 py-2 tabular-nums text-fg-secondary">
                                {formatTradeTime(t.close_timestamp)}
                              </td>
                              <td className="px-3 py-2">
                                {t.is_short ? (
                                  <span className="rounded bg-bearish/15 px-1.5 py-0.5 text-2xs font-semibold text-bearish">
                                    SHORT
                                  </span>
                                ) : (
                                  <span className="rounded bg-bullish/15 px-1.5 py-0.5 text-2xs font-semibold text-bullish">
                                    LONG
                                  </span>
                                )}
                              </td>
                              <td
                                className={`px-3 py-2 text-right font-mono tabular-nums ${plCls}`}
                              >
                                {`${plSign}${t.profit_abs.toFixed(2)}`}
                              </td>
                              <td
                                className={`px-3 py-2 text-right font-mono tabular-nums ${plCls}`}
                              >
                                {`${pctSign}${(t.profit_ratio * 100).toFixed(2)}%`}
                              </td>
                              <td className="px-3 py-2 text-fg-muted">
                                {t.exit_reason}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}

                <div className="flex justify-end gap-2 border-t border-border pt-4">
                  {onViewDetails && (
                    <Button
                      variant="secondary"
                      size="md"
                      onClick={onViewDetails}
                    >
                      <Eye className="h-4 w-4" />
                      View bot details
                    </Button>
                  )}
                  <Button
                    variant="primary"
                    size="md"
                    onClick={() => onOpenChange(false)}
                  >
                    Done
                  </Button>
                </div>
              </div>
            )}

            {step === 'result' && !metrics && (
              <div className="flex flex-col items-center py-10 text-center">
                <p className="text-sm text-fg-muted">
                  No metrics returned. Try again.
                </p>
                <Button
                  variant="secondary"
                  size="md"
                  className="mt-4"
                  onClick={() => {
                    setStep('setup');
                    setBacktestId(null);
                    setError(null);
                  }}
                >
                  Try again
                </Button>
              </div>
            )}
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

function ResultMetric({
  label,
  value,
  tone = 'default',
}: {
  label: string;
  value: string;
  tone?: 'default' | 'bullish' | 'bearish';
}) {
  const toneCls =
    tone === 'bullish'
      ? 'text-bullish'
      : tone === 'bearish'
        ? 'text-bearish'
        : 'text-fg';
  return (
    <div className="rounded-xl border border-border-subtle bg-surface/40 p-3">
      <div className="text-2xs uppercase tracking-wider text-fg-muted">
        {label}
      </div>
      <div
        className={`mt-1 font-mono text-lg font-bold tabular-nums ${toneCls}`}
      >
        {value}
      </div>
    </div>
  );
}
