# Review request — Remaining FE work **PLANS** (3 implementation plans, pre-execution)

**Repo:** https://github.com/TriNguyen3010/trading_bot
**Branch:** `feat/phase-2b.1-agent-mgmt` (commit `421a991`)
**Type:** Review of **bite-sized TDD implementation plans BEFORE execution**. Spec already reviewed (GO). Goal: catch wrong code/field-names/missing-steps now so execution doesn't thrash.

## Plans under review
- WS1: `docs/superpowers/plans/2026-06-03-phase-2b.1-agent-mgmt.md` (8 tasks / 38 steps) — agent wallet management
- WS2: `docs/superpowers/plans/2026-06-03-builder-remove-trading-mode.md` (6 tasks) — remove build-time trading-mode toggle
- WS3: `docs/superpowers/plans/2026-06-03-backtest-trades-table.md` (5 tasks) — backtest per-trade table
- Spec (context): `docs/superpowers/specs/2026-06-03-remaining-fe-work-design.md` (GO) + WS3 detail `docs/superpowers/specs/2026-06-03-backtest-trades-table-design.md`

## Please verify (read the plans against the real codebase + `BE/openapi.json`)

**A. WS1 — code/contract accuracy (highest priority).**
1. Every `agentApi`/`botApi` method in the plan uses **real openapi paths + field names** (schemas: `HyperliquidWalletResponse`, `AgentSyncStatusResponse`, `AgentRevokeRequest`/`ExternalRevokeRequest`, `BotWalletRotationResponse`+`...ResultItem`). Flag any invented field.
2. The two `*revoke-payload` GETs are **untyped (`{}`) in openapi** — plan types them `{ sign_payload: unknown }` (mirroring `AgentPrepareResponse`). Acceptable? Any safer shape?
3. `useAgentRevokeFlow` correctly mirrors the existing `useAgentSignFlow` (payload→`eip712Sign`→submit), and external revoke uses **`HyperliquidWalletResponse.name`** (NOT address) in the EIP-712 `agentName`.
4. Cap-full matcher (`"too many"` + `"agent"`, case-insensitive) — correct against how `src/lib/http.ts`/`format-error.ts` surface BE errors.
5. `ManageAgentsModal`: merge of `/agent/list` (DB) ⨉ `/agent/hyperliquid-wallets` (on-chain) is sound; active-agent stronger-confirm; sync-status `mismatch_db_active_but_onchain_missing` banner; rotate-wallet `error_count>0` handling.

**B. WS2 — removal completeness / no over-reach.**
1. The plan's `tradingMode` removal sites are complete (store/types/BotConfigStep/summaries/translators/templates/i18n/validateSetup/deploy-summary + their tests).
2. **Must NOT touch** `src/schemas/unified-bot-strategy.schema.ts` `tradingModeSchema` — that's the BE `trading_mode` (spot/margin/futures) enum, unrelated to the FE toggle. Confirm the plan leaves it alone.
3. serializer hardcodes `dry_run: true` on create; import-side `dry_run`→`tradingMode` map dropped without breaking round-trip.

**C. WS3 — dependency correctness.**
1. WS3 **depends on C1 (PR #20)**: `quoteCurrencyFromPair` already exists from C1 → the plan's ⚠️ callout says reuse, do NOT re-add. Confirm no task actually re-implements/re-tests it, and the branch base note (off `fix/backtest-stake-currency` or post-#20-merge) is right.
2. `BacktestTrade` + `extractTrades` use **real `trades[]` field names** from `BE/backtest_200.json` (`open_timestamp`, `close_timestamp`, `open_rate`, `close_rate`, `profit_abs`, `profit_ratio`, `exit_reason`, `enter_tag`, `trade_duration`, `is_short`, `leverage`).

**D. Cross-cutting.** Placeholder scan (no "TBD"/"add error handling"/undefined types); type/name consistency across tasks within each plan; any spec requirement with no covering task; bite-sized TDD ordering (failing test → run → implement → pass → commit).

## Out of scope
- Spec design (already GO).
- Phase 2b (PR #19), Telegram, C1 (PR #20) — shipped/reviewed.
- Strategy quality.

## Output format
Per plan: **GO** (ready to execute) / **NO-GO** + 1-line rationale.
Per finding: **Severity** (Critical/Important/Should-fix/Nice-to-have/Note) · **plan file + task/step** · **Issue** · **Suggested fix**.
Flag explicitly any task code that would fail typecheck/test as written, or any wrong openapi field.
