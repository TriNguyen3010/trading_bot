# C98 Wallet Auth Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace email/password JWT auth with Coin98 wallet signature flow. User connects C98 wallet, signs a server-issued nonce, and every API call carries `X-Wallet-{Address,Nonce,Signature}` headers verified by the BE.

**Architecture:** New `src/features/wallet-auth/` folder mirroring shape of old `src/features/auth/`. Stateless auth — credentials live in `sessionStorage` under key `trading_bot_wallet_auth`, app bootstrap verifies via `/user/status`. No JWT, no zustand `persist` middleware (manual sessionStorage read/write). The HTTP wrapper `src/lib/http.ts` is rewritten to attach wallet headers + handle 401 (clear+redirect) / 403 (toast only).

**Tech Stack:** React 18 + Vite + TypeScript + Tailwind + Radix (shadcn) + Zustand + Sonner + Vitest + Testing Library. **No new dependencies** — uses `window.coin98.provider` (Coin98 EIP-1193 injection) directly.

**Reference spec:** [docs/superpowers/specs/2026-05-14-c98-wallet-auth-design.md](../specs/2026-05-14-c98-wallet-auth-design.md)

---

## File Structure

### Files created (under `src/features/wallet-auth/`)

| File | Responsibility |
|------|---------------|
| `wallet.types.ts` | Types: `WalletCredentials`, `NonceResponse`, `AuthUser`, `EthereumProvider` |
| `wallet.provider.ts` | Wallet detection + low-level RPC: `detectCoin98()`, `requestAccounts()`, `personalSign()` |
| `wallet.api.ts` | BE client: `getNonce()`, `getStatus()`, `disconnect()` |
| `wallet.store.ts` | Zustand store: state + actions `hydrate / connect / disconnect / loadUser / reset` |
| `ConnectWalletPage.tsx` | UI for `/connect` route (replaces `LoginPage`) |
| `ProtectedRoute.tsx` | Route guard (replaces `auth/ProtectedRoute`) |
| `useWalletEvents.ts` | Hook listening to `accountsChanged` + `disconnect` |
| `wallet.provider.test.ts` | Unit tests for provider module |
| `wallet.api.test.ts` | Unit tests for API client |
| `wallet.store.test.ts` | Unit tests for store actions |
| `ConnectWalletPage.test.tsx` | Component tests for connect UI |
| `useWalletEvents.test.ts` | Hook tests |

### Files modified

| File | Change |
|------|--------|
| `src/lib/http.ts` | Replace `Authorization: Bearer` with `X-Wallet-*` headers, swap localStorage→sessionStorage, add PUBLIC_PATHS whitelist, add 403 handler |
| `src/lib/http.test.ts` | Rewrite assertions for wallet headers + new 401/403 behaviour |
| `src/routes.tsx` | `/login` → `/connect`, swap `LoginPage` → `ConnectWalletPage`, swap auth/ProtectedRoute → wallet-auth/ProtectedRoute |
| `src/main.tsx` | Wrap router with `AppBootstrap` (hydrate + loadUser + mount `useWalletEvents`) |
| `src/test/setup.ts` | Add sessionStorage polyfill + global `window.coin98` stub |

### Files deleted

- `src/features/auth/LoginPage.tsx`
- `src/features/auth/auth.api.ts`
- `src/features/auth/auth.store.ts`
- `src/features/auth/auth.types.ts`
- `src/features/auth/auth.store.test.ts`
- `src/features/auth/ProtectedRoute.tsx`
- `src/features/auth/` (empty folder)

---

## Task 0: Prerequisites & branch setup

**Files:** None (git ops only)

- [ ] **Step 1: Verify `feat/auth-and-submit` merged to main**

Run:
```bash
git checkout main && git pull
git log --oneline -5
```
Expected: top commits include the email-login + submit-to-BE work that was on `feat/auth-and-submit`. If not, **STOP** and coordinate the merge first.

- [ ] **Step 2: Create wallet auth branch off main**

Run:
```bash
git checkout -b feat/wallet-auth
```
Expected: `Switched to a new branch 'feat/wallet-auth'`.

- [ ] **Step 3: Confirm BE endpoints exist (smoke check, optional but recommended)**

Run:
```bash
curl -s "http://tradingbot.ne.com:8088/wallet/nonce?address=0x0000000000000000000000000000000000000001" | head -c 200
echo
```
Expected: JSON response `{"nonce":"...","message":"..."}` (200), OR `{"detail":"..."}` (400/422 about address format).
If `404 Not Found` → BE endpoints not deployed yet. Continue with implementation in `VITE_BYPASS_AUTH=true` mode and resync before merging.

---

## Task 1: Wallet types

**Files:**
- Create: `src/features/wallet-auth/wallet.types.ts`

- [ ] **Step 1: Create types file**

Create `src/features/wallet-auth/wallet.types.ts`:

```ts
// Persisted shape — must match server expectations exactly.
// Lives in sessionStorage under key 'trading_bot_wallet_auth'.
export interface WalletCredentials {
  address: string;    // lowercase EVM address
  nonce: string;      // 32-char hex from /wallet/nonce
  signature: string;  // 132-char hex from personal_sign
}

export interface NonceResponse {
  nonce: string;
  message: string;
}

// /user/status response — see Q2 from BE.
// For wallet-only users, email is null and identity is wallet_address.
export interface AuthUser {
  id: number;
  email: string | null;
  wallet_address: string;
  is_active: boolean;
  is_admin: boolean;
}

// Minimal EIP-1193 provider shape we actually call.
export interface EthereumProvider {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
  on: (event: string, handler: (...args: unknown[]) => void) => void;
  removeListener: (event: string, handler: (...args: unknown[]) => void) => void;
}
```

- [ ] **Step 2: Verify typecheck passes**

Run: `pnpm typecheck`
Expected: PASS (no errors).

- [ ] **Step 3: Commit**

```bash
git add src/features/wallet-auth/wallet.types.ts
git commit -m "feat(wallet-auth): add types for credentials, nonce response, user, provider"
```

---

## Task 2: Wallet provider (detection + RPC)

**Files:**
- Create: `src/features/wallet-auth/wallet.provider.ts`
- Create: `src/features/wallet-auth/wallet.provider.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/features/wallet-auth/wallet.provider.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  detectCoin98,
  requestAccounts,
  personalSign,
  UserRejectedError,
  NoProviderError,
} from './wallet.provider';
import type { EthereumProvider } from './wallet.types';

function fakeProvider(): EthereumProvider {
  return {
    request: vi.fn(),
    on: vi.fn(),
    removeListener: vi.fn(),
  };
}

describe('wallet.provider', () => {
  beforeEach(() => {
    delete (window as unknown as { coin98?: unknown }).coin98;
    delete (window as unknown as { ethereum?: unknown }).ethereum;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('detectCoin98', () => {
    it('returns window.coin98.provider when present', () => {
      const p = fakeProvider();
      (window as unknown as { coin98: { provider: EthereumProvider } }).coin98 = { provider: p };
      expect(detectCoin98()).toBe(p);
    });

    it('falls back to window.ethereum when isCoin98=true', () => {
      const p = { ...fakeProvider(), isCoin98: true } as EthereumProvider & { isCoin98: true };
      (window as unknown as { ethereum: typeof p }).ethereum = p;
      expect(detectCoin98()).toBe(p);
    });

    it('returns null when neither provider exists', () => {
      expect(detectCoin98()).toBeNull();
    });

    it('returns null when only non-C98 window.ethereum exists', () => {
      (window as unknown as { ethereum: EthereumProvider }).ethereum = fakeProvider();
      expect(detectCoin98()).toBeNull();
    });
  });

  describe('requestAccounts', () => {
    it('returns lowercase addresses on success', async () => {
      const p = fakeProvider();
      vi.mocked(p.request).mockResolvedValueOnce(['0xABCdef0000000000000000000000000000000001']);
      const result = await requestAccounts(p);
      expect(result).toEqual(['0xabcdef0000000000000000000000000000000001']);
      expect(p.request).toHaveBeenCalledWith({ method: 'eth_requestAccounts' });
    });

    it('throws UserRejectedError on error code 4001', async () => {
      const p = fakeProvider();
      vi.mocked(p.request).mockRejectedValueOnce({ code: 4001, message: 'User rejected' });
      await expect(requestAccounts(p)).rejects.toBeInstanceOf(UserRejectedError);
    });

    it('throws UserRejectedError when wallet returns empty accounts (locked / cancelled password)', async () => {
      const p = fakeProvider();
      vi.mocked(p.request).mockResolvedValueOnce([]);
      await expect(requestAccounts(p)).rejects.toBeInstanceOf(UserRejectedError);
    });

    it('throws generic Error on other failures', async () => {
      const p = fakeProvider();
      vi.mocked(p.request).mockRejectedValueOnce(new Error('boom'));
      await expect(requestAccounts(p)).rejects.toThrow('boom');
    });
  });

  describe('personalSign', () => {
    it('returns signature on success', async () => {
      const p = fakeProvider();
      vi.mocked(p.request).mockResolvedValueOnce('0xdeadbeef');
      const sig = await personalSign(p, 'hello', '0xabc');
      expect(sig).toBe('0xdeadbeef');
      expect(p.request).toHaveBeenCalledWith({
        method: 'personal_sign',
        params: ['hello', '0xabc'],
      });
    });

    it('throws UserRejectedError on error code 4001', async () => {
      const p = fakeProvider();
      vi.mocked(p.request).mockRejectedValueOnce({ code: 4001 });
      await expect(personalSign(p, 'hello', '0xabc')).rejects.toBeInstanceOf(UserRejectedError);
    });

    it('NoProviderError thrown when null provider used', async () => {
      // @ts-expect-error — runtime safety check
      await expect(personalSign(null, 'm', '0x1')).rejects.toBeInstanceOf(NoProviderError);
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm vitest run src/features/wallet-auth/wallet.provider.test.ts`
Expected: FAIL — "Cannot find module './wallet.provider'".

- [ ] **Step 3: Implement the provider module**

Create `src/features/wallet-auth/wallet.provider.ts`:

```ts
import type { EthereumProvider } from './wallet.types';

export class UserRejectedError extends Error {
  constructor() {
    super('Bạn đã từ chối yêu cầu từ ví');
    this.name = 'UserRejectedError';
  }
}

export class NoProviderError extends Error {
  constructor() {
    super('Không tìm thấy ví Coin98');
    this.name = 'NoProviderError';
  }
}

interface RpcErrorLike {
  code?: number;
  message?: string;
}

function isUserReject(err: unknown): boolean {
  return typeof err === 'object' && err !== null && (err as RpcErrorLike).code === 4001;
}

export function detectCoin98(): EthereumProvider | null {
  const win = window as unknown as {
    coin98?: { provider?: EthereumProvider };
    ethereum?: EthereumProvider & { isCoin98?: boolean };
  };
  if (win.coin98?.provider) return win.coin98.provider;
  if (win.ethereum?.isCoin98) return win.ethereum;
  return null;
}

export async function requestAccounts(provider: EthereumProvider): Promise<string[]> {
  if (!provider) throw new NoProviderError();
  try {
    const result = (await provider.request({ method: 'eth_requestAccounts' })) as string[];
    // Empty array = wallet locked + user cancelled password prompt. Treat as reject.
    if (!result || result.length === 0) throw new UserRejectedError();
    return result.map((a) => a.toLowerCase());
  } catch (err) {
    if (err instanceof UserRejectedError) throw err;
    if (isUserReject(err)) throw new UserRejectedError();
    throw err;
  }
}

export async function personalSign(
  provider: EthereumProvider,
  message: string,
  address: string,
): Promise<string> {
  if (!provider) throw new NoProviderError();
  try {
    return (await provider.request({
      method: 'personal_sign',
      params: [message, address],
    })) as string;
  } catch (err) {
    if (isUserReject(err)) throw new UserRejectedError();
    throw err;
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm vitest run src/features/wallet-auth/wallet.provider.test.ts`
Expected: PASS — all tests green.

- [ ] **Step 5: Commit**

```bash
git add src/features/wallet-auth/wallet.provider.ts src/features/wallet-auth/wallet.provider.test.ts
git commit -m "feat(wallet-auth): add provider module (detect, request accounts, personal_sign)"
```

---

## Task 3: Wallet API client

**Files:**
- Create: `src/features/wallet-auth/wallet.api.ts`
- Create: `src/features/wallet-auth/wallet.api.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/features/wallet-auth/wallet.api.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { walletApi } from './wallet.api';

const mockFetch = vi.fn();
globalThis.fetch = mockFetch;

describe('walletApi', () => {
  beforeEach(() => {
    sessionStorage.clear();
    mockFetch.mockReset();
  });

  it('getNonce calls GET /wallet/nonce with lowercased address', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ nonce: 'abc123', message: 'Sign me' }),
    });

    const result = await walletApi.getNonce('0xABCdef0000000000000000000000000000000001');

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining(
        '/wallet/nonce?address=0xabcdef0000000000000000000000000000000001',
      ),
      expect.objectContaining({ method: 'GET' }),
    );
    expect(result).toEqual({ nonce: 'abc123', message: 'Sign me' });
  });

  it('getStatus calls GET /user/status', async () => {
    sessionStorage.setItem(
      'trading_bot_wallet_auth',
      JSON.stringify({ address: '0xabc', nonce: 'n', signature: 's' }),
    );
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        id: 1,
        email: null,
        wallet_address: '0xabc',
        is_active: true,
        is_admin: false,
      }),
    });

    const result = await walletApi.getStatus();

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/user/status'),
      expect.objectContaining({ method: 'GET' }),
    );
    expect(result.wallet_address).toBe('0xabc');
    expect(result.email).toBeNull();
  });

  it('disconnect POSTs to /wallet/disconnect with empty body', async () => {
    sessionStorage.setItem(
      'trading_bot_wallet_auth',
      JSON.stringify({ address: '0xabc', nonce: 'n', signature: 's' }),
    );
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ status: 'ok' }),
    });

    await walletApi.disconnect();

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/wallet/disconnect'),
      expect.objectContaining({ method: 'POST' }),
    );
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm vitest run src/features/wallet-auth/wallet.api.test.ts`
Expected: FAIL — "Cannot find module './wallet.api'".

- [ ] **Step 3: Implement the API client**

Create `src/features/wallet-auth/wallet.api.ts`:

```ts
import { http } from '@/lib/http';
import type { AuthUser, NonceResponse } from './wallet.types';

export const walletApi = {
  getNonce: (address: string) =>
    http<NonceResponse>('GET', `/wallet/nonce?address=${address.toLowerCase()}`),
  getStatus: () => http<AuthUser>('GET', '/user/status'),
  disconnect: () => http<{ status: string }>('POST', '/wallet/disconnect'),
};
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm vitest run src/features/wallet-auth/wallet.api.test.ts`
Expected: PASS — all tests green.

> Note: the `getStatus` and `disconnect` tests rely on `http.ts` reading sessionStorage. At this point `http.ts` still reads localStorage (Bearer token). That's fine for this task — `walletApi` only assert the request **method** and **URL**, not headers. Header assertions happen in Task 5 after `http.ts` is rewritten.

- [ ] **Step 5: Commit**

```bash
git add src/features/wallet-auth/wallet.api.ts src/features/wallet-auth/wallet.api.test.ts
git commit -m "feat(wallet-auth): add API client (getNonce, getStatus, disconnect)"
```

---

## Task 4: Update `http.ts` — X-Wallet-* headers + 403 handling

**Files:**
- Modify: `src/lib/http.ts` (entire file)
- Modify: `src/lib/http.test.ts` (entire file)

- [ ] **Step 1: Rewrite the tests first (TDD)**

Replace `src/lib/http.test.ts` entirely with:

```ts
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
    mockFetch.mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({}) });

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
    mockFetch.mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({}) });

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

  it('on 403: toasts error, does NOT clear, does NOT redirect', async () => {
    setWalletCreds();
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 403,
      statusText: 'Forbidden',
      text: async () => 'Signature mismatch',
    });

    await expect(http('GET', '/user/status')).rejects.toBeInstanceOf(HttpError);
    expect(sessionStorage.getItem(STORAGE_KEY)).not.toBeNull();
    expect(toast.error).toHaveBeenCalledWith(expect.stringContaining('Chữ ký'));
  });

  it('does NOT toast 5xx for /bot-strategy/* (dialog handles)', async () => {
    setWalletCreds();
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      statusText: 'ISE',
      text: async () => 'boom',
    });

    await expect(http('POST', '/bot-strategy/create', {})).rejects.toBeInstanceOf(HttpError);
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

    await expect(http('POST', '/bot-strategy/create', {})).rejects.toBeInstanceOf(HttpError);
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

  it('throws ValidationError on 422 with FastAPI object detail', async () => {
    const detail = [{ loc: ['body', 'name'], msg: 'required', type: 'value_error' }];
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
```

- [ ] **Step 2: Run tests to verify they fail (header assertions)**

Run: `pnpm vitest run src/lib/http.test.ts`
Expected: FAIL — assertions about `X-Wallet-*` headers fail because `http.ts` still attaches `Authorization`.

- [ ] **Step 3: Rewrite `src/lib/http.ts`**

Replace `src/lib/http.ts` entirely with:

```ts
import { toast } from 'sonner';

export type ValidationDetail = {
  loc: (string | number)[];
  msg: string;
  type: string;
};

export class ValidationError extends Error {
  detail: ValidationDetail[];

  constructor(detail: ValidationDetail[]) {
    super('Validation failed');
    this.name = 'ValidationError';
    this.detail = detail;
  }
}

const STRING_DETAIL_RE = /^Field '([^']+)' \(([^)]+)\): (.+)$/;

export function normalizeValidationDetail(raw: unknown): ValidationDetail[] {
  if (!Array.isArray(raw)) {
    return [
      {
        loc: [],
        msg: raw == null ? 'Validation failed' : String(raw),
        type: 'unknown',
      },
    ];
  }
  return raw.map((item): ValidationDetail => {
    if (typeof item === 'string') {
      const m = STRING_DETAIL_RE.exec(item);
      if (m) {
        return {
          loc: m[1].split(/\s*->\s*/),
          msg: m[3],
          type: m[2],
        };
      }
      return { loc: [], msg: item, type: 'unknown' };
    }
    if (item && typeof item === 'object') {
      const obj = item as Record<string, unknown>;
      return {
        loc: Array.isArray(obj.loc) ? (obj.loc as (string | number)[]) : [],
        msg: typeof obj.msg === 'string' ? obj.msg : String(obj.msg ?? ''),
        type: typeof obj.type === 'string' ? obj.type : 'unknown',
      };
    }
    return { loc: [], msg: String(item), type: 'unknown' };
  });
}

export class HttpError extends Error {
  status: number;
  body: string;

  constructor(status: number, body: string) {
    super(body || `HTTP ${status}`);
    this.name = 'HttpError';
    this.status = status;
    this.body = body;
  }
}

// Endpoints that BE explicitly does NOT require auth headers on
// (see BE Q1 response from Tuấn, 2026-05-14).
const PUBLIC_PATHS = [
  '/wallet/nonce',
  '/internal/',
  '/webhook/',
  '/docs',
  '/openapi',
  '/health',
];

// Endpoints with their own error UX (red box in dialog) → http.ts
// suppresses toast. 401 still triggers global clear+redirect.
const SILENT_TOAST_PREFIXES = ['/bot-strategy/', '/bot/'];

const STORAGE_KEY = 'trading_bot_wallet_auth';

interface WalletCreds {
  address: string;
  nonce: string;
  signature: string;
}

function isPublicPath(path: string): boolean {
  return PUBLIC_PATHS.some((p) => path.startsWith(p));
}

function hasSilentToast(path: string): boolean {
  return SILENT_TOAST_PREFIXES.some((p) => path.startsWith(p));
}

function getWalletCreds(): WalletCreds | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<WalletCreds>;
    if (!parsed.address || !parsed.nonce || !parsed.signature) return null;
    return parsed as WalletCreds;
  } catch {
    return null;
  }
}

function clearWalletAuth() {
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    /* noop */
  }
}

const baseURL = import.meta.env.VITE_API_BASE_URL ?? '';
const BYPASS_AUTH = import.meta.env.VITE_BYPASS_AUTH === 'true';

export async function http<T>(
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
  path: string,
  body?: unknown,
): Promise<T> {
  const url = `${baseURL}${path}`;
  const creds = getWalletCreds();
  const isPublic = isPublicPath(path);

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (creds && !isPublic && !BYPASS_AUTH) {
    headers['X-Wallet-Address'] = creds.address;
    headers['X-Wallet-Nonce'] = creds.nonce;
    headers['X-Wallet-Signature'] = creds.signature;
  }

  const silentToast = hasSilentToast(path);

  let res: Response;
  try {
    res = await fetch(url, {
      method,
      headers,
      body: body != null ? JSON.stringify(body) : undefined,
    });
  } catch {
    if (!silentToast) {
      toast.error('Không thể kết nối server. Vui lòng kiểm tra mạng.');
    }
    throw new Error('Network error');
  }

  // 401 anywhere → session expired / nonce invalid → clear + redirect.
  if (res.status === 401 && !BYPASS_AUTH) {
    clearWalletAuth();
    toast.warning('Phiên ví hết hạn, vui lòng kết nối lại.');
    window.location.href = '/connect';
    throw new HttpError(401, 'Unauthorized');
  }

  // 403 = signature mismatch. Per spec: toast, no clear, no redirect, no auto-retry.
  if (res.status === 403) {
    if (!silentToast) {
      toast.error('Chữ ký không khớp địa chỉ ví. Vui lòng kết nối lại.');
    }
    throw new HttpError(403, 'Forbidden');
  }

  if (res.status === 422) {
    const data = (await res.json().catch(() => ({}))) as { detail?: unknown };
    throw new ValidationError(normalizeValidationDetail(data?.detail));
  }

  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    if (!silentToast) {
      toast.error(text || 'Đã có lỗi xảy ra.');
    }
    throw new HttpError(res.status, text);
  }

  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm vitest run src/lib/http.test.ts`
Expected: PASS — all tests green.

- [ ] **Step 5: Verify wallet.api tests still pass after http.ts rewrite**

Run: `pnpm vitest run src/features/wallet-auth/wallet.api.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/http.ts src/lib/http.test.ts
git commit -m "refactor(http): replace Bearer with X-Wallet-* headers, add 403 handler + PUBLIC_PATHS"
```

---

## Task 5: Test setup — sessionStorage polyfill + global window.coin98 stub

**Files:**
- Modify: `src/test/setup.ts`

- [ ] **Step 1: Add sessionStorage polyfill and window.coin98 reset to test setup**

Modify `src/test/setup.ts` — append the following blocks at the end (after the existing localStorage polyfill):

```ts
// Mirror the localStorage polyfill for sessionStorage — same jsdom 25 +
// Node + vitest fragility surface. Wallet auth lives in sessionStorage
// so any test exercising http.ts / wallet.store needs setItem to work.
if (
  typeof globalThis.sessionStorage === 'undefined' ||
  typeof globalThis.sessionStorage.setItem !== 'function'
) {
  const store = new Map<string, string>();
  Object.defineProperty(globalThis, 'sessionStorage', {
    configurable: true,
    value: {
      getItem: (k: string) => (store.has(k) ? (store.get(k) as string) : null),
      setItem: (k: string, v: string) => store.set(k, String(v)),
      removeItem: (k: string) => store.delete(k),
      clear: () => store.clear(),
      key: (i: number) => Array.from(store.keys())[i] ?? null,
      get length() {
        return store.size;
      },
    } as Storage,
  });
}

// Wallet-auth tests stub `window.coin98` per-test. Provide a clean
// baseline (`undefined`) so a leaked stub from one test never bleeds
// into another.
if (typeof window !== 'undefined') {
  delete (window as unknown as { coin98?: unknown }).coin98;
}
```

- [ ] **Step 2: Run full test suite to verify nothing breaks**

Run: `pnpm test`
Expected: PASS — all existing + new wallet-auth tests pass.

- [ ] **Step 3: Commit**

```bash
git add src/test/setup.ts
git commit -m "test(setup): add sessionStorage polyfill + window.coin98 baseline reset"
```

---

## Task 6: Wallet store

**Files:**
- Create: `src/features/wallet-auth/wallet.store.ts`
- Create: `src/features/wallet-auth/wallet.store.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/features/wallet-auth/wallet.store.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useWalletStore } from './wallet.store';

vi.mock('./wallet.api', () => ({
  walletApi: {
    getNonce: vi.fn(),
    getStatus: vi.fn(),
    disconnect: vi.fn(),
  },
}));

vi.mock('./wallet.provider', async () => {
  const actual =
    await vi.importActual<typeof import('./wallet.provider')>('./wallet.provider');
  return {
    ...actual,
    detectCoin98: vi.fn(),
    requestAccounts: vi.fn(),
    personalSign: vi.fn(),
  };
});

import { walletApi } from './wallet.api';
import {
  detectCoin98,
  requestAccounts,
  personalSign,
  UserRejectedError,
} from './wallet.provider';
import type { EthereumProvider } from './wallet.types';

const fakeProvider: EthereumProvider = {
  request: vi.fn(),
  on: vi.fn(),
  removeListener: vi.fn(),
};

function resetStore() {
  useWalletStore.setState({
    address: null,
    nonce: null,
    signature: null,
    user: null,
    status: 'idle',
    error: null,
  });
}

describe('wallet.store', () => {
  beforeEach(() => {
    sessionStorage.clear();
    resetStore();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('hydrate', () => {
    it('loads credentials from sessionStorage', () => {
      sessionStorage.setItem(
        'trading_bot_wallet_auth',
        JSON.stringify({ address: '0xabc', nonce: 'n', signature: 's' }),
      );

      useWalletStore.getState().hydrate();

      const s = useWalletStore.getState();
      expect(s.address).toBe('0xabc');
      expect(s.nonce).toBe('n');
      expect(s.signature).toBe('s');
      expect(s.status).toBe('ready');
    });

    it('leaves state idle when sessionStorage is empty', () => {
      useWalletStore.getState().hydrate();
      expect(useWalletStore.getState().status).toBe('idle');
      expect(useWalletStore.getState().address).toBeNull();
    });

    it('handles malformed JSON without crashing', () => {
      sessionStorage.setItem('trading_bot_wallet_auth', 'not-json');
      useWalletStore.getState().hydrate();
      expect(useWalletStore.getState().status).toBe('idle');
    });
  });

  describe('connect', () => {
    it('happy path: detects → requests accounts → fetches nonce → signs → saves creds → verifies via /user/status', async () => {
      vi.mocked(detectCoin98).mockReturnValue(fakeProvider);
      vi.mocked(requestAccounts).mockResolvedValueOnce(['0xabc']);
      vi.mocked(walletApi.getNonce).mockResolvedValueOnce({
        nonce: 'n1',
        message: 'Sign me',
      });
      vi.mocked(personalSign).mockResolvedValueOnce('0xsig');
      vi.mocked(walletApi.getStatus).mockResolvedValueOnce({
        id: 1,
        email: null,
        wallet_address: '0xabc',
        is_active: true,
        is_admin: false,
      });

      await useWalletStore.getState().connect();

      const s = useWalletStore.getState();
      expect(s.address).toBe('0xabc');
      expect(s.nonce).toBe('n1');
      expect(s.signature).toBe('0xsig');
      expect(s.user?.wallet_address).toBe('0xabc');
      expect(s.status).toBe('ready');

      const stored = JSON.parse(
        sessionStorage.getItem('trading_bot_wallet_auth')!,
      );
      expect(stored).toEqual({ address: '0xabc', nonce: 'n1', signature: '0xsig' });
    });

    it('clears storage + error state when /user/status returns 403 (bad sig)', async () => {
      vi.mocked(detectCoin98).mockReturnValue(fakeProvider);
      vi.mocked(requestAccounts).mockResolvedValueOnce(['0xabc']);
      vi.mocked(walletApi.getNonce).mockResolvedValueOnce({
        nonce: 'n1',
        message: 'm',
      });
      vi.mocked(personalSign).mockResolvedValueOnce('0xsig');
      vi.mocked(walletApi.getStatus).mockRejectedValueOnce(
        Object.assign(new Error('Forbidden'), { name: 'HttpError', status: 403 }),
      );

      await useWalletStore.getState().connect();

      const s = useWalletStore.getState();
      expect(s.status).toBe('error');
      expect(s.address).toBeNull();
      expect(sessionStorage.getItem('trading_bot_wallet_auth')).toBeNull();
    });

    it('clears storage + error state when /user/status returns 401', async () => {
      vi.mocked(detectCoin98).mockReturnValue(fakeProvider);
      vi.mocked(requestAccounts).mockResolvedValueOnce(['0xabc']);
      vi.mocked(walletApi.getNonce).mockResolvedValueOnce({
        nonce: 'n1',
        message: 'm',
      });
      vi.mocked(personalSign).mockResolvedValueOnce('0xsig');
      vi.mocked(walletApi.getStatus).mockRejectedValueOnce(
        Object.assign(new Error('Unauthorized'), { name: 'HttpError', status: 401 }),
      );

      await useWalletStore.getState().connect();

      const s = useWalletStore.getState();
      expect(s.status).toBe('error');
      expect(sessionStorage.getItem('trading_bot_wallet_auth')).toBeNull();
    });

    it('clears storage + error state on network error during /user/status', async () => {
      vi.mocked(detectCoin98).mockReturnValue(fakeProvider);
      vi.mocked(requestAccounts).mockResolvedValueOnce(['0xabc']);
      vi.mocked(walletApi.getNonce).mockResolvedValueOnce({
        nonce: 'n1',
        message: 'm',
      });
      vi.mocked(personalSign).mockResolvedValueOnce('0xsig');
      vi.mocked(walletApi.getStatus).mockRejectedValueOnce(new Error('Network error'));

      await useWalletStore.getState().connect();
      expect(useWalletStore.getState().status).toBe('error');
      expect(sessionStorage.getItem('trading_bot_wallet_auth')).toBeNull();
    });

    it('sets status="no-c98" when provider not detected', async () => {
      vi.mocked(detectCoin98).mockReturnValue(null);

      await useWalletStore.getState().connect();

      expect(useWalletStore.getState().status).toBe('no-c98');
      expect(useWalletStore.getState().address).toBeNull();
    });

    it('sets error state when user rejects account request', async () => {
      vi.mocked(detectCoin98).mockReturnValue(fakeProvider);
      vi.mocked(requestAccounts).mockRejectedValueOnce(new UserRejectedError());

      await useWalletStore.getState().connect();

      const s = useWalletStore.getState();
      expect(s.status).toBe('error');
      expect(s.error).toContain('từ chối');
    });

    it('sets error state when user rejects signing', async () => {
      vi.mocked(detectCoin98).mockReturnValue(fakeProvider);
      vi.mocked(requestAccounts).mockResolvedValueOnce(['0xabc']);
      vi.mocked(walletApi.getNonce).mockResolvedValueOnce({
        nonce: 'n',
        message: 'm',
      });
      vi.mocked(personalSign).mockRejectedValueOnce(new UserRejectedError());

      await useWalletStore.getState().connect();

      expect(useWalletStore.getState().status).toBe('error');
      expect(sessionStorage.getItem('trading_bot_wallet_auth')).toBeNull();
    });

    it('sets error when getNonce fails', async () => {
      vi.mocked(detectCoin98).mockReturnValue(fakeProvider);
      vi.mocked(requestAccounts).mockResolvedValueOnce(['0xabc']);
      vi.mocked(walletApi.getNonce).mockRejectedValueOnce(new Error('500'));

      await useWalletStore.getState().connect();
      expect(useWalletStore.getState().status).toBe('error');
    });

    // Bảo vệ fix của commit f56ecaf: nếu /user/status fail sau khi sign,
    // KHÔNG được set status='ready'. Nếu test này fail → regression của bug
    // "user vào builder với cred xấu".
    it('clears creds and sets error when /user/status fails after sign', async () => {
      vi.mocked(detectCoin98).mockReturnValue(fakeProvider);
      vi.mocked(requestAccounts).mockResolvedValueOnce(['0xabc']);
      vi.mocked(walletApi.getNonce).mockResolvedValueOnce({
        nonce: 'n',
        message: 'm',
      });
      vi.mocked(personalSign).mockResolvedValueOnce('0xsig');
      vi.mocked(walletApi.getStatus).mockRejectedValueOnce(
        new HttpError(403, 'Forbidden'),
      );

      await useWalletStore.getState().connect();

      const s = useWalletStore.getState();
      expect(s.status).toBe('error');
      expect(s.address).toBeNull();
      expect(s.nonce).toBeNull();
      expect(s.signature).toBeNull();
      expect(sessionStorage.getItem('trading_bot_wallet_auth')).toBeNull();
    });
  });

  describe('disconnect', () => {
    it('clears sessionStorage + state and calls BE disconnect (best-effort)', async () => {
      sessionStorage.setItem(
        'trading_bot_wallet_auth',
        JSON.stringify({ address: '0xabc', nonce: 'n', signature: 's' }),
      );
      useWalletStore.setState({
        address: '0xabc',
        nonce: 'n',
        signature: 's',
        user: {
          id: 1,
          email: null,
          wallet_address: '0xabc',
          is_active: true,
          is_admin: false,
        },
        status: 'ready',
        error: null,
      });
      vi.mocked(walletApi.disconnect).mockResolvedValueOnce({ status: 'ok' });

      await useWalletStore.getState().disconnect();

      expect(sessionStorage.getItem('trading_bot_wallet_auth')).toBeNull();
      const s = useWalletStore.getState();
      expect(s.address).toBeNull();
      expect(s.user).toBeNull();
      expect(s.status).toBe('idle');
      expect(walletApi.disconnect).toHaveBeenCalled();
    });

    it('still clears local state when BE disconnect fails', async () => {
      sessionStorage.setItem(
        'trading_bot_wallet_auth',
        JSON.stringify({ address: '0xabc', nonce: 'n', signature: 's' }),
      );
      useWalletStore.setState({
        address: '0xabc',
        nonce: 'n',
        signature: 's',
        user: null,
        status: 'ready',
        error: null,
      });
      vi.mocked(walletApi.disconnect).mockRejectedValueOnce(new Error('network'));

      await useWalletStore.getState().disconnect();

      expect(sessionStorage.getItem('trading_bot_wallet_auth')).toBeNull();
      expect(useWalletStore.getState().address).toBeNull();
    });
  });

  describe('loadUser', () => {
    it('sets user on success', async () => {
      useWalletStore.setState({
        address: '0xabc',
        nonce: 'n',
        signature: 's',
        user: null,
        status: 'ready',
        error: null,
      });
      vi.mocked(walletApi.getStatus).mockResolvedValueOnce({
        id: 2,
        email: null,
        wallet_address: '0xabc',
        is_active: true,
        is_admin: false,
      });

      await useWalletStore.getState().loadUser();
      expect(useWalletStore.getState().user?.id).toBe(2);
    });

    it('swallows errors silently (http.ts handles 401/403)', async () => {
      vi.mocked(walletApi.getStatus).mockRejectedValueOnce(new Error('boom'));
      await expect(useWalletStore.getState().loadUser()).resolves.toBeUndefined();
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm vitest run src/features/wallet-auth/wallet.store.test.ts`
Expected: FAIL — "Cannot find module './wallet.store'".

- [ ] **Step 3: Implement the store**

Create `src/features/wallet-auth/wallet.store.ts`:

```ts
import { create } from 'zustand';
import { walletApi } from './wallet.api';
import {
  detectCoin98,
  requestAccounts,
  personalSign,
  UserRejectedError,
  NoProviderError,
} from './wallet.provider';
import type { AuthUser } from './wallet.types';

const STORAGE_KEY = 'trading_bot_wallet_auth';

export type WalletStatus =
  | 'idle'
  | 'detecting'
  | 'no-c98'
  | 'connecting'
  | 'signing'
  | 'ready'
  | 'error';

interface WalletState {
  address: string | null;
  nonce: string | null;
  signature: string | null;

  user: AuthUser | null;
  status: WalletStatus;
  error: string | null;

  hydrate: () => void;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  loadUser: () => Promise<void>;
  reset: () => void;
}

function writeStorage(creds: { address: string; nonce: string; signature: string }) {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(creds));
  } catch {
    /* noop */
  }
}

function clearStorage() {
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    /* noop */
  }
}

function readableError(err: unknown): string {
  if (err instanceof UserRejectedError) return 'Bạn đã từ chối yêu cầu từ ví Coin98.';
  if (err instanceof NoProviderError) return 'Không tìm thấy ví Coin98.';
  if (err instanceof Error) return err.message;
  return 'Đã có lỗi xảy ra. Vui lòng thử lại.';
}

export const useWalletStore = create<WalletState>()((set, get) => ({
  address: null,
  nonce: null,
  signature: null,
  user: null,
  status: 'idle',
  error: null,

  hydrate: () => {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as {
        address?: string;
        nonce?: string;
        signature?: string;
      };
      if (parsed.address && parsed.nonce && parsed.signature) {
        set({
          address: parsed.address,
          nonce: parsed.nonce,
          signature: parsed.signature,
          status: 'ready',
        });
      }
    } catch {
      /* malformed — leave idle */
    }
  },

  connect: async () => {
    set({ status: 'detecting', error: null });
    const provider = detectCoin98();
    if (!provider) {
      set({ status: 'no-c98' });
      return;
    }

    try {
      set({ status: 'connecting' });
      const [address] = await requestAccounts(provider);

      set({ status: 'signing', address });
      const { nonce, message } = await walletApi.getNonce(address);
      const signature = await personalSign(provider, message, address);

      writeStorage({ address, nonce, signature });
      set({ address, nonce, signature });

      // Verify credentials by calling /user/status DIRECTLY.
      // Do NOT call loadUser() — it swallows errors, which would let 403/401/network
      // failures slip through and set status='ready' with bad credentials.
      const user = await walletApi.getStatus();
      set({ user, status: 'ready' });
    } catch (err) {
      clearStorage();
      set({
        address: null,
        nonce: null,
        signature: null,
        user: null,
        status: 'error',
        error: readableError(err),
      });
    }
  },

  disconnect: async () => {
    // BẮT BUỘC await: BE xoá wallet_nonce:0x... ở Redis. Nếu FE chỉ clear local
    // mà không gọi BE → nonce cũ còn valid 24h → cred bị steal vẫn auth được.
    // Caller PHẢI await action này trước khi navigate (xem useWalletEvents).
    // (Confirm với BE Tuấn 2026-05-19.)
    try {
      await walletApi.disconnect();
    } catch {
      /* ignore network/5xx — nonce sẽ tự expire ≤24h */
    }
    clearStorage();
    set({
      address: null,
      nonce: null,
      signature: null,
      user: null,
      status: 'idle',
      error: null,
    });
  },

  loadUser: async () => {
    try {
      const user = await walletApi.getStatus();
      set({ user });
    } catch {
      // http.ts already handles 401 (clear + redirect) and 403 (toast).
      // Other errors: leave state alone, UI will show stale user briefly.
    }
  },

  reset: () => {
    clearStorage();
    set({
      address: null,
      nonce: null,
      signature: null,
      user: null,
      status: 'idle',
      error: null,
    });
  },
}));

// Check cả 3 fields (match http.ts validation). Nếu chỉ check 2, partial-state
// edge case cho qua ProtectedRoute → 1 cycle thừa: request fail 401 →
// http.ts clear+redirect /connect. Không phải infinite loop nhưng UX có flash.
export const useIsAuthenticated = () =>
  useWalletStore((s) => !!s.address && !!s.nonce && !!s.signature);

// Run hydrate synchronously at module load — BEFORE any React render.
// Required so ProtectedRoute sees the right state on the first render after
// a page reload, instead of redirecting to /connect because the store hasn't
// caught up with sessionStorage yet. See "High #2 fix" in risk report.
if (typeof window !== 'undefined') {
  useWalletStore.getState().hydrate();
}
```

> **Why module-level hydrate?** `ProtectedRoute` reads store state during render. `useEffect` runs AFTER render. If hydrate lived in a `useEffect`, the first render after a reload would see an empty store → redirect to `/connect` even when sessionStorage has valid credentials. Module-level hydrate runs once at import time, before any component mounts.

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm vitest run src/features/wallet-auth/wallet.store.test.ts`
Expected: PASS — all tests green.

> The module-level hydrate runs once when `wallet.store.ts` is imported. In tests, `beforeEach` already resets state via `resetStore()`, so leftover hydration from a prior test doesn't bleed in.

- [ ] **Step 5: Commit**

```bash
git add src/features/wallet-auth/wallet.store.ts src/features/wallet-auth/wallet.store.test.ts
git commit -m "feat(wallet-auth): add zustand store with module-level hydrate; connect verifies via /user/status"
```

---

## Task 7: ProtectedRoute (wallet-auth version)

**Files:**
- Create: `src/features/wallet-auth/ProtectedRoute.tsx`
- (Note: existing `src/features/auth/ProtectedRoute.tsx` stays for now — Task 12 deletes the whole `auth/` folder.)

- [ ] **Step 1: Implement ProtectedRoute**

Create `src/features/wallet-auth/ProtectedRoute.tsx`:

```tsx
import { Navigate } from 'react-router-dom';
import { useIsAuthenticated } from './wallet.store';

const BYPASS_AUTH = import.meta.env.VITE_BYPASS_AUTH === 'true';

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useIsAuthenticated();
  if (!BYPASS_AUTH && !isAuthenticated) {
    return <Navigate to="/connect" replace />;
  }
  return <>{children}</>;
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/features/wallet-auth/ProtectedRoute.tsx
git commit -m "feat(wallet-auth): add ProtectedRoute guarding on wallet credentials"
```

---

## Task 8: ConnectWalletPage UI

**Files:**
- Create: `src/features/wallet-auth/ConnectWalletPage.tsx`
- Create: `src/features/wallet-auth/ConnectWalletPage.test.tsx`

- [ ] **Step 1: Write failing component tests**

Create `src/features/wallet-auth/ConnectWalletPage.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ConnectWalletPage } from './ConnectWalletPage';
import { useWalletStore } from './wallet.store';

function renderPage() {
  return render(
    <MemoryRouter>
      <ConnectWalletPage />
    </MemoryRouter>,
  );
}

describe('ConnectWalletPage', () => {
  beforeEach(() => {
    useWalletStore.setState({
      address: null,
      nonce: null,
      signature: null,
      user: null,
      status: 'idle',
      error: null,
    });
    vi.restoreAllMocks();
  });

  it('renders the Connect button in idle state', () => {
    renderPage();
    expect(
      screen.getByRole('button', { name: /kết nối coin98/i }),
    ).toBeInTheDocument();
  });

  it('renders install prompt when status=no-c98', () => {
    useWalletStore.setState({ status: 'no-c98' });
    renderPage();
    expect(screen.getByText(/chưa cài coin98/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /cài đặt coin98/i })).toBeInTheDocument();
  });

  it('shows signing state with cancel button', () => {
    useWalletStore.setState({
      status: 'signing',
      address: '0xabcdef0000000000000000000000000000000001',
    });
    renderPage();
    expect(screen.getByText(/mở coin98 để ký/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /huỷ/i })).toBeInTheDocument();
  });

  it('shows error message and retry button when status=error', () => {
    useWalletStore.setState({ status: 'error', error: 'Test error message' });
    renderPage();
    expect(screen.getByText('Test error message')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /thử lại/i })).toBeInTheDocument();
  });

  it('clicking Connect calls store.connect', async () => {
    const spy = vi.spyOn(useWalletStore.getState(), 'connect').mockResolvedValueOnce();
    renderPage();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /kết nối coin98/i }));
    });
    expect(spy).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm vitest run src/features/wallet-auth/ConnectWalletPage.test.tsx`
Expected: FAIL — "Cannot find module './ConnectWalletPage'".

- [ ] **Step 3: Implement ConnectWalletPage**

Create `src/features/wallet-auth/ConnectWalletPage.tsx`:

```tsx
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, AlertTriangle, Wallet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useWalletStore } from './wallet.store';
import { detectCoin98 } from './wallet.provider';

const C98_INSTALL_URL =
  'https://chromewebstore.google.com/detail/coin98-wallet/aeachknmefphepccionboohckonoeemg';

const BYPASS_AUTH = import.meta.env.VITE_BYPASS_AUTH === 'true';

export function ConnectWalletPage() {
  const navigate = useNavigate();
  const status = useWalletStore((s) => s.status);
  const address = useWalletStore((s) => s.address);
  const error = useWalletStore((s) => s.error);
  const connect = useWalletStore((s) => s.connect);
  const reset = useWalletStore((s) => s.reset);

  // Bypass mode → skip page entirely (CI/dev/local with AUTH_DISABLED BE).
  useEffect(() => {
    if (BYPASS_AUTH) {
      navigate('/builder', { replace: true });
    }
  }, [navigate]);

  // After successful auth → redirect.
  useEffect(() => {
    if (status === 'ready' && address) {
      navigate('/builder', { replace: true });
    }
  }, [status, address, navigate]);

  // On mount, run a detection check so we can show install prompt if needed.
  // Coin98 extension content scripts can inject `window.coin98.provider`
  // asynchronously — a single 300ms wait sometimes fires before injection
  // completes (esp. on first-load after enabling the extension). Poll
  // 5 × 500ms (~2.5s total) before giving up.
  useEffect(() => {
    if (status !== 'idle' || BYPASS_AUTH) return;
    if (detectCoin98()) return;

    let attempts = 0;
    const interval = window.setInterval(() => {
      attempts++;
      if (detectCoin98()) {
        window.clearInterval(interval);
        // Provider arrived — stay idle, user clicks Connect.
      } else if (attempts >= 5) {
        window.clearInterval(interval);
        useWalletStore.setState({ status: 'no-c98' });
      }
    }, 500);

    return () => window.clearInterval(interval);
  }, [status]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-canvas">
      <div className="w-full max-w-sm space-y-6 rounded-2xl border border-border bg-surface p-8 shadow-xl">
        <div className="flex flex-col items-center gap-3">
          <img
            src="/logo.png"
            alt="Trading Bot"
            className="h-12 w-12 rounded-full object-contain"
            draggable={false}
          />
          <h1 className="text-xl font-bold text-fg">Đăng nhập Trading Bot</h1>
        </div>

        {status === 'no-c98' && (
          <div className="space-y-3 rounded-xl border border-border bg-canvas p-4 text-center">
            <AlertTriangle className="mx-auto h-8 w-8 text-bearish" />
            <p className="text-sm text-fg">Chưa cài Coin98 Wallet</p>
            <a
              href={C98_INSTALL_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-canvas hover:opacity-90"
            >
              Cài đặt Coin98 →
            </a>
            <p className="text-xs text-fg-muted">Đã cài? Refresh trang.</p>
          </div>
        )}

        {(status === 'idle' || status === 'detecting') && (
          <Button
            variant="primary"
            className="w-full"
            onClick={() => void connect()}
            disabled={status === 'detecting'}
          >
            <Wallet className="h-4 w-4" />
            Kết nối Coin98 Wallet
          </Button>
        )}

        {(status === 'connecting' || status === 'signing') && (
          <div className="space-y-3 text-center">
            <Loader2 className="mx-auto h-8 w-8 animate-spin text-brand" />
            <p className="text-sm text-fg">
              {status === 'connecting'
                ? 'Mở Coin98 để chấp thuận kết nối...'
                : 'Mở Coin98 để ký message...'}
            </p>
            {address && (
              <p className="font-mono text-xs text-fg-muted">
                {address.slice(0, 8)}…{address.slice(-6)}
              </p>
            )}
            <Button variant="secondary" onClick={() => reset()}>
              Huỷ
            </Button>
          </div>
        )}

        {status === 'error' && (
          <div className="space-y-3 rounded-xl border border-bearish/40 bg-bearish/10 p-4 text-center">
            <AlertTriangle className="mx-auto h-8 w-8 text-bearish" />
            <p className="text-sm text-fg">{error ?? 'Đã có lỗi xảy ra.'}</p>
            <Button variant="primary" className="w-full" onClick={() => void connect()}>
              Thử lại
            </Button>
          </div>
        )}

        <p className="text-center text-xs text-fg-muted">
          Bạn cần ví Coin98 để sử dụng Trading Bot.
        </p>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm vitest run src/features/wallet-auth/ConnectWalletPage.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/wallet-auth/ConnectWalletPage.tsx src/features/wallet-auth/ConnectWalletPage.test.tsx
git commit -m "feat(wallet-auth): add ConnectWalletPage UI with detection/sign/error states"
```

---

## Task 9: useWalletEvents hook

**Files:**
- Create: `src/features/wallet-auth/useWalletEvents.ts`
- Create: `src/features/wallet-auth/useWalletEvents.test.ts`

- [ ] **Step 1: Write failing tests**

Create `src/features/wallet-auth/useWalletEvents.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useWalletEvents } from './useWalletEvents';
import { useWalletStore } from './wallet.store';
import type { EthereumProvider } from './wallet.types';

vi.mock('./wallet.provider', async () => {
  const actual =
    await vi.importActual<typeof import('./wallet.provider')>('./wallet.provider');
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
    });
    Object.defineProperty(window, 'location', {
      writable: true,
      value: { ...window.location, href: '' },
    });
  });

  it('attaches accountsChanged + disconnect listeners on mount', () => {
    renderHook(() => useWalletEvents());
    expect(provider.on).toHaveBeenCalledWith('accountsChanged', expect.any(Function));
    expect(provider.on).toHaveBeenCalledWith('disconnect', expect.any(Function));
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

  it('on accountsChanged with different address → disconnect + redirect', async () => {
    const disconnectSpy = vi
      .spyOn(useWalletStore.getState(), 'disconnect')
      .mockResolvedValueOnce();
    renderHook(() => useWalletEvents());

    // Handler async — await để window.location.href chắc chắn set xong khi assert.
    await onHandlers.accountsChanged(['0xDIFFERENT']);

    expect(disconnectSpy).toHaveBeenCalled();
    expect(window.location.href).toBe('/connect');
  });

  it('on accountsChanged with empty array → disconnect + redirect', async () => {
    const disconnectSpy = vi
      .spyOn(useWalletStore.getState(), 'disconnect')
      .mockResolvedValueOnce();
    renderHook(() => useWalletEvents());

    await onHandlers.accountsChanged([]);

    expect(disconnectSpy).toHaveBeenCalled();
    expect(window.location.href).toBe('/connect');
  });

  it('on accountsChanged with same address → no-op', async () => {
    const disconnectSpy = vi
      .spyOn(useWalletStore.getState(), 'disconnect')
      .mockResolvedValueOnce();
    renderHook(() => useWalletEvents());

    await onHandlers.accountsChanged(['0xABC']);

    expect(disconnectSpy).not.toHaveBeenCalled();
  });

  it('does nothing when no provider', () => {
    vi.mocked(detectCoin98).mockReturnValue(null);
    expect(() => renderHook(() => useWalletEvents())).not.toThrow();
  });

  it('polls for late-injected provider and attaches once found', async () => {
    vi.useFakeTimers();
    vi.mocked(detectCoin98).mockReturnValueOnce(null); // first call: not yet
    vi.mocked(detectCoin98).mockReturnValue(provider); // subsequent polls: found

    try {
      renderHook(() => useWalletEvents());
      // Initial call → null. Hook should set up a poll.
      expect(provider.on).not.toHaveBeenCalled();

      // Advance one poll cycle (500ms).
      await vi.advanceTimersByTimeAsync(500);
      expect(provider.on).toHaveBeenCalledWith('accountsChanged', expect.any(Function));
    } finally {
      vi.useRealTimers();
    }
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm vitest run src/features/wallet-auth/useWalletEvents.test.ts`
Expected: FAIL — "Cannot find module './useWalletEvents'".

- [ ] **Step 3: Implement the hook**

Create `src/features/wallet-auth/useWalletEvents.ts`:

```ts
import { useEffect } from 'react';
import { detectCoin98 } from './wallet.provider';
import { useWalletStore } from './wallet.store';
import type { EthereumProvider } from './wallet.types';

const BYPASS_AUTH = import.meta.env.VITE_BYPASS_AUTH === 'true';

export function useWalletEvents() {
  // Re-run when status changes so we get a second chance to attach
  // after a successful connect — provider is guaranteed to exist then,
  // even if it was injected late.
  const status = useWalletStore((s) => s.status);

  useEffect(() => {
    if (BYPASS_AUTH) return;

    let cleanup: (() => void) | undefined;
    let pollInterval: number | undefined;
    let attempts = 0;

    const attach = (provider: EthereumProvider) => {
      // BẮT BUỘC await disconnect() trước khi window.location.href —
      // BE xoá nonce ở Redis trong /wallet/disconnect call. Nếu không await,
      // page navigate có thể kill in-flight fetch → nonce còn valid 24h
      // → security hole (confirm với BE Tuấn 2026-05-19).
      const onAccountsChanged = async (...args: unknown[]) => {
        const accounts = (args[0] as string[]) ?? [];
        const current = useWalletStore.getState().address;
        const next = accounts[0]?.toLowerCase() ?? null;
        if (!next || next !== current?.toLowerCase()) {
          await useWalletStore.getState().disconnect();
          window.location.href = '/connect';
        }
      };

      const onDisconnect = async () => {
        await useWalletStore.getState().disconnect();
        window.location.href = '/connect';
      };

      provider.on('accountsChanged', onAccountsChanged);
      provider.on('disconnect', onDisconnect);

      cleanup = () => {
        provider.removeListener('accountsChanged', onAccountsChanged);
        provider.removeListener('disconnect', onDisconnect);
      };
    };

    const tryAttach = (): boolean => {
      const provider = detectCoin98();
      if (!provider) return false;
      attach(provider);
      return true;
    };

    if (!tryAttach()) {
      // Late injection — poll 10 × 500ms = 5s, then give up.
      pollInterval = window.setInterval(() => {
        attempts++;
        if (tryAttach() || attempts >= 10) {
          if (pollInterval) window.clearInterval(pollInterval);
        }
      }, 500);
    }

    return () => {
      if (pollInterval) window.clearInterval(pollInterval);
      cleanup?.();
    };
  }, [status]);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm vitest run src/features/wallet-auth/useWalletEvents.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/wallet-auth/useWalletEvents.ts src/features/wallet-auth/useWalletEvents.test.ts
git commit -m "feat(wallet-auth): add useWalletEvents hook for accountsChanged + disconnect"
```

---

## Task 10: Wire app bootstrap + routes

**Files:**
- Modify: `src/main.tsx`
- Modify: `src/routes.tsx`

- [ ] **Step 1: Update `src/routes.tsx` to use new login route + ProtectedRoute**

Replace `src/routes.tsx` entirely with:

```tsx
import { createBrowserRouter, Navigate } from 'react-router-dom';
import { BuilderPage } from './pages/BuilderPage';
import { BotMonitoringPage } from './features/bot-monitoring/BotMonitoringPage';
import { ConnectWalletPage } from './features/wallet-auth/ConnectWalletPage';
import { ProtectedRoute } from './features/wallet-auth/ProtectedRoute';

export const router = createBrowserRouter([
  {
    path: '/connect',
    element: <ConnectWalletPage />,
  },
  {
    path: '/',
    element: <Navigate to="/builder" replace />,
  },
  {
    path: '/builder',
    element: (
      <ProtectedRoute>
        <BuilderPage />
      </ProtectedRoute>
    ),
  },
  {
    path: '/bots/:id',
    element: (
      <ProtectedRoute>
        <BotMonitoringPage />
      </ProtectedRoute>
    ),
  },
  {
    path: '*',
    element: <Navigate to="/builder" replace />,
  },
]);
```

- [ ] **Step 2: Update `src/main.tsx` to refresh user + mount wallet events on bootstrap**

Note: hydration happens at module load inside `wallet.store.ts` (see Task 6).
Bootstrap only needs to refresh user data and mount the events hook.

Replace `src/main.tsx` entirely with:

```tsx
import { StrictMode, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router-dom';
import { Toaster } from 'sonner';
import { router } from './routes';
import { useWalletStore } from './features/wallet-auth/wallet.store';
import { useWalletEvents } from './features/wallet-auth/useWalletEvents';
import './index.css';

const BYPASS_AUTH = import.meta.env.VITE_BYPASS_AUTH === 'true';

function AppBootstrap() {
  useEffect(() => {
    // Bypass mode skips all auth side-effects — see spec §7.1.
    if (BYPASS_AUTH) return;
    const store = useWalletStore.getState();
    // Hydration already ran at module load; just verify creds are still valid.
    if (store.address) {
      void store.loadUser();
    }
  }, []);

  useWalletEvents();

  return <RouterProvider router={router} />;
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppBootstrap />
    <Toaster
      theme="dark"
      position="top-right"
      toastOptions={{
        className: 'rounded-2xl card-coin98 text-fg shadow-2xl',
      }}
    />
  </StrictMode>,
);
```

- [ ] **Step 3: Typecheck + full test run**

Run:
```bash
pnpm typecheck
pnpm test
```
Expected: PASS — all green.

> If `auth.store.test.ts` fails because it imports `./auth.api` (which still exists at this point), that's expected and will be removed in Task 11. If it passes (still wired up correctly), great.

- [ ] **Step 4: Commit**

```bash
git add src/routes.tsx src/main.tsx
git commit -m "feat(wallet-auth): wire routes (/connect) + app bootstrap (hydrate + events)"
```

---

## Task 10.5: Migrate `HeaderToolbar` from email auth to wallet auth

**Files:**
- Modify: `src/features/bot-builder/components/HeaderToolbar.tsx`
- Modify: `src/features/bot-builder/components/HeaderToolbar.test.tsx`

**Why this task exists:** `HeaderToolbar` is the only component outside `features/auth/` that depends on `useAuthStore`. It displays `user.email`, calls `logout()`, and navigates to `/login`. Task 11 deletes `features/auth/` — if we do that before migrating `HeaderToolbar`, typecheck and build fail.

- [ ] **Step 1: Locate every email-auth coupling in `HeaderToolbar.tsx`**

Run:
```bash
grep -n "useAuthStore\|authUser\|logout\|'/login'" src/features/bot-builder/components/HeaderToolbar.tsx
```
Expected to find (line numbers may vary):
- `import { useAuthStore }` (top of file)
- `const authUser = useAuthStore((s) => s.user);`
- `const logout = useAuthStore((s) => s.logout);`
- `{authUser?.email ?? 'User'}` — appears in two places (collapsed + expanded states)
- `{authUser?.is_admin ? 'Admin' : 'Member'}`
- `logout(); navigate('/login', { replace: true });`

- [ ] **Step 2: Apply migration edits**

In `src/features/bot-builder/components/HeaderToolbar.tsx`:

**2a.** Replace the import:
```diff
- import { useAuthStore } from '@/features/auth/auth.store';
+ import { useWalletStore } from '@/features/wallet-auth/wallet.store';
```

**2b.** Replace the store hook reads:
```diff
- const authUser = useAuthStore((s) => s.user);
- const logout = useAuthStore((s) => s.logout);
+ const user = useWalletStore((s) => s.user);
+ const disconnect = useWalletStore((s) => s.disconnect);
```

**2c.** Add a `shortenAddress` helper above the component:
```ts
function shortenAddress(addr: string | null | undefined): string {
  if (!addr) return 'Wallet';
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}
```

**2d.** Replace display strings (both occurrences of `authUser?.email ?? 'User'`):
```diff
- {authUser?.email ?? 'User'}
+ {shortenAddress(user?.wallet_address)}
```

**2e.** Replace the admin badge:
```diff
- {authUser?.is_admin ? 'Admin' : 'Member'}
+ {user?.is_admin ? 'Admin' : 'Member'}
```

**2f.** Replace the logout handler. Find the existing `onClick` that calls `logout()`:
```diff
- logout();
- navigate('/login', { replace: true });
+ await disconnect();
+ navigate('/connect', { replace: true });
```

If the handler isn't already `async`, mark it `async`:
```diff
- onClick={() => {
+ onClick={async () => {
```

- [ ] **Step 3: Update `HeaderToolbar.test.tsx`**

Look at the existing test file:
```bash
cat src/features/bot-builder/components/HeaderToolbar.test.tsx | head -40
```

Replace any `useAuthStore` mock with `useWalletStore` mock. Pattern:

```ts
vi.mock('@/features/wallet-auth/wallet.store', () => ({
  useWalletStore: Object.assign(
    vi.fn((selector: (s: unknown) => unknown) =>
      selector({
        user: {
          id: 1,
          email: null,
          wallet_address: '0xabcdef0000000000000000000000000000000001',
          is_active: true,
          is_admin: false,
        },
        disconnect: vi.fn(),
      }),
    ),
    {
      getState: () => ({
        user: null,
        disconnect: vi.fn(),
      }),
    },
  ),
}));
```

Update any assertion that previously checked for `'test@example.com'` etc. to check for the shortened address pattern: `screen.getByText(/0xabcd…0001/i)`.

- [ ] **Step 4: Run typecheck + HeaderToolbar tests**

Run:
```bash
pnpm typecheck
pnpm vitest run src/features/bot-builder/components/HeaderToolbar.test.tsx
```
Expected: PASS.

- [ ] **Step 5: Smoke check — render the full builder page**

Run: `pnpm vitest run src/features/bot-builder`
Expected: PASS — no other tests in bot-builder pull in HeaderToolbar with the old shape.

- [ ] **Step 6: Commit**

```bash
git add src/features/bot-builder/components/HeaderToolbar.tsx src/features/bot-builder/components/HeaderToolbar.test.tsx
git commit -m "refactor(header-toolbar): migrate from email auth to wallet auth (display address, disconnect)"
```

---

## Task 11: Delete old `features/auth/` folder

**Files:**
- Delete: `src/features/auth/LoginPage.tsx`
- Delete: `src/features/auth/auth.api.ts`
- Delete: `src/features/auth/auth.store.ts`
- Delete: `src/features/auth/auth.types.ts`
- Delete: `src/features/auth/auth.store.test.ts`
- Delete: `src/features/auth/ProtectedRoute.tsx`

- [ ] **Step 1: Confirm no imports remain to `src/features/auth/`**

Run (broad pattern catches any quote style + alias + relative path + dynamic imports):
```bash
grep -rEn "['\"][^'\"]*features/auth[/'\"]" src/ || echo "No imports — safe to delete"
```
Expected: "No imports — safe to delete" — or only matches inside `src/features/auth/` files themselves (which are being deleted).
If any other match → STOP, migrate that consumer first (Task 10.5 should have already handled `HeaderToolbar.tsx`).

- [ ] **Step 2: Delete the folder**

Run:
```bash
git rm -r src/features/auth/
```
Expected: 6 files removed.

- [ ] **Step 3: Typecheck + tests**

Run:
```bash
pnpm typecheck
pnpm test
```
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git commit -m "chore(auth): remove email login feature, replaced by wallet-auth"
```

---

## Task 12: Full QA gate

**Files:** None (verification only)

- [ ] **Step 1: Run all checks**

Run:
```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm format
```
Expected: all PASS. If `format` modifies files, commit them in Step 3.

- [ ] **Step 2: Dev server smoke test (manual)**

Run: `pnpm dev`
Then in browser open `http://127.0.0.1:5173/`:

1. App redirects to `/connect`. ✓
2. If Coin98 not installed → see install prompt + link.
3. If Coin98 installed → click "Kết nối Coin98 Wallet":
   - Wallet popup asks to connect → approve
   - Wallet popup asks to sign message → approve
   - Page redirects to `/builder`
4. In wallet UI, switch to a different account → app should auto-redirect back to `/connect`.
5. Refresh `/builder` directly → still authenticated (sessionStorage survives reload).
6. Close tab + reopen → unauthenticated (sessionStorage gone) → `/connect`.
7. Network tab: verify every API call has `X-Wallet-Address`, `X-Wallet-Nonce`, `X-Wallet-Signature` headers.
8. Create a bot via wizard → submit → BE returns `{ bot: { id, ... }, strategy: { ... } }` → redirect to `/bots/{id}`.
9. **Auto-create user (BE Q5 verification)**:
   - Switch Coin98 to an address that has NEVER connected to this BE before.
   - Click "Kết nối Coin98 Wallet" and approve/sign.
   - Expect: `/user/status` returns `{ id: <fresh number>, email: null, wallet_address: <new addr>, is_active: true, is_admin: false }`.
   - Cross-check BE logs (if accessible) — should show "user created" or equivalent entry.
   - Result: app behaves identically to a returning user (no extra register step).
10. **Wallet-locked recovery**:
    - Lock Coin98 (extension settings → Lock wallet).
    - Click "Kết nối Coin98 Wallet" → wallet prompts for password → cancel.
    - Expect: ConnectWalletPage shows error state ("Bạn đã từ chối yêu cầu từ ví Coin98") and a "Thử lại" button.

If any step fails: stop, fix, re-run. Do not proceed to PR.

- [ ] **Step 3: Commit any formatter changes**

Run: `git status`
If files are modified by Prettier:
```bash
git add -u
git commit -m "chore: prettier format wallet-auth files"
```
Otherwise skip.

- [ ] **Step 4: Push and open PR**

Run:
```bash
git push -u origin feat/wallet-auth
gh pr create --title "feat(auth): replace email login with Coin98 wallet signature auth" --body "$(cat <<'EOF'
## Summary

- Replaces `features/auth/` (email/password JWT) with `features/wallet-auth/` (Coin98 wallet signature)
- Stateless: `GET /wallet/nonce` → `personal_sign` → `X-Wallet-*` headers on every request
- `sessionStorage` key `trading_bot_wallet_auth` (cleared on tab close, 24h server-side TTL)
- Auto-create user on first connect (BE Q5)
- 401 → clear + redirect `/connect`. 403 → toast only, no retry (per spec)
- `accountsChanged` event → force reconnect

## BE coordination

All 7 questions answered by Tuấn (see [Q1-Q6.md] + Q7 inline). HTTPS deferred to stag/prod.

## Test plan

- [ ] Connect C98 wallet → redirect `/builder` works
- [ ] All API calls carry `X-Wallet-*` headers
- [ ] Account switch in wallet → auto reconnect prompt
- [ ] Tab close → unauthenticated on reopen
- [ ] 401 from BE → toast + redirect to `/connect`
- [ ] 403 from BE → toast only, no redirect
- [ ] CI green (`VITE_BYPASS_AUTH=true` skips wallet flow)

## Refs

- Design: `docs/superpowers/specs/2026-05-14-c98-wallet-auth-design.md`
- Plan: `docs/superpowers/plans/2026-05-14-c98-wallet-auth.md`

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```
Expected: PR URL returned. Share with team for review.

---

## Definition of Done

- [ ] All tasks 0-12 complete
- [ ] `pnpm typecheck` + `pnpm lint` + `pnpm test` + `pnpm format` clean
- [ ] Manual smoke test with C98 wallet passes
- [ ] `src/features/auth/` is gone
- [ ] PR opened and merged to main
- [ ] Production deployment verified (after BE HTTPS goes live)

---

## Open follow-ups (NOT in this plan)

These are tracked separately and shouldn't be added here:
- BE HTTPS rollout (Q7 — blocked on infra)
- WalletConnect / multi-wallet support
- Multi-wallet-per-user linking
- ENS / wallet display name resolution
