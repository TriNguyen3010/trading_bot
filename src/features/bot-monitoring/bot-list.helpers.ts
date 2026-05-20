import { jsonPairToUi } from '@/lib/pair-format';
import type { BotOut } from './bot.api';

export type DashboardBotMode = 'LIVE' | 'DRY-RUN' | 'PAUSED' | 'ERROR';

export interface DashboardBot {
  id: number;
  name: string;
  pair: string;
  timeframe: string;
  uptime: string | null;
  mode: DashboardBotMode;
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
  exchange?: { pair_whitelist?: string[] } | null;
}

export function deriveMode(
  bot: BotOut,
  config: ConfigShape | null,
): DashboardBotMode {
  if (bot.error_message) return 'ERROR';
  if (bot.status === 'running') {
    // Need config to disambiguate live vs dry-run. If config fetch failed
    // (null) we'd be guessing — fall through to PAUSED rather than misreport.
    if (config?.dry_run === false) return 'LIVE';
    if (config?.dry_run === true) return 'DRY-RUN';
  }
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
      uptime: null,
      mode: deriveMode(bot, config),
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
