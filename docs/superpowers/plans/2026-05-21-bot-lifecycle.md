# Bot Lifecycle (Run/Stop/Sync/Delete) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cho phép user **chạy / dừng / sync / xoá** bot từ FE thay vì chỉ create + view. Sau khi user tạo bot trong Builder (status `stopped`), họ cần bấm 1 nút để bot thực sự chạy, dừng nó khi cần, recover nếu process chết, hoặc xoá hẳn. Plan này wire 5 endpoint BE đã có: `POST /bot/{id}/start`, `POST /bot/{id}/stop`, `GET /bot/{id}/status`, `POST /bot/{id}/sync`, `DELETE /bot/{id}` vào 2 surface UI hiện tại: **Dashboard card** + **BotMonitoringPage header**.

**Architecture:** Mở rộng `bot.api.ts` với 5 method mới (cùng pattern `botApi.list`/`getConfig` hiện có). Tạo 1 hook `useBotStatusPoll(botId)` để poll `/status` với cadence khác nhau theo surface (Monitoring 3s, Dashboard 10s, **chỉ poll khi state transition** để giảm load). Mỗi action button đi qua confirm dialog với destructive variant cho Stop/Delete. Status flow: action → optimistic UI (`status: 'starting' | 'stopping'`) → poll cho tới khi terminal (`running` | `stopped` | `error`). Không cần WebSocket — REST polling đủ cho lifecycle (monitoring data thật sẽ dùng `/ws/bot/{id}/info` ở plan sau).

**Tech Stack:** React 18, TypeScript 5.7, Vite 6, React Router 7, Tailwind 3, Radix Dialog (qua `@/components/ui/dialog`), Vitest 2 + @testing-library/react, Sonner toasts.

**Reference:**

- [BE/API_SPEC.md](../../../BE/API_SPEC.md) — schema `BotStatusOut`, `BotOut`
- [BE/openapi.json](../../../BE/openapi.json) — source of truth
- [BE/tradingbot_doc.md](../../../BE/tradingbot_doc.md) — lifecycle design intent (BE owns process spawning)
- Prior wiring: [docs/superpowers/plans/2026-05-20-dashboard-real-bots.md](2026-05-20-dashboard-real-bots.md) — dashboard already consumes `botApi.list()`

---

## Build notes (post-implementation, 2026-05-28)

Phase 1 đã ship trên branch `feat/bot-lifecycle` (commits `78517f1`, `afa1080`, `1596b2d`, `616246e`, `db53cee`, `737daef`, `75b876c`, `7019cc8`). 393/393 tests pass, typecheck clean, 0 lint errors. Reviewer code nên đọc các deviation đã approve dưới đây — code có sai khác với snippet trong plan, **không phải bug**.

### T3 — `useBotStatusPoll` (commit `1596b2d`) — 2 approved deviations

- **Combined two `useEffect`s into one.** Plan calls `schedule()` synchronously before the initial fetch resolves, so `statusRef.current === null` → `isTerminal('')` is `false` → always picks `fastInterval` for the first tick. Breaks the "polls slow" test. Fix: `void fetchOnce().then(() => { if (enabled && active) schedule(); })`. Spec reviewer independently verified by reverting to plan code (test fails) — approved.
- **Added `globalThis.jest = vi` shim to `src/test/setup.ts`** so `@testing-library/dom`'s `waitFor` recognizes Vitest fake timers (RTL gates fake-timer detection on `typeof jest !== 'undefined'`). Without it, `waitFor` falls back to real-timer polling and hangs.

### T5 — `bot-list.helpers.ts` (commit `737daef`) — S3 + 2 approved deviations

- **S3 finding applied** (see `docs/superpowers/reviews/2026-05-28-response-to-devin-bot-lifecycle-review.md` §S3): `deriveMode` param narrowed from `BotOut` → `Pick<BotOut, 'status' | 'error_message'>`. Removes the cast + misleading `strategy_name: b.name` line that T6's `updateOneBot` would otherwise need.
- **Also touched `src/pages/DashboardPage.tsx`** (not in plan's file list): added `STARTING` + `STOPPING` entries to the `modeStyle` map. The map is `Record<DashboardBotMode, string>` (implicitly typed) so extending the union without extending the map fails typecheck.
- **Preserved the 2-if guard** for the `running` branch. Plan's condensed `config?.dry_run === false ? 'LIVE' : 'DRY-RUN'` would regress the existing `handles null config (treats as PAUSED unless explicitly error)` test (with `running` + `config=null`, ternary returns `'DRY-RUN'` instead of falling through to `'PAUSED'`).

### T1, T2, T4 — verbatim from plan

T4 has a 1-line a11y test fixture follow-up in commit `db53cee` (replaced `body=""` → `body="Stopping…"` to silence Radix's `Missing Description` warning).

### T6 + T7 — shipped without subagent code-review

T1–T5 went through the `superpowers:subagent-driven-development` review chain (spec + code-quality reviewers). T6 (`75b876c`) and T7 (`7019cc8`) were shipped manually and skipped that chain. **Code reviewer should give these extra attention.**

### Deferred findings (apply before merge, ~30 min)

| #             | Source      | Effort   | Description                                                                                                                     |
| ------------- | ----------- | -------- | ------------------------------------------------------------------------------------------------------------------------------- |
| T3 I2         | code-review | 10 lines | Missing tests for `enabled: false` and `botId === null` (documented contracts, no coverage today)                               |
| T3 I1         | code-review | 1 line   | Unmount race window for in-flight `setState` (React 18 silently no-ops; low risk) — add a `mountedRef` guard inside `fetchOnce` |
| T5 M1         | code-review | 1 line   | `Record<DashboardBotMode, string>` annotation on `modeStyle` for exhaustiveness lock-in                                         |
| T5 M2         | code-review | 2 lines  | Bump opacity `/60` → `/70` on STARTING/STOPPING text classes (WCAG AA at 10px)                                                  |
| T5 M4 _(opt)_ | code-review | 5 lines  | Test pinning `status='starting' + error_message='crash'` → STARTING precedence over ERROR                                       |

---

## Background — what BE exposes

Khi đọc plan này lần đầu, đây là 5 endpoint BE đã sẵn (xem `BE/openapi.json`):

| Endpoint           | Method | Body | Response         | Side effect BE                                                                               |
| ------------------ | ------ | ---- | ---------------- | -------------------------------------------------------------------------------------------- |
| `/bot/{id}/start`  | POST   | —    | `BotStatusOut`   | Spawn process Freqtrade với strategy file, set `desired_status='running'`                    |
| `/bot/{id}/stop`   | POST   | —    | `BotStatusOut`   | Kill process (graceful), set `desired_status='stopped'`                                      |
| `/bot/{id}/status` | GET    | —    | `BotStatusOut`   | Đọc DB + check process alive                                                                 |
| `/bot/{id}/sync`   | POST   | —    | `BotStatusOut`   | Re-check process health → fix `status` nếu DB lag (vd. process chết mà DB vẫn ghi `running`) |
| `/bot/{id}`        | DELETE | —    | `204 No Content` | Xoá DB record + file Python + tracking                                                       |

**Response schema `BotStatusOut`:**

```ts
{
  id: number;
  bot_name: string | null;
  status: string; // current — vd "running", "stopped", "starting", "stopping", "error"
  desired_status: string | null; // target — set bởi start/stop
  is_process_running: boolean; // BE check tiến trình OS thật
  error_message: string | null; // populated khi process crash
}
```

> ⚠️ **Spec không enum hoá `status`.** FE phải treat `running` và `stopped` là terminal, mọi thứ khác (`starting`, `stopping`, …) là transition — keep polling. Nếu `error_message` non-null → surface lỗi và cho user bấm Sync hoặc Delete.

---

## File Structure

**New files (5):**
| Path | Purpose |
|---|---|
| `src/features/bot-monitoring/useBotStatusPoll.ts` | React hook: poll `/bot/{id}/status` với cadence + auto-stop khi terminal |
| `src/features/bot-monitoring/useBotStatusPoll.test.ts` | Unit test cho hook (mock `botApi.getStatus`, fake timers) |
| `src/features/bot-monitoring/lifecycle-actions.ts` | Pure helpers: `nextOptimisticStatus(action, current)`, `isTerminal(status)`, `formatStatusLabel(status)` |
| `src/features/bot-monitoring/lifecycle-actions.test.ts` | Unit test |
| `src/features/bot-monitoring/ConfirmActionDialog.tsx` | Reusable Radix Dialog cho Stop/Delete confirmation (destructive variant) |

**Modified files (5):**
| Path | Change |
|---|---|
| `src/features/bot-monitoring/bot.api.ts` | Add `start`, `stop`, `getStatus`, `sync`, `delete` methods + export `BotStatusOut` type |
| `src/features/bot-monitoring/bot-list.helpers.ts` | Add `mode` derivation for new statuses (`STARTING`, `STOPPING`) → render as transition; expose `deriveMode(bot, config)` already exists, extend it |
| `src/features/bot-monitoring/bot-list.helpers.test.ts` | Cover new transition modes |
| `src/pages/DashboardPage.tsx` | Wire Resume/Pause/Stop/Delete buttons on `BotCard`; refresh row after action via shared callback |
| `src/features/bot-monitoring/BotMonitoringPage.tsx` | Replace `// TODO(wallet-team)` Stop button with real action; show status pill from real `useBotStatusPoll` (header `Live`/`Dry-run` chip stays unchanged at this phase) |

**Not in scope (defer to next plans):**

- WebSocket `/ws/bot/{id}/info` signal stream
- `GET /bot/{id}/open_trades`, `/logs`, `/performance` → real charts on BotMonitoringPage
- Force entry/exit, set stoploss (`/force_entry`, `/force_exit`, `/set_stoploss`)
- Bulk actions on Dashboard (multi-select start/stop)
- Soft delete vs hard delete distinction

---

## Task 1: Extend `bot.api.ts` with 5 lifecycle methods

**Files:**

- Modify: `src/features/bot-monitoring/bot.api.ts`
- Create: `src/features/bot-monitoring/__tests__/bot.api.lifecycle.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/features/bot-monitoring/__tests__/bot.api.lifecycle.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { botApi } from '../bot.api';

describe('botApi lifecycle', () => {
  const fetchSpy = vi.fn();

  beforeEach(() => {
    sessionStorage.setItem(
      'trading_bot_wallet_auth',
      JSON.stringify({ address: '0xabc', nonce: 'n', signature: 's' }),
    );
    vi.stubGlobal('fetch', fetchSpy);
  });

  afterEach(() => {
    sessionStorage.clear();
    vi.unstubAllGlobals();
    fetchSpy.mockReset();
  });

  function jsonRes(body: unknown, status = 200) {
    return new Response(JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  it('start POSTs /bot/:id/start and returns BotStatusOut', async () => {
    fetchSpy.mockResolvedValueOnce(
      jsonRes({
        id: 42,
        bot_name: 'My bot',
        status: 'starting',
        desired_status: 'running',
        is_process_running: false,
        error_message: null,
      }),
    );
    const res = await botApi.start(42);
    expect(fetchSpy).toHaveBeenCalledWith(
      expect.stringContaining('/bot/42/start'),
      expect.objectContaining({ method: 'POST' }),
    );
    expect(res.status).toBe('starting');
    expect(res.desired_status).toBe('running');
  });

  it('stop POSTs /bot/:id/stop', async () => {
    fetchSpy.mockResolvedValueOnce(
      jsonRes({
        id: 42,
        status: 'stopping',
        desired_status: 'stopped',
        is_process_running: true,
      }),
    );
    const res = await botApi.stop(42);
    expect(fetchSpy).toHaveBeenCalledWith(
      expect.stringContaining('/bot/42/stop'),
      expect.objectContaining({ method: 'POST' }),
    );
    expect(res.status).toBe('stopping');
  });

  it('getStatus GETs /bot/:id/status', async () => {
    fetchSpy.mockResolvedValueOnce(
      jsonRes({
        id: 42,
        status: 'running',
        desired_status: 'running',
        is_process_running: true,
      }),
    );
    const res = await botApi.getStatus(42);
    expect(fetchSpy).toHaveBeenCalledWith(
      expect.stringContaining('/bot/42/status'),
      expect.objectContaining({ method: 'GET' }),
    );
    expect(res.is_process_running).toBe(true);
  });

  it('sync POSTs /bot/:id/sync', async () => {
    fetchSpy.mockResolvedValueOnce(
      jsonRes({
        id: 42,
        status: 'stopped',
        desired_status: 'running',
        is_process_running: false,
        error_message: 'Process crashed',
      }),
    );
    const res = await botApi.sync(42);
    expect(fetchSpy).toHaveBeenCalledWith(
      expect.stringContaining('/bot/42/sync'),
      expect.objectContaining({ method: 'POST' }),
    );
    expect(res.error_message).toBe('Process crashed');
  });

  it('remove DELETEs /bot/:id and resolves to undefined on 204', async () => {
    fetchSpy.mockResolvedValueOnce(new Response(null, { status: 204 }));
    const res = await botApi.remove(42);
    expect(fetchSpy).toHaveBeenCalledWith(
      expect.stringContaining('/bot/42'),
      expect.objectContaining({ method: 'DELETE' }),
    );
    expect(res).toBeUndefined();
  });

  it('start throws HttpError on 500 (silent-toast prefix)', async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response('Internal error', { status: 500 }),
    );
    await expect(botApi.start(42)).rejects.toThrow();
  });
});
```

Run:

```bash
pnpm vitest run src/features/bot-monitoring/__tests__/bot.api.lifecycle.test.ts
```

Expected: FAIL — `botApi.start is not a function` (and similar for stop/getStatus/sync/remove).

- [ ] **Step 2: Implement the API methods**

Replace `src/features/bot-monitoring/bot.api.ts` with:

```ts
import { http } from '@/lib/http';
import type { components } from '@/types/api';

export type BotOut = components['schemas']['BotOut'];
export type BotConfigOut = components['schemas']['BotConfigOut'];
export type BotStatusOut = components['schemas']['BotStatusOut'];

export const botApi = {
  list: () => http<BotOut[]>('GET', '/bot/list'),
  getConfig: (id: number) => http<BotConfigOut>('GET', `/bot/${id}/config`),
  getStatus: (id: number) => http<BotStatusOut>('GET', `/bot/${id}/status`),
  start: (id: number) => http<BotStatusOut>('POST', `/bot/${id}/start`),
  stop: (id: number) => http<BotStatusOut>('POST', `/bot/${id}/stop`),
  sync: (id: number) => http<BotStatusOut>('POST', `/bot/${id}/sync`),
  // `remove` (not `delete` — reserved word in some lint configs)
  remove: (id: number) => http<void>('DELETE', `/bot/${id}`),
};
```

> Note: `BotStatusOut` đã có trong `src/types/api.d.ts` vì spec đã regen. Nếu typecheck báo thiếu, regen: `pnpm gen:api` (script `gen:api` chạy `openapi-typescript BE/openapi.json -o src/types/api.d.ts`). Đừng tạo type tay.

Run tests again:

```bash
pnpm vitest run src/features/bot-monitoring/__tests__/bot.api.lifecycle.test.ts
```

Expected: all 6 PASS.

- [ ] **Step 3: Typecheck + commit**

```bash
pnpm typecheck
git add src/features/bot-monitoring/bot.api.ts \
        src/features/bot-monitoring/__tests__/bot.api.lifecycle.test.ts
git commit -m "feat(bot-api): add start/stop/getStatus/sync/remove lifecycle methods"
```

---

## Task 2: `lifecycle-actions.ts` pure helpers

Tách 3 helper pure (optimistic state, terminal check, label format) ra module riêng để test độc lập + để Dashboard và Monitoring cùng dùng.

**Files:**

- Create: `src/features/bot-monitoring/lifecycle-actions.ts`
- Create: `src/features/bot-monitoring/lifecycle-actions.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/features/bot-monitoring/lifecycle-actions.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import {
  isTerminal,
  nextOptimisticStatus,
  formatStatusLabel,
} from './lifecycle-actions';

describe('isTerminal', () => {
  it('returns true for known terminal states', () => {
    expect(isTerminal('running')).toBe(true);
    expect(isTerminal('stopped')).toBe(true);
    expect(isTerminal('error')).toBe(true);
  });
  it('returns false for transition states', () => {
    expect(isTerminal('starting')).toBe(false);
    expect(isTerminal('stopping')).toBe(false);
  });
  it('treats unknown status as non-terminal (keep polling)', () => {
    expect(isTerminal('weird-new-state')).toBe(false);
  });
});

describe('nextOptimisticStatus', () => {
  it('start → starting', () => {
    expect(nextOptimisticStatus('start', 'stopped')).toBe('starting');
    expect(nextOptimisticStatus('start', 'error')).toBe('starting');
  });
  it('stop → stopping', () => {
    expect(nextOptimisticStatus('stop', 'running')).toBe('stopping');
  });
  it('sync → leaves status alone (server picks)', () => {
    expect(nextOptimisticStatus('sync', 'running')).toBe('running');
    expect(nextOptimisticStatus('sync', 'error')).toBe('error');
  });
});

describe('formatStatusLabel', () => {
  it('returns human label for known states', () => {
    expect(formatStatusLabel('running')).toBe('Running');
    expect(formatStatusLabel('stopped')).toBe('Stopped');
    expect(formatStatusLabel('starting')).toBe('Starting…');
    expect(formatStatusLabel('stopping')).toBe('Stopping…');
    expect(formatStatusLabel('error')).toBe('Error');
  });
  it('falls back to titlecase for unknown', () => {
    expect(formatStatusLabel('weird_new')).toBe('Weird new');
  });
});
```

Run:

```bash
pnpm vitest run src/features/bot-monitoring/lifecycle-actions.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 2: Implement**

Create `src/features/bot-monitoring/lifecycle-actions.ts`:

```ts
export type LifecycleAction = 'start' | 'stop' | 'sync' | 'remove';

const TERMINAL = new Set(['running', 'stopped', 'error']);

export function isTerminal(status: string): boolean {
  return TERMINAL.has(status);
}

export function nextOptimisticStatus(
  action: LifecycleAction,
  current: string,
): string {
  if (action === 'start') return 'starting';
  if (action === 'stop') return 'stopping';
  return current;
}

const LABELS: Record<string, string> = {
  running: 'Running',
  stopped: 'Stopped',
  starting: 'Starting…',
  stopping: 'Stopping…',
  error: 'Error',
};

export function formatStatusLabel(status: string): string {
  if (LABELS[status]) return LABELS[status];
  // Titlecase fallback: "weird_new" → "Weird new"
  const spaced = status.replace(/_/g, ' ');
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}
```

Run tests:

```bash
pnpm vitest run src/features/bot-monitoring/lifecycle-actions.test.ts
```

Expected: all PASS.

- [ ] **Step 3: Commit**

```bash
git add src/features/bot-monitoring/lifecycle-actions.ts \
        src/features/bot-monitoring/lifecycle-actions.test.ts
git commit -m "feat(bot-lifecycle): pure helpers for status labels + optimistic transitions"
```

---

## Task 3: `useBotStatusPoll` hook with adaptive cadence

Poll `botApi.getStatus(id)` định kỳ:

- **Khi mounted lần đầu** → fetch ngay (initial state)
- **Status terminal (running / stopped / error)** → poll mỗi `slowInterval` (default 10s) — chỉ refresh để bắt drift
- **Status transition (starting / stopping / unknown)** → poll mỗi `fastInterval` (default 1.5s) — user vừa bấm action, muốn UI update nhanh
- **`document.hidden`** → skip tick (đỡ phí request khi tab background)

**Files:**

- Create: `src/features/bot-monitoring/useBotStatusPoll.ts`
- Create: `src/features/bot-monitoring/useBotStatusPoll.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/features/bot-monitoring/useBotStatusPoll.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useBotStatusPoll } from './useBotStatusPoll';
import { botApi, type BotStatusOut } from './bot.api';

vi.mock('./bot.api', () => ({
  botApi: { getStatus: vi.fn() },
}));

function mkStatus(over: Partial<BotStatusOut> = {}): BotStatusOut {
  return {
    id: 42,
    bot_name: 'b',
    status: 'stopped',
    desired_status: null,
    is_process_running: false,
    error_message: null,
    ...over,
  } as BotStatusOut;
}

describe('useBotStatusPoll', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.mocked(botApi.getStatus).mockResolvedValue(mkStatus());
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.resetAllMocks();
  });

  it('fetches once on mount', async () => {
    const { result } = renderHook(() => useBotStatusPoll(42));
    await waitFor(() => expect(result.current.status).not.toBeNull());
    expect(botApi.getStatus).toHaveBeenCalledTimes(1);
    expect(result.current.status?.status).toBe('stopped');
  });

  it('polls fast (1.5s) while in transition state', async () => {
    vi.mocked(botApi.getStatus)
      .mockResolvedValueOnce(mkStatus({ status: 'starting' }))
      .mockResolvedValueOnce(mkStatus({ status: 'starting' }))
      .mockResolvedValueOnce(mkStatus({ status: 'running' }));

    renderHook(() => useBotStatusPoll(42));
    // initial
    await vi.advanceTimersByTimeAsync(0);
    expect(botApi.getStatus).toHaveBeenCalledTimes(1);
    // 1.5s tick
    await vi.advanceTimersByTimeAsync(1_500);
    expect(botApi.getStatus).toHaveBeenCalledTimes(2);
    // another 1.5s tick — now terminal
    await vi.advanceTimersByTimeAsync(1_500);
    expect(botApi.getStatus).toHaveBeenCalledTimes(3);
  });

  it('polls slow (10s) while in terminal state', async () => {
    vi.mocked(botApi.getStatus).mockResolvedValue(
      mkStatus({ status: 'running' }),
    );
    renderHook(() => useBotStatusPoll(42));
    await vi.advanceTimersByTimeAsync(0);
    expect(botApi.getStatus).toHaveBeenCalledTimes(1);

    // Tick 1.5s — should NOT fetch (terminal uses 10s cadence)
    await vi.advanceTimersByTimeAsync(1_500);
    expect(botApi.getStatus).toHaveBeenCalledTimes(1);

    // Tick another 8.5s (total 10s) → fetch
    await vi.advanceTimersByTimeAsync(8_500);
    expect(botApi.getStatus).toHaveBeenCalledTimes(2);
  });

  it('skips tick when document.hidden=true', async () => {
    Object.defineProperty(document, 'hidden', {
      value: true,
      configurable: true,
    });
    renderHook(() => useBotStatusPoll(42));
    await vi.advanceTimersByTimeAsync(0);
    // initial fetch DOES still run on mount even if hidden (so we have data)
    expect(botApi.getStatus).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(10_000);
    expect(botApi.getStatus).toHaveBeenCalledTimes(1);
    Object.defineProperty(document, 'hidden', {
      value: false,
      configurable: true,
    });
  });

  it('exposes refetch() that forces an immediate fetch', async () => {
    const { result } = renderHook(() => useBotStatusPoll(42));
    await waitFor(() => expect(botApi.getStatus).toHaveBeenCalledTimes(1));
    await act(async () => {
      await result.current.refetch();
    });
    expect(botApi.getStatus).toHaveBeenCalledTimes(2);
  });

  it('exposes setStatus() for optimistic update from action handlers', async () => {
    const { result } = renderHook(() => useBotStatusPoll(42));
    await waitFor(() => expect(result.current.status).not.toBeNull());
    act(() => {
      result.current.setStatus(mkStatus({ status: 'starting' }));
    });
    expect(result.current.status?.status).toBe('starting');
  });

  it('stops polling on unmount', async () => {
    const { unmount } = renderHook(() => useBotStatusPoll(42));
    await vi.advanceTimersByTimeAsync(0);
    expect(botApi.getStatus).toHaveBeenCalledTimes(1);
    unmount();
    await vi.advanceTimersByTimeAsync(60_000);
    expect(botApi.getStatus).toHaveBeenCalledTimes(1);
  });
});
```

Run:

```bash
pnpm vitest run src/features/bot-monitoring/useBotStatusPoll.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 2: Implement the hook**

Create `src/features/bot-monitoring/useBotStatusPoll.ts`:

```ts
import { useCallback, useEffect, useRef, useState } from 'react';
import { botApi, type BotStatusOut } from './bot.api';
import { isTerminal } from './lifecycle-actions';

export interface UseBotStatusPollOptions {
  /** Poll interval when status is transition (starting/stopping/unknown). Default 1500ms. */
  fastInterval?: number;
  /** Poll interval when status is terminal (running/stopped/error). Default 10000ms. */
  slowInterval?: number;
  /** Set to false to disable polling entirely (still does initial fetch). */
  enabled?: boolean;
}

export interface UseBotStatusPollResult {
  status: BotStatusOut | null;
  loading: boolean;
  error: string | null;
  /** Force an immediate fetch (e.g. after a start/stop action). */
  refetch: () => Promise<void>;
  /** Replace status synchronously (e.g. optimistic update). Next tick still polls server. */
  setStatus: (s: BotStatusOut) => void;
}

export function useBotStatusPoll(
  botId: number | null,
  opts: UseBotStatusPollOptions = {},
): UseBotStatusPollResult {
  const { fastInterval = 1_500, slowInterval = 10_000, enabled = true } = opts;
  const [status, setStatusState] = useState<BotStatusOut | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Stash status in ref so the polling loop can read latest without re-binding
  // the interval each render. Re-creating the interval on every state change
  // would make cadence detection (terminal vs transition) impossible.
  const statusRef = useRef<BotStatusOut | null>(null);
  statusRef.current = status;

  const inFlightRef = useRef(false);

  const fetchOnce = useCallback(async () => {
    if (botId == null) return;
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    try {
      const res = await botApi.getStatus(botId);
      setStatusState(res);
      statusRef.current = res;
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      inFlightRef.current = false;
      setLoading(false);
    }
  }, [botId]);

  useEffect(() => {
    if (botId == null) {
      setLoading(false);
      return;
    }
    setLoading(true);
    void fetchOnce();
  }, [botId, fetchOnce]);

  useEffect(() => {
    if (!enabled || botId == null) return;

    let handle: ReturnType<typeof setTimeout> | null = null;
    const schedule = () => {
      const current = statusRef.current?.status ?? '';
      const ms = isTerminal(current) ? slowInterval : fastInterval;
      handle = setTimeout(async () => {
        if (!document.hidden) {
          await fetchOnce();
        }
        schedule();
      }, ms);
    };
    schedule();
    return () => {
      if (handle != null) clearTimeout(handle);
    };
  }, [botId, enabled, fastInterval, slowInterval, fetchOnce]);

  const refetch = useCallback(async () => {
    await fetchOnce();
  }, [fetchOnce]);

  const setStatus = useCallback((s: BotStatusOut) => {
    setStatusState(s);
    statusRef.current = s;
  }, []);

  return { status, loading, error, refetch, setStatus };
}
```

Run tests:

```bash
pnpm vitest run src/features/bot-monitoring/useBotStatusPoll.test.ts
```

Expected: all 7 PASS.

- [ ] **Step 3: Commit**

```bash
git add src/features/bot-monitoring/useBotStatusPoll.ts \
        src/features/bot-monitoring/useBotStatusPoll.test.ts
git commit -m "feat(bot-lifecycle): useBotStatusPoll hook with adaptive cadence"
```

---

## Task 4: `ConfirmActionDialog` reusable component

Một dialog xác nhận destructive action (Stop / Delete). Pattern này lặp lại 4 lần (Stop trên Dashboard card, Stop trên Monitoring header, Delete trên card, Delete trên header sau này) → extract ra ngay.

**Files:**

- Create: `src/features/bot-monitoring/ConfirmActionDialog.tsx`
- Create: `src/features/bot-monitoring/__tests__/ConfirmActionDialog.test.tsx`

- [ ] **Step 1: Write failing test**

Create `src/features/bot-monitoring/__tests__/ConfirmActionDialog.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ConfirmActionDialog } from '../ConfirmActionDialog';

describe('ConfirmActionDialog', () => {
  it('renders title/body and fires onConfirm when user clicks confirm', async () => {
    const onConfirm = vi.fn();
    const onOpenChange = vi.fn();
    render(
      <ConfirmActionDialog
        open
        onOpenChange={onOpenChange}
        title="Stop bot?"
        body="The bot will stop placing orders immediately."
        confirmLabel="Stop"
        variant="destructive"
        onConfirm={onConfirm}
      />,
    );
    expect(screen.getByText('Stop bot?')).toBeInTheDocument();
    expect(screen.getByText(/will stop placing orders/i)).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Stop' }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('cancel closes without calling onConfirm', async () => {
    const onConfirm = vi.fn();
    const onOpenChange = vi.fn();
    render(
      <ConfirmActionDialog
        open
        onOpenChange={onOpenChange}
        title="Delete bot?"
        body="This action cannot be undone."
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={onConfirm}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: /cancel/i }));
    expect(onConfirm).not.toHaveBeenCalled();
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('shows a loading spinner state when busy=true and disables confirm', async () => {
    const onConfirm = vi.fn();
    render(
      <ConfirmActionDialog
        open
        onOpenChange={() => {}}
        title="Stop bot?"
        body=""
        confirmLabel="Stop"
        variant="destructive"
        onConfirm={onConfirm}
        busy
      />,
    );
    const btn = screen.getByRole('button', { name: /stop/i });
    expect(btn).toBeDisabled();
    await userEvent.click(btn);
    expect(onConfirm).not.toHaveBeenCalled();
  });
});
```

Run:

```bash
pnpm vitest run src/features/bot-monitoring/__tests__/ConfirmActionDialog.test.tsx
```

Expected: FAIL — module not found.

- [ ] **Step 2: Implement**

Create `src/features/bot-monitoring/ConfirmActionDialog.tsx`:

```tsx
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';

export interface ConfirmActionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  body: string;
  confirmLabel: string;
  cancelLabel?: string;
  variant?: 'destructive' | 'primary';
  busy?: boolean;
  onConfirm: () => void;
}

export function ConfirmActionDialog({
  open,
  onOpenChange,
  title,
  body,
  confirmLabel,
  cancelLabel = 'Cancel',
  variant = 'destructive',
  busy = false,
  onConfirm,
}: ConfirmActionDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {body ? <DialogDescription>{body}</DialogDescription> : null}
        </DialogHeader>
        <DialogFooter className="mt-4 gap-2">
          <Button
            variant="ghost"
            size="sm"
            disabled={busy}
            onClick={() => onOpenChange(false)}
          >
            {cancelLabel}
          </Button>
          <Button
            variant={variant === 'destructive' ? 'destructive' : 'primary'}
            size="sm"
            disabled={busy}
            onClick={() => {
              if (busy) return;
              onConfirm();
            }}
          >
            {busy ? (
              <>
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                {confirmLabel}
              </>
            ) : (
              confirmLabel
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

> If `Button` doesn't have a `destructive` variant yet, check `src/components/ui/button.tsx`. If absent, add one (red bg, white text) — typical shadcn pattern. If you add a variant, also add a test for it OR open a tiny follow-up commit before this task.

Run tests:

```bash
pnpm vitest run src/features/bot-monitoring/__tests__/ConfirmActionDialog.test.tsx
```

Expected: all 3 PASS.

- [ ] **Step 3: Commit**

```bash
git add src/features/bot-monitoring/ConfirmActionDialog.tsx \
        src/features/bot-monitoring/__tests__/ConfirmActionDialog.test.tsx
git commit -m "feat(bot-lifecycle): ConfirmActionDialog for destructive lifecycle actions"
```

---

## Task 5: Extend `bot-list.helpers.ts` for transition modes

`deriveMode` hiện trả 4 giá trị: `LIVE | DRY-RUN | PAUSED | ERROR`. Cần thêm 2 transition mode để UI biết khi nào hiện spinner:

- `STARTING` — `status === 'starting'`
- `STOPPING` — `status === 'stopping'`

**Files:**

- Modify: `src/features/bot-monitoring/bot-list.helpers.ts`
- Modify: `src/features/bot-monitoring/bot-list.helpers.test.ts`

- [ ] **Step 1: Extend the failing tests**

Append to `src/features/bot-monitoring/bot-list.helpers.test.ts` inside the `describe('deriveMode', ...)` block (after the existing tests):

```ts
it('returns STARTING when status is starting', () => {
  expect(deriveMode(makeBot({ status: 'starting' }), makeConfig())).toBe(
    'STARTING',
  );
});
it('returns STOPPING when status is stopping', () => {
  expect(deriveMode(makeBot({ status: 'stopping' }), makeConfig())).toBe(
    'STOPPING',
  );
});
it('STARTING/STOPPING take precedence over error_message=null check', () => {
  // status `starting` even with no error → STARTING, not PAUSED
  expect(
    deriveMode(makeBot({ status: 'starting', error_message: null }), null),
  ).toBe('STARTING');
});
```

Run:

```bash
pnpm vitest run src/features/bot-monitoring/bot-list.helpers.test.ts
```

Expected: 3 new tests FAIL (current `deriveMode` returns `PAUSED` for `starting`/`stopping`).

- [ ] **Step 2: Update `DashboardBotMode` union and `deriveMode`**

Edit `src/features/bot-monitoring/bot-list.helpers.ts`:

```ts
export type DashboardBotMode =
  | 'LIVE'
  | 'DRY-RUN'
  | 'PAUSED'
  | 'ERROR'
  | 'STARTING'
  | 'STOPPING';
```

And inside `deriveMode`, BEFORE the existing checks add:

```ts
export function deriveMode(
  bot: BotOut,
  config: ConfigShape | null,
): DashboardBotMode {
  if (bot.status === 'starting') return 'STARTING';
  if (bot.status === 'stopping') return 'STOPPING';
  if (bot.error_message) return 'ERROR';
  if (bot.status === 'running') {
    return config?.dry_run === false ? 'LIVE' : 'DRY-RUN';
  }
  return 'PAUSED';
}
```

Run tests:

```bash
pnpm vitest run src/features/bot-monitoring/bot-list.helpers.test.ts
```

Expected: all PASS (existing + 3 new).

- [ ] **Step 3: Commit**

```bash
git add src/features/bot-monitoring/bot-list.helpers.ts \
        src/features/bot-monitoring/bot-list.helpers.test.ts
git commit -m "feat(bot-list): STARTING/STOPPING transition modes"
```

---

## Task 6: Wire Dashboard card actions (Start / Stop / Delete)

DashboardPage `BotCard` hiện đã có 3 button (Edit / Pause-Resume / ■ Stop) nhưng **chưa wire**. Cần:

1. Map `mode` → button visible + label:
   - `PAUSED` (stopped) → **Resume** (primary) + **Delete** (ghost icon)
   - `LIVE` / `DRY-RUN` (running) → **Pause** = stop (secondary) + **Delete** (ghost icon)
   - `STARTING` / `STOPPING` → button disabled + Loader2 spinner
   - `ERROR` → **Sync** (warning) + **Delete** (ghost icon)
2. Click action → confirm dialog (Stop/Delete) → call API → optimistic update + refetch list
3. Demo cards (`isDemo: true`) → buttons disabled / hidden (no wallet wallet → 401 → noop)

**Files:**

- Modify: `src/pages/DashboardPage.tsx`
- Modify: `src/pages/__tests__/DashboardPage.test.tsx` (extend)

- [ ] **Step 1: Add helper that mutates one bot in `realBots`**

Inside `DashboardPage`, near the `useEffect` that fetches the list, add:

```ts
import type { BotStatusOut } from '@/features/bot-monitoring/bot.api';
import { deriveMode } from '@/features/bot-monitoring/bot-list.helpers';

// Update one bot in realBots after a lifecycle action. Keeps other rows
// untouched so the user's scroll position / hover state isn't reset.
// `BotStatusOut` doesn't expose dry_run, so we infer it from the previous
// mode of the row (set at mount time from `getConfig`). For PAUSED rows
// (dry_run unknown), `deriveMode` defaults to DRY-RUN when status=running —
// the user can hit Refresh to re-derive from `getConfig` if it matters.
const updateOneBot = useCallback((id: number, next: BotStatusOut) => {
  setRealBots((prev) => {
    if (!prev) return prev;
    return prev.map((b) => {
      if (b.id !== id) return b;
      const prevDryRun =
        b.mode === 'LIVE' ? false : b.mode === 'DRY-RUN' ? true : null;
      return {
        ...b,
        mode: deriveMode(
          {
            id: next.id,
            bot_name: next.bot_name ?? null,
            status: next.status,
            desired_status: next.desired_status ?? null,
            error_message: next.error_message ?? null,
            strategy_name: b.name,
          } as Parameters<typeof deriveMode>[0],
          { dry_run: prevDryRun },
        ),
        errorMsg: next.error_message ?? null,
      };
    });
  });
}, []);

const removeOneBot = useCallback((id: number) => {
  setRealBots((prev) => (prev ? prev.filter((b) => b.id !== id) : prev));
}, []);
```

> The cast `as Parameters<...>[0]` mirrors the existing `BotOut`/`ConfigShape` shape that `deriveMode` expects — `BotStatusOut` is a subset.

- [ ] **Step 2: Add action handlers using `botApi`**

Still inside `DashboardPage`, add the action functions:

```ts
import { botApi } from '@/features/bot-monitoring/bot.api';
import { toast } from 'sonner';
import { formatBackendError } from '@/lib/format-error';

const [pendingActionId, setPendingActionId] = useState<number | null>(null);
const [confirmState, setConfirmState] = useState<null | {
  action: 'stop' | 'remove';
  botId: number;
  botName: string;
}>(null);

const doStart = useCallback(
  async (id: number) => {
    setPendingActionId(id);
    try {
      const next = await botApi.start(id);
      updateOneBot(id, next);
      toast.success(`Starting bot #${id}`);
    } catch (err) {
      toast.error(formatBackendError(err));
    } finally {
      setPendingActionId(null);
    }
  },
  [updateOneBot],
);

const doStop = useCallback(
  async (id: number) => {
    setPendingActionId(id);
    try {
      const next = await botApi.stop(id);
      updateOneBot(id, next);
      toast.success(`Stopping bot #${id}`);
    } catch (err) {
      toast.error(formatBackendError(err));
    } finally {
      setPendingActionId(null);
    }
  },
  [updateOneBot],
);

const doSync = useCallback(
  async (id: number) => {
    setPendingActionId(id);
    try {
      const next = await botApi.sync(id);
      updateOneBot(id, next);
      toast.message('Re-synced bot status');
    } catch (err) {
      toast.error(formatBackendError(err));
    } finally {
      setPendingActionId(null);
    }
  },
  [updateOneBot],
);

const doRemove = useCallback(
  async (id: number) => {
    setPendingActionId(id);
    try {
      await botApi.remove(id);
      removeOneBot(id);
      toast.success(`Bot #${id} deleted`);
    } catch (err) {
      toast.error(formatBackendError(err));
    } finally {
      setPendingActionId(null);
      setConfirmState(null);
    }
  },
  [removeOneBot],
);
```

- [ ] **Step 3: Pass action props to `BotCard`**

Update the `BotCard` mapping:

```tsx
{
  filteredBots.map((bot) => (
    <BotCard
      key={bot.id}
      bot={bot}
      busy={pendingActionId === bot.id}
      onClick={
        bot.isDemo
          ? () => requireWalletThen(() => navigate('/builder'))
          : () => navigate(`/bots/${bot.id}`)
      }
      onStart={bot.isDemo ? undefined : () => void doStart(bot.id)}
      onStop={
        bot.isDemo
          ? undefined
          : () =>
              setConfirmState({
                action: 'stop',
                botId: bot.id,
                botName: bot.name,
              })
      }
      onSync={bot.isDemo ? undefined : () => void doSync(bot.id)}
      onRemove={
        bot.isDemo
          ? undefined
          : () =>
              setConfirmState({
                action: 'remove',
                botId: bot.id,
                botName: bot.name,
              })
      }
    />
  ));
}
```

- [ ] **Step 4: Update `BotCardProps` and the action row inside `BotCard`**

```tsx
import { Loader2, Play, StopCircle, Trash2, RefreshCcw } from 'lucide-react';

interface BotCardProps {
  bot: DashboardBot | MockBot;
  onClick: () => void;
  busy?: boolean;
  onStart?: () => void;
  onStop?: () => void;
  onSync?: () => void;
  onRemove?: () => void;
}

function BotCard({
  bot,
  onClick,
  busy = false,
  onStart,
  onStop,
  onSync,
  onRemove,
}: BotCardProps) {
  // ... (existing card chrome stays unchanged)

  // ── REPLACE the existing /* Actions */ block at ~line 602 with: ──
  return (
    <article /* … existing className/onClick … */>
      {/* … keep header, sparkline, metrics … */}

      {/* Actions */}
      <div className="mt-3 flex gap-1.5" onClick={(e) => e.stopPropagation()}>
        {bot.mode === 'ERROR' ? (
          <>
            <Button
              variant="primary"
              size="sm"
              className="flex-1"
              disabled={busy || !onSync}
              onClick={onSync}
            >
              {busy ? (
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              ) : (
                <RefreshCcw className="mr-1.5 h-3.5 w-3.5" />
              )}
              Fix connection
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="px-2 text-bearish hover:bg-bearish-subtle"
              aria-label="Delete bot"
              disabled={busy || !onRemove}
              onClick={onRemove}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </>
        ) : bot.mode === 'STARTING' || bot.mode === 'STOPPING' ? (
          <Button variant="secondary" size="sm" className="flex-1" disabled>
            <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            {bot.mode === 'STARTING' ? 'Starting…' : 'Stopping…'}
          </Button>
        ) : bot.mode === 'PAUSED' ? (
          <>
            <Button
              variant="primary"
              size="sm"
              className="flex-1"
              disabled={busy || !onStart}
              onClick={onStart}
            >
              {busy ? (
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              ) : (
                <Play className="mr-1.5 h-3.5 w-3.5" />
              )}
              Start
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="px-2 text-bearish hover:bg-bearish-subtle"
              aria-label="Delete bot"
              disabled={busy || !onRemove}
              onClick={onRemove}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </>
        ) : (
          /* LIVE or DRY-RUN */
          <>
            <Button
              variant="secondary"
              size="sm"
              className="flex-1"
              disabled={busy || !onStop}
              onClick={onStop}
            >
              {busy ? (
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              ) : (
                <StopCircle className="mr-1.5 h-3.5 w-3.5" />
              )}
              Stop
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="px-2 text-bearish hover:bg-bearish-subtle"
              aria-label="Delete bot"
              disabled={busy || !onRemove}
              onClick={onRemove}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </>
        )}
      </div>
    </article>
  );
}
```

Remove the old static `Edit / Pause-Resume / ■` button row that's currently at the same location.

- [ ] **Step 5: Render `ConfirmActionDialog`**

At the bottom of the `DashboardPage` return tree (before the closing `</>` or wrapping `<div>`), add:

```tsx
<ConfirmActionDialog
  open={confirmState != null}
  onOpenChange={(o) => {
    if (!o) setConfirmState(null);
  }}
  title={
    confirmState?.action === 'remove'
      ? `Delete "${confirmState.botName}"?`
      : `Stop "${confirmState?.botName}"?`
  }
  body={
    confirmState?.action === 'remove'
      ? 'This action cannot be undone. The bot, its strategy file, and its tracking history will be permanently removed.'
      : 'The bot will stop placing orders immediately. Open positions are NOT closed automatically — you can manage them on the bot detail page.'
  }
  confirmLabel={confirmState?.action === 'remove' ? 'Delete' : 'Stop'}
  variant="destructive"
  busy={pendingActionId === confirmState?.botId}
  onConfirm={() => {
    if (!confirmState) return;
    if (confirmState.action === 'stop') void doStop(confirmState.botId);
    else void doRemove(confirmState.botId);
  }}
/>
```

Add the import:

```ts
import { ConfirmActionDialog } from '@/features/bot-monitoring/ConfirmActionDialog';
```

- [ ] **Step 6: Component tests for new actions**

Append to `src/pages/__tests__/DashboardPage.test.tsx`:

```tsx
import { toast } from 'sonner';

vi.mock('sonner', async () => {
  const actual = await vi.importActual<typeof import('sonner')>('sonner');
  return {
    ...actual,
    toast: {
      success: vi.fn(),
      error: vi.fn(),
      message: vi.fn(),
      warning: vi.fn(),
    },
  };
});

describe('DashboardPage — lifecycle actions', () => {
  beforeEach(() => {
    useWalletStore.setState({
      address: '0xabc',
      nonce: 'n',
      signature: 's',
      status: 'ready',
      user: null,
      error: null,
      signingMessage: null,
    });
  });

  function loadOne(over: Partial<BotOut> = {}, dryRun = true) {
    vi.mocked(botApi.list).mockResolvedValueOnce([
      {
        id: 7,
        bot_name: 'Lifecycle bot',
        status: 'stopped',
        desired_status: null,
        error_message: null,
        strategy_name: 'X',
        ...over,
      },
    ]);
    vi.mocked(botApi.getConfig).mockResolvedValueOnce({
      config: {
        dry_run: dryRun,
        timeframe: '5m',
        exchange: { pair_whitelist: ['BTC/USDT'] },
      },
    });
  }

  it('Start button calls botApi.start and optimistically updates row to STARTING', async () => {
    loadOne();
    vi.mocked(botApi.start).mockResolvedValueOnce({
      id: 7,
      bot_name: 'Lifecycle bot',
      status: 'starting',
      desired_status: 'running',
      is_process_running: false,
      error_message: null,
    });

    renderPage();
    await waitFor(() =>
      expect(screen.getByText('Lifecycle bot')).toBeInTheDocument(),
    );
    await userEvent.click(screen.getByRole('button', { name: /start/i }));

    expect(botApi.start).toHaveBeenCalledWith(7);
    await waitFor(() =>
      expect(screen.getByText(/starting…/i)).toBeInTheDocument(),
    );
    expect(vi.mocked(toast.success)).toHaveBeenCalledWith(
      expect.stringContaining('#7'),
    );
  });

  it('Stop button shows confirm dialog and calls botApi.stop on confirm', async () => {
    loadOne({ status: 'running' });
    vi.mocked(botApi.stop).mockResolvedValueOnce({
      id: 7,
      status: 'stopping',
      desired_status: 'stopped',
      is_process_running: true,
    });

    renderPage();
    await waitFor(() =>
      expect(screen.getByText('Lifecycle bot')).toBeInTheDocument(),
    );

    await userEvent.click(screen.getByRole('button', { name: /^stop$/i }));
    expect(screen.getByText(/Stop "Lifecycle bot"\?/)).toBeInTheDocument();

    await userEvent.click(
      screen.getAllByRole('button', { name: /^stop$/i }).at(-1)!,
    );
    expect(botApi.stop).toHaveBeenCalledWith(7);
  });

  it('Delete button confirms then removes the row', async () => {
    loadOne();
    vi.mocked(botApi.remove).mockResolvedValueOnce(undefined);

    renderPage();
    await waitFor(() =>
      expect(screen.getByText('Lifecycle bot')).toBeInTheDocument(),
    );

    await userEvent.click(screen.getByRole('button', { name: /delete bot/i }));
    expect(screen.getByText(/Delete "Lifecycle bot"\?/)).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /^delete$/i }));
    expect(botApi.remove).toHaveBeenCalledWith(7);
    await waitFor(() =>
      expect(screen.queryByText('Lifecycle bot')).not.toBeInTheDocument(),
    );
  });

  it('Sync button visible only in ERROR mode', async () => {
    loadOne({ status: 'stopped', error_message: 'Process crashed' });
    renderPage();
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: /fix connection/i }),
      ).toBeInTheDocument(),
    );
  });

  it('demo cards do not show wired action buttons', async () => {
    vi.mocked(botApi.list).mockResolvedValueOnce([]); // empty → demos render
    renderPage();
    await waitFor(() =>
      expect(
        screen.getByText(/haven't built any bots yet/i),
      ).toBeInTheDocument(),
    );
    // The demo cards still render their visual mock action UI, but no real
    // `botApi.start/stop/remove` call should fire when a user clicks Start
    const startBtns = screen.queryAllByRole('button', { name: /start/i });
    if (startBtns.length > 0) {
      await userEvent.click(startBtns[0]);
    }
    expect(botApi.start).not.toHaveBeenCalled();
  });
});
```

Update the mock module at the top of the file (where `vi.mock('@/features/bot-monitoring/bot.api')` is declared) so `start`/`stop`/`remove`/`sync` exist:

```ts
vi.mock('@/features/bot-monitoring/bot.api', () => ({
  botApi: {
    list: vi.fn(),
    getConfig: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
    getStatus: vi.fn(),
    sync: vi.fn(),
    remove: vi.fn(),
  },
}));
```

- [ ] **Step 7: Run + typecheck + commit**

```bash
pnpm vitest run src/pages/__tests__/DashboardPage.test.tsx
pnpm typecheck
git add src/pages/DashboardPage.tsx src/pages/__tests__/DashboardPage.test.tsx
git commit -m "feat(dashboard): wire start/stop/sync/delete actions on bot cards"
```

---

## Task 7: Wire BotMonitoringPage header (Stop + status pill)

Hiện tại `MonitoringHeader` có 3 button: Pause / Stop / Edit. **Pause** không tồn tại trên BE — chỉ có Stop. Rename "Pause" → bỏ; giữ **Stop** (wire); **Edit** đã navigate `/builder` (giữ); thêm **Start** khi bot đang stopped; thêm **Sync** khi `error`.

Hiện code dùng `meta` từ `useBotMeta` (mock). Plan này **giữ mock data cho phần body** (charts, fills, etc.) nhưng **wire real lifecycle** ở header — đó là minimum để "chạy bot" hoạt động end-to-end. Plan kế tiếp (out-of-scope) sẽ replace mock body với `/open_trades`, `/performance`, …

**Files:**

- Modify: `src/features/bot-monitoring/BotMonitoringPage.tsx`

- [ ] **Step 1: Import the hook + API**

Top of `BotMonitoringPage.tsx`, add:

```ts
import { useBotStatusPoll } from './useBotStatusPoll';
import { botApi } from './bot.api';
import { ConfirmActionDialog } from './ConfirmActionDialog';
import { formatStatusLabel } from './lifecycle-actions';
import { toast } from 'sonner';
import { formatBackendError } from '@/lib/format-error';
import { Play, RefreshCcw, Loader2 } from 'lucide-react';
```

- [ ] **Step 2: Mount the hook + action handlers in the page component**

Find the `BotMonitoringPage` function (top-level component) and add at the top of its body:

```ts
const params = useParams<{ id: string }>();
const botId = params.id ? Number(params.id) : null;
// ↑ existing — locate, don't duplicate.

// === NEW: real lifecycle state ===
const { status: liveStatus, setStatus: setLiveStatus } =
  useBotStatusPoll(botId);
const [pending, setPending] = useState(false);
const [confirmStop, setConfirmStop] = useState(false);

const doStart = useCallback(async () => {
  if (botId == null) return;
  setPending(true);
  try {
    const next = await botApi.start(botId);
    setLiveStatus(next);
    toast.success(`Starting bot #${botId}`);
  } catch (err) {
    toast.error(formatBackendError(err));
  } finally {
    setPending(false);
  }
}, [botId, setLiveStatus]);

const doStop = useCallback(async () => {
  if (botId == null) return;
  setPending(true);
  try {
    const next = await botApi.stop(botId);
    setLiveStatus(next);
    toast.success(`Stopping bot #${botId}`);
  } catch (err) {
    toast.error(formatBackendError(err));
  } finally {
    setPending(false);
    setConfirmStop(false);
  }
}, [botId, setLiveStatus]);

const doSync = useCallback(async () => {
  if (botId == null) return;
  setPending(true);
  try {
    const next = await botApi.sync(botId);
    setLiveStatus(next);
    toast.message('Re-synced bot status');
  } catch (err) {
    toast.error(formatBackendError(err));
  } finally {
    setPending(false);
  }
}, [botId, setLiveStatus]);
```

- [ ] **Step 3: Pass props down to `MonitoringHeader`**

Below where `MonitoringHeader` is rendered (search `<MonitoringHeader meta={meta}`), update:

```tsx
<MonitoringHeader
  meta={meta}
  liveStatus={liveStatus}
  pending={pending}
  onStart={doStart}
  onStopClick={() => setConfirmStop(true)}
  onSync={doSync}
/>
```

And update `MonitoringHeader` signature + body:

```tsx
function MonitoringHeader({
  meta,
  liveStatus,
  pending,
  onStart,
  onStopClick,
  onSync,
}: {
  meta: BotMeta;
  liveStatus: BotStatusOut | null;
  pending: boolean;
  onStart: () => void;
  onStopClick: () => void;
  onSync: () => void;
}) {
  const navigate = useNavigate();
  const uptime = formatUptime(meta.deployedAt);
  // Derive what to show: prefer live status over mock meta.mode.
  const status = liveStatus?.status ?? 'stopped';
  const isRunning = status === 'running';
  const isError = !!liveStatus?.error_message;
  const isTransition = status === 'starting' || status === 'stopping';

  return (
    <>
      <header /* … existing chrome … */>
        <div /* … */>
          <div /* left side identity — unchanged … */>{/* … */}</div>

          <div className="flex items-center gap-1.5 pr-1">
            {/* Status pill — driven by liveStatus, fallback to meta.mode for label */}
            <span
              className={cn(
                'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-2xs font-semibold uppercase tracking-wider',
                isError
                  ? 'bg-bearish-subtle text-bearish'
                  : isRunning
                    ? 'bg-bullish-subtle text-bullish'
                    : 'bg-brand-subtle text-brand',
              )}
            >
              <span
                className={cn(
                  'h-1.5 w-1.5 rounded-full',
                  isTransition ? 'animate-pulse' : '',
                  isError
                    ? 'bg-bearish'
                    : isRunning
                      ? 'animate-pulse bg-bullish'
                      : 'bg-brand',
                )}
              />
              {formatStatusLabel(status)}
            </span>

            {/* Start (visible when stopped) */}
            {!isRunning && !isError && (
              <Button
                variant="ghost"
                size="sm"
                disabled={pending || isTransition}
                onClick={onStart}
                className="rounded-full px-3 text-bullish hover:bg-bullish-subtle"
              >
                {pending || isTransition ? (
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Play className="mr-1.5 h-3.5 w-3.5" />
                )}
                Start
              </Button>
            )}

            {/* Stop (visible when running) */}
            {isRunning && (
              <Button
                variant="ghost"
                size="sm"
                disabled={pending || isTransition}
                onClick={onStopClick}
                className="rounded-full px-3 text-bearish hover:bg-bearish-subtle hover:text-bearish-hover"
              >
                {pending || isTransition ? (
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                ) : (
                  <StopCircle className="mr-1.5 h-3.5 w-3.5" />
                )}
                Stop
              </Button>
            )}

            {/* Sync (visible on error) */}
            {isError && (
              <Button
                variant="ghost"
                size="sm"
                disabled={pending}
                onClick={onSync}
                className="rounded-full px-3 text-warning hover:bg-warning/10"
              >
                {pending ? (
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                ) : (
                  <RefreshCcw className="mr-1.5 h-3.5 w-3.5" />
                )}
                Sync
              </Button>
            )}

            {/* Edit — unchanged */}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/builder')}
              className="rounded-full px-3 text-fg-muted hover:bg-black/40 hover:text-fg"
            >
              <Pencil className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
              Edit
            </Button>
          </div>
        </div>
      </header>
      <div
        aria-hidden="true"
        className="h-[var(--layout-header,56px)] flex-shrink-0"
      />
    </>
  );
}
```

Remove the old standalone `Pause` button + the `// TODO(wallet-team): wire to bot stop API` block (replaced by the wired Stop above).

- [ ] **Step 4: Render `ConfirmActionDialog` for Stop**

Inside the `BotMonitoringPage` return tree, after the main content:

```tsx
<ConfirmActionDialog
  open={confirmStop}
  onOpenChange={setConfirmStop}
  title="Stop this bot?"
  body="The bot will stop placing orders immediately. Open positions are NOT closed automatically — close them manually or with a take-profit/stop-loss already set."
  confirmLabel="Stop"
  variant="destructive"
  busy={pending}
  onConfirm={doStop}
/>
```

- [ ] **Step 5: Error banner when `error_message` present**

Below the header (or near the top of the page content, depending on where existing banners live), add:

```tsx
{
  liveStatus?.error_message ? (
    <div
      role="alert"
      className="mx-auto mt-2 max-w-[1200px] rounded-lg border border-bearish/40 bg-bearish-subtle px-4 py-3 text-xs text-bearish"
    >
      <strong className="mr-2">Bot error:</strong>
      {liveStatus.error_message}
      <Button
        variant="ghost"
        size="sm"
        onClick={doSync}
        className="ml-2 px-2 text-warning hover:bg-warning/10"
        disabled={pending}
      >
        Sync
      </Button>
    </div>
  ) : null;
}
```

- [ ] **Step 6: Typecheck + smoke**

```bash
pnpm typecheck
pnpm lint --max-warnings=0 src/features/bot-monitoring/BotMonitoringPage.tsx
```

Manual: `pnpm dev`, navigate `/bots/1` (mock id) → header shows real status pill from `useBotStatusPoll(1)`. **Caveat:** if bot id 1 doesn't exist on BE, the hook will surface a network/404 error in console — that's expected at this phase (mock body still renders).

- [ ] **Step 7: Commit**

```bash
git add src/features/bot-monitoring/BotMonitoringPage.tsx
git commit -m "feat(monitoring): wire Start/Stop/Sync to real BE + live status pill"
```

---

## Task 8: Manual smoke (end-to-end with real wallet + BE)

- [ ] **Step 1: Create + start a bot from scratch**

1. `pnpm dev` → open `http://127.0.0.1:5173`
2. Connect Coin98 wallet
3. Dashboard → **New bot** → Builder → fill wizard (dry-run, BTC/USDT, 5m)
4. ExportDialog → **Submit to Backend**
5. Toast `Bot #<id> created`, auto-navigate `/bots/<id>`
6. Monitoring header: status pill = **Stopped** (yellow), Start button visible
7. Click **Start** → toast `Starting bot #<id>`, pill turns **Starting…** (yellow pulse), button shows spinner
8. ~1-5s later: pill → **Running** (green pulse), Stop button replaces Start

- [ ] **Step 2: Stop confirmation**

1. Header → **Stop** → ConfirmActionDialog appears
2. Cancel → dialog closes, pill still **Running**
3. Stop again → **Stop** → toast `Stopping bot`, pill → **Stopping…** → **Stopped**
4. Start button reappears

- [ ] **Step 3: Dashboard sync**

1. Click **All bots** → back to `/dashboard`
2. The bot card mode matches latest state (`PAUSED` after stop)
3. Hover → **Start** button visible
4. Click **Start** → card mode → **Starting…** (spinner)
5. Wait — card mode auto-progresses to **DRY-RUN** without manual refresh (next slow-poll tick within 10s)

- [ ] **Step 4: Delete from Dashboard**

1. Card → trash icon → ConfirmActionDialog `Delete "<name>"?`
2. Confirm → toast `Bot #<id> deleted`, card disappears from grid
3. Hard reload (`Cmd+R`) → bot stays gone (BE confirmed delete)

- [ ] **Step 5: Sync on error**

(Best-effort if BE supports inducing error state — otherwise document for QA pass.)

1. Force BE-side error (kill process manually on server, or use dry-run + bad API key for `live` mode)
2. Dashboard card → mode **ERROR**, **Fix connection** button visible
3. Click **Fix connection** → toast `Re-synced bot status`
4. Monitoring page: error banner with **Sync** button matches

- [ ] **Step 6: Adaptive polling sanity**

1. On Monitoring page (running bot), open DevTools → Network → filter `/status`
2. While **Running** (terminal): one `/status` request every ~10s
3. Click **Stop** → during **Stopping…**: one `/status` every ~1.5s until terminal
4. Tab → background (open another tab) → `/status` requests pause; foreground → resume

---

## Task 9: Final sweep + PR

- [ ] **Step 1: Run full test suite**

```bash
pnpm typecheck
pnpm lint --max-warnings=0
pnpm vitest run
```

All green except known pre-existing flakes (`CypheusPanel.test.tsx`).

- [ ] **Step 2: Format ONLY this plan's files**

```bash
npx prettier --write \
  src/features/bot-monitoring/bot.api.ts \
  src/features/bot-monitoring/lifecycle-actions.ts \
  src/features/bot-monitoring/lifecycle-actions.test.ts \
  src/features/bot-monitoring/useBotStatusPoll.ts \
  src/features/bot-monitoring/useBotStatusPoll.test.ts \
  src/features/bot-monitoring/ConfirmActionDialog.tsx \
  src/features/bot-monitoring/__tests__/ConfirmActionDialog.test.tsx \
  src/features/bot-monitoring/__tests__/bot.api.lifecycle.test.ts \
  src/features/bot-monitoring/bot-list.helpers.ts \
  src/features/bot-monitoring/bot-list.helpers.test.ts \
  src/features/bot-monitoring/BotMonitoringPage.tsx \
  src/pages/DashboardPage.tsx \
  src/pages/__tests__/DashboardPage.test.tsx
```

- [ ] **Step 3: Branch + push**

```bash
git checkout -b feat/bot-lifecycle
git push -u origin feat/bot-lifecycle
```

- [ ] **Step 4: Open PR**

PR title: `feat(bot): start/stop/sync/delete lifecycle wired to BE`

Body template:

```md
## Summary

- Add `botApi.start/stop/getStatus/sync/remove` lifecycle methods
- `useBotStatusPoll` hook with adaptive cadence (1.5s in transition, 10s terminal)
- Dashboard cards: wired Start/Stop/Sync/Delete buttons with confirm dialog
- BotMonitoringPage header: live status pill + Start/Stop/Sync actions
- Mock body charts on Monitoring unchanged (next plan replaces with real data)

## Test plan

- [ ] `pnpm vitest run` — green (35+ new test cases)
- [ ] Manual smoke (Task 8 above) — full lifecycle round-trip
- [ ] Adaptive polling verified in DevTools Network tab
- [ ] Demo cards in empty state do NOT call real lifecycle endpoints
```

---

## Definition of Done

- [ ] `botApi.start / stop / getStatus / sync / remove` exist + tested
- [ ] `useBotStatusPoll` hook with adaptive cadence + skip-when-hidden + manual refetch + optimistic setStatus
- [ ] `lifecycle-actions.ts` pure helpers covered
- [ ] `ConfirmActionDialog` covers destructive confirm pattern
- [ ] `deriveMode` returns `STARTING` / `STOPPING` for transition statuses
- [ ] DashboardPage `BotCard`: Start (when PAUSED), Stop (when LIVE/DRY-RUN), Sync (when ERROR), Delete (everywhere except STARTING/STOPPING) — all wired
- [ ] DashboardPage row updates optimistically + reflects server response
- [ ] BotMonitoringPage header status pill driven by `useBotStatusPoll`
- [ ] Stop / Delete behind `ConfirmActionDialog`
- [ ] Sonner toasts for success/error feedback on every action
- [ ] No remaining `// TODO(wallet-team)` lifecycle stubs in `BotMonitoringPage.tsx`
- [ ] Demo cards on Dashboard do NOT call real lifecycle APIs (`onStart`/`onStop`/`onSync`/`onRemove` are `undefined`)
- [ ] `pnpm typecheck` + `pnpm lint --max-warnings=0` clean
- [ ] PR opened with link to this plan

---

## Out of scope (next plans)

- **Real monitoring data**: `GET /bot/{id}/open_trades`, `/logs`, `/performance`, `/orders/{bot_id}` → replace mock charts/tables on BotMonitoringPage
- **WebSocket signal stream**: `/ws/bot/{id}/info` for real-time fills & cycle ticks
- **Force entry/exit + custom stoploss**: `/bot/{id}/force_entry`, `/force_exit`, `/set_stoploss` → trade-row actions on Monitoring page
- **Test signal**: `/bot/{id}/test_signal` → "send dry signal" debug button
- **Rebuild config**: `/bot/{id}/config/rebuild` → after manual edits to strategy file
- **Restore from S3**: `/bot/{id}/restore` → backup recovery flow
- **Backtest**: `/backtest/*` — separate feature
- **Bulk actions** on Dashboard (multi-select start/stop/delete)
- **Auto-refresh on window focus** for dashboard list (currently relies on manual Refresh)
- **Optimistic delete with undo toast** — for now, hard delete after confirm
