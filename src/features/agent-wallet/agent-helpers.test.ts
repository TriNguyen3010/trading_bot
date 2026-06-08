import { describe, it, expect, vi } from 'vitest';
import {
  extractNonceFromSignPayload,
  formatSpendingLimit,
  eip712Sign,
  isAgentCapFull,
  isHyperliquidDepositRequired,
  formatAgentFlowError,
  extractEip712ChainId,
  WalletChainError,
} from './agent-helpers';
import {
  UserRejectedError,
  NoProviderError,
} from '@/features/wallet-auth/wallet.provider';
import { HttpError } from '@/lib/http';

describe('extractNonceFromSignPayload', () => {
  it('returns nonce from message.nonce', () => {
    const payload = { message: { nonce: 1234567890123 } };
    expect(extractNonceFromSignPayload(payload)).toBe(1234567890123);
  });
  it('returns 0 if shape unexpected', () => {
    expect(extractNonceFromSignPayload({})).toBe(0);
    expect(extractNonceFromSignPayload(null)).toBe(0);
    expect(extractNonceFromSignPayload({ message: {} })).toBe(0);
  });
});

describe('formatSpendingLimit', () => {
  it('formats positive numbers as USD', () => {
    expect(formatSpendingLimit(1000)).toBe('$1,000');
    expect(formatSpendingLimit(50.5)).toBe('$50.50');
  });
  it('renders "No limit" for null/undefined', () => {
    expect(formatSpendingLimit(null)).toBe('No limit');
    expect(formatSpendingLimit(undefined)).toBe('No limit');
  });
});

describe('eip712Sign', () => {
  it('calls provider.request with eth_signTypedData_v4', async () => {
    const request = vi.fn().mockResolvedValue('0xsignature');
    const provider = { request } as never;
    const typedData = { primaryType: 'ApproveAgent', message: {} };
    const sig = await eip712Sign(provider, '0xuser', typedData);
    expect(request).toHaveBeenCalledWith({
      method: 'eth_signTypedData_v4',
      params: ['0xuser', JSON.stringify(typedData)],
    });
    expect(sig).toBe('0xsignature');
  });

  it('does not switch chain when EIP-712 domain chainId matches the active chain', async () => {
    const typedData = { domain: { chainId: 42161 }, message: {} };
    const request = vi.fn(async ({ method }: { method: string }) => {
      if (method === 'eth_chainId') return '0xa4b1';
      if (method === 'eth_signTypedData_v4') return '0xsignature';
      throw new Error(`unexpected method ${method}`);
    });
    const provider = { request } as never;

    await expect(eip712Sign(provider, '0xuser', typedData)).resolves.toBe(
      '0xsignature',
    );
    expect(request).not.toHaveBeenCalledWith(
      expect.objectContaining({ method: 'wallet_switchEthereumChain' }),
    );
  });

  it('switches to the EIP-712 domain chain before signing when wallet is on another chain', async () => {
    const typedData = { domain: { chainId: 42161 }, message: {} };
    const request = vi.fn(async ({ method }: { method: string }) => {
      if (method === 'eth_chainId') return '0x58';
      if (method === 'wallet_switchEthereumChain') return null;
      if (method === 'eth_signTypedData_v4') return '0xsignature';
      throw new Error(`unexpected method ${method}`);
    });
    const provider = { request } as never;

    await expect(eip712Sign(provider, '0xuser', typedData)).resolves.toBe(
      '0xsignature',
    );
    expect(request.mock.calls.map(([arg]) => arg.method)).toEqual([
      'eth_chainId',
      'wallet_switchEthereumChain',
      'eth_signTypedData_v4',
    ]);
    expect(request).toHaveBeenCalledWith({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: '0xa4b1' }],
    });
  });

  it('throws a clear chain error when wallet cannot switch to the EIP-712 domain chain', async () => {
    const typedData = { domain: { chainId: 42161 }, message: {} };
    const request = vi.fn(async ({ method }: { method: string }) => {
      if (method === 'eth_chainId') return '0x58';
      if (method === 'wallet_switchEthereumChain') throw new Error('nope');
      throw new Error(`unexpected method ${method}`);
    });
    const provider = { request } as never;

    await expect(eip712Sign(provider, '0xuser', typedData)).rejects.toThrow(
      WalletChainError,
    );
  });

  it('throws UserRejectedError when provider rejects with code 4001', async () => {
    const request = vi.fn().mockRejectedValue({ code: 4001 });
    const provider = { request } as never;
    await expect(eip712Sign(provider, '0xuser', {})).rejects.toBeInstanceOf(
      UserRejectedError,
    );
  });

  it('rethrows original error when provider rejects with a non-4001 error', async () => {
    const originalError = new Error('boom');
    const request = vi.fn().mockRejectedValue(originalError);
    const provider = { request } as never;
    await expect(eip712Sign(provider, '0xuser', {})).rejects.toBe(
      originalError,
    );
    await expect(eip712Sign(provider, '0xuser', {})).rejects.not.toBeInstanceOf(
      UserRejectedError,
    );
  });

  it('throws NoProviderError when called with a falsy provider', async () => {
    await expect(
      eip712Sign(null as never, '0xuser', {}),
    ).rejects.toBeInstanceOf(NoProviderError);
  });
});

describe('extractEip712ChainId', () => {
  it('reads numeric, decimal-string, and hex-string domain chainId values', () => {
    expect(extractEip712ChainId({ domain: { chainId: 42161 } })).toBe(42161);
    expect(extractEip712ChainId({ domain: { chainId: '42161' } })).toBe(42161);
    expect(extractEip712ChainId({ domain: { chainId: '0xa4b1' } })).toBe(42161);
  });

  it('returns null when typed data has no parseable domain chainId', () => {
    expect(extractEip712ChainId({})).toBeNull();
    expect(extractEip712ChainId({ domain: {} })).toBeNull();
    expect(extractEip712ChainId(null)).toBeNull();
  });
});

describe('isAgentCapFull', () => {
  it('returns true for HttpError whose body contains "too many" and "agent" (case-insensitive)', () => {
    const err = new HttpError(
      400,
      '{"detail":"Too many extra agents — limit is 3"}',
    );
    expect(isAgentCapFull(err)).toBe(true);
  });

  it('returns true when message has "TOO MANY" and "AGENT" uppercased', () => {
    const err = new HttpError(400, 'TOO MANY AGENTS');
    expect(isAgentCapFull(err)).toBe(true);
  });

  it('returns false when only "too many" matches but "agent" is absent', () => {
    const err = new HttpError(400, 'Too many requests');
    expect(isAgentCapFull(err)).toBe(false);
  });

  it('returns false when only "agent" matches but "too many" is absent', () => {
    const err = new HttpError(400, 'agent wallet error');
    expect(isAgentCapFull(err)).toBe(false);
  });

  it('returns true for a plain Error whose message contains both keywords', () => {
    const err = new Error('too many agent connections');
    expect(isAgentCapFull(err)).toBe(true);
  });

  it('returns false for a plain Error whose message lacks both keywords', () => {
    const err = new Error('something went wrong');
    expect(isAgentCapFull(err)).toBe(false);
  });

  it('returns false for a non-Error value', () => {
    expect(isAgentCapFull('too many agents')).toBe(false);
    expect(isAgentCapFull(null)).toBe(false);
    expect(isAgentCapFull(undefined)).toBe(false);
  });
});

describe('Hyperliquid deposit-required error helpers', () => {
  it('detects Hyperliquid must-deposit errors from BE JSON detail', () => {
    const err = new HttpError(
      400,
      '{"detail":"Hyperliquid requires a deposit before creating an agent wallet. Please deposit funds to your Hyperliquid account and try again. (Hyperliquid: Must deposit before performing actions. User: 0x718efe21485ba7a7fadd62ce49d8465b80905142)"}',
    );
    expect(isHyperliquidDepositRequired(err)).toBe(true);
  });

  it('formats deposit-required errors as actionable Vietnamese copy', () => {
    const err = new HttpError(
      400,
      '{"detail":"Hyperliquid requires a deposit before creating an agent wallet. Please deposit funds to your Hyperliquid account and try again. (Hyperliquid: Must deposit before performing actions. User: 0x718efe21485ba7a7fadd62ce49d8465b80905142)"}',
    );
    expect(formatAgentFlowError(err)).toBe(
      'Hyperliquid yêu cầu account đã deposit trước khi tạo API/agent wallet. Hãy deposit USDC vào Hyperliquid cho ví 0x718efe21485ba7a7fadd62ce49d8465b80905142, chờ tiền được credit vào perps/cross margin, rồi thử Generate & Sign lại.',
    );
  });

  it('falls back to backend detail for other JSON HttpError bodies', () => {
    const err = new HttpError(400, '{"detail":"BE 500"}');
    expect(formatAgentFlowError(err)).toBe('BE 500');
  });
});
