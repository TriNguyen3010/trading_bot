import { botStrategyApi } from '@/features/bot-builder/bot-strategy.api';
import { botApi, type BotStatusOut } from '@/features/bot-monitoring/bot.api';
import { agentApi } from '@/features/agent-wallet/agent.api';

export type LaunchMode = 'dry-run' | 'live';

/** Thrown when a live launch is attempted but the user has no active agent.
 * Signals LaunchpadModal to open the agent onboarding flow, then retry. */
export class AgentNotActiveError extends Error {
  constructor() {
    super('User has no active agent — onboarding required');
    this.name = 'AgentNotActiveError';
  }
}

/** Align the bot's `dry_run` flag with the desired mode, then start it.
 * dry-run → dry_run=true, live → dry_run=false. PATCH is idempotent, so this
 * is safe even when the flag is already correct. Start only runs if PATCH
 * succeeds.
 * For live mode: checks that the user has an active Hyperliquid agent first;
 * throws AgentNotActiveError (before any mutation) if not. */
export async function launchBot(
  botId: number,
  mode: LaunchMode,
): Promise<BotStatusOut> {
  if (mode === 'live') {
    const active = await agentApi.active();
    if (!active) throw new AgentNotActiveError();
  }
  await botStrategyApi.update(botId, { dry_run: mode === 'dry-run' });
  // The wizard collects no Telegram token; disable Telegram before start so
  // Freqtrade's Updater doesn't crash on a null token. Idempotent — harmless
  // once the BE stops enabling Telegram by default.
  await botApi.disableTelegram(botId);
  return botApi.start(botId);
}
