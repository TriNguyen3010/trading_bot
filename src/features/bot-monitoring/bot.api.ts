import { http } from '@/lib/http';
import type { components } from '@/types/api';

export type BotOut = components['schemas']['BotOut'];
export type BotConfigOut = components['schemas']['BotConfigOut'];

export const botApi = {
  list: () => http<BotOut[]>('GET', '/bot/list'),
  getConfig: (id: number) => http<BotConfigOut>('GET', `/bot/${id}/config`),
};
