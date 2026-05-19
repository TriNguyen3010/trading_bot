import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useWalletEvents } from './useWalletEvents';
import { useWalletStore } from './wallet.store';
import type { EthereumProvider } from './wallet.types';

vi.mock('./wallet.provider', async () => {
  const actual =
    await vi.importActual<typeof import('./wallet.provider')>(
      './wallet.provider',
    );
  return { ...actual, detectCoin98: vi.fn() };
});

import { detectCoin98 } from './wallet.provider';

describe('useWalletEvents', () => {
  let onHandlers: Record<string, (...args: unknown[]) => void>;
  let provider: EthereumProvider;

  beforeEach(() => {
    onHandlers = {};
    provider = {
      request: vi.fn(),
      on: vi.fn((event: string, handler: (...args: unknown[]) => void) => {
        onHandlers[event] = handler;
      }),
      removeListener: vi.fn(),
    };
    vi.mocked(detectCoin98).mockReturnValue(provider);
    useWalletStore.setState({
      address: '0xabc',
      nonce: 'n',
      signature: 's',
      user: null,
      status: 'ready',
      error: null,
      signingMessage: null,
    });
    Object.defineProperty(window, 'location', {
      writable: true,
      value: { ...window.location, href: '' },
    });
  });

  it('attaches accountsChanged + disconnect listeners on mount', () => {
    renderHook(() => useWalletEvents());
    expect(provider.on).toHaveBeenCalledWith(
      'accountsChanged',
      expect.any(Function),
    );
    expect(provider.on).toHaveBeenCalledWith(
      'disconnect',
      expect.any(Function),
    );
  });

  it('removes listeners on unmount', () => {
    const { unmount } = renderHook(() => useWalletEvents());
    unmount();
    expect(provider.removeListener).toHaveBeenCalledWith(
      'accountsChanged',
      expect.any(Function),
    );
    expect(provider.removeListener).toHaveBeenCalledWith(
      'disconnect',
      expect.any(Function),
    );
  });

  it('on accountsChanged with different address → disconnect + redirect to /', async () => {
    const disconnectSpy = vi
      .spyOn(useWalletStore.getState(), 'disconnect')
      .mockResolvedValueOnce();
    renderHook(() => useWalletEvents());

    await onHandlers.accountsChanged(['0xDIFFERENT']);

    expect(disconnectSpy).toHaveBeenCalled();
    expect(window.location.href).toBe('/');
  });

  it('on accountsChanged with empty array → disconnect + redirect to /', async () => {
    const disconnectSpy = vi
      .spyOn(useWalletStore.getState(), 'disconnect')
      .mockResolvedValueOnce();
    renderHook(() => useWalletEvents());

    await onHandlers.accountsChanged([]);

    expect(disconnectSpy).toHaveBeenCalled();
    expect(window.location.href).toBe('/');
  });

  it('on accountsChanged with same address → no-op', async () => {
    const disconnectSpy = vi
      .spyOn(useWalletStore.getState(), 'disconnect')
      .mockResolvedValueOnce();
    renderHook(() => useWalletEvents());

    await onHandlers.accountsChanged(['0xABC']);

    expect(disconnectSpy).not.toHaveBeenCalled();
  });

  it('on disconnect event → disconnect + redirect to /', async () => {
    const disconnectSpy = vi
      .spyOn(useWalletStore.getState(), 'disconnect')
      .mockResolvedValueOnce();
    renderHook(() => useWalletEvents());

    await onHandlers.disconnect();

    expect(disconnectSpy).toHaveBeenCalled();
    expect(window.location.href).toBe('/');
  });

  it('does nothing when no provider', () => {
    vi.mocked(detectCoin98).mockReturnValue(null);
    expect(() => renderHook(() => useWalletEvents())).not.toThrow();
  });

  it('polls for late-injected provider and attaches once found', async () => {
    vi.useFakeTimers();
    vi.mocked(detectCoin98).mockReturnValueOnce(null);
    vi.mocked(detectCoin98).mockReturnValue(provider);

    try {
      renderHook(() => useWalletEvents());
      expect(provider.on).not.toHaveBeenCalled();

      await vi.advanceTimersByTimeAsync(500);
      expect(provider.on).toHaveBeenCalledWith(
        'accountsChanged',
        expect.any(Function),
      );
    } finally {
      vi.useRealTimers();
    }
  });
});
