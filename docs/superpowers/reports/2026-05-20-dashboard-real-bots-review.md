# Findings — Dashboard real-bots plan review

> **Reviewed:** Spec `2026-05-20-dashboard-real-bots-design.md` (328 lines) + Plan `2026-05-20-dashboard-real-bots.md` (916 lines)
> **Against:** main @ `796b93e` — codebase files: `DashboardPage.tsx`, `bot.api.ts`, `MyBotsDialog.tsx`, `http.ts`, `format-error.ts`, `pair-format.ts`, `wallet.store.ts`, `Data/openapi.json`
> **Reviewer:** Devin
> **Date:** 2026-05-20

---

## Critical (blocks execution as-is)

### F1: `BotConfigOut` wrapper not unwrapped — plan will NOT compile + runtime all-wrong data

**Where:** Plan Task 2 Step 2 (useEffect, lines 310-318) + all DashboardPage tests in Task 3

**What's wrong:**

`BotConfigOut` in openapi.json / `api.d.ts` is a **wrapper** with a single field:

```ts
// src/types/api.d.ts (auto-gen from openapi.json)
BotConfigOut: {
  config: { [key: string]: unknown };
};
```

So `botApi.getConfig(id)` returns `{ config: { dry_run, timeframe, exchange, ... } }`.

The plan's useEffect passes `r.value` (the wrapper) directly to `zipBotsAndConfigs`:

```ts
// Plan line 315-318 — WRONG
const configsOrNull = configs.map((r) =>
  r.status === 'fulfilled' ? r.value : null,  // ← r.value is BotConfigOut = { config: {...} }
);
setRealBots(zipBotsAndConfigs(list, configsOrNull));
```

But `zipBotsAndConfigs` expects `Array<ConfigShape | null>` where `ConfigShape = { dry_run?, timeframe?, exchange? }` — the **inner** shape.

**Consequences:**
1. **TypeScript error** — `BotConfigOut` (`{ config: {...} }`) is not assignable to `ConfigShape` (`{ dry_run?, timeframe?, exchange? }`)
2. **If cast past:** `config.dry_run` = `undefined` → `undefined === false` = false → ALL running bots show **DRY-RUN** instead of LIVE
3. `config.exchange?.pair_whitelist` = `undefined` → ALL pairs show **?**
4. `config.timeframe` = `undefined` → ALL timeframes show **?**

**Evidence:** `MyBotsDialog.tsx:207` handles this correctly:
```ts
const res = await botApi.getConfig(b.id);
return { meta: b, config: res.config as FreqtradeConfig, configError: false };
//                        ^^^^^^^^^^  ← unwraps .config
```

**Fix — useEffect (plan Task 2 Step 2, line 315):**
```ts
// BEFORE (wrong)
const configsOrNull = configs.map((r) =>
  r.status === 'fulfilled' ? r.value : null,
);

// AFTER (correct)
const configsOrNull = configs.map((r) =>
  r.status === 'fulfilled' ? (r.value.config as ConfigShape) : null,
);
```

Import `ConfigShape` from `bot-list.helpers.ts` (add to exports).

**Fix — DashboardPage tests (plan Task 3, lines 592-596, 694-698, and every `mockResolvedValueOnce` for `getConfig`):**
```ts
// BEFORE (wrong — flat inner config masquerading as BotConfigOut)
vi.mocked(botApi.getConfig).mockResolvedValueOnce({
  dry_run: false,
  timeframe: '5m',
  exchange: { pair_whitelist: ['ETH/USDT'] },
} as never);

// AFTER (correct — BotConfigOut wrapper shape)
vi.mocked(botApi.getConfig).mockResolvedValueOnce({
  config: { dry_run: false, timeframe: '5m', exchange: { pair_whitelist: ['ETH/USDT'] } },
} as BotConfigOut);
```

### F2: `BotCardProps` type not updated — TypeScript error when passing `DashboardBot` to `BotCard`

**Where:** Plan Task 2 Step 3 (line 439) vs `DashboardPage.tsx:331-333`

**What's wrong:**

Current `BotCardProps`:
```ts
// DashboardPage.tsx:331-333
interface BotCardProps {
  bot: MockBot;  // ← expects MockBot (isDemo: true)
  onClick: () => void;
}
```

After the plan refactors, `filteredBots` is `(DashboardBot | MockBot)[]`. The plan's Step 3 passes each element to `<BotCard>`:
```tsx
{filteredBots.map((bot) => (
  <BotCard key={bot.id} bot={bot} ... />
  //                      ^^^  DashboardBot | MockBot  ← NOT assignable to MockBot
))}
```

`DashboardBot` has `isDemo: false`, `MockBot` has `isDemo: true`. TypeScript will reject `DashboardBot` as `MockBot`.

The plan explicitly says "BotCard component đã handle nullable fields — không cần thay đổi BotCard" (spec §3.4 line 183). This is wrong — the **type** needs updating.

**Fix — add to plan Task 2 (before Step 3):**
```ts
// Update BotCardProps to accept the union:
interface BotCardProps {
  bot: DashboardBot | MockBot;
  onClick: () => void;
}
```

---

## Should fix (would degrade quality but execution can start)

### S1: React 18 removed `setState on unmounted` warning — unmount test is a no-op

**Where:** Plan Task 3, lines 745-769 (test `'unmount during fetch does not setState on unmounted component'`)

**What's wrong:**

React 18 removed the "Can't perform a React state update on an unmounted component" warning ([React PR #22114](https://github.com/facebook/react/pull/22114)). The test asserts `console.error` was NOT called with `/setState.*unmounted/i`. Since React 18 never emits this message, the assertion **always passes** — even if you delete the `cancelled` flag entirely.

The `cancelled` flag is correct defensive code (prevents stale state updates), but this test doesn't validate it works.

**Fix — replace with a behavioral assertion:**
```ts
it('unmount during fetch does not produce stale state update', async () => {
  let resolveList!: (value: BotOut[]) => void;
  vi.mocked(botApi.list).mockReturnValueOnce(
    new Promise((res) => { resolveList = res; }),
  );

  const { unmount } = renderPage();
  // Skeleton is visible (loading state)
  expect(document.querySelectorAll('.animate-pulse').length).toBeGreaterThanOrEqual(3);

  unmount();
  // Resolve AFTER unmount — cancelled flag should prevent setState
  resolveList([]);
  await new Promise((r) => setTimeout(r, 0));

  // No crash, no error = success. The cancelled flag prevented the
  // stale setState. In React 18 there's no console warning to assert
  // against — this test documents the intent and guards against future
  // React versions that might reintroduce the warning.
  expect(vi.mocked(botApi.list)).toHaveBeenCalledOnce();
});
```

Alternatively, accept the current test as "defensive intent documentation" and add a comment:
```ts
// NOTE: React 18 removed the "setState on unmounted" warning.
// This test documents the intent of the cancelled flag but cannot
// behaviorally assert the flag prevents a stale update from the outside.
```

### S2: `vi.clearAllMocks()` doesn't reset persistent `mockReturnValue` implementations

**Where:** Plan Task 3, `beforeEach` (line 561)

**What's wrong:**

`vi.clearAllMocks()` clears call history but does NOT reset implementations set by `.mockReturnValue()` (persistent mock). Two tests use `mockReturnValue()`:
- Loading test (line 575): `vi.mocked(botApi.list).mockReturnValue(new Promise(() => {}));`
- Refresh-hidden test (line 710): same pattern

The persistent implementation from test N leaks into test N+1 as a fallback. Currently works by accident because each test sets its own mock (and `.mockResolvedValueOnce` queue takes priority). But if test ordering changes, tests could break mysteriously.

**Fix:**
```ts
beforeEach(() => {
  vi.resetAllMocks();  // ← resets implementations too
  // ... rest of setup
});
```

### S3: `pnpm format` risks unrelated format drift

**Where:** Plan Task 4 Step 1 (line 798)

**What's wrong:**

`pnpm format` runs Prettier on ALL files. If any file has pre-existing format drift (common with Prettier version bumps or config changes), the diff includes unrelated files in the dashboard commits. This exact issue was flagged during the header glass refresh task.

**Fix — scope format to changed files only:**
```bash
npx prettier --write \
  src/features/bot-monitoring/bot-list.helpers.ts \
  src/features/bot-monitoring/bot-list.helpers.test.ts \
  src/pages/DashboardPage.tsx \
  src/pages/__tests__/DashboardPage.test.tsx
```

### S4: `makeConfig` test factory creates wrong shape for integration context

**Where:** Plan Task 1, lines 68-76 (`bot-list.helpers.test.ts`)

**What's wrong:**

`makeConfig` creates a flat config `{ dry_run, timeframe, exchange }` and casts `as BotConfigOut`. But `BotConfigOut` is `{ config: { [key: string]: unknown } }`. The cast hides the type mismatch.

For `bot-list.helpers.test.ts` this is fine — the helpers take `ConfigShape` (the inner shape) and the cast is just to satisfy the import type signature. But if someone copies this factory to `DashboardPage.test.tsx` for integration tests, they'd get wrong mock data (flat instead of wrapped).

**Fix:**
1. Change helper test signature to use `ConfigShape` directly (not `BotConfigOut`):
```ts
function makeConfig(over: Partial<ConfigShape> = {}): ConfigShape {
  return {
    dry_run: true,
    timeframe: '5m',
    exchange: { pair_whitelist: ['BTC/USDT'] },
    ...over,
  };
}
```

2. In `DashboardPage.test.tsx`, create a separate factory that wraps:
```ts
function makeBotConfigOut(inner: Record<string, unknown> = {}): BotConfigOut {
  return {
    config: {
      dry_run: true,
      timeframe: '5m',
      exchange: { pair_whitelist: ['BTC/USDT'] },
      ...inner,
    },
  };
}
```

---

## Nice to have

### N1: Demo bot cards navigate to `/bots/${id}` with mock IDs (1, 2, 4) — will 404 against real BE

**Where:** Plan Task 2 Step 5 (line 443), spec §4.2

In empty state, MOCK_BOTS are rendered with `onClick={() => navigate(`/bots/${bot.id}`)}`. IDs 1/2/4 are hardcoded mocks — clicking them navigates to `BotMonitoringPage` which would try to load non-existent bot data.

**Options:**
- A: Disable click on demo cards: `onClick={bot.isDemo ? undefined : () => navigate(...)}`
- B: Navigate to `/builder` instead for demo cards
- C: Document as known limitation (current plan does this implicitly in §8 "Out of scope")

### N2: Trailing separator for null `uptime` in BotCard

**Where:** `DashboardPage.tsx:397`

```tsx
<div className="text-xs text-fg-muted">
  {bot.pair} · {bot.timeframe} · {bot.uptime}
</div>
```

For real bots with `uptime: null`, renders "BTC-USDT · 5m · " (trailing separator with nothing).

**Fix:**
```tsx
<div className="text-xs text-fg-muted">
  {bot.pair} · {bot.timeframe}{bot.uptime && <> · {bot.uptime}</>}
</div>
```

### N3: Scroll position resets on Refresh

**Where:** Spec §4.6

When user clicks Refresh, the grid transitions loading → skeleton → loaded. The DOM replacement causes scroll position to reset to top. Not addressed in spec.

Acceptable for now (list is typically < 1 viewport), but document as known behavior. If list grows long, consider preserving `window.scrollY` and restoring after load.

### N4: `bot.bot_name: null` + `Bot #${id}` display collision

**Where:** Plan Task 1 Step 2, line 222

If user has bots: `{ id: 7, bot_name: null }` → displays "Bot #7", and another bot with `bot_name: "Bot #7"` → also displays "Bot #7". Both cards look identical in name. No functional bug (different `bot.id` as key), just confusing UX.

Low priority — unlikely in practice. If needed later, suffix with strategy name: `bot.bot_name ?? \`Bot #${bot.id} (${bot.strategy_name ?? 'unnamed'})\``.

### N5: Concurrency cap for `Promise.allSettled`

**Where:** Spec §1 row 5, Plan Task 2 Step 2 (line 310)

Plan defers batching. For < 50 bots this is acceptable — browser HTTP/1.1 connection limit (6 per origin) provides natural throttling. For HTTP/2, all requests fire simultaneously. No evidence of BE rate-limiting in openapi.json, CLAUDE.md, or API_SPEC.md.

If the team wants a safety net without adding a dependency, a 10-line `pLimit` can be inlined:
```ts
function pLimit(concurrency: number) {
  let active = 0;
  const queue: (() => void)[] = [];
  return <T,>(fn: () => Promise<T>): Promise<T> =>
    new Promise((resolve, reject) => {
      const run = () => { active++; fn().then(resolve, reject).finally(() => { active--; queue.length && queue.shift()!(); }); };
      active < concurrency ? run() : queue.push(run);
    });
}
```

### N6: 403 error body lost due to `silentToast` in `http.ts` (pre-existing)

**Where:** `http.ts:170-183`

`/bot/list` matches `SILENT_TOAST_PREFIXES` (`/bot/`). For 403, `http.ts` skips `res.text()` when `silentToast=true` and throws `HttpError(403, 'Forbidden')` with hardcoded body. Dashboard error card shows "403: Forbidden" instead of BE message (e.g., "Tài khoản đã bị vô hiệu hoá").

Compare with 5xx handling (lines 191-196) where `res.text()` is read BEFORE the silentToast check.

Not introduced by this plan — pre-existing http.ts inconsistency. Flag for future fix: move `res.text()` before `if (!silentToast)` in the 403 block.

---

## Verified — no issues found

- ✓ **§1 sixteen decisions** — internally consistent, no contradictions
- ✓ **`BotOut` type** matches `openapi.json` — required: `id`, `status`; optional: `bot_name`, `desired_status`, `error_message`, `strategy_name`
- ✓ **Bot status mapping** (§1 row 15) — defensive catch-all `PAUSED` for unknown statuses. `BotOut.status` is `string` (no enum), so the catch-all is correct and necessary
- ✓ **`cancelled` flag** race handling — sufficient for this use case. `AbortController` would cancel HTTP requests (saving bandwidth) but adds complexity. The flag approach correctly prevents stale `setState`. Difference matters only for very slow requests + rapid nav — acceptable tradeoff
- ✓ **`formatBackendError`** exists at `src/lib/format-error.ts` with correct import path `@/lib/format-error`
- ✓ **`jsonPairToUi`** exists at `src/lib/pair-format.ts` — correctly converts `BTC/USDT:USDT` → `BTC-USDT`
- ✓ **`botApi.list()` / `botApi.getConfig(id)`** signatures match `bot.api.ts` exactly
- ✓ **`useWalletStore.setState(...)` test setup** matches `WalletState` interface — Zustand `setState` does partial merge, action methods don't need to be provided. `status: 'ready'` is valid `WalletStatus`
- ✓ **Hidden-toolbar logic** (§4) — per-state visibility for Search/Refresh correctly specified with no edge case gaps
- ✓ **Hero portfolio `useMemo`** dependency on `[realBots]` — correct, re-computes when realBots changes
- ✓ **Retry vs Refresh button query** — `screen.queryByRole('button', { name: /refresh/i })` does NOT match Retry button (accessible name "Retry" doesn't contain "refresh"). No accidental match risk
- ✓ **MyBotsDialog coexistence** — DashboardPage (home overview) and MyBotsDialog (Builder quick-switch) serve different contexts, not true duplicates
- ✓ **Empty state fallback logic** — MOCK_BOTS shown only when `realBots !== null && realBots.length === 0`
- ✓ **Error path** catches all throw types from `http.ts` (HttpError, Error, ValidationError) via `formatBackendError`
- ✓ **No documented BE rate-limit** in CLAUDE.md, API_SPEC.md, or openapi.json — "defer batching" decision is reasonable
- ✓ **`MockBot = Omit<DashboardBot, 'isDemo'> & { isDemo: true }`** compiles cleanly
- ✓ **Auth edge case** (403 on bot list) — `http.ts` handles with silentToast (no toast, just throw); Dashboard catches and shows error card with Retry. No dangling state

---

## Suggested plan amendments (concrete edits)

### Amendment 1 — Plan Task 2 Step 2: unwrap `BotConfigOut.config`

**Location:** Plan line 315-318 (inside useEffect `configsOrNull` computation)

**Current:**
```ts
const configsOrNull = configs.map((r) =>
  r.status === 'fulfilled' ? r.value : null,
);
```

**Replace with:**
```ts
const configsOrNull = configs.map((r) =>
  r.status === 'fulfilled' ? (r.value.config as ConfigShape) : null,
);
```

Also add to line 286 imports:
```ts
import { zipBotsAndConfigs, type ConfigShape } from '@/features/bot-monitoring/bot-list.helpers';
```

And export `ConfigShape` from `bot-list.helpers.ts` (line 187):
```ts
export interface ConfigShape {
```

### Amendment 2 — Plan Task 2: add BotCardProps update step

**Location:** Between Plan Task 2 Step 1 (line 272) and Step 3 (line 336), add new step:

> **Step 2b: Update BotCardProps type**
>
> Change `BotCardProps.bot` type to accept both real and mock bots:
>
> ```ts
> interface BotCardProps {
>   bot: DashboardBot | MockBot;
>   onClick: () => void;
> }
> ```

### Amendment 3 — Plan Task 3: fix all `botApi.getConfig` mock shapes

**Location:** Every `vi.mocked(botApi.getConfig).mockResolvedValueOnce(...)` in Task 3

**Pattern — replace all instances:**
```ts
// BEFORE
vi.mocked(botApi.getConfig).mockResolvedValueOnce({
  dry_run: false,
  timeframe: '5m',
  exchange: { pair_whitelist: ['ETH/USDT'] },
} as never);

// AFTER
vi.mocked(botApi.getConfig).mockResolvedValueOnce({
  config: { dry_run: false, timeframe: '5m', exchange: { pair_whitelist: ['ETH/USDT'] } },
} as BotConfigOut);
```

Affected lines: 592-596, 694-698.

### Amendment 4 — Plan Task 3: fix `beforeEach` mock reset

**Location:** Plan line 562

**Current:**
```ts
vi.clearAllMocks();
```

**Replace with:**
```ts
vi.resetAllMocks();
```

### Amendment 5 — Plan Task 3: add React 18 comment to unmount test

**Location:** Plan line 745

**Add comment above test:**
```ts
// NOTE: React 18 removed the "setState on unmounted" warning (PR #22114).
// This test documents the intent of the cancelled flag. The assertion
// guards against future React versions that may reintroduce the warning,
// but in React 18 it cannot behaviorally verify the flag prevents stale updates.
```

### Amendment 6 — Plan Task 4: scope format to changed files only

**Location:** Plan line 798

**Current:**
```bash
pnpm format
```

**Replace with:**
```bash
npx prettier --write \
  src/features/bot-monitoring/bot-list.helpers.ts \
  src/features/bot-monitoring/bot-list.helpers.test.ts \
  src/pages/DashboardPage.tsx \
  src/pages/__tests__/DashboardPage.test.tsx
```

### Amendment 7 — Spec §3.4: clarify BotConfigOut unwrap step in data flow

**Location:** Spec line 112 (after `Promise.allSettled`)

**Add explicit step:**
```
        Promise.allSettled(list.map(b => botApi.getConfig(b.id)))
           ↓
        unwrap: result.value.config (BotConfigOut → inner config)
           ↓
        cancelled check — if cleanup ran, drop result
```

---

## Overall assessment

**Approach is sound.** Local `useState` is correct for component-scoped data that only DashboardPage needs — no need for Zustand store, react-query, or Suspense at this scale. The pattern mirrors MyBotsDialog (proven in production). The `cancelled` flag + `refreshKey` pattern is idiomatic React 18.

**One critical bug (F1)** will silently break ALL bot data display if not fixed before implementation. F2 will prevent compilation. Both have straightforward fixes above. The remaining should-fix items are quality improvements that don't block starting work.

**Not recommending a different architecture.** `react-query` would add automatic caching + stale-while-revalidate, but it's a new dependency the codebase doesn't use, and for a single page with manual refresh, the added complexity isn't justified. Zustand store for bots would only make sense if multiple pages need the bot list — currently only DashboardPage does. The plan's approach follows codebase conventions.
