import type {
  CreatePayload,
  UpdatePayload,
  BotStrategyResponse,
} from '@/types/api-helpers';
import { http } from '@/lib/http';

export const botStrategyApi = {
  create: (payload: CreatePayload) =>
    http<BotStrategyResponse>('POST', '/bot-strategy/create', payload),

  /** Partial update — used by Launchpad to flip `dry_run` before start. */
  update: (botId: number, payload: UpdatePayload) =>
    http<BotStrategyResponse>('PATCH', `/bot-strategy/${botId}`, payload),
};
