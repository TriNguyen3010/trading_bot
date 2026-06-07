import { http } from '@/lib/http';
import type { components } from '@/types/api';
import type { BotWalletRotationResponse } from '@/types/api-helpers';
import { parseBotPerformance, type BotPerformance } from './bot-performance';

export type BotOut = components['schemas']['BotOut'];
export type BotConfigOut = components['schemas']['BotConfigOut'];
export type BotStatusOut = components['schemas']['BotStatusOut'];
export type BotConfigUpdate = components['schemas']['BotConfigUpdate'];
export type BacktestHistoryItem = components['schemas']['BacktestHistoryItem'];
export type BacktestHistoryList = components['schemas']['BacktestHistoryList'];
export type BotAuditLogOut = components['schemas']['BotAuditLogOut'];

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
  /** Rotate the active agent wallet into all owner bots (update config + restart running bots). */
  rotateWallet: () =>
    http<BotWalletRotationResponse>('POST', '/bot/rotate-wallet'),
  /** Live balance + open-trades count. openapi response is untyped (None) →
   * parsed defensively; PnL/win-rate are NOT read (BE returns N/A). */
  getPerformance: (id: number): Promise<BotPerformance> =>
    http<unknown>('GET', `/bot/${id}/performance`).then(parseBotPerformance),
  getBacktestHistory: (botId: number, limit = 20) =>
    http<BacktestHistoryList>(
      'GET',
      `/backtest/history?bot_id=${botId}&limit=${limit}`,
    ),
  getBacktest: (backtestId: number) =>
    http<BacktestHistoryItem>('GET', `/backtest/${backtestId}`),
  getAuditLogs: (id: number, limit = 50) =>
    http<BotAuditLogOut[]>('GET', `/bot/${id}/audit_logs?limit=${limit}`),
};
