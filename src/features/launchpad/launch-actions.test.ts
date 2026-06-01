import { describe, it, expect, vi, beforeEach } from 'vitest';
import { botStrategyApi } from '@/features/bot-builder/bot-strategy.api';
import { botApi } from '@/features/bot-monitoring/bot.api';
import { launchBot } from './launch-actions';

vi.mock('@/features/bot-builder/bot-strategy.api', () => ({
  botStrategyApi: { update: vi.fn() },
}));
vi.mock('@/features/bot-monitoring/bot.api', () => ({
  botApi: { start: vi.fn(), disableTelegram: vi.fn() },
}));
const mockUpdate = vi.mocked(botStrategyApi.update);
const mockStart = vi.mocked(botApi.start);
const mockDisableTelegram = vi.mocked(botApi.disableTelegram);

beforeEach(() => {
  mockUpdate
    .mockReset()
    .mockResolvedValue({ bot: { id: 42 }, strategy: {} } as never);
  mockDisableTelegram.mockReset().mockResolvedValue({} as never);
  mockStart.mockReset().mockResolvedValue({
    id: 42,
    status: 'starting',
    is_process_running: false,
  } as never);
});

describe('launchBot', () => {
  it('dry-run → PATCH dry_run=true, disable Telegram, then start', async () => {
    await launchBot(42, 'dry-run');
    expect(mockUpdate).toHaveBeenCalledWith(42, { dry_run: true });
    expect(mockDisableTelegram).toHaveBeenCalledWith(42);
    expect(mockStart).toHaveBeenCalledWith(42);
    // Telegram must be disabled BEFORE start (Freqtrade Updater crashes on a
    // null token otherwise).
    expect(mockDisableTelegram.mock.invocationCallOrder[0]).toBeLessThan(
      mockStart.mock.invocationCallOrder[0],
    );
  });

  it('live → PATCH dry_run=false then start', async () => {
    await launchBot(42, 'live');
    expect(mockUpdate).toHaveBeenCalledWith(42, { dry_run: false });
    expect(mockStart).toHaveBeenCalledWith(42);
  });

  it('does not start if the dry_run patch fails', async () => {
    mockUpdate.mockRejectedValueOnce(new Error('patch failed'));
    await expect(launchBot(42, 'live')).rejects.toThrow('patch failed');
    expect(mockStart).not.toHaveBeenCalled();
  });

  it('does not start if disabling Telegram fails', async () => {
    mockDisableTelegram.mockRejectedValueOnce(new Error('telegram patch failed'));
    await expect(launchBot(42, 'dry-run')).rejects.toThrow(
      'telegram patch failed',
    );
    expect(mockStart).not.toHaveBeenCalled();
  });

  it('returns the BotStatusOut from start', async () => {
    const res = await launchBot(42, 'dry-run');
    expect(res.status).toBe('starting');
  });
});
