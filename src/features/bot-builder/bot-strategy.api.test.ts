import { describe, it, expect, vi, beforeEach } from 'vitest';
import { http } from '@/lib/http';
import { botStrategyApi } from './bot-strategy.api';

vi.mock('@/lib/http', () => ({ http: vi.fn() }));
const mockHttp = vi.mocked(http);
beforeEach(() => mockHttp.mockReset());

describe('botStrategyApi.update', () => {
  it('PATCHes /bot-strategy/:id with the partial payload', async () => {
    mockHttp.mockResolvedValue({ bot: { id: 42 }, strategy: {} });
    await botStrategyApi.update(42, { dry_run: false });
    expect(mockHttp).toHaveBeenCalledWith('PATCH', '/bot-strategy/42', {
      dry_run: false,
    });
  });
});
