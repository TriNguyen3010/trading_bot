# Design Spec Review — Remaining FE Work (pre-implementation)

> **Reviewer:** Devin · **Date:** 2026-06-03
> **Spec:** `docs/superpowers/specs/2026-06-03-remaining-fe-work-design.md` (commit `924d013`)
> **Branch:** `feat/phase-2b.1-agent-mgmt`
> **Scope:** Design/scope review — no code yet. 3 workstreams (WS1 agent mgmt, WS2 remove toggle, WS3 backtest trades table).

---

## Verdict: **GO** — 2 Important, 2 Should-fix, 3 Nice-to-have

Spec is sound overall. WS1 agent-management design correctly maps the revoke/rotate/sync flows. WS2 regression claim verified correct. WS3 already specced separately. Two Important findings in WS1 BE-contract assumptions must be corrected before writing the implementation plan; both are name-level mismatches, not architectural.

---

## Findings

### Important (2)

**I-1 · WS1 §API surface · `externalRevokePayload` param is `agent_name`, not `address`**

Spec says: `externalRevokePayload(address)` → `GET /agent/external-revoke-payload`

Actual openapi: the endpoint takes **`agent_name`** (query param, type `string`, default `""`), NOT address. Additionally, `ExternalRevokeRequest` (POST body) carries `agent_name` as well (optional, default `""`).

This matters because external wallets on Hyperliquid are identified by **name** in the EIP-712 `approveAgent` payload (`agentName` field in the typed data — see `BE/auth-architecture.md` L156). The flow should be:

1. User selects external wallet from merged list (displayed by address from `HyperliquidWalletResponse.address`)
2. FE reads the `name` field from the same `HyperliquidWalletResponse`
3. Passes `name` → `GET /agent/external-revoke-payload?agent_name={name}` (not address)
4. After signing: `POST /agent/external-revoke` body includes `agent_name` (same value)

**Fix:** Change `externalRevokePayload(address)` → `externalRevokePayload(agentName)` in spec §API surface. Note in the Manage-Agents modal spec that the join must carry `name` alongside `address` for the external-revoke flow.

**Evidence:**

- `BE/openapi.json` `/agent/external-revoke-payload` → params: `[{name: "agent_name", in: "query", schema: {type: "string", default: ""}}]`
- `ExternalRevokeRequest` schema → `agent_name: {type: "string", default: ""}`
- `BE/auth-architecture.md` L156 → `{ "name": "agentName", "type": "string" }` in EIP-712 typed data

---

**I-2 · WS1 §1.2 · Revoking the active agent needs an explicit UX warning**

Spec §1.2 describes revoke with a generic confirm step: _"Revoke … sẽ ký 1 tx và xoá agent khỏi Hyperliquid"_. But revoking the **currently-active** agent has a much larger blast radius:

- All running bots using that agent will immediately error
- User must create a NEW agent + rotate-wallet before bots can trade again
- The `mismatch_db_active_but_onchain_missing` sync warning (B3) would fire retroactively, but by then bots are already broken

The spec should differentiate the confirm dialog when the target agent `is_active === true`: show a stronger warning ("Agent đang được các bot sử dụng — revoke sẽ dừng toàn bộ bot cho đến khi tạo agent mới + cập nhật") and perhaps auto-redirect to onboarding + rotate after revoke succeeds.

**Fix:** Add an "active-agent revoke" confirm variant in §1.2 with the warning copy. Optionally: after revoking the active agent, auto-open onboarding flow → on success, offer rotate.

---

### Should-fix (2)

**S-1 · WS2 §Change · Cleanup site list incomplete — 4 sites missing**

Spec lists: `BotConfigStep.tsx`, `serializer`, `builder.store`, `builder.types`, `BotConfigSummary` + test, `deploy-summary`, templates.

Missing sites that reference `tradingMode` and will break or leave dead code:

| File                                             | Line   | Usage                                                                                                            |
| ------------------------------------------------ | ------ | ---------------------------------------------------------------------------------------------------------------- |
| `src/features/templates/TemplateDetailModal.tsx` | 154    | `c.tradingMode === 'dry-run' ? 'Dry-run' : 'Live'` — renders in template preview                                 |
| `src/features/bot-summary/translators/risk.ts`   | 27, 67 | Conditional narrative: "Live trading" vs "Dry-run mode"; high-leverage warning gated on `tradingMode === 'live'` |
| `src/lib/validateSetup.ts`                       | 9      | `tradingMode: z.enum(['dry-run', 'live'])` — step completion validation                                          |
| `src/i18n/en.ts`                                 | 258    | Help text for `tradingMode` field                                                                                |

After removing `tradingMode` from `BotConfigForm` (builder.types), all 4 will fail typecheck. The `risk.ts` translator needs special attention: with mode always dry-run at build time, the "Live trading — using real funds" narrative and the high-leverage live-warning become dead code. Decide: remove them entirely (mode is launch-time concern) or rewrite to be mode-agnostic.

**Fix:** Add these 4 files to the cleanup list. For `risk.ts`: remove the live-mode conditional — always show dry-run narrative (consistent with "mode is a launch-time decision" philosophy). If the user later needs live-mode warnings, those belong in the Launchpad, not the builder summary.

---

**S-2 · WS1 §1.1 · Cap-full detection: string-matching is fragile but no better signal exists — document explicitly**

Spec detects cap-full via: `"Too many extra agents…limit is 3"` string match from the `/agent/create` error response. Review brief asks: _"Is there a cleaner BE signal?"_

Verified: **No.** `/agent/check-limit` is for **spending limits** (USD amount per day), not agent count. The openapi shows no structured error code for agent-cap. The Hyperliquid error is forwarded by BE as an unstructured message.

This is pragmatic but fragile — if Hyperliquid changes the error wording, detection breaks silently (generic error, not the dedicated cap-full UX).

**Fix:** Document the fragility in spec + plan. Recommend: (a) implement a case-insensitive partial match on `"too many"` + `"agent"` rather than the exact string, and (b) file a follow-up for BE to return a structured error code (e.g., `error_code: "AGENT_CAP_FULL"`) so FE can stop string-matching long-term.

---

### Nice-to-have (3)

**N-1 · WS1 §1.2 · "N/3" cap display hardcodes the limit**

Spec says: _"Empty/within-cap state: shows current count N/3"_. The "3" is currently correct (Hyperliquid default) but the spec itself says "cap is dynamic, volume-based." If the cap increases (e.g., to 5 for high-volume wallets), the UI would show "3/3" at cap when the real limit is 5.

Openapi provides no "current cap" endpoint. Consider: parse the cap from the error message on failure, or simply show "N agents" without the denominator until BE provides a cap endpoint.

**N-2 · WS1 §API surface · `/bot/rotate-wallet` response has `error_count` + per-bot `results[]` — spec only toasts `updated_count`/`restarted_count`**

`BotWalletRotationResponse` includes: `total_bots`, `updated_count`, `restarted_count`, **`error_count`**, and `results[]` (per-bot with `bot_name`, `error: string|null`). Spec only mentions toasting `updated_count`/`restarted_count`. If `error_count > 0`, user gets no feedback about which bots failed rotation. Consider: if `error_count > 0`, show a warning toast or expandable detail listing failed bots.

**N-3 · WS1 §API surface · `POST /agent/revoke` (DB-only) has no request body — implicit "revoke active"**

Confirmed: `POST /agent/revoke` has no `requestBody` in openapi — it revokes the currently active agent (implicit from auth headers). Spec correctly excludes this from UI v1. Just noting: if the active agent was already revoked on-chain externally, calling this endpoint still flips `is_active=false` in DB, which could be useful as a "sync DB to reality" fallback. Consider for v2.

---

## Section-by-section verification

### A. WS1 — BE contract correctness

| Endpoint                             | Spec claim                                                                      | openapi.json                                                                                   | Verdict                                      |
| ------------------------------------ | ------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- | -------------------------------------------- |
| `GET /agent/list`                    | Returns `AgentInfoResponse[]`                                                   | ✓                                                                                              | **PASS**                                     |
| `GET /agent/hyperliquid-wallets`     | Returns `HyperliquidWalletResponse[]` (address, name, valid_until)              | ✓ — fields: `address` (string, required), `name` (string, required), `valid_until` (int\|null) | **PASS**                                     |
| `GET /agent/sync-status`             | Returns `AgentSyncStatusResponse` with `mismatch_db_active_but_onchain_missing` | ✓ — boolean, required                                                                          | **PASS**                                     |
| `GET /agent/{id}/revoke-payload`     | Takes `agent_id` (path), returns opaque sign_payload                            | ✓                                                                                              | **PASS**                                     |
| `POST /agent/{id}/revoke`            | Takes `AgentRevokeRequest` {wallet_address, nonce, signature}                   | ✓ — all 3 required                                                                             | **PASS**                                     |
| `GET /agent/external-revoke-payload` | Spec says `(address)`                                                           | ✗ — takes `agent_name` (query), not address                                                    | **FAIL → I-1**                               |
| `POST /agent/external-revoke`        | Takes `ExternalRevokeRequest`                                                   | ✓ — {wallet_address, agent_name (default ""), nonce, signature}                                | **PASS** (but note `agent_name` key)         |
| `POST /bot/rotate-wallet`            | Returns `BotWalletRotationResponse` with `updated_count`/`restarted_count`      | ✓ — also has `error_count`, `results[]`, `message` (all required)                              | **PASS** (but spec underuses response — N-2) |
| Cap-full detection                   | String match on error                                                           | No structured error code available                                                             | **PASS** (pragmatic — S-2)                   |

### B. WS1 — UX/flow completeness

| Concern                                        | Addressed?                                                                          |
| ---------------------------------------------- | ----------------------------------------------------------------------------------- |
| Revoke tx rejected (user cancels wallet popup) | ✓ — "Progress states like the onboarding flow (idle/signing/submitting/done/error)" |
| Revoke tx failed on-chain                      | ✓ — error state in progress states                                                  |
| `hyperliquidWallets` and DB `list` disagreeing | ✓ — merge covers this; sync-status warning (B3) covers active-missing               |
| Revoking the currently-active agent            | ✗ — **I-2** (no differentiated warning)                                             |
| Cap > 3 (dynamic)                              | Partially — mentioned in Problem but UI hardcodes 3 — **N-1**                       |
| Modal vs page                                  | ✓ — modal is pragmatic for v1, spec notes "can graduate to a page later"            |

### C. WS2 — Regression safety

| Claim                                     | Verified? | Evidence                                                                                                                                      |
| ----------------------------------------- | --------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| Launch always overwrites `dry_run`        | ✓         | `launch-actions.ts:30`: `botStrategyApi.update(botId, { dry_run: mode === 'dry-run' })` — unconditional, runs for both dry-run and live modes |
| Bot created-but-never-launched stays safe | ✓         | Hardcoded `dry_run: true` → bot sits dry/paused, can't accidentally trade live                                                                |
| BE create requires `dry_run`              | ✓         | `UnifiedBotStrategyCreate.dry_run` is `required` + `type: boolean` — must be present                                                          |
| Cleanup sites complete                    | ✗         | 4 sites missing — **S-1**                                                                                                                     |

### D. Scope / decomposition / sequencing

| Question                                               | Answer                                                                                                                                                            |
| ------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 3-WS split correct?                                    | ✓ — different domains, different files, no cross-dependency                                                                                                       |
| WS1→WS2→WS3 order correct?                             | ✓ — WS1 unblocks Live (highest value), WS2+WS3 are independent and lower priority                                                                                 |
| Anything missing for real Live end-to-end?             | No — flow is: revoke (free slot) → Go Live → onboard (create agent) → rotate (existing bots) → bot trades live. All steps covered between Phase 2b (PR #19) + WS1 |
| Would anything force a plan rewrite if not caught now? | I-1 (`agent_name` vs address) would cause incorrect API calls if not fixed before plan                                                                            |

---

## Summary

| #   | Severity     | Area | Finding                                                                                  | Effort                               |
| --- | ------------ | ---- | ---------------------------------------------------------------------------------------- | ------------------------------------ |
| I-1 | Important    | WS1  | `externalRevokePayload` param is `agent_name`, not `address`                             | 5 min (rename in spec)               |
| I-2 | Important    | WS1  | No warning when revoking the active agent — bots will error                              | 10 min (add confirm variant in spec) |
| S-1 | Should-fix   | WS2  | 4 cleanup sites missing: `TemplateDetailModal`, `risk.ts`, `validateSetup`, `i18n/en.ts` | 5 min (add to list)                  |
| S-2 | Should-fix   | WS1  | Cap-full string matching is only option but fragile — document + widen match             | 5 min (add note in spec)             |
| N-1 | Nice-to-have | WS1  | "N/3" hardcodes cap                                                                      | —                                    |
| N-2 | Nice-to-have | WS1  | `rotate-wallet` response `error_count`/`results[]` underused in toast                    | —                                    |
| N-3 | Note         | WS1  | `POST /agent/revoke` (DB-only) could be useful as "sync DB" fallback in v2               | —                                    |

**Verdict: GO** — fix I-1 + I-2 in spec (~15 min), then proceed to implementation plan.
