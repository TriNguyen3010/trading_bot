import type { DashboardBot, DashboardBotMode } from '../bot-list.helpers';
import type { BotPerformance } from '../bot-performance';

const RUNNING: DashboardBotMode[] = ['LIVE', 'DRY-RUN'];

/** Top bots for the home strip: running first, then by live balance desc,
 * then by id asc. Bots without a known balance sort to the end of their group. */
export function pickTopBots(
  bots: DashboardBot[],
  perfById: Map<number, BotPerformance>,
  limit: number,
): DashboardBot[] {
  const score = (b: DashboardBot): number => {
    const bal = perfById.get(b.id)?.balance;
    const runningBoost = RUNNING.includes(b.mode) ? 1e12 : 0;
    return runningBoost + (bal ?? -1);
  };
  return [...bots]
    .sort((a, b) => score(b) - score(a) || a.id - b.id)
    .slice(0, limit);
}
