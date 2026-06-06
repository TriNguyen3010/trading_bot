import type { DashboardBotMode } from './bot-list.helpers';

export type PresentationalState =
  | DashboardBotMode
  | 'NEW'
  | 'BACKTESTING'
  | 'BACKTEST_FAILED';

export interface PresentationalContext {
  historyCount: number;
  /** status of the most recent backtest history item (from /backtest/history) */
  latestStatus: string | null;
}

const BACKTEST_IN_PROGRESS = ['running', 'pending'];

export function derivePresentationalState(
  mode: DashboardBotMode,
  ctx: PresentationalContext,
): PresentationalState {
  // BACKTESTING is sourced from the bot's latest backtest-history status
  // (bot-scoped, reliable) — NOT from /jobs (no reliable job→bot mapping).
  if (ctx.latestStatus && BACKTEST_IN_PROGRESS.includes(ctx.latestStatus))
    return 'BACKTESTING';
  if (mode === 'PAUSED') {
    if (ctx.historyCount === 0) return 'NEW';
    if (ctx.latestStatus === 'failed') return 'BACKTEST_FAILED';
  }
  return mode;
}
