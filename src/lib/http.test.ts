import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { http, ValidationError } from './http';

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

  it('clears auth and redirects on 401', async () => {
    localStorage.setItem(
      'auth-storage',
      JSON.stringify({ state: { token: 'expired', user: null } }),
    );

    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
      statusText: 'Unauthorized',
    });

    // Mock window.location
    const originalHref = window.location.href;
    Object.defineProperty(window, 'location', {
      writable: true,
      value: { ...window.location, href: originalHref },
    });

    await expect(http('GET', '/protected')).rejects.toThrow('Unauthorized');
    expect(localStorage.getItem('auth-storage')).toBeNull();
  });

  it('throws ValidationError on 422', async () => {
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

  it('throws Error with toast on other errors', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
      text: async () => 'Server exploded',
    });

    await expect(http('GET', '/fail')).rejects.toThrow('Server exploded');
  });
});
