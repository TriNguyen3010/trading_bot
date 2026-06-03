import { describe, it, expect, vi, beforeEach } from 'vitest';
import { http } from '@/lib/http';
import { botApi } from './bot.api';

vi.mock('@/lib/http', () => ({ http: vi.fn() }));
const mockHttp = vi.mocked(http);
beforeEach(() => mockHttp.mockReset());

describe('botApi.enableTelegram', () => {
  it('PATCHes /bot/{id}/config enabling telegram with token + chat_id', async () => {
    mockHttp.mockResolvedValue({} as never);
    await botApi.enableTelegram(42, { token: '123:abc', chat_id: '99' });
    expect(mockHttp).toHaveBeenCalledWith('PATCH', '/bot/42/config', {
      optional: {
        telegram: {
          enabled: true,
          token: '123:abc',
          chat_id: '99',
          allow_custom_messages: true,
        },
      },
    });
  });

  it('disableTelegram still PATCHes telegram disabled', async () => {
    mockHttp.mockResolvedValue({} as never);
    await botApi.disableTelegram(42);
    expect(mockHttp).toHaveBeenCalledWith('PATCH', '/bot/42/config', {
      optional: { telegram: { enabled: false, allow_custom_messages: false } },
    });
  });
});

// I-2: lock the lifecycle endpoint+method strings — a typo here (e.g. stop
// hitting start, or remove hitting the wrong route) acts on real bots.
describe('botApi lifecycle endpoints', () => {
  beforeEach(() => mockHttp.mockResolvedValue({} as never));

  it.each([
    ['list', () => botApi.list(), 'GET', '/bot/list'],
    ['getConfig', () => botApi.getConfig(7), 'GET', '/bot/7/config'],
    ['getStatus', () => botApi.getStatus(7), 'GET', '/bot/7/status'],
    ['start', () => botApi.start(7), 'POST', '/bot/7/start'],
    ['stop', () => botApi.stop(7), 'POST', '/bot/7/stop'],
    ['sync', () => botApi.sync(7), 'POST', '/bot/7/sync'],
    ['remove', () => botApi.remove(7), 'DELETE', '/bot/7'],
    ['rotateWallet', () => botApi.rotateWallet(), 'POST', '/bot/rotate-wallet'],
  ] as const)('%s → %s %s', async (_name, call, method, path) => {
    await call();
    expect(mockHttp).toHaveBeenCalledWith(method, path);
  });
});
