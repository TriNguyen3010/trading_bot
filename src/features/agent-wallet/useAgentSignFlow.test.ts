import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useAgentSignFlow } from './useAgentSignFlow';
import { agentApi } from './agent.api';
import { eip712Sign } from './agent-helpers';
import { detectCoin98 } from '@/features/wallet-auth/wallet.provider';
import { useWalletStore } from '@/features/wallet-auth/wallet.store';
import { HttpError } from '@/lib/http';

vi.mock('./agent.api', () => ({
  agentApi: { create: vi.fn(), confirm: vi.fn() },
}));
vi.mock('./agent-helpers', async () => {
  const actual =
    await vi.importActual<typeof import('./agent-helpers')>('./agent-helpers');
  return { ...actual, eip712Sign: vi.fn() };
});
vi.mock('@/features/wallet-auth/wallet.provider', async () => {
  const actual = await vi.importActual<
    typeof import('@/features/wallet-auth/wallet.provider')
  >('@/features/wallet-auth/wallet.provider');
  return { ...actual, detectCoin98: vi.fn() };
});

beforeEach(() => {
  vi.clearAllMocks();
  useWalletStore.setState({
    address: '0xuser',
    nonce: 'n',
    signature: 's',
    status: 'ready',
    user: null,
    error: null,
    signingMessage: null,
  });
});

describe('useAgentSignFlow', () => {
  it('runs full happy-path: create → sign → confirm → success', async () => {
    vi.mocked(agentApi.create).mockResolvedValue({
      agent_address: '0xagent',
      label: 'main',
      spending_limit_usd: 1000,
      sign_payload: { message: { nonce: 999 } },
    });
    vi.mocked(eip712Sign).mockResolvedValue('0xsig');
    vi.mocked(agentApi.confirm).mockResolvedValue({
      id: 1,
      agent_address: '0xagent',
      label: 'main',
      spending_limit_usd: 1000,
      is_active: true,
      spent_today_usd: 0,
      created_at: '2026-05-28T00:00:00Z',
    });
    vi.mocked(detectCoin98).mockReturnValue({ request: vi.fn() } as never);

    const { result } = renderHook(() => useAgentSignFlow());
    expect(result.current.state).toEqual({ stage: 'idle' });

    await act(async () => {
      await result.current.run({ label: 'main', spendingLimitUsd: 1000 });
    });

    expect(agentApi.create).toHaveBeenCalledWith({
      label: 'main',
      spending_limit_usd: 1000,
    });
    expect(eip712Sign).toHaveBeenCalledWith(expect.anything(), '0xuser', {
      message: { nonce: 999 },
    });
    expect(agentApi.confirm).toHaveBeenCalledWith({
      wallet_address: '0xuser',
      agent_address: '0xagent',
      signature: '0xsig',
      nonce: 999,
    });
    await waitFor(() => expect(result.current.state.stage).toBe('success'));
  });

  it('reports userRejected error when wallet sign throws UserRejectedError', async () => {
    const { UserRejectedError } =
      await import('@/features/wallet-auth/wallet.provider');
    vi.mocked(agentApi.create).mockResolvedValue({
      agent_address: '0xagent',
      label: null,
      spending_limit_usd: null,
      sign_payload: { message: { nonce: 1 } },
    });
    vi.mocked(eip712Sign).mockRejectedValue(new UserRejectedError());
    vi.mocked(detectCoin98).mockReturnValue({ request: vi.fn() } as never);

    const { result } = renderHook(() => useAgentSignFlow());
    await act(async () => {
      await result.current.run({});
    });
    expect(result.current.state.stage).toBe('error');
    if (result.current.state.stage === 'error') {
      expect(result.current.state.userRejected).toBe(true);
    }
  });

  it('reset() returns to idle', async () => {
    const { result } = renderHook(() => useAgentSignFlow());
    act(() => result.current.reset());
    expect(result.current.state).toEqual({ stage: 'idle' });
  });

  it('errors immediately when wallet address is null (no-address guard)', async () => {
    useWalletStore.setState({
      address: null,
      nonce: 'n',
      signature: 's',
      status: 'ready',
      user: null,
      error: null,
      signingMessage: null,
    });

    const { result } = renderHook(() => useAgentSignFlow());
    await act(async () => {
      await result.current.run({});
    });

    expect(result.current.state.stage).toBe('error');
    if (result.current.state.stage === 'error') {
      expect(result.current.state.userRejected).toBe(false);
    }
    expect(agentApi.create).not.toHaveBeenCalled();
  });

  it('errors immediately when no Coin98 provider detected (no-provider guard)', async () => {
    vi.mocked(detectCoin98).mockReturnValue(null);

    const { result } = renderHook(() => useAgentSignFlow());
    await act(async () => {
      await result.current.run({});
    });

    expect(result.current.state.stage).toBe('error');
    if (result.current.state.stage === 'error') {
      expect(result.current.state.userRejected).toBe(false);
    }
    expect(agentApi.create).not.toHaveBeenCalled();
  });

  it('reports generic error (userRejected=false) when agentApi.confirm rejects', async () => {
    vi.mocked(detectCoin98).mockReturnValue({ request: vi.fn() } as never);
    vi.mocked(agentApi.create).mockResolvedValue({
      agent_address: '0xagent',
      label: null,
      spending_limit_usd: null,
      sign_payload: { message: { nonce: 42 } },
    });
    vi.mocked(eip712Sign).mockResolvedValue('0xsig');
    vi.mocked(agentApi.confirm).mockRejectedValue(new Error('BE 500'));

    const { result } = renderHook(() => useAgentSignFlow());
    await act(async () => {
      await result.current.run({});
    });

    expect(result.current.state.stage).toBe('error');
    if (result.current.state.stage === 'error') {
      expect(result.current.state.message).toBe('BE 500');
      expect(result.current.state.userRejected).toBe(false);
    }
  });

  it('reports a friendly deposit-required error when Hyperliquid rejects agent confirm', async () => {
    vi.mocked(detectCoin98).mockReturnValue({ request: vi.fn() } as never);
    vi.mocked(agentApi.create).mockResolvedValue({
      agent_address: '0xagent',
      label: null,
      spending_limit_usd: null,
      sign_payload: { message: { nonce: 42 } },
    });
    vi.mocked(eip712Sign).mockResolvedValue('0xsig');
    vi.mocked(agentApi.confirm).mockRejectedValue(
      new HttpError(
        400,
        '{"detail":"Hyperliquid requires a deposit before creating an agent wallet. Please deposit funds to your Hyperliquid account and try again. (Hyperliquid: Must deposit before performing actions. User: 0x718efe21485ba7a7fadd62ce49d8465b80905142)"}',
      ),
    );

    const { result } = renderHook(() => useAgentSignFlow());
    await act(async () => {
      await result.current.run({});
    });

    expect(result.current.state.stage).toBe('error');
    if (result.current.state.stage === 'error') {
      expect(result.current.state.message).toContain(
        'Hyperliquid yêu cầu account đã deposit',
      );
      expect(result.current.state.message).toContain(
        '0x718efe21485ba7a7fadd62ce49d8465b80905142',
      );
      expect(result.current.state.message).not.toContain('{"detail"');
      expect(result.current.state.userRejected).toBe(false);
    }
  });

  it("transitions to 'signing' with correct agentAddress while sign promise is pending", async () => {
    vi.mocked(detectCoin98).mockReturnValue({ request: vi.fn() } as never);
    vi.mocked(agentApi.create).mockResolvedValue({
      agent_address: '0xagent',
      label: null,
      spending_limit_usd: null,
      sign_payload: { message: { nonce: 7 } },
    });
    vi.mocked(agentApi.confirm).mockResolvedValue({
      id: 2,
      agent_address: '0xagent',
      label: null,
      spending_limit_usd: null,
      is_active: true,
      spent_today_usd: 0,
      created_at: '2026-06-01T00:00:00Z',
    });

    // Deferred promise so we can observe the 'signing' stage before resolution.
    let resolveSign!: (sig: string) => void;
    const signPromise = new Promise<string>((r) => {
      resolveSign = r;
    });
    vi.mocked(eip712Sign).mockReturnValue(signPromise);

    const { result } = renderHook(() => useAgentSignFlow());

    // Start run without awaiting so we can inspect intermediate state.
    act(() => {
      void result.current.run({});
    });

    // Wait for the 'signing' stage — agentApi.create resolves synchronously
    // (mockResolvedValue), so after the microtask queue drains we should be
    // in 'signing' with the agentAddress set.
    await waitFor(() => expect(result.current.state.stage).toBe('signing'));
    if (result.current.state.stage === 'signing') {
      expect(result.current.state.agentAddress).toBe('0xagent');
    }

    // Now let the sign promise resolve and wait for success.
    await act(async () => {
      resolveSign('0xsig');
    });
    await waitFor(() => expect(result.current.state.stage).toBe('success'));
  });
});
