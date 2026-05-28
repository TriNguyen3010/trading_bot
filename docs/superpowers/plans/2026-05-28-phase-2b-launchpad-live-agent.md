# Phase 2b — Live Launch + Agent Wallet Flow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mở khoá Live launch trên Launchpad (đã build trong Phase 2a). Hyperliquid yêu cầu **agent wallet** (sub-key được EIP-712 approve) trước khi bot tự đặt lệnh tiền thật. Flow: user bấm Live → FE check user đã confirm agent chưa → nếu chưa, chạy 3-step onboarding (POST `/agent/create` → wallet ký EIP-712 → POST `/agent/confirm`) → sau khi confirm xong, PATCH `dry_run=false` + `botApi.start(id)`.

**Architecture:** Feature mới `src/features/agent-wallet/` chứa: `agent.api.ts` (5 method REST), `agent-helpers.ts` (pure — extract nonce from sign_payload, format spending limit, error mapper), `useAgentSignFlow` hook (orchestrate Create → ký → Confirm với progress states), và `AgentOnboardingDialog.tsx` (3-step modal). Mở rộng `src/features/launchpad/launch-actions.ts` để Live path check `getActive` agent trước; nếu null → trigger onboarding flow → continue launch sau confirm. Reuse `detectCoin98()` từ `wallet-auth/wallet.provider.ts` (đã có cho EIP-191 personal_sign — EIP-712 chỉ đổi method name).

**Tech Stack:** React 18, TypeScript 5.7, Radix Dialog, Tailwind 3, Sonner, Vitest + @testing-library/react. Wallet provider qua `src/features/wallet-auth/wallet.provider.ts` (Coin98 / window.ethereum). API qua `src/lib/http.ts`.

**Prerequisites (build order):**

- **Phase 1** merged — cần `botApi.start(id)` (PR #12 đã ship, await review).
- **Phase 2a** merged — cần `LaunchpadModal` + `launch-actions.ts` shell + Live card disabled placeholder.
- `openapi.json` refresh 2026-05-28 — đã có 15 endpoint `/agent/*` typed (commit `c13fe09`).

**Scope / Non-goals:**

- ✅ In: agent api wrapper, EIP-712 sign helper, onboarding modal (3-step), check-before-live integration, error handling (user reject + on-chain reject), spending limit check trước launch.
- ❌ Out: agent rotation UX (`/bot/rotate-wallet` — Phase 2b.1 advanced); agent revocation UI từ user (chỉ admin / settings page sau); multiple agent management; tier-based agent count caps (Phase 5).

---

## Background — Hyperliquid agent wallet flow

Reference: `BE/auth-architecture.md` §"Layer 2: Agent Wallet" (491 dòng, đọc kỹ trước khi build).

Tóm tắt 3-layer auth:

1. **Wallet Auth (session)** — Coin98 wallet ký EIP-191 nonce, BE attach `X-Wallet-*` headers cho mọi request. Đã có sẵn từ Phase 0.
2. **Agent Wallet (Hyperliquid delegation)** — user ký EIP-712 `approveAgent` typed-data 1 lần, BE relay lên Hyperliquid on-chain, store encrypted agent private key. → **Đây là Phase 2b.**
3. **Trading Execution** — bot dùng agent private key (server-side) để tự ký order. Không cần FE.

### Flow chi tiết (FE side)

```
User clicks "Go Live" trong LaunchpadModal
   ↓
launchBot('live', botId) gọi
   ↓
GET /agent/active
   ├─ Trả AgentInfoResponse (agent đã confirm + active) → skip onboarding, tiếp tục
   └─ Trả null → mở AgentOnboardingDialog
       ↓
       Step 1: "Why agent" (explain UX)
       ↓
       Step 2: POST /agent/create { label?, spending_limit_usd? }
         → AgentPrepareResponse { agent_address, sign_payload: object }
       ↓
       Step 3: Wallet ký EIP-712
         provider.request({
           method: 'eth_signTypedData_v4',
           params: [wallet_address, JSON.stringify(sign_payload)],
         })
         → signature: string
       ↓
       Step 4: POST /agent/confirm {
           wallet_address, agent_address, signature,
           nonce: extract từ sign_payload.message.nonce
         }
         → AgentCreateResponse (id, agent_address, is_active=true, ...)
       ↓
       Onboarding done → callback resumeLaunch()
   ↓
GET /agent/check-limit { bot_id, requested_usd } (optional pre-flight, xem §1.4)
   ├─ allowed → tiếp tục
   └─ exceeded → block với toast "Spending limit exceeded"
   ↓
PATCH /bot-strategy/{botId} { dry_run: false }
   ↓
POST /bot/{botId}/start → BotStatusOut
   ↓
navigate `/bots/{botId}` (live monitor)
```

### EIP-712 typed-data shape (từ auth-architecture.md L142-175)

`sign_payload` trong `AgentPrepareResponse` là object opaque (`additionalProperties:true`), nhưng auth-architecture.md mô tả nó là EIP-712 standard:

```json
{
  "types": {
    "EIP712Domain": [...],
    "ApproveAgent": [
      { "name": "agentAddress", "type": "address" },
      { "name": "agentName", "type": "string" },
      { "name": "nonce", "type": "uint64" },
      ...
    ]
  },
  "primaryType": "ApproveAgent",
  "domain": { ... Hyperliquid chain config ... },
  "message": {
    "agentAddress": "0x...",
    "agentName": "My Agent",
    "nonce": 1234567890123,
    ...
  }
}
```

FE chỉ cần: (a) `JSON.stringify(sign_payload)` đưa nguyên block cho `eth_signTypedData_v4`, (b) extract `sign_payload.message.nonce` để gửi vào `AgentConfirmRequest.nonce`. Không cần parse sâu hơn.

### BE schemas (từ openapi.json sau refresh 2026-05-28)

```ts
// /agent/create
interface CreateAgentRequest {
  label?: string | null; // optional human label
  spending_limit_usd?: number | null; // optional daily cap
}
interface AgentPrepareResponse {
  agent_address: string;
  label?: string | null;
  spending_limit_usd?: number | null;
  sign_payload: object; // EIP-712 typed data — see shape above
}

// /agent/confirm
interface AgentConfirmRequest {
  wallet_address: string;
  agent_address: string;
  signature: string;
  nonce: number;
}
interface AgentCreateResponse {
  id: number;
  agent_address: string;
  label?: string | null;
  spending_limit_usd?: number | null;
  spent_today_usd: number;
  is_active: boolean;
  created_at: string;
}

// /agent/active (current), /agent/list (history)
interface AgentInfoResponse {
  id: number;
  agent_address: string;
  label?: string | null;
  spending_limit_usd?: number | null;
  spent_today_usd: number;
  is_active: boolean;
  created_at: string;
  revoked_at?: string | null;
}

// /agent/check-limit (verified 2026-05-28 against openapi commit c13fe09)
interface SpendingLimitCheckRequest {
  amount_usd: number; // * required, exclusiveMinimum 0
}
interface SpendingLimitCheckResponse {
  allowed: boolean; // * required
  reason: string; // * required (NOT remaining_usd / message)
}
```

⚠️ Note: Endpoints `revoke` / `revoke-payload` / `external-revoke` để future plan.

---

## File Structure

**New files (7):**

| Path                                                       | Responsibility                                                                              |
| ---------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| `src/features/agent-wallet/agent.api.ts`                   | 5 method REST: `create`, `confirm`, `active`, `list`, `checkLimit`                          |
| `src/features/agent-wallet/agent.api.test.ts`              | Unit test (mock `@/lib/http`)                                                               |
| `src/features/agent-wallet/agent-helpers.ts`               | Pure: `extractNonceFromSignPayload`, `formatSpendingLimit`, `eip712Sign` (provider wrapper) |
| `src/features/agent-wallet/agent-helpers.test.ts`          | Unit test                                                                                   |
| `src/features/agent-wallet/useAgentSignFlow.ts`            | Hook: orchestrate Create → sign → Confirm với progress states                               |
| `src/features/agent-wallet/useAgentSignFlow.test.ts`       | Hook test (mock api + provider)                                                             |
| `src/features/agent-wallet/AgentOnboardingDialog.tsx`      | 3-step modal: explain → sign → success                                                      |
| `src/features/agent-wallet/AgentOnboardingDialog.test.tsx` | Component test                                                                              |

**Modified files (3):**

| Path                                        | Change                                                                                                |
| ------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `src/types/api-helpers.ts`                  | Re-export 6 agent types                                                                               |
| `src/features/launchpad/launch-actions.ts`  | Extend `launchBot('live')` → check agent active, run onboarding if needed, then PATCH dry_run + start |
| `src/features/launchpad/LaunchpadModal.tsx` | Enable Live card (was disabled in Phase 2a); wire `onLive` to trigger `useAgentSignFlow` + launchBot  |

---

## Task 1: Re-export agent types

**Files:**

- Modify: `src/types/api-helpers.ts`

- [ ] **Step 1: Add 6 type re-exports**

Thêm vào `src/types/api-helpers.ts`:

```ts
// Agent wallet (Hyperliquid)
export type CreateAgentRequest = Schemas['CreateAgentRequest'];
export type AgentPrepareResponse = Schemas['AgentPrepareResponse'];
export type AgentConfirmRequest = Schemas['AgentConfirmRequest'];
export type AgentCreateResponse = Schemas['AgentCreateResponse'];
export type AgentInfoResponse = Schemas['AgentInfoResponse'];
export type SpendingLimitCheckRequest = Schemas['SpendingLimitCheckRequest'];
export type SpendingLimitCheckResponse = Schemas['SpendingLimitCheckResponse'];
```

- [ ] **Step 2: Verify typecheck**

Run: `pnpm typecheck` → PASS.

- [ ] **Step 3: Commit**

```bash
git add src/types/api-helpers.ts
git commit -m "feat(agent-wallet): re-export 6 agent types"
```

---

## Task 2: `agent.api.ts` — 5 REST methods

**Files:**

- Create: `src/features/agent-wallet/agent.api.ts`
- Test: `src/features/agent-wallet/agent.api.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/features/agent-wallet/agent.api.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { http } from '@/lib/http';
import { agentApi } from './agent.api';

vi.mock('@/lib/http', () => ({ http: vi.fn() }));
const mockHttp = vi.mocked(http);
beforeEach(() => mockHttp.mockReset());

describe('agentApi.create', () => {
  it('POSTs /agent/create with label + spending_limit_usd', async () => {
    mockHttp.mockResolvedValue({
      agent_address: '0xagent',
      label: 'main',
      spending_limit_usd: 1000,
      sign_payload: { primaryType: 'ApproveAgent' },
    });
    const res = await agentApi.create({
      label: 'main',
      spending_limit_usd: 1000,
    });
    expect(mockHttp).toHaveBeenCalledWith('POST', '/agent/create', {
      label: 'main',
      spending_limit_usd: 1000,
    });
    expect(res.agent_address).toBe('0xagent');
  });
});

describe('agentApi.confirm', () => {
  it('POSTs /agent/confirm with signature + nonce', async () => {
    mockHttp.mockResolvedValue({
      id: 1,
      agent_address: '0xagent',
      is_active: true,
      spent_today_usd: 0,
      created_at: '2026-05-28T00:00:00Z',
    });
    await agentApi.confirm({
      wallet_address: '0xuser',
      agent_address: '0xagent',
      signature: '0xsig',
      nonce: 1234,
    });
    expect(mockHttp).toHaveBeenCalledWith('POST', '/agent/confirm', {
      wallet_address: '0xuser',
      agent_address: '0xagent',
      signature: '0xsig',
      nonce: 1234,
    });
  });
});

describe('agentApi.active', () => {
  it('GETs /agent/active', async () => {
    mockHttp.mockResolvedValue(null);
    await agentApi.active();
    expect(mockHttp).toHaveBeenCalledWith('GET', '/agent/active');
  });
});

describe('agentApi.list', () => {
  it('GETs /agent/list', async () => {
    mockHttp.mockResolvedValue([]);
    await agentApi.list();
    expect(mockHttp).toHaveBeenCalledWith('GET', '/agent/list');
  });
});

describe('agentApi.checkLimit', () => {
  it('POSTs /agent/check-limit', async () => {
    mockHttp.mockResolvedValue({ allowed: true, reason: 'ok' });
    await agentApi.checkLimit({ amount_usd: 200 });
    expect(mockHttp).toHaveBeenCalledWith('POST', '/agent/check-limit', {
      amount_usd: 200,
    });
  });
});
```

- [ ] **Step 2: Run test → fail**

`pnpm test agent.api` → FAIL (module not found).

- [ ] **Step 3: Implement**

Create `src/features/agent-wallet/agent.api.ts`:

```ts
import { http } from '@/lib/http';
import type {
  CreateAgentRequest,
  AgentPrepareResponse,
  AgentConfirmRequest,
  AgentCreateResponse,
  AgentInfoResponse,
  SpendingLimitCheckRequest,
  SpendingLimitCheckResponse,
} from '@/types/api-helpers';

export const agentApi = {
  /** Step 1 of onboarding: gen agent keypair + EIP-712 sign payload. */
  create: (payload: CreateAgentRequest) =>
    http<AgentPrepareResponse>('POST', '/agent/create', payload),

  /** Step 2 of onboarding: submit user signature, BE relays approveAgent on-chain. */
  confirm: (payload: AgentConfirmRequest) =>
    http<AgentCreateResponse>('POST', '/agent/confirm', payload),

  /** Current active agent for the authenticated wallet (null if none). */
  active: () => http<AgentInfoResponse | null>('GET', '/agent/active'),

  /** Historical list of all agents for this wallet. */
  list: () => http<AgentInfoResponse[]>('GET', '/agent/list'),

  /** Pre-flight: is the requested USD amount within today's remaining cap? */
  checkLimit: (payload: SpendingLimitCheckRequest) =>
    http<SpendingLimitCheckResponse>('POST', '/agent/check-limit', payload),
};
```

- [ ] **Step 4: Run test → pass** (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/features/agent-wallet/agent.api.ts src/features/agent-wallet/agent.api.test.ts
git commit -m "feat(agent-wallet): agentApi (create/confirm/active/list/checkLimit)"
```

---

## Task 3: `agent-helpers.ts` — pure helpers + EIP-712 sign wrapper

**Files:**

- Create: `src/features/agent-wallet/agent-helpers.ts`
- Test: `src/features/agent-wallet/agent-helpers.test.ts`

- [ ] **Step 1: Write failing test**

```ts
import { describe, it, expect, vi } from 'vitest';
import {
  extractNonceFromSignPayload,
  formatSpendingLimit,
  eip712Sign,
} from './agent-helpers';

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
});
```

- [ ] **Step 2: Implement**

```ts
import type { EthereumProvider } from '@/features/wallet-auth/wallet.types';
import {
  UserRejectedError,
  NoProviderError,
} from '@/features/wallet-auth/wallet.provider';

/** EIP-712 sign_payload từ BE là object opaque. Parse nonce defensively. */
export function extractNonceFromSignPayload(payload: unknown): number {
  if (
    payload &&
    typeof payload === 'object' &&
    'message' in payload &&
    payload.message &&
    typeof payload.message === 'object' &&
    'nonce' in payload.message &&
    typeof payload.message.nonce === 'number'
  ) {
    return payload.message.nonce;
  }
  return 0;
}

/** Format spending limit cap for display. Null → "No limit". */
export function formatSpendingLimit(v: number | null | undefined): string {
  if (v == null) return 'No limit';
  return v >= 1000
    ? `$${v.toLocaleString('en-US', { maximumFractionDigits: 0 })}`
    : `$${v.toFixed(2)}`;
}

/** Wrap EIP-712 sign request to the wallet provider (Coin98 / window.ethereum).
 * Mirrors personalSign() pattern in wallet.provider.ts but uses
 * eth_signTypedData_v4 method. Throws UserRejectedError if user cancels. */
export async function eip712Sign(
  provider: EthereumProvider,
  walletAddress: string,
  typedData: unknown,
): Promise<string> {
  if (!provider) throw new NoProviderError();
  try {
    return (await provider.request({
      method: 'eth_signTypedData_v4',
      params: [walletAddress, JSON.stringify(typedData)],
    })) as string;
  } catch (err) {
    // Coin98 / EIP-1193 returns code 4001 for user-reject. Inline check
    // mirrors private `isUserReject` in wallet.provider.ts (line 28) — keep
    // them in sync if the wallet-auth feature changes its reject signal.
    if (
      typeof err === 'object' &&
      err !== null &&
      (err as { code?: number }).code === 4001
    ) {
      throw new UserRejectedError();
    }
    throw err;
  }
}
```

> Note: `UserRejectedError`, `NoProviderError` exported từ `src/features/wallet-auth/wallet.provider.ts`; `EthereumProvider` type ở `wallet.types.ts`. `isUserReject` là **private** trong wallet.provider.ts — plan inline check 4001 thay vì xin export (tránh đụng vào Phase 0 code). `detectCoin98()` (không phải `detectCoin98`) là helper detect provider.

- [ ] **Step 3: Test pass + commit**

```bash
pnpm test agent-helpers
git add src/features/agent-wallet/agent-helpers.ts src/features/agent-wallet/agent-helpers.test.ts
git commit -m "feat(agent-wallet): pure helpers (extract nonce / format limit / eip712 sign)"
```

---

## Task 4: `useAgentSignFlow` hook — orchestrate 3-step

**Files:**

- Create: `src/features/agent-wallet/useAgentSignFlow.ts`
- Test: `src/features/agent-wallet/useAgentSignFlow.test.ts`

Hook contract:

```ts
export type AgentFlowState =
  | { stage: 'idle' }
  | { stage: 'creating' } // calling /agent/create
  | { stage: 'signing'; agentAddress: string } // waiting wallet signature
  | { stage: 'confirming' } // calling /agent/confirm
  | { stage: 'success'; agent: AgentCreateResponse }
  | { stage: 'error'; message: string; userRejected: boolean };

export interface UseAgentSignFlowResult {
  state: AgentFlowState;
  /** Trigger full flow: create → sign → confirm. */
  run: (opts: {
    label?: string;
    spendingLimitUsd?: number | null;
  }) => Promise<void>;
  /** Reset back to idle (e.g. after error, retry). */
  reset: () => void;
}
```

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useAgentSignFlow } from './useAgentSignFlow';
import { agentApi } from './agent.api';
import { eip712Sign } from './agent-helpers';
import { detectCoin98 } from '@/features/wallet-auth/wallet.provider';
import { useWalletStore } from '@/features/wallet-auth/wallet.store';

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
    vi.mocked(detectCoin98).mockReturnValue({
      request: vi.fn(),
    } as never);

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
    vi.mocked(detectCoin98).mockReturnValue({
      request: vi.fn(),
    } as never);

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
});
```

- [ ] **Step 2: Implement**

```ts
import { useCallback, useState } from 'react';
import { agentApi } from './agent.api';
import { eip712Sign, extractNonceFromSignPayload } from './agent-helpers';
import {
  detectCoin98,
  UserRejectedError,
  NoProviderError,
} from '@/features/wallet-auth/wallet.provider';
import { useWalletStore } from '@/features/wallet-auth/wallet.store';
import type { AgentCreateResponse } from '@/types/api-helpers';

export type AgentFlowState =
  | { stage: 'idle' }
  | { stage: 'creating' }
  | { stage: 'signing'; agentAddress: string }
  | { stage: 'confirming' }
  | { stage: 'success'; agent: AgentCreateResponse }
  | { stage: 'error'; message: string; userRejected: boolean };

export interface UseAgentSignFlowResult {
  state: AgentFlowState;
  run: (opts: {
    label?: string;
    spendingLimitUsd?: number | null;
  }) => Promise<void>;
  reset: () => void;
}

export function useAgentSignFlow(): UseAgentSignFlowResult {
  const [state, setState] = useState<AgentFlowState>({ stage: 'idle' });

  const run = useCallback(
    async (opts: { label?: string; spendingLimitUsd?: number | null }) => {
      const walletAddress = useWalletStore.getState().address;
      if (!walletAddress) {
        setState({
          stage: 'error',
          message: 'Wallet chưa connect',
          userRejected: false,
        });
        return;
      }
      const provider = detectCoin98();
      if (!provider) {
        setState({
          stage: 'error',
          message: 'Không tìm thấy ví — vui lòng cài Coin98',
          userRejected: false,
        });
        return;
      }

      try {
        setState({ stage: 'creating' });
        const prep = await agentApi.create({
          label: opts.label ?? null,
          spending_limit_usd: opts.spendingLimitUsd ?? null,
        });

        setState({ stage: 'signing', agentAddress: prep.agent_address });
        const signature = await eip712Sign(
          provider,
          walletAddress,
          prep.sign_payload,
        );

        setState({ stage: 'confirming' });
        const agent = await agentApi.confirm({
          wallet_address: walletAddress,
          agent_address: prep.agent_address,
          signature,
          nonce: extractNonceFromSignPayload(prep.sign_payload),
        });

        setState({ stage: 'success', agent });
      } catch (err) {
        const userRejected = err instanceof UserRejectedError;
        const noProvider = err instanceof NoProviderError;
        setState({
          stage: 'error',
          message: userRejected
            ? 'Bạn đã huỷ ký — agent không được tạo'
            : noProvider
              ? 'Không tìm thấy ví — vui lòng cài Coin98'
              : err instanceof Error
                ? err.message
                : 'Unknown error',
          userRejected,
        });
      }
    },
    [],
  );

  const reset = useCallback(() => setState({ stage: 'idle' }), []);

  return { state, run, reset };
}
```

- [ ] **Step 3: Test pass + commit**

```bash
pnpm test useAgentSignFlow
git add src/features/agent-wallet/useAgentSignFlow.ts src/features/agent-wallet/useAgentSignFlow.test.ts
git commit -m "feat(agent-wallet): useAgentSignFlow hook (create → sign → confirm)"
```

---

## Task 5: `AgentOnboardingDialog` component

**Files:**

- Create: `src/features/agent-wallet/AgentOnboardingDialog.tsx`
- Test: `src/features/agent-wallet/AgentOnboardingDialog.test.tsx`

Modal 3-step (explain → sign → success), driven by `useAgentSignFlow`'s state. Uses raw `DialogPrimitive` (bespoke layout, per CLAUDE.md §8.3 convention).

- [ ] **Step 1: Component contract**

```ts
export interface AgentOnboardingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Pre-fill spending limit (vd: user yêu cầu launch live $1000 → suggest $5000 limit). */
  suggestedLimit?: number | null;
  /** Called once Confirm succeeds — caller resumes the original action (e.g. launch live bot). */
  onSuccess: (agent: AgentCreateResponse) => void;
}
```

- [ ] **Step 2: Implement (key structure — implementer fills full JSX)**

3 step render branches keyed on `state.stage`:

1. **`idle` / explain** — bullet list lý do agent (1 lần ký, sau đó bot tự trade, có spending cap), input "Daily spending limit" (number, optional), button "Generate & Sign".
2. **`creating`** — spinner + "Đang chuẩn bị ký..."
3. **`signing`** — spinner + "Vui lòng ký trên ví Coin98 — sẽ pop-up window"
4. **`confirming`** — spinner + "Đang xác nhận trên Hyperliquid..."
5. **`success`** — checkmark + "Agent confirmed!" + "Continue" button → `onSuccess(agent)` + `onOpenChange(false)`.
6. **`error`** — error message + 2 button: "Retry" (calls `reset()` → user back to step 1) hoặc "Cancel" (closes).

Component file structure:

```tsx
import { useEffect, useState } from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { Loader2, Check, AlertCircle, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAgentSignFlow } from './useAgentSignFlow';
import { formatSpendingLimit } from './agent-helpers';
import type { AgentCreateResponse } from '@/types/api-helpers';

export interface AgentOnboardingDialogProps { ... } // see contract

export function AgentOnboardingDialog({
  open,
  onOpenChange,
  suggestedLimit,
  onSuccess,
}: AgentOnboardingDialogProps) {
  const { state, run, reset } = useAgentSignFlow();
  const [limitInput, setLimitInput] = useState<string>(
    suggestedLimit != null ? String(suggestedLimit) : '',
  );

  // When transitioning to success, fire onSuccess callback
  useEffect(() => {
    if (state.stage === 'success') {
      onSuccess(state.agent);
    }
  }, [state, onSuccess]);

  // Reset when dialog reopens
  useEffect(() => {
    if (open) reset();
  }, [open, reset]);

  const handleGenerate = () => {
    const limitNum = parseFloat(limitInput);
    void run({
      spendingLimitUsd: Number.isFinite(limitNum) ? limitNum : null,
    });
  };

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="..." />
        <DialogPrimitive.Content className="fixed inset-0 m-auto w-[480px] h-fit ...">
          {/* Header: title + close button */}
          {/* Body: render branch per state.stage */}
          {/* Footer: per-stage actions */}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
```

> Implementer fills the JSX following the prototype's visual style (xem `public/bot-launch-prototype.html` line ~2885 cho LiveConfirmModal reference, mặc dù onboarding khác scope).

- [ ] **Step 3: Component test**

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AgentOnboardingDialog } from './AgentOnboardingDialog';
import { useAgentSignFlow } from './useAgentSignFlow';

vi.mock('./useAgentSignFlow');

beforeEach(() => vi.clearAllMocks());

describe('AgentOnboardingDialog', () => {
  it('renders explain step when stage=idle', () => {
    vi.mocked(useAgentSignFlow).mockReturnValue({
      state: { stage: 'idle' },
      run: vi.fn(),
      reset: vi.fn(),
    });
    render(
      <AgentOnboardingDialog
        open
        onOpenChange={() => {}}
        onSuccess={() => {}}
      />,
    );
    expect(screen.getByText(/Generate & Sign/i)).toBeInTheDocument();
  });

  it('clicking Generate calls run with parsed limit', () => {
    const run = vi.fn();
    vi.mocked(useAgentSignFlow).mockReturnValue({
      state: { stage: 'idle' },
      run,
      reset: vi.fn(),
    });
    render(
      <AgentOnboardingDialog
        open
        onOpenChange={() => {}}
        suggestedLimit={5000}
        onSuccess={() => {}}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /Generate & Sign/i }));
    expect(run).toHaveBeenCalledWith({ spendingLimitUsd: 5000 });
  });

  it('renders spinner during creating/signing/confirming', () => {
    vi.mocked(useAgentSignFlow).mockReturnValue({
      state: { stage: 'signing', agentAddress: '0xagent' },
      run: vi.fn(),
      reset: vi.fn(),
    });
    render(
      <AgentOnboardingDialog
        open
        onOpenChange={() => {}}
        onSuccess={() => {}}
      />,
    );
    expect(screen.getByText(/ký trên ví/i)).toBeInTheDocument();
  });

  it('calls onSuccess when state transitions to success', async () => {
    const onSuccess = vi.fn();
    const agent = {
      id: 1,
      agent_address: '0xagent',
      label: null,
      spending_limit_usd: null,
      is_active: true,
      spent_today_usd: 0,
      created_at: '2026-05-28T00:00:00Z',
    };
    vi.mocked(useAgentSignFlow).mockReturnValue({
      state: { stage: 'success', agent },
      run: vi.fn(),
      reset: vi.fn(),
    });
    render(
      <AgentOnboardingDialog
        open
        onOpenChange={() => {}}
        onSuccess={onSuccess}
      />,
    );
    await waitFor(() => expect(onSuccess).toHaveBeenCalledWith(agent));
  });

  it('error state shows retry + cancel', () => {
    const reset = vi.fn();
    vi.mocked(useAgentSignFlow).mockReturnValue({
      state: { stage: 'error', message: 'Bạn đã huỷ ký', userRejected: true },
      run: vi.fn(),
      reset,
    });
    render(
      <AgentOnboardingDialog
        open
        onOpenChange={() => {}}
        onSuccess={() => {}}
      />,
    );
    expect(screen.getByText(/huỷ ký/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Retry/i }));
    expect(reset).toHaveBeenCalled();
  });
});
```

- [ ] **Step 4: Run + commit**

```bash
pnpm test AgentOnboardingDialog
pnpm typecheck
git add src/features/agent-wallet/AgentOnboardingDialog.tsx src/features/agent-wallet/AgentOnboardingDialog.test.tsx
git commit -m "feat(agent-wallet): AgentOnboardingDialog (3-step modal)"
```

---

## Task 6: Wire Live launch into `launch-actions` + `LaunchpadModal`

**Files:**

- Modify: `src/features/launchpad/launch-actions.ts`
- Modify: `src/features/launchpad/LaunchpadModal.tsx`
- Modify: tests for both

- [ ] **Step 1: Extend `launchBot` with Live path**

Current `launch-actions.ts` (Phase 2a) handles `'dry-run'`. Add `'live'` that requires `agentApi.active()` non-null.

```ts
// New signature
export type LaunchMode = 'dry-run' | 'live';

export async function launchBot(
  botId: number,
  mode: LaunchMode,
): Promise<BotStatusOut> {
  if (mode === 'live') {
    const active = await agentApi.active();
    if (!active) {
      throw new AgentNotActiveError(); // signals LaunchpadModal to open onboarding
    }
  }
  await botStrategyApi.update(botId, { dry_run: mode === 'dry-run' });
  return botApi.start(botId);
}

export class AgentNotActiveError extends Error {
  constructor() {
    super('User has no active agent — onboarding required');
    this.name = 'AgentNotActiveError';
  }
}
```

Test: extend `launch-actions.test.ts` với 3 case mới:

- `live` + agent active → PATCH(false) + start
- `live` + agent null → throws `AgentNotActiveError`, không gọi update/start
- `dry-run` unchanged

- [ ] **Step 2: Update `LaunchpadModal` Live card**

Phase 2a renders Live card disabled. Now enable it + wire onboarding:

```tsx
// State for onboarding modal
const [onboardingOpen, setOnboardingOpen] = useState(false);

const handleLive = async () => {
  try {
    setBusy('live');
    await launchBot(bot.id, 'live');
    toast.success(`Live launched for bot #${bot.id}`);
    onOpenChange(false);
    onLaunched();
  } catch (err) {
    if (err instanceof AgentNotActiveError) {
      // Trigger onboarding, then resume after success
      setOnboardingOpen(true);
    } else {
      setError(formatBackendError(err));
    }
  } finally {
    setBusy(null);
  }
};

const handleOnboardingSuccess = async () => {
  setOnboardingOpen(false);
  // Resume the launch now that agent exists
  await handleLive();
};

// Render <AgentOnboardingDialog open={onboardingOpen} ... onSuccess={handleOnboardingSuccess} />
```

- [ ] **Step 3: Tests for the bridge**

`LaunchpadModal.test.tsx`:

- Click "Go Live" → calls `launchBot(id, 'live')`.
- If `AgentNotActiveError`, opens `AgentOnboardingDialog`.
- After `onSuccess`, re-runs launch.

- [ ] **Step 4: Run + commit**

```bash
pnpm test launch-actions LaunchpadModal
pnpm typecheck
git add src/features/launchpad/launch-actions.ts src/features/launchpad/launch-actions.test.ts \
        src/features/launchpad/LaunchpadModal.tsx src/features/launchpad/LaunchpadModal.test.tsx
git commit -m "feat(launchpad): enable Live path + agent onboarding bridge"
```

---

## Task 7: Manual smoke + final sweep + PR

- [ ] **Step 1: Lint + format + typecheck + test**

```bash
pnpm typecheck && pnpm lint && pnpm test && pnpm format
```

- [ ] **Step 2: Manual smoke (Tri tests)**

Checklist:

- Click "Go Live" trên bot chưa có agent → `AgentOnboardingDialog` mở.
- Daily limit input pre-fill nếu có `suggestedLimit`.
- Click "Generate & Sign" → ví Coin98 pop-up EIP-712 sign window.
- User confirm → BE call `/agent/confirm` → success step.
- Click "Continue" → modal close → bot start live trên Hyperliquid.
- Click "Go Live" lần 2 (đã có agent) → skip onboarding, launch ngay.
- User reject sign → error step với "Retry" button.

- [ ] **Step 3: Open PR**

```bash
git push -u origin feat/phase-2b-live-agent
gh pr create --title "feat(phase-2b): Live launch + Hyperliquid agent wallet flow" --body "..."
```

---

## Self-Review

**1. Spec coverage:**

- ✅ `/agent/create` → `/agent/confirm` flow (Tasks 2, 4)
- ✅ Pre-check `/agent/active` before live launch (Task 6)
- ✅ EIP-712 sign via wallet provider (Task 3)
- ✅ Onboarding modal 3-step (Task 5)
- ✅ Error handling (UserRejected + NoProvider + generic)
- ✅ Spending limit input + format (Task 3 `formatSpendingLimit`)
- ⏸️ `/agent/check-limit` API ready (Task 2) but not wired into launch flow — defer Phase 2b.1 nếu cần pre-flight gate trước PATCH+start.
- ⏸️ Agent revoke UI: out of scope (admin path).

**2. Placeholder scan:** Bullets describe what tests + components should look like; full JSX of `AgentOnboardingDialog` Task 5 is a structural outline, NOT full code. Implementer fills based on visual style + the test contracts. _(Trade-off accepted: faster ship of plan; component is straightforward enough.)_

**3. Type consistency:**

- `LaunchMode = 'dry-run' | 'live'` extends Phase 2a type.
- `AgentNotActiveError` new — exported from `launch-actions.ts`.
- `AgentFlowState` discriminated union — used consistently in hook + dialog.
- Agent api types pulled from re-exports in `api-helpers.ts` (Task 1).

---

## Execution Handoff

Plan complete: `docs/superpowers/plans/2026-05-28-phase-2b-launchpad-live-agent.md`. Two execution options:

1. **Subagent-Driven (recommended)** — dispatch a fresh subagent per task, two-stage review after each (spec compliance + code quality), fast iteration.
2. **Inline Execution** — execute tasks in this session, batch with checkpoints.

Phase 2b is gated on Phase 2a merge — wait for that first.

Which approach?
