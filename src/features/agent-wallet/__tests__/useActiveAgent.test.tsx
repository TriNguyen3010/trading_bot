import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useActiveAgent } from '../useActiveAgent';
import { agentApi } from '../agent.api';

vi.mock('../agent.api', () => ({
  agentApi: { active: vi.fn() },
}));
const mockActive = (agentApi as unknown as { active: ReturnType<typeof vi.fn> })
  .active;

beforeEach(() => vi.clearAllMocks());

describe('useActiveAgent', () => {
  it('does not fetch when disabled', () => {
    const { result } = renderHook(() => useActiveAgent({ enabled: false }));
    expect(mockActive).not.toHaveBeenCalled();
    expect(result.current.agent).toBeNull();
    expect(result.current.loading).toBe(false);
  });

  it('returns the active agent', async () => {
    mockActive.mockResolvedValue({
      id: 7,
      agent_address: '0xabc',
      is_active: true,
    });
    const { result } = renderHook(() => useActiveAgent());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.agent?.agent_address).toBe('0xabc');
  });

  it('fails soft to null on error', async () => {
    mockActive.mockRejectedValue(new Error('boom'));
    const { result } = renderHook(() => useActiveAgent());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.agent).toBeNull();
  });
});
