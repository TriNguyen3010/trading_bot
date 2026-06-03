# Plan Review Lại Code Đã Merged (Phase 2b → WS3)

> **Mục tiêu:** Re-review toàn bộ code FE đã merged vào main (`4344603`), ưu tiên feature rủi ro cao trước, để bắt bug/edge-case/lỗ hổng còn sót trước khi smoke-test Live thật.
> **Phương pháp:** review theo **tier ưu tiên rủi ro**; mỗi tier ra 1 findings doc (severity Blocker/Important/Nice). Anh duyệt fix sau mỗi tier — có thể dừng sớm khi đủ tự tin.
> **Ngày:** 2026-06-03 · **Reviewer:** Claude (Tri duyệt)

---

## 0. Baseline (chạy trước, 1 lần)

- [ ] `pnpm typecheck` ✓ · `pnpm lint` ✓ · `pnpm test` ✓ (toàn xanh) — chốt điểm xuất phát, mọi finding sau là _thêm_ trên nền xanh.
- Nếu có test/lint đỏ → đó là **Blocker #0**, fix trước khi review tiếp.

---

## Bản đồ rủi ro (cơ sở xếp ưu tiên)

| Vùng                                                 | LOC     | Rủi ro chính                                                                 |
| ---------------------------------------------------- | ------- | ---------------------------------------------------------------------------- |
| `agent-wallet/`                                      | 1089    | **Tiền thật** — EIP-712 sign, agent cap/revoke/rotate, on-chain irreversible |
| `launchpad/`                                         | 371     | Quyết định **dry vs Live** (`dry_run` flip)                                  |
| `lib/serializer.ts` + `schemas/unified-bot-strategy` | 611+672 | Payload tạo bot — sai = bot chạy sai cấu hình                                |
| `lib/http.ts`                                        | 203     | Auth headers, 401, public-path, silence agent toast                          |
| `bot-monitoring/` (bot.api)                          | 5501    | Start/stop/status/sync/remove bot đang chạy                                  |
| `wallet-auth/`                                       | 1173    | Session, signature, nonce, persist                                           |
| `export-import/`                                     | 1026    | Submit create — **0 test** ⚠️                                                |
| `bot-builder/`                                       | 3917    | Wizard, store migrate v3→v4, BotConfigStep sau khi bỏ trading-mode           |
| `bot-summary/`                                       | 1142    | Translators + risk warning (WS2 đụng)                                        |
| `backtest/`                                          | 788     | Per-trade table (WS3), currency (C1), poll                                   |
| `conditions/ indicators/ templates/`                 | ~2400   | Build điều kiện entry/exit                                                   |
| `fx/ cypheus/ layout-prefs/`                         | ~2000   | Visual/prefs — rủi ro thấp                                                   |

---

## TIER 1 — Critical (tiền thật / không thể đảo ngược / gửi BE)

> Đây là "những tính năng cần thiết" cần review **trước tiên**. Nếu chỉ làm 1 tier, làm tier này.

### 1A. agent-wallet (Live + agent lifecycle)

**Files:** `agent.api.ts`, `agent-helpers.ts` (eip712Sign, extractNonce, formatSpendingLimit, isAgentCapFull), `useAgentSignFlow.ts`, `useAgentRevokeFlow.ts`, `AgentOnboardingDialog.tsx`, `ManageAgentsModal.tsx`, `bot.api rotateWallet`.
**Soi gì:**

- [ ] EIP-712 sign: domain/types/message đúng chuẩn Hyperliquid `approveAgent`? nonce lấy đúng từ sign-payload? ký nhầm field nào không?
- [ ] 3 đường revoke (`/agent/revoke` DB-only, `/agent/{id}/revoke` app-created, `/agent/external-revoke` by NAME) — gọi đúng endpoint cho đúng loại agent? external revoke truyền **name** không phải address?
- [ ] `isAgentCapFull` match chuỗi (case-insensitive "too many"+"agent") — false positive/negative? (đây là chỗ chờ BE thêm `error_code`).
- [ ] rotate-wallet: gắn agent active vào bot cũ — gọi đúng lúc? bot mới auto-attach có double-attach không?
- [ ] **State/effect races** trong ManageAgentsModal (đã từng có bug post-revoke-success C-1 + render-loop) — re-verify effect deps, reset stage, không loop.
- [ ] Error handling: sign bị user reject, BE 4xx/5xx, nonce hết hạn → UI có kẹt spinner không?

### 1B. launchpad — dry vs Live

**Files:** `launch-actions.ts`, `LaunchpadModal.tsx`.
**Soi gì:**

- [ ] `dry_run` flip đúng: Live → start với dry_run=false; dry-run → dry_run=true? Không có đường nào vô tình Live khi user chọn dry?
- [ ] Cap-full → mở onboarding/manage đúng nhánh? onboarding-success relaunch bot vs rotate (N-2 product intent).
- [ ] Telegram dev-test (token/chat_id, `VITE_TELEGRAM_DEV`) chỉ lộ ở dev, không leak prod.

### 1C. serializer + schema (payload tạo bot)

**Files:** `lib/serializer.ts`, `schemas/unified-bot-strategy.schema.ts`.
**Soi gì:**

- [ ] `create` hardcode `dry_run: true` (WS2) — đúng mọi nhánh? deserialize round-trip không vỡ?
- [ ] pair format `BTC-USDC` → `BTC/USDC:USDC` (futures) đúng mọi market type?
- [ ] telegram=null khi wizard không config (tránh BE 500).
- [ ] entry_long/entry_short + can_short theo direction; TP levels → custom_exit.partial_levels.
- [ ] Zod schema khớp BE thật (so `BE/API_SPEC.md` / `openapi.json`).

### 1D. http.ts (auth/security)

- [ ] Attach `X-Wallet-*` đúng; PUBLIC_PATHS whitelist không rò endpoint cần auth.
- [ ] 401 → clear sessionStorage + redirect `/`; không loop redirect.
- [ ] Silence `/agent/*` global toast không nuốt mất lỗi quan trọng.
- [ ] `VITE_BYPASS_AUTH` chỉ dev.

**→ Ra `findings-tier1.md`. Anh duyệt fix trước khi qua Tier 2.**

---

## TIER 2 — Important (điều khiển bot đang chạy / session)

- [ ] **bot-monitoring/bot.api** — start/stop/getStatus/sync/remove: confirm dialog đúng action? `useBotStatusPoll` rò interval/leak? desired_status vs status race?
- [ ] **wallet-auth** — connect/sign/persist sessionStorage; expire khi đóng tab; reconnect lấy nonce mới.
- [ ] **export-import/ExportDialog** — submit `/bot-strategy/create`; ⚠️ **0 test** → đề xuất bổ sung test cho handleSubmit (happy + 4xx/5xx).

**→ Ra `findings-tier2.md`.**

---

## TIER 3 — Correctness (config/display)

- [ ] **bot-builder** — store migrate **v3→v4** (bỏ tradingMode): state cũ trong localStorage có vỡ không? BotConfigStep sau khi bỏ toggle (giữ MarginMode) render đúng?
- [ ] **bot-summary** — risk warning mode-agnostic (P-1), translators đúng số liệu.
- [ ] **backtest** — per-trade table (WS3): extractTrades/format duration+time đúng? currency USDC (C1) mọi pair? poll cleanup.
- [ ] **conditions / indicators / templates** — build tree, apply template không tạo state lỗi.

**→ Ra `findings-tier3.md`.**

---

## TIER 4 — Low risk (chỉ khi còn thời gian)

- [ ] fx (DotGrid), cypheus (scripted), layout-prefs — chủ yếu memory leak / perf, không logic tiền.

---

## Cách thực thi (đề xuất)

1. Baseline xanh (mục 0).
2. **Tier 1** trước: dispatch subagent review **song song theo 4 vùng 1A–1D** (mỗi subagent đọc code + ra findings có severity + file:line), em tổng hợp + tự verify lại từng Blocker/Important (không tin báo cáo subagent mù quáng — đã từng bắt 2 bug thật theo cách này).
3. Anh xem `findings-tier1.md` → chọn fix cái nào → em fix theo TDD (test đỏ → fix → xanh) → commit.
4. Lặp cho Tier 2/3 nếu anh muốn đi tiếp.

**Gate:** sau mỗi tier dừng cho anh duyệt — anh có thể dừng ở Tier 1/2 khi đủ tự tin, không bắt buộc làm hết.
