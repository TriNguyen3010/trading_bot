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
