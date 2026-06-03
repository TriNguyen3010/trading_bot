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
- `externalRevokePayload(agentName)` → `GET /agent/external-revoke-payload?agent_name={agentName}`; `externalRevoke({wallet_address, agent_name, nonce, signature})` → `POST /agent/external-revoke` (external → signed, removes on-chain). Important: Hyperliquid external revoke identifies the agent by **name** in the EIP-712 `agentName` field, not by address. FE displays `HyperliquidWalletResponse.address`, but must carry and submit `HyperliquidWalletResponse.name`.
- `rotateWallet()` → `POST /bot/rotate-wallet` (lives in `bot.api.ts`; returns `{total_bots, updated_count, restarted_count, error_count, results, message}`).

> `agentApi.active`, `create`, `confirm`, `checkLimit` already exist (Phase 2b).
> Exact request/response shapes resolved against openapi at plan time.

### Components & flows

**1.1 Cap-full error in `AgentOnboardingDialog` (B1).**
When `/agent/create` fails with the Hyperliquid cap error, the dialog shows a dedicated state (not the generic banner): explains the wallet has reached its Hyperliquid agent cap, with a **"Quản lý agent"** button that opens the Manage-Agents modal (1.2). Detection is necessarily string-based for now because BE/openapi does not expose a structured agent-cap error code; `/agent/check-limit` is only for daily USD spending limits. Implement the matcher as a case-insensitive partial match on both `"too many"` and `"agent"` instead of exact text like `"Too many extra agents…limit is 3"`. File a follow-up for BE to return `error_code: "AGENT_CAP_FULL"`.

**1.2 Manage-Agents modal (B2 + B3).** Bespoke `DialogPrimitive` modal, opened from (a) the cap-full state, and (b) a small entry in the wallet/header area.
- Lists every Hyperliquid agent (merge `hyperliquidWallets()` ⨉ `list()`): columns **Name · Address (short) · Valid until · Nguồn** (app-managed vs external) · **Action (Revoke)**.
- **Revoke flow (signed):** app-managed → `revokePayload(id)` → `eip712Sign` (reuse Phase 2b helper) → `revoke(id, …)`; external → read `name` from the selected `HyperliquidWalletResponse`, call `externalRevokePayload(name)` → sign → `externalRevoke({ ..., agent_name: name })`. Progress states like the onboarding flow (idle/signing/submitting/done/error). On success, refresh the list (a slot is freed).
- **Active-agent revoke variant:** if the target agent is currently active (`is_active === true` after merging DB + on-chain rows), show a stronger confirm before signing: "Agent này đang được các bot sử dụng. Revoke sẽ làm các bot dùng agent này lỗi/dừng giao dịch cho đến khi tạo agent mới và cập nhật agent cho bot." After a successful active-agent revoke, auto-open the onboarding flow; after onboarding succeeds, offer/run rotate-wallet (1.3).
- **Sync-status warning (B3):** call `syncStatus()`; if `mismatch_db_active_but_onchain_missing` (our active agent was removed on-chain), show a banner: "Agent đang active đã bị xoá trên Hyperliquid — tạo agent mới và cập nhật bot." with a shortcut to onboarding + rotate (1.3).
- Empty/within-cap state: shows current count (`N agents`) and a hint that creating happens via Go Live. Do not hardcode `N/3`; Hyperliquid's cap is dynamic and openapi currently exposes no current-cap endpoint.

**1.3 Rotate-wallet for existing bots (B4).** A **"Cập nhật agent cho các bot"** action (in the Manage-Agents modal, shown when an active agent exists) → `rotateWallet()` → toast the result (`updated_count`/`restarted_count`). Needed because a freshly-created agent only auto-attaches to **new** bots; existing bots stay dry until rotated. If `error_count > 0`, show a warning toast/detail state listing failed `results[]` rows by `bot_name` + `error`. (Also offered from the post-onboarding success path.)

### Decisions baked in (Tri: edit if wrong)
- Manage-Agents is a **modal** (not a full settings page) — minimal surface to unblock; can graduate to a page later.
- Only **slot-freeing** revokes are exposed (signed on-chain). Plain `/agent/revoke` (DB-only deactivate) is **not** in the UI for v1.
- Revoke confirmation: a small confirm step before signing ("Revoke … sẽ ký 1 tx và xoá agent khỏi Hyperliquid"). Use the stronger active-agent variant above when applicable.

### Testing (TDD)
- `agent.api` methods (mock `http`) — paths/bodies for list/hyperliquid-wallets/sync-status/revoke(+payload)/external-revoke(+payload)/rotateWallet.
- Error mapper: cap-full message containing `"too many"` + `"agent"` → typed `AgentCapFullError` (or flag).
- `AgentOnboardingDialog`: cap-full state renders + "Quản lý agent" opens modal.
- Manage-Agents modal: renders merged list, marks external vs managed, external revoke uses `name` not address, revoke happy-path (payload→sign→submit→refresh), active-agent revoke warning + post-revoke onboarding/rotate path, sync mismatch banner, rotate-wallet button calls api + toasts failed `results[]` when `error_count > 0`.
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
- Remove `tradingMode` from `builder.store.ts`, `builder.types.ts`, `BotConfigSummary.tsx` (+ `summary-modes` test), `deploy-summary.ts`, `TemplateDetailModal.tsx`, `validateSetup.ts`, `i18n/en.ts`, and template catalog entries that set it.
- Update `src/features/bot-summary/translators/risk.ts`: remove the live/dry-run conditional copy and high-leverage warning tied to `tradingMode === 'live'`. Builder summaries should be mode-agnostic/default-dry; live-mode risk warnings belong in Launchpad because mode is chosen at launch time.
- **Keep** Leverage, Stake amount/currency, **Dry-run wallet** (the sim balance, still used when a bot runs dry = the default mode). These are real params, not the mode toggle.
- On import (`serializer` line ~280/562 maps `dry_run`→`tradingMode`): drop the `tradingMode` mapping; keep importing `dry_run_wallet` etc.

### Testing
- `serializer.test.ts`: create payload always sends `dry_run: true`; round-trip no longer depends on `tradingMode`.
- `summary-modes.test.tsx` + `BotConfigStep.test.tsx`: toggle gone; config summary no longer shows trading mode.
- Typecheck guard: no remaining `tradingMode` references in `src/features/templates/TemplateDetailModal.tsx`, `src/features/bot-summary/translators/risk.ts`, `src/lib/validateSetup.ts`, or `src/i18n/en.ts`.

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
