import type { DashboardBotMode } from './bot-list.helpers';
import type { BotPerformance } from './bot-performance';

export interface PortfolioStats {
  capitalDeployed: number;
  openTrades: number;
  total: number;
  active: number;
  transitioning: number;
  idle: number;
  error: number;
}

const RUNNING: DashboardBotMode[] = ['LIVE', 'DRY-RUN'];
const TRANSIT: DashboardBotMode[] = ['STARTING', 'STOPPING'];

export function computePortfolioStats(
  bots: Array<{ id: number; mode: DashboardBotMode }>,
  perfById: Map<number, Pick<BotPerformance, 'balance' | 'openTrades'>>,
): PortfolioStats {
  let capitalDeployed = 0;
  let openTrades = 0;
  for (const b of bots) {
    if (!RUNNING.includes(b.mode)) continue;
    const p = perfById.get(b.id);
    if (p?.balance != null) capitalDeployed += p.balance;
    if (p?.openTrades != null) openTrades += p.openTrades;
  }
  return {
    capitalDeployed,
    openTrades,
    total: bots.length,
    active: bots.filter((b) => RUNNING.includes(b.mode)).length,
    transitioning: bots.filter((b) => TRANSIT.includes(b.mode)).length,
    idle: bots.filter((b) => b.mode === 'PAUSED').length,
    error: bots.filter((b) => b.mode === 'ERROR').length,
  };
}
