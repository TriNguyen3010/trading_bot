# Remaining FE Work — Consolidated Design Spec

> **Status:** Draft for Tri review — 2026-06-03.
> **Covers** the remaining FE work after Phase 2b (PR #19) + Telegram dev-test + C1 currency fix (PR #20).
> Decomposed into **3 independent workstreams**, each shipping on its own branch/PR. One spec for review; one plan for execution.

| WS | Title | Branch | Depends on |
| --- | --- | --- | --- |
| **1** | Phase 2b.1 — Agent wallet management (unblock real Live) | `feat/phase-2b.1-agent-mgmt` | Phase 2b merged (PR #19) |
| **2** | Builder — remove "Trading mode" toggle | `refactor/builder-remove-trading-mode` | — |
| **3** | Backtest — per-trade table | `feat/backtest-trades-table` (spec `2026-06-03-backtest-trades-table-design.md`, already written) | C1 (PR #20) |

WS are independent (different files/domains) → separate branches/PRs, but one plan sequences them. Recommended order: **WS1 → WS2 → WS3**.

---

## Workstream 1 — Phase 2b.1: Agent wallet management

### Problem
Real "Go Live" silently stays **dry-run** because: the user's Hyperliquid wallet already has the **max 3 agent wallets** (cap is dynamic, volume-based), all **created externally** (BE has no private key) → `/agent/create` is blocked and no usable agent attaches to the bot. The FE today shows only a generic error and has no way to free a slot, see agents, warn about external agents, or attach a new agent to existing bots.

**Confirmed by Tuấn (2026-06-03):**
- New agent → auto-attaches to **new bots**; **existing bots** need user-triggered **`/bot/rotate-wallet`**.
- Freeing a Hyperliquid slot requires an **on-chain revoke (signed tx)**: `/agent/{id}/revoke` (app-created) or `/agent/external-revoke` (created on Hyperliquid). `/agent/revoke` only flips DB status — does **not** free a slot.
- Removing a wallet directly on Hyperliquid → bot errors → user must create new + rotate-wallet.

### Goal
Let the user, entirely from the app: (a) understand the cap-full error, (b) see all agent wallets and revoke to free a slot (with signing), (c) be warned when the active agent is missing on-chain, (d) attach the active agent to existing bots. Result: real Live works without touching the Hyperliquid site.

### API surface (`src/features/agent-wallet/agent.api.ts` — extend)
Add methods (types from `@/types/api-helpers`, generated from openapi):
- `list()` → `GET /agent/list` (agents in our DB).
- `hyperliquidWallets()` → `GET /agent/hyperliquid-wallets` (all agents on the user's Hyperliquid account, incl. external).
- `syncStatus()` → `GET /agent/sync-status`.
- `revokePayload(id)` → `GET /agent/{id}/revoke-payload`; `revoke(id, {signature, ...})` → `POST /agent/{id}/revoke` (app-created → signed, removes on-chain).
- `externalRevokePayload(address)` → `GET /agent/external-revoke-payload`; `externalRevoke({...signed})` → `POST /agent/external-revoke` (external → signed, removes on-chain).
- `rotateWallet()` → `POST /bot/rotate-wallet` (lives in `bot.api.ts`; returns `{total_bots, updated_count, restarted_count, error_count, ...}`).

> `agentApi.active`, `create`, `confirm`, `checkLimit` already exist (Phase 2b).
> Exact request/response shapes resolved against openapi at plan time.

### Components & flows

**1.1 Cap-full error in `AgentOnboardingDialog` (B1).**
When `/agent/create` fails with the Hyperliquid cap error (`"Too many extra agents…limit is 3"`), the dialog shows a dedicated state (not the generic banner): explains the wallet is at the 3-agent cap, with a **"Quản lý agent"** button that opens the Manage-Agents modal (1.2). Detection via an error-message/code matcher in the agent error mapper.

**1.2 Manage-Agents modal (B2 + B3).** Bespoke `DialogPrimitive` modal, opened from (a) the cap-full state, and (b) a small entry in the wallet/header area.
- Lists every Hyperliquid agent (merge `hyperliquidWallets()` ⨉ `list()`): columns **Name · Address (short) · Valid until · Nguồn** (app-managed vs external) · **Action (Revoke)**.
- **Revoke flow (signed):** app-managed → `revokePayload(id)` → `eip712Sign` (reuse Phase 2b helper) → `revoke(id, …)`; external → `externalRevokePayload(address)` → sign → `externalRevoke(…)`. Progress states like the onboarding flow (idle/signing/submitting/done/error). On success, refresh the list (a slot is freed).
- **Sync-status warning (B3):** call `syncStatus()`; if `mismatch_db_active_but_onchain_missing` (our active agent was removed on-chain), show a banner: "Agent đang active đã bị xoá trên Hyperliquid — tạo agent mới và cập nhật bot." with a shortcut to onboarding + rotate (1.3).
- Empty/within-cap state: shows current count `N/3` and a hint that creating happens via Go Live.

**1.3 Rotate-wallet for existing bots (B4).** A **"Cập nhật agent cho các bot"** action (in the Manage-Agents modal, shown when an active agent exists) → `rotateWallet()` → toast the result (`updated_count`/`restarted_count`). Needed because a freshly-created agent only auto-attaches to **new** bots; existing bots stay dry until rotated. (Also offered from the post-onboarding success path.)

### Decisions baked in (Tri: edit if wrong)
- Manage-Agents is a **modal** (not a full settings page) — minimal surface to unblock; can graduate to a page later.
- Only **slot-freeing** revokes are exposed (signed on-chain). Plain `/agent/revoke` (DB-only deactivate) is **not** in the UI for v1.
- Revoke confirmation: a small confirm step before signing ("Revoke … sẽ ký 1 tx và xoá agent khỏi Hyperliquid").

### Testing (TDD)
- `agent.api` methods (mock `http`) — paths/bodies for list/hyperliquid-wallets/sync-status/revoke(+payload)/external-revoke(+payload)/rotateWallet.
- Error mapper: cap-full message → typed `AgentCapFullError` (or flag).
- `AgentOnboardingDialog`: cap-full state renders + "Quản lý agent" opens modal.
- Manage-Agents modal: renders merged list, marks external vs managed, revoke happy-path (payload→sign→submit→refresh), sync mismatch banner, rotate-wallet button calls api + toasts.
- A hook (e.g. `useAgentRevokeFlow`) mirrors `useAgentSignFlow` and is unit-tested.

### Out of scope (v1)
- No multi-account; no agent rename; no spending-limit editing post-create; no DB-only deactivate UI; no auto-rotate (user-triggered only).

---

## Workstream 2 — Builder: remove "Trading mode" toggle

### Problem
The BotConfig step has a **Dry-run / Live trade** toggle (`tradingMode` → `dry_run`), but every launch overwrites `dry_run` via the Launchpad (`launch-actions.ts:35` `update(botId, { dry_run: mode==='dry-run' })`). So the build-time choice is **moot and misleading** — mode is a **launch-time** decision (Launchpad: Dry-run card vs Go Live).

### Change
- Remove the Trading-mode toggle from `BotConfigStep.tsx`.
- `serializer.ts`: stop reading `tradingMode`; **hardcode `dry_run: true`** on create (create schema requires it; bot sits dry/paused until launched — safe default).
- Remove `tradingMode` from `builder.store.ts`, `builder.types.ts`, `BotConfigSummary.tsx` (+ `summary-modes` test), `deploy-summary.ts`, and template catalog entries that set it.
- **Keep** Leverage, Stake amount/currency, **Dry-run wallet** (the sim balance, still used when a bot runs dry = the default mode). These are real params, not the mode toggle.
- On import (`serializer` line ~280/562 maps `dry_run`→`tradingMode`): drop the `tradingMode` mapping; keep importing `dry_run_wallet` etc.

### Testing
- `serializer.test.ts`: create payload always sends `dry_run: true`; round-trip no longer depends on `tradingMode`.
- `summary-modes.test.tsx` + `BotConfigStep.test.tsx`: toggle gone; config summary no longer shows trading mode.

### Out of scope
Launchpad/launch behavior unchanged (it remains the single source of truth for mode).

---

## Workstream 3 — Backtest per-trade table

Already specced: **`docs/superpowers/specs/2026-06-03-backtest-trades-table-design.md`** (branch `feat/backtest-trades-table`, commit `be8cb11`). Summary: `extractTrades()` helper + `BacktestTrade` type; `Tổng quan ↔ Lệnh (N)` toggle in the result step; 6-column table (Vào · Hướng · Giá vào→ra · P/L màu · Thoát · T.gian); TDD. No BE change. The consolidated plan will include its tasks by reference.

---

## Delivery & sequencing
1. **WS1 Phase 2b.1** first — unblocks real Live (highest value). Branch `feat/phase-2b.1-agent-mgmt` off `main`. Gated only on Phase 2b (PR #19) merging.
2. **WS2 builder toggle removal** — small, independent. Branch `refactor/builder-remove-trading-mode`.
3. **WS3 backtest table** — independent. Branch `feat/backtest-trades-table` (spec done).

Each WS = own PR, subagent-driven TDD per task, two-stage review. The plan (next) lays out tasks per WS.
