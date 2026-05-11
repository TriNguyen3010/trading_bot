import type { CreatePayload, BotStrategyResponse } from '@/types/api-helpers';
import { http } from '@/lib/http';

export const botStrategyApi = {
  create: (payload: CreatePayload) =>
    http<BotStrategyResponse>('POST', '/bot-strategy/create', payload),
};
