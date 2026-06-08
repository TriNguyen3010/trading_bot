import { jsonPairToUi } from '@/lib/pair-format';
import type { BotOut } from './bot.api';

export type DashboardBotMode =
  | 'LIVE'
  | 'DRY-RUN'
  | 'PAUSED'
  | 'ERROR'
  | 'STARTING'
  | 'STOPPING';

/** Modes that count as "running" (have live balance + deploy capital).
 * Single source of truth — reused by portfolio-stats, the overview hook,
 * and the top-bots picker so the definition can't drift. */
export const RUNNING_MODES: DashboardBotMode[] = ['LIVE', 'DRY-RUN'];

export interface DashboardBot {
  id: number;
  name: string;
  pair: string;
  timeframe: string;
  strategyName: string | null;
  uptime: string | null;
  mode: DashboardBotMode;
  /** dry_run captured from getConfig at load time. Persisted so lifecycle
   * transitions (which only return BotStatusOut, no dry_run) can still
   * resolve a running bot to DRY-RUN/LIVE instead of falling back to PAUSED. */
  dryRun: boolean | null;
  createdAt: string | null;
  leverage: number | null;
  stakeAmount: number | null;
  maxOpenTrades: number | null;
  tradingMode: string | null;
  errorMsg: string | null;
  pnl: string | null;
  pnlPct: string | null;
  pnlDirection: 'up' | 'down' | 'flat';
  trades: number | null;
  winRate: number | null;
  sharpe: number | null;
  sparkline: number[] | null;
  badge?: string;
  isDemo: false;
}

/** The inner config shape after unwrapping `BotConfigOut.config`. Exported so
 * DashboardPage can type the `.config` field it pulls out of each
 * `BotConfigOut` wrapper from `botApi.getConfig(id)`. */
export interface ConfigShape {
  dry_run?: boolean | null;
  timeframe?: string | null;
  exchange?: { pair_whitelist?: string[]; name?: string | null } | null;
  leverage?: number | null;
  stake_amount?: number | null;
  max_open_trades?: number | null;
  trading_mode?: string | null;
}

export function deriveMode(
  bot: Pick<BotOut, 'status' | 'error_message'>, // S3: narrow so T6 can pass BotStatusOut without cast
  config: ConfigShape | null,
): DashboardBotMode {
  if (bot.status === 'starting') return 'STARTING';
  if (bot.status === 'stopping') return 'STOPPING';
  // A bot that is actually running reads as running even if it carries an
  // error_message: Freqtrade logs non-fatal errors (e.g. a Telegram polling
  // warning) while still trading, and a stale message from a previous attempt
  // shouldn't mask a live bot. Only treat error_message as ERROR when the bot
  // is NOT running (checked below). Need config to disambiguate live vs
  // dry-run; if config fetch failed (null) fall through rather than misreport.
  if (bot.status === 'running') {
    if (config?.dry_run === false) return 'LIVE';
    if (config?.dry_run === true) return 'DRY-RUN';
  }
  // A failed launch reads as ERROR off EITHER signal: BE may report
  // status:"error" with error_message still null (no captured reason). Keying
  // ERROR off error_message alone let such a bot fall through to PAUSED — which
  // then renders as the misleading "NEW" badge for a 0-history bot.
  if (bot.status === 'error' || bot.error_message) return 'ERROR';
  return 'PAUSED';
}

export function derivePair(config: ConfigShape | null): string {
  const pair = config?.exchange?.pair_whitelist?.[0];
  if (!pair) return '?';
  return jsonPairToUi(pair);
}

export function deriveTimeframe(config: ConfigShape | null): string {
  return config?.timeframe ?? '?';
}

export function zipBotsAndConfigs(
  bots: BotOut[],
  configs: Array<ConfigShape | null>,
): DashboardBot[] {
  return bots.map((bot, i) => {
    const config = configs[i] ?? null;
    return {
      id: bot.id,
      name: bot.bot_name ?? `Bot #${bot.id}`,
      pair: derivePair(config),
      timeframe: deriveTimeframe(config),
      strategyName: bot.strategy_name ?? null,
      uptime: null,
      mode: deriveMode(bot, config),
      dryRun: config?.dry_run ?? null,
      createdAt: bot.created_at ?? null,
      leverage: config?.leverage ?? null,
      stakeAmount: config?.stake_amount ?? null,
      maxOpenTrades: config?.max_open_trades ?? null,
      tradingMode: config?.trading_mode ?? null,
      errorMsg: bot.error_message ?? null,
      pnl: null,
      pnlPct: null,
      pnlDirection: 'flat',
      trades: null,
      winRate: null,
      sharpe: null,
      sparkline: null,
      isDemo: false,
    };
  });
}
