import { http } from '@/lib/http';
import type { components } from '@/types/api';

export type BotOut = components['schemas']['BotOut'];
export type BotConfigOut = components['schemas']['BotConfigOut'];
export type BotStatusOut = components['schemas']['BotStatusOut'];

export const botApi = {
  list: () => http<BotOut[]>('GET', '/bot/list'),
  getConfig: (id: number) => http<BotConfigOut>('GET', `/bot/${id}/config`),
  getStatus: (id: number) => http<BotStatusOut>('GET', `/bot/${id}/status`),
  start: (id: number) => http<BotStatusOut>('POST', `/bot/${id}/start`),
  stop: (id: number) => http<BotStatusOut>('POST', `/bot/${id}/stop`),
  sync: (id: number) => http<BotStatusOut>('POST', `/bot/${id}/sync`),
  // `remove` (not `delete` — reserved word in some lint configs)
  remove: (id: number) => http<void>('DELETE', `/bot/${id}`),
};
