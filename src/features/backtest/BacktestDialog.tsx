import { useEffect, useMemo, useState } from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { Loader2, Rocket, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatBackendError } from '@/lib/format-error';
import { backtestApi } from './backtest.api';
import { useBacktestPoll } from './useBacktestPoll';
import {
  presetToTimerange,
  extractMetrics,
  formatWinRate,
  formatTotalProfit,
} from './backtest-helpers';
import type { BacktestRequest } from '@/types/api-helpers';

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
  /** Test-only seam: mount straight into the running/result phase. */
  initialBacktestId?: number | null;
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
  initialBacktestId = null,
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
    }
  }, [step, poll.done, poll.error]);

  // Reset to a clean setup state each time the dialog re-opens.
  useEffect(() => {
    if (open && !initialBacktestId) {
      setStep('setup');
      setBacktestId(null);
      setError(null);
      setSubmitting(false);
    }
  }, [open, initialBacktestId]);

  const metrics = useMemo(
    () => (poll.item ? extractMetrics(poll.item) : null),
    [poll.item],
  );

  if (!bot) return null;

  const runBacktest = async () => {
    setSubmitting(true);
    setError(null);
    const payload: BacktestRequest = {
      bot_id: bot.id,
      strategy: bot.strategyName ?? '',
      timeframe: bot.timeframe,
      timerange: presetToTimerange(days),
      stake_amount: Number(stake),
      dry_run_wallet: Number(wallet),
      enable_protections: true,
      // Schema patch: generated BacktestRequest marks `backtest_cache` as
      // required (no `?`), despite the openapi `@default day`. Pass null so
      // BE falls back to its own `day` default. See task notes.
      backtest_cache: null,
    };
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
        <DialogPrimitive.Content className="fixed left-1/2 top-1/2 z-50 w-[640px] max-w-[calc(100vw-32px)] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-2xl border border-border-strong bg-surface-elevated shadow-lg data-[state=open]:animate-fade-in">
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
                    Bot này chưa có strategy name từ BE — backtest có thể bị từ
                    chối.
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
                      Dry-run wallet (USDT)
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
                      Stake / trade (USDT)
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
                    disabled={submitting || !Number(stake) || !Number(wallet)}
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

            {step === 'result' && metrics && (
              <div className="space-y-4">
                <div className="grid grid-cols-3 gap-3">
                  <ResultMetric
                    label="Trades"
                    value={metrics.trades?.toString() ?? '—'}
                  />
                  <ResultMetric
                    label="Net profit"
                    value={formatTotalProfit(metrics.totalProfit)}
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
                  Drawdown / Sharpe / avg-trade đến từ <code>results</code> — sẽ
                  là "—" nếu BE chưa trả các field đó.
                </p>
                <div className="flex justify-end gap-2 border-t border-border pt-4">
                  <Button
                    variant="secondary"
                    size="md"
                    onClick={() => {
                      setStep('setup');
                      setBacktestId(null);
                      setError(null);
                    }}
                  >
                    Run again
                  </Button>
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
                  Run again
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
