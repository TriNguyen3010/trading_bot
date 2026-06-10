import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { toast } from 'sonner';
import {
  http,
  HttpError,
  ValidationError,
  normalizeValidationDetail,
} from './http';

const mockFetch = vi.fn();
globalThis.fetch = mockFetch;

vi.mock('sonner', () => ({
  toast: {
    warning: vi.fn(),
    error: vi.fn(),
    success: vi.fn(),
  },
}));

const STORAGE_KEY = 'trading_bot_wallet_auth';

function setWalletCreds() {
  sessionStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      address: '0xabc',
      nonce: 'nonce123',
      signature: '0xsig',
    }),
  );
}

describe('http wrapper (wallet auth)', () => {
  beforeEach(() => {
    sessionStorage.clear();
    mockFetch.mockReset();
    vi.mocked(toast.warning).mockClear();
    vi.mocked(toast.error).mockClear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('attaches X-Wallet-* headers when credentials present', async () => {
    setWalletCreds();
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({}),
    });

    await http('GET', '/user/status');

    expect(mockFetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        headers: expect.objectContaining({
          'X-Wallet-Address': '0xabc',
          'X-Wallet-Nonce': 'nonce123',
          'X-Wallet-Signature': '0xsig',
        }),
      }),
    );
  });

  it('does NOT attach headers to /wallet/nonce (public path)', async () => {
    setWalletCreds();
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({}),
    });

    await http('GET', '/wallet/nonce?address=0xabc');

    const callHeaders = mockFetch.mock.calls[0][1].headers;
    expect(callHeaders['X-Wallet-Address']).toBeUndefined();
    expect(callHeaders['X-Wallet-Nonce']).toBeUndefined();
    expect(callHeaders['X-Wallet-Signature']).toBeUndefined();
  });

  it('clears sessionStorage and redirects on 401 for protected endpoint', async () => {
    setWalletCreds();
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
      statusText: 'Unauthorized',
      text: async () => 'expired',
    });

    Object.defineProperty(window, 'location', {
      writable: true,
      value: { ...window.location, href: '' },
    });

    await expect(http('GET', '/user/status')).rejects.toBeInstanceOf(HttpError);
    expect(sessionStorage.getItem(STORAGE_KEY)).toBeNull();
    expect(toast.warning).toHaveBeenCalled();
  });

  it('on 403 with BE {detail}: pass-through message, does NOT clear, does NOT redirect', async () => {
    setWalletCreds();
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 403,
      statusText: 'Forbidden',
      text: async () =>
        JSON.stringify({ detail: 'Signature does not match wallet address.' }),
    });

    await expect(http('GET', '/user/status')).rejects.toBeInstanceOf(HttpError);
    expect(sessionStorage.getItem(STORAGE_KEY)).not.toBeNull();
    expect(toast.error).toHaveBeenCalledWith(
      'Signature does not match wallet address.',
    );
  });

  it('on 403 with non-JSON body: uses raw text as toast message', async () => {
    setWalletCreds();
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 403,
      statusText: 'Forbidden',
      text: async () => 'Account has been disabled.',
    });

    await expect(http('GET', '/user/status')).rejects.toBeInstanceOf(HttpError);
    expect(toast.error).toHaveBeenCalledWith('Account has been disabled.');
  });

  it('on 403 with empty body: falls back to default message', async () => {
    setWalletCreds();
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 403,
      statusText: 'Forbidden',
      text: async () => '',
    });

    await expect(http('GET', '/user/status')).rejects.toBeInstanceOf(HttpError);
    expect(toast.error).toHaveBeenCalledWith('Access denied.');
  });

  it('does NOT toast 5xx for /bot-strategy/* (dialog handles)', async () => {
    setWalletCreds();
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      statusText: 'ISE',
      text: async () => 'boom',
    });

    await expect(
      http('POST', '/bot-strategy/create', {}),
    ).rejects.toBeInstanceOf(HttpError);
    expect(toast.error).not.toHaveBeenCalled();
  });

  it('does NOT toast 403 for /bot-strategy/* either (silent path)', async () => {
    setWalletCreds();
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 403,
      statusText: 'Forbidden',
      text: async () => 'denied',
    });

    await expect(
      http('POST', '/bot-strategy/create', {}),
    ).rejects.toBeInstanceOf(HttpError);
    expect(toast.error).not.toHaveBeenCalled();
  });

  it('does NOT toast 5xx for /agent/* (modal/dialog handles)', async () => {
    setWalletCreds();
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      statusText: 'ISE',
      text: async () => 'boom',
    });

    await expect(http('GET', '/agent/active')).rejects.toBeInstanceOf(
      HttpError,
    );
    expect(toast.error).not.toHaveBeenCalled();
  });

  it('throws HttpError + toast on other server errors', async () => {
    setWalletCreds();
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      statusText: 'ISE',
      text: async () => 'Server exploded',
    });

    await expect(http('GET', '/fail')).rejects.toBeInstanceOf(HttpError);
    expect(toast.error).toHaveBeenCalledWith('Server exploded');
  });

  // F4: public-path matching must be segment-aware, not a loose startsWith.
  it('attaches auth headers to a protected path that merely shares a public prefix', async () => {
    setWalletCreds();
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({}),
    });

    await http('GET', '/healthcheck-bots'); // shares "/health" prefix but is NOT public

    const h = mockFetch.mock.calls[0][1].headers;
    expect(h['X-Wallet-Address']).toBe('0xabc');
  });

  it('still treats /openapi.json as public (dotted extension)', async () => {
    setWalletCreds();
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({}),
    });

    await http('GET', '/openapi.json');

    const h = mockFetch.mock.calls[0][1].headers;
    expect(h['X-Wallet-Address']).toBeUndefined();
  });

  // F9: 401 must NOT trigger a full-page redirect when already on landing.
  it('redirects on 401 when NOT on landing', async () => {
    setWalletCreds();
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
      statusText: 'Unauthorized',
      text: async () => 'expired',
    });
    Object.defineProperty(window, 'location', {
      writable: true,
      value: { ...window.location, pathname: '/dashboard', href: 'x' },
    });

    await expect(http('GET', '/user/status')).rejects.toBeInstanceOf(HttpError);
    expect(window.location.href).toBe('/');
  });

  it('does NOT redirect on 401 when already on landing (/)', async () => {
    setWalletCreds();
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
      statusText: 'Unauthorized',
      text: async () => 'expired',
    });
    Object.defineProperty(window, 'location', {
      writable: true,
      value: { ...window.location, pathname: '/', href: 'untouched' },
    });

    await expect(http('GET', '/user/status')).rejects.toBeInstanceOf(HttpError);
    expect(sessionStorage.getItem(STORAGE_KEY)).toBeNull(); // still clears
    expect(window.location.href).toBe('untouched'); // but no redirect
  });

  // F8: a hostile/oversized non-JSON error body must not be reflected verbatim.
  it('falls back to generic message on HTML/oversized 5xx body', async () => {
    setWalletCreds();
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      statusText: 'ISE',
      text: async () => '<html><body>502 Bad Gateway proxy page</body></html>',
    });

    await expect(http('GET', '/fail')).rejects.toBeInstanceOf(HttpError);
    expect(toast.error).toHaveBeenCalledWith('Something went wrong.');
  });

  it('falls back to default message on HTML 403 body', async () => {
    setWalletCreds();
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 403,
      statusText: 'Forbidden',
      text: async () => '<html>403 Forbidden</html>',
    });

    await expect(http('GET', '/user/status')).rejects.toBeInstanceOf(HttpError);
    expect(toast.error).toHaveBeenCalledWith('Access denied.');
  });

  it('throws ValidationError on 422 with FastAPI object detail', async () => {
    const detail = [
      { loc: ['body', 'name'], msg: 'required', type: 'value_error' },
    ];
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 422,
      json: async () => ({ detail }),
    });

    try {
      await http('POST', '/create', {});
      expect.unreachable('should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(ValidationError);
      expect((err as ValidationError).detail).toEqual(detail);
    }
  });

  it('throws ValidationError on 422 with Gamma BE string detail (normalized)', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 422,
      json: async () => ({
        detail: ["Field 'body -> bot_name' (missing): Field required"],
      }),
    });

    try {
      await http('POST', '/bot-strategy/create', {});
      expect.unreachable('should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(ValidationError);
      expect((err as ValidationError).detail).toEqual([
        { loc: ['body', 'bot_name'], msg: 'Field required', type: 'missing' },
      ]);
    }
  });

  describe('normalizeValidationDetail', () => {
    it('parses Gamma BE flat-string format', () => {
      expect(
        normalizeValidationDetail([
          "Field 'body -> bot_name' (missing): Field required",
        ]),
      ).toEqual([
        { loc: ['body', 'bot_name'], msg: 'Field required', type: 'missing' },
      ]);
    });

    it('passes through FastAPI object format', () => {
      expect(
        normalizeValidationDetail([
          { loc: ['body', 'x'], msg: 'wrong', type: 'value_error' },
        ]),
      ).toEqual([{ loc: ['body', 'x'], msg: 'wrong', type: 'value_error' }]);
    });

    it('falls back gracefully on unknown string format', () => {
      expect(normalizeValidationDetail(['just a message'])).toEqual([
        { loc: [], msg: 'just a message', type: 'unknown' },
      ]);
    });

    it('wraps non-array input', () => {
      expect(normalizeValidationDetail('boom')).toEqual([
        { loc: [], msg: 'boom', type: 'unknown' },
      ]);
    });
  });
});
