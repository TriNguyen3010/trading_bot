import { http } from '@/lib/http';
import type { components } from '@/types/api';

export type BotOut = components['schemas']['BotOut'];
export type BotConfigOut = components['schemas']['BotConfigOut'];
export type BotStatusOut = components['schemas']['BotStatusOut'];
export type BotConfigUpdate = components['schemas']['BotConfigUpdate'];

const DISABLE_TELEGRAM_PATCH = {
  optional: {
    telegram: {
      enabled: false,
      allow_custom_messages: false,
    },
  },
} satisfies BotConfigUpdate;

export const botApi = {
  list: () => http<BotOut[]>('GET', '/bot/list'),
  getConfig: (id: number) => http<BotConfigOut>('GET', `/bot/${id}/config`),
  disableTelegram: (id: number) =>
    http<BotConfigOut>('PATCH', `/bot/${id}/config`, DISABLE_TELEGRAM_PATCH),
  enableTelegram: (id: number, cfg: { token: string; chat_id: string }) =>
    http<BotConfigOut>('PATCH', `/bot/${id}/config`, {
      optional: {
        telegram: {
          enabled: true,
          token: cfg.token,
          chat_id: cfg.chat_id,
          allow_custom_messages: true,
        },
      },
    } satisfies BotConfigUpdate),
  getStatus: (id: number) => http<BotStatusOut>('GET', `/bot/${id}/status`),
  start: (id: number) => http<BotStatusOut>('POST', `/bot/${id}/start`),
  stop: (id: number) => http<BotStatusOut>('POST', `/bot/${id}/stop`),
  sync: (id: number) => http<BotStatusOut>('POST', `/bot/${id}/sync`),
  // `remove` (not `delete` — reserved word in some lint configs)
  remove: (id: number) => http<void>('DELETE', `/bot/${id}`),
};
