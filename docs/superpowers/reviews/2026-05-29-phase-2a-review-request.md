# Review request — Phase 2a (Launchpad) — PR #14

**Repo:** https://github.com/TriNguyen3010/trading_bot
**PR:** https://github.com/TriNguyen3010/trading_bot/pull/14
**Branch:** `feat/phase-2a-launchpad` (6 commits)
**Base branch:** `feat/phase-3-backtest` — **STACK PR** on top of Phase 3 (PR #13, not yet merged). When #13 merges, this PR rebases onto `main` automatically. Diff shows ONLY Phase 2a changes.
**Plan:** [`docs/superpowers/plans/2026-05-27-launchpad-dry-live.md`](../plans/2026-05-27-launchpad-dry-live.md)
**Roadmap context:** [`docs/superpowers/specs/2026-05-27-phases-4-5-monitoring-monetization.md`](../specs/2026-05-27-phases-4-5-monitoring-monetization.md) §0 (build order 1 → 3 → 2a → 2b → 4 → 5; Phase 1 merged in PR #12; Phase 3 open in PR #13; this PR is Phase 2a).

## What this PR ships

Self-contained `src/features/launchpad/` feature giving a Launchpad hub modal on every stopped/error bot card:

- `botStrategyApi.update` — PATCH `/bot-strategy/{id}` for partial updates (flip `dry_run` before start).
- `launchBot(botId, mode)` — orchestrates PATCH → start with proper error propagation (no start if PATCH fails). Returns `BotStatusOut`.
- `LaunchpadModal` — Radix Dialog hub with 3 cards: Backtest (bridge to Phase 3 dialog), Dry-run (recommended — runs immediately), Live (disabled, "Live — Phase 2b"). Error-mode bots get a red banner + Sync button.
- `DashboardPage` wire — running bots (LIVE / DRY-RUN / STARTING / STOPPING) navigate to monitor; PAUSED / ERROR open the Launchpad. `BotCard.onClick` is now a 3-way ternary.
- Post-create flow — `ExportDialog` lands on `/dashboard` with `state.launchpadBotId` so the Launchpad auto-opens on the new bot once it appears in the refetched list. `consumedLaunchRef` + `navigate({ replace: true, state: {} })` guard against re-trigger.

## Quality gates (already passed)

- `pnpm typecheck` ✅
- `pnpm lint` ✅ 0 errors (5 pre-existing warnings, unchanged baseline)
- `pnpm test --run` ✅ **438/438** (was 429 — +9 new tests across Tasks 1, 2, 3)

## Authorised plan deviations — DO NOT re-litigate

Each was justified during implementation and documented in the relevant commit. Only flag if you find a real bug we missed:

1. **Live card disabled (cách 1 chốt by Tri)** — Plan's top SPLIT callout (line 5) said Live ships in Phase 2b alongside the agent EIP-712 flow ("Card Live trong Modal render disabled với label 'Live (Phase 2b)' cho tới khi 2b ship"). The plan's inline Task 3 code CONTRADICTED this and implemented full Live launch with `live-confirm` step. Followed the SPLIT callout:
   - Live ModeCard: `cta="Live — Phase 2b"`, `disabled` prop, no-op `onClick`.
   - `step === 'live-confirm'` JSX block DELETED from component body.
   - `type Step = 'modes' | 'live-confirm'` union literal RETAINED so Phase 2b revives it cleanly.
   - 4th test case asserts Live button is disabled (replaces the inline plan's "live goes through a confirm step").
   - `ArrowLeft` import removed (was only used in `live-confirm` back button).
   - See commits `6fd1287` + `c80e5c4`.

2. **STARTING / STOPPING routed to monitor too** — Plan only specified `LIVE / DRY-RUN` as "monitor route". Phase 1 added STARTING / STOPPING (mid-transition modes). Routing them to monitor avoids the confusing UX of opening Launchpad on a bot that's already moving. See commit `8fd1c2c`.

3. **`as LaunchpadBot['mode']` cast in `toLaunchpadBot`** (`src/pages/DashboardPage.tsx:124`) — `LaunchpadBot.mode` is a strict subset of `DashboardBot.mode` (no STARTING / STOPPING). Runtime onClick router guarantees those values never reach the mapper. Documented in JSDoc. See commit `8fd1c2c`.

## Focus areas — please verify these explicitly

1. **`launchBot` PATCH-then-start ordering** (`src/features/launchpad/launch-actions.ts`). Plan + tests assert: PATCH fails → start NOT called, error propagates. Trace whether any timing / Promise interleaving could let `botApi.start` fire before `botStrategyApi.update` resolves.

2. **`LaunchpadModal` step machine + Live deviation** (`src/features/launchpad/LaunchpadModal.tsx`). Verify the `Step = 'modes' | 'live-confirm'` union literal genuinely cannot reach the `'live-confirm'` branch in Phase 2a:
   - `setStep('live-confirm')` is NEVER called from any code path.
   - Live Button's `disabled` actually prevents the `onClick` no-op from running launch.
   - `doLaunch('live')` is dead code in Phase 2a (kept generic so Phase 2b can revive).
   - No way for a user gesture to reach the Live launch path.

3. **Dashboard `onClick` 3-way router** (`src/pages/DashboardPage.tsx:594-602`). Trace all 7 mode states (LIVE / DRY-RUN / PAUSED / ERROR / STARTING / STOPPING / Demo) × isDemo bit. Any unreachable combination? Any combination that incorrectly opens the Launchpad while the bot is mid-transition?

4. **`onLaunched` closure capture** (`src/pages/DashboardPage.tsx:728-732`). Code reads `launchBotTarget?.id` AFTER `setLaunchBotTarget(null)`. The const-snapshot-before-setState pattern should make this safe, but verify the React 18 batching semantics don't somehow null the snapshot. Worth a fresh-eyes trace.

5. **Cross-page handoff via `location.state`** (`src/pages/DashboardPage.tsx:226-239`). Race: bot creation refetches `realBots` asynchronously. If realBots arrives AFTER user navigates away from `/dashboard`, what happens? If realBots arrives but the new bot isn't in it (BE filtering / refresh-failure), `state.launchpadBotId` lingers indefinitely. Acceptable trade-off, or worth a timeout fallback?

6. **`consumedLaunchRef` + `navigate({replace, state:{}})` double-guard** (`src/pages/DashboardPage.tsx:232-238`). Belt-and-suspenders or one of them is dead code? Trace React 18 strict-mode double-invoke to confirm both are doing useful work.

7. **Stack PR regression risk** — this PR's base is `feat/phase-3-backtest`. Phase 3 modifies `DashboardPage.tsx` (BotCard adds `onBacktest`, mounts `BacktestDialog`). Phase 2a now adds `LaunchpadModal` mount + new onClick router + `backtestBot` seeding from Launchpad. Verify the Phase 3 + Phase 2a wiring on `DashboardPage.tsx` composes correctly — no double-mount, no stale closure, no z-index conflict between dialogs.

## Out of scope — don't flag

- **Live launch + agent EIP-712 flow** — Phase 2b ships this. Plan: [`docs/superpowers/plans/2026-05-28-phase-2b-launchpad-live-agent.md`](../plans/2026-05-28-phase-2b-launchpad-live-agent.md) (Devin R4 fixes already applied).
- Rich monitoring / real-time data on `BotMonitoringPage.tsx` (Phase 4 — mock body untouched).
- Tier / paywall / billing (Phase 5 — blocked on BE + pricing).
- "Edit recipe / Duplicate / Delete" footer in Launchpad (intentionally omitted, plan §Scope).
- Phase 1 lifecycle code (PR #12, merged + reviewed by Devin rounds 1-3).
- Phase 3 backtest code (PR #13 — separate review request file in `docs/superpowers/reviews/2026-05-29-phase-3-review-request.md`).

## Known follow-ups (non-blocking, already documented)

These were raised by code reviewers and accepted as deferred — flag only if you find a NEW issue:

- `onLaunched` stale-closure: works today via const-snapshot; would harden if `LaunchpadModal` passed `botId` as a callback param.
- Post-create `state.launchpadBotId` cleanup edge case: lingers if realBots fetch fails between create and Dashboard mount.
- No RTL test on the post-create → Launchpad handoff flow.
- 3-way `onClick` ternary worth extracting to named `handleBotCardClick(bot)` helper before Phase 2b extends routing.

## Output format

Verdict at top: **GO** / **NO-GO** + 1-line rationale.

Per finding:

- **Severity:** Critical / Important / Should-fix / Nice-to-have / Note
- **Location:** `file.ts:line-line`
- **Issue:** what's wrong
- **Suggested fix:** concrete patch or direction

Flag any regression against Phase 1 (PR #12) or Phase 3 (PR #13) explicitly.
