# Review request — Remaining FE work **SPEC** (design-stage, pre-implementation)

**Repo:** https://github.com/TriNguyen3010/trading_bot
**Branch:** `feat/phase-2b.1-agent-mgmt` (off `main`)
**Spec under review:** [`docs/superpowers/specs/2026-06-03-remaining-fe-work-design.md`](../specs/2026-06-03-remaining-fe-work-design.md) (commit `924d013`)
**Type:** This is a **DESIGN/SPEC review BEFORE any implementation** — there is no plan or code for this work yet. Goal: catch design/scope/BE-contract mistakes now so we don't write a wrong plan.

## Context
Multi-day effort to make Hyperliquid **real Live** work. Already shipped/open: Phase 2b (PR #19, agent onboarding create→sign→confirm), Telegram dev-test (same branch), backtest currency fix (PR #20). Live currently stays **dry-run** because the user's Hyperliquid wallet has the **max 3 agent wallets**, all created externally (BE has no key) → `/agent/create` blocked; and existing bots don't pick up a new agent without `/bot/rotate-wallet`. This spec covers the FE work to fix that + two smaller cleanups.

The spec decomposes into 3 independent workstreams (own branches/PRs):
- **WS1 — Phase 2b.1 agent wallet management** (the important one): cap-full error UX, Manage-Agents modal (list + on-chain revoke with signing), sync-status warning, rotate-wallet for existing bots.
- **WS2 — remove the build-time "Trading mode" toggle** (mode is decided at launch via Launchpad).
- **WS3 — backtest per-trade table** (separate spec `2026-06-03-backtest-trades-table-design.md`).

## Please verify (read the spec + the referenced code/openapi)

**A. WS1 — BE contract correctness (highest priority).** Check the spec's agent API mapping against `BE/openapi.json` + the documented Tuấn semantics:
1. Revoke endpoints: `/agent/revoke` (DB-only, does NOT free a Hyperliquid slot) vs `/agent/{agent_id}/revoke` (+ `/agent/{agent_id}/revoke-payload`, app-created, signs tx, frees slot) vs `/agent/external-revoke` (+ `/agent/external-revoke-payload`, external wallet, signs tx). Is the spec's usage of each correct? Are the request/response shapes as the spec assumes?
2. `/bot/rotate-wallet` — does the spec use it correctly for attaching a new agent to **existing** bots (new bots auto-attach)? Response fields (`updated_count`/`restarted_count`) right?
3. `/agent/hyperliquid-wallets`, `/agent/sync-status` (esp. `mismatch_db_active_but_onchain_missing`), `/agent/list` — does the spec read the right signals to (a) list external vs app-managed agents and (b) warn when the active agent was removed on-chain?
4. Cap-full detection: spec keys off the Hyperliquid error `"Too many extra agents…limit is 3"`. Is there a cleaner BE signal (e.g. `/agent/check-limit` or a structured error code) the spec should use instead of string-matching?

**B. WS1 — UX/flow completeness.** Revoke requires an on-chain **signed tx** (like create). Does the design miss any state: revoke tx rejected/failed on-chain; `hyperliquid-wallets` and DB `list` disagreeing; revoking the currently-active agent; the cap being >3 once volume grows (dynamic cap)? Is a modal the right surface, or does this need a page?

**C. WS2 — regression safety.** The spec removes the build-time Trading-mode toggle and hardcodes `dry_run: true` on create, arguing every launch overwrites `dry_run` (`src/features/launchpad/launch-actions.ts:35`). Verify: (a) launch truly always overwrites `dry_run`; (b) nothing else relies on the build-time `dry_run`/`tradingMode` (e.g. a bot that's created but never launched, or any BE create-time requirement); (c) the listed cleanup sites (`builder.store`, `builder.types`, `serializer`, `BotConfigSummary` + tests, `deploy-summary`, templates) are complete.

**D. Scope / decomposition / sequencing.** Is the 3-workstream split right? Is anything **missing for real Live to work end-to-end** (FE side)? Is WS1→WS2→WS3 the right order? Anything that would force a plan rewrite if not caught now.

## Out of scope
- No implementation/plan exists yet — don't review code quality (there's none for this).
- Phase 2b (PR #19), Telegram, C1 currency (PR #20) — already reviewed/shipped separately.
- Strategy quality (the losing TP/SL config) — user's config concern, not this spec.

## Output format
Verdict: **GO** (spec is sound, proceed to plan) / **NO-GO** (design issues) + 1-line rationale.
Per finding: **Severity** (Critical / Important / Should-fix / Nice-to-have / Note) · **Spec section or file:line** · **Issue** · **Suggested fix**.
Flag explicitly any BE-contract assumption in the spec that is wrong.
