# Review request — Phase 3 (Backtest) — PR #13

**Repo:** https://github.com/TriNguyen3010/trading_bot
**PR:** https://github.com/TriNguyen3010/trading_bot/pull/13
**Branch:** `feat/phase-3-backtest` (8 commits on top of `origin/main`)
**Plan:** [`docs/superpowers/plans/2026-05-27-backtest.md`](../plans/2026-05-27-backtest.md)
**Roadmap context:** [`docs/superpowers/specs/2026-05-27-phases-4-5-monitoring-monetization.md`](../specs/2026-05-27-phases-4-5-monitoring-monetization.md) §0 (build order 1 → 3 → 2 → 4 → 5; Phase 1 merged in PR #12; this PR is Phase 3).

## What this PR ships

Self-contained `src/features/backtest/` feature so a user can backtest any real bot from Dashboard:

- `backtestApi` — 4 REST methods (`start` / `get` / `history` / `cancel`)
- Pure helpers — `presetToTimerange` (UTC), `isBacktestTerminal`, `extractMetrics`, `formatWinRate`, `formatTotalProfit`, `BacktestComparisonItem` interface (FE-defined from `BE/backtest_200.json` sample)
- `useBacktestPoll` — polls `GET /backtest/{id}` every 2s until terminal, captures error
- `BacktestDialog` — 3-step modal (setup → running → result) with timerange presets, wallet/stake inputs, no-strategy warning, error banner, best-effort cancel, 6-metric grid + null-metrics fallback
- Dashboard entry — `DashboardBot.strategyName` carried from `BotOut.strategy_name`; new Backtest row on each non-demo `BotCard`

## Quality gates (already passed)

- `pnpm typecheck` ✅
- `pnpm lint` ✅ 0 errors (5 pre-existing warnings, unchanged baseline)
- `pnpm test --run` ✅ **426/426** (was 396 — +30 new tests across 5 new files)

## Authorised plan deviations — DO NOT re-litigate

Each was justified during implementation and documented in the commit body. Only flag if you find a real bug we missed:

1. **`backtest_cache: null` + `BacktestJobResponse.message` patches** (commits `15bb525` + `245b49d`). Generated `src/types/api.d.ts` marks both fields required (openapi `@default` semantics make `?: T | null` → `: T | null` in openapi-typescript output). Plan prose treated them as optional. Production payload sends `backtest_cache: null` so BE falls back to its `day` default; test fixture provides the canonical `message` string.

2. **Backtest button placement** (commits `a4ccc64` + `26d7f36`). Plan said insert into the "else branch with Edit/Pause/Stop" — that row no longer exists since Phase 1 (PR #12) replaced it with mode-based lifecycle UI (Start/Stop/Sync + trash). Backtest now lives in its OWN row above the lifecycle row, gated `onBacktest && mode !== 'STARTING' && mode !== 'STOPPING'`. ERROR mode is intentionally allowed (backtest is pure strategy analysis, doesn't need a live process — comment at `DashboardPage.tsx:842-850`).

3. **Run button shows "Run" + `aria-label="Run backtest"`** (commit `15bb525`). Plan's verbatim test does `getByText(/Backtest/i)` which would otherwise match both the dialog title (`Backtest {bot.name}`) AND a "Run backtest" button label. The aria-label keeps the accessibility query (`getByRole('button', { name: /run backtest/i })`) working.

## Focus areas — please verify these explicitly

1. **`extractMetrics` defensive read** (`src/features/backtest/backtest-helpers.ts:80-96`). `results` is `object | null` with `additionalProperties:true` in openapi — we cast to a narrow shape and read defensively. Tests cover null, empty array, missing key, but a malformed `max_drawdown_account` (non-number) would produce `NaN`. Worth a runtime `typeof === 'number'` guard?

2. **`useBacktestPoll` cleanup race** (`src/features/backtest/useBacktestPoll.ts`). `cancelled` flag + `clearTimeout(handle)` — any stale-state path on rapid `backtestId` changes during an in-flight `await backtestApi.get(...)`?

3. **`BacktestDialog` step machine** (`src/features/backtest/BacktestDialog.tsx`). 3 steps × 2 effects (poll.done transition + open-reset). Trace whether any combination of `open`, `initialBacktestId`, `step`, `poll.done`, `poll.error` can produce an unreachable state, a loop, or a stuck dialog.

4. **`isBacktestTerminal` regex** — `/fail|error|cancel/i` matches BE's free-form status strings. Could a non-terminal status containing one of those substrings (e.g. `"preparing-fallback"`) be misclassified as terminal?

5. **Schema-drift sweep** — we patched `backtest_cache` and `message`. Quick grep of `BE/openapi.json` for other `@default`-marked optional-looking fields that openapi-typescript will mark required → flag any field that the FE consumes which has the same gotcha lying in wait.

6. **`BotCard` prop accretion** — now 8 props (`bot, onClick, busy, onStart, onStop, onSync, onRemove, onBacktest`). Trace each of the 6 mode states (LIVE / DRY-RUN / PAUSED / ERROR / STARTING / STOPPING) — any unreachable combination or unused prop?

7. **`BacktestDialog` test coverage** — 5 cases for a 359-line component. We added cancel-flow + no-strategy banner in a fix-up. Other obvious holes (error rendering, the new no-metrics fallback branch)?

## Out of scope — don't flag

- WebSocket support (removed from roadmap — REST polling is the agreed pattern)
- `BotMonitoringPage` mock data (Phase 4 will overhaul; this PR doesn't touch it)
- Backtest history list UI (Phase 3.1 — api method exists, no UI by design)
- `/backtest/{id}/candles` equity curve (Phase 3.1)
- Monetization / tier gating (Phase 5)
- Phase 1 lifecycle code (PR #12, already merged + reviewed by Devin rounds 1-3)

## Output format

Verdict at top: **GO** / **NO-GO** + 1-line rationale.

Per finding:

- **Severity:** Critical / Important / Should-fix / Nice-to-have / Note
- **Location:** `file.ts:line-line`
- **Issue:** what's wrong
- **Suggested fix:** concrete patch or direction

Flag any regression against Phase 1 (PR #12, already merged) explicitly.
