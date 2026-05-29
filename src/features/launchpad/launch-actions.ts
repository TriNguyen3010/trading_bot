import { botStrategyApi } from '@/features/bot-builder/bot-strategy.api';
import { botApi, type BotStatusOut } from '@/features/bot-monitoring/bot.api';

export type LaunchMode = 'dry-run' | 'live';

/** Align the bot's `dry_run` flag with the desired mode, then start it.
 * dry-run → dry_run=true, live → dry_run=false. PATCH is idempotent, so this
 * is safe even when the flag is already correct. Start only runs if PATCH
 * succeeds. */
export async function launchBot(
  botId: number,
  mode: LaunchMode,
): Promise<BotStatusOut> {
  await botStrategyApi.update(botId, { dry_run: mode === 'dry-run' });
  return botApi.start(botId);
}
