import { describe, it, expect, vi } from 'vitest';
import {
  extractNonceFromSignPayload,
  formatSpendingLimit,
  eip712Sign,
} from './agent-helpers';
import {
  UserRejectedError,
  NoProviderError,
} from '@/features/wallet-auth/wallet.provider';

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
