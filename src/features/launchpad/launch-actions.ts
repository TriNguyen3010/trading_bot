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

export class AgentAddressMismatchError extends Error {
  constructor(expected: string, actual: string) {
    super(
      `API wallet address không khớp active agent. Đang active: ${actual}; bạn nhập: ${expected}.`,
    );
    this.name = 'AgentAddressMismatchError';
  }
}

function normalizeAddress(v: string): string {
  return v.trim().toLowerCase();
}

/** Align the bot's `dry_run` flag with the desired mode, then start it.
 * dry-run → dry_run=true, live → dry_run=false. PATCH is idempotent, so this
 * is safe even when the flag is already correct. Start only runs if PATCH
 * succeeds.
 * For live mode: checks that the user has an active Hyperliquid agent first;
 * throws AgentNotActiveError (before any mutation) if not.
 * Optional `telegram` param: when token + chat_id are supplied, enables
 * Telegram notifications; otherwise disables (Freqtrade's Updater crashes on
 * an enabled-but-null token). Config is set BEFORE start so Freqtrade reads
 * it on boot. */
export async function launchBot(
  botId: number,
  mode: LaunchMode,
  telegram?: { token: string; chat_id: string },
  opts?: { expectedAgentAddress?: string },
): Promise<BotStatusOut> {
  if (mode === 'live') {
    const active = await agentApi.active();
    if (!active) throw new AgentNotActiveError();
    const expected = opts?.expectedAgentAddress?.trim();
    if (
      expected &&
      normalizeAddress(expected) !== normalizeAddress(active.agent_address)
    ) {
      throw new AgentAddressMismatchError(expected, active.agent_address);
    }
  }
  await botStrategyApi.update(botId, { dry_run: mode === 'dry-run' });
  // Telegram config must be set BEFORE start (Freqtrade reads it on boot).
  // Enable with the supplied token; otherwise disable (Freqtrade's Updater
  // crashes on an enabled-but-null token).
  if (telegram?.token && telegram?.chat_id) {
    await botApi.enableTelegram(botId, telegram);
  } else {
    await botApi.disableTelegram(botId);
  }
  return botApi.start(botId);
}
