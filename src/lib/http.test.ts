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

describe('http wrapper', () => {
  beforeEach(() => {
    localStorage.clear();
    mockFetch.mockReset();
    vi.mocked(toast.warning).mockClear();
    vi.mocked(toast.error).mockClear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('attaches Authorization header when token present', async () => {
    localStorage.setItem(
      'auth-storage',
      JSON.stringify({ state: { token: 'test-token', user: null } }),
    );
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ id: 1 }),
    });

    await http('GET', '/user/status');

    expect(mockFetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer test-token',
        }),
      }),
    );
  });

  it('returns parsed JSON on success', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ data: 'hello' }),
    });

    const result = await http('GET', '/test');
    expect(result).toEqual({ data: 'hello' });
  });

  it('clears auth and redirects on 401 for protected endpoint', async () => {
    localStorage.setItem(
      'auth-storage',
      JSON.stringify({ state: { token: 'expired', user: null } }),
    );

    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
      statusText: 'Unauthorized',
    });

    const originalHref = window.location.href;
    Object.defineProperty(window, 'location', {
      writable: true,
      value: { ...window.location, href: originalHref },
    });

    try {
      await http('GET', '/protected');
      expect.unreachable('should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(HttpError);
      expect((err as HttpError).status).toBe(401);
    }
    expect(localStorage.getItem('auth-storage')).toBeNull();
    expect(toast.warning).toHaveBeenCalled();
  });

  it('does NOT clear auth or redirect on 401 for /user/login', async () => {
    localStorage.setItem(
      'auth-storage',
      JSON.stringify({ state: { token: 'preserved', user: null } }),
    );

    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
      statusText: 'Unauthorized',
      text: async () => 'Invalid credentials',
    });

    try {
      await http('POST', '/user/login', { email: 'a', password: 'b' });
      expect.unreachable('should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(HttpError);
      expect((err as HttpError).status).toBe(401);
    }
    // Auth must remain intact — login flow handles its own error UX.
    expect(localStorage.getItem('auth-storage')).not.toBeNull();
    expect(toast.warning).not.toHaveBeenCalled();
    expect(toast.error).not.toHaveBeenCalled();
  });

  it('does NOT toast on network error for /user/login (LoginPage handles it)', async () => {
    mockFetch.mockRejectedValueOnce(new TypeError('Failed to fetch'));

    await expect(
      http('POST', '/user/login', { email: 'a', password: 'b' }),
    ).rejects.toThrow('Network error');
    expect(toast.error).not.toHaveBeenCalled();
  });

  it('does NOT toast on 5xx for /user/login (LoginPage handles it)', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
      text: async () => 'boom',
    });

    try {
      await http('POST', '/user/login', { email: 'a', password: 'b' });
      expect.unreachable('should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(HttpError);
      expect((err as HttpError).status).toBe(500);
    }
    expect(toast.error).not.toHaveBeenCalled();
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
        detail: [
          "Field 'body -> bot_name' (missing): Field required",
          "Field 'body -> stake_amount' (greater_than): Input should be greater than 0",
        ],
      }),
    });

    try {
      await http('POST', '/bot-strategy/create', {});
      expect.unreachable('should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(ValidationError);
      const detail = (err as ValidationError).detail;
      expect(detail).toEqual([
        { loc: ['body', 'bot_name'], msg: 'Field required', type: 'missing' },
        {
          loc: ['body', 'stake_amount'],
          msg: 'Input should be greater than 0',
          type: 'greater_than',
        },
      ]);
    }
  });

  describe('normalizeValidationDetail', () => {
    it('parses Gamma BE flat-string format', () => {
      const result = normalizeValidationDetail([
        "Field 'body -> bot_name' (missing): Field required",
      ]);
      expect(result).toEqual([
        { loc: ['body', 'bot_name'], msg: 'Field required', type: 'missing' },
      ]);
    });

    it('passes through FastAPI object format', () => {
      const result = normalizeValidationDetail([
        { loc: ['body', 'x'], msg: 'wrong', type: 'value_error' },
      ]);
      expect(result).toEqual([
        { loc: ['body', 'x'], msg: 'wrong', type: 'value_error' },
      ]);
    });

    it('falls back gracefully on unknown string format', () => {
      const result = normalizeValidationDetail(['just a message']);
      expect(result).toEqual([
        { loc: [], msg: 'just a message', type: 'unknown' },
      ]);
    });

    it('wraps non-array input', () => {
      const result = normalizeValidationDetail('boom');
      expect(result).toEqual([{ loc: [], msg: 'boom', type: 'unknown' }]);
    });
  });

  it('throws HttpError with status + toast on other server errors', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
      text: async () => 'Server exploded',
    });

    try {
      await http('GET', '/fail');
      expect.unreachable('should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(HttpError);
      expect((err as HttpError).status).toBe(500);
      expect((err as HttpError).body).toBe('Server exploded');
    }
    expect(toast.error).toHaveBeenCalledWith('Server exploded');
  });
});
