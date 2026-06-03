import { describe, it, expect, vi, beforeEach } from 'vitest';
import { http } from '@/lib/http';
import { botApi } from '../bot.api';

vi.mock('@/lib/http', () => ({ http: vi.fn() }));
const mockHttp = vi.mocked(http);
beforeEach(() => mockHttp.mockReset());

describe('botApi lifecycle', () => {
  it('start POSTs /bot/:id/start and returns BotStatusOut', async () => {
    mockHttp.mockResolvedValueOnce({
      id: 42,
      bot_name: 'My bot',
      status: 'starting',
      desired_status: 'running',
      is_process_running: false,
      error_message: null,
    });
    const res = await botApi.start(42);
    expect(mockHttp).toHaveBeenCalledWith('POST', '/bot/42/start');
    expect(res.status).toBe('starting');
    expect(res.desired_status).toBe('running');
  });

  it('disableTelegram PATCHes telegram.enabled=false before lifecycle start', async () => {
    mockHttp.mockResolvedValueOnce({ config: {} });
    const res = await botApi.disableTelegram(42);
    expect(mockHttp).toHaveBeenCalledWith('PATCH', '/bot/42/config', {
      optional: {
        telegram: {
          enabled: false,
          allow_custom_messages: false,
        },
      },
    });
    expect(res).toEqual({ config: {} });
  });

  it('stop POSTs /bot/:id/stop', async () => {
    mockHttp.mockResolvedValueOnce({
      id: 42,
      status: 'stopping',
      desired_status: 'stopped',
      is_process_running: true,
    });
    const res = await botApi.stop(42);
    expect(mockHttp).toHaveBeenCalledWith('POST', '/bot/42/stop');
    expect(res.status).toBe('stopping');
  });

  it('getStatus GETs /bot/:id/status', async () => {
    mockHttp.mockResolvedValueOnce({
      id: 42,
      status: 'running',
      desired_status: 'running',
      is_process_running: true,
    });
    const res = await botApi.getStatus(42);
    expect(mockHttp).toHaveBeenCalledWith('GET', '/bot/42/status');
    expect(res.is_process_running).toBe(true);
  });

  it('sync POSTs /bot/:id/sync', async () => {
    mockHttp.mockResolvedValueOnce({
      id: 42,
      status: 'stopped',
      desired_status: 'running',
      is_process_running: false,
      error_message: 'Process crashed',
    });
    const res = await botApi.sync(42);
    expect(mockHttp).toHaveBeenCalledWith('POST', '/bot/42/sync');
    expect(res.error_message).toBe('Process crashed');
  });

  it('remove DELETEs /bot/:id and resolves to undefined', async () => {
    mockHttp.mockResolvedValueOnce(undefined);
    const res = await botApi.remove(42);
    expect(mockHttp).toHaveBeenCalledWith('DELETE', '/bot/42');
    expect(res).toBeUndefined();
  });

  it('rotateWallet POSTs /bot/rotate-wallet and returns BotWalletRotationResponse', async () => {
    mockHttp.mockResolvedValueOnce({
      total_bots: 3,
      updated_count: 2,
      restarted_count: 1,
      error_count: 1,
      results: [
        {
          bot_id: 1,
          bot_name: 'Alpha',
          was_running: true,
          updated: true,
          restart_attempted: true,
          restarted: true,
          error: null,
        },
        {
          bot_id: 2,
          bot_name: 'Beta',
          was_running: false,
          updated: true,
          restart_attempted: false,
          restarted: false,
          error: null,
        },
        {
          bot_id: 3,
          bot_name: 'Gamma',
          was_running: true,
          updated: false,
          restart_attempted: false,
          restarted: false,
          error: 'No active agent',
        },
      ],
      message: '2/3 bots updated',
    });
    const res = await botApi.rotateWallet();
    expect(mockHttp).toHaveBeenCalledWith('POST', '/bot/rotate-wallet');
    expect(res.total_bots).toBe(3);
    expect(res.updated_count).toBe(2);
    expect(res.error_count).toBe(1);
    expect(res.results[2].error).toBe('No active agent');
  });
});
