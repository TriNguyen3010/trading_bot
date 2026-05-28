# Phase 4 & 5 Spec — Rich Monitoring + Monetization

> **Mục đích doc này:** AI/dev mới vào đọc xong là biết ngay 2 phase còn lại (chưa có plan) là gì, đang bị chặn bởi cái gì, cần gì để bắt đầu, và viết plan TDD lúc nào. Đây là **spec (design + handoff)**, KHÔNG phải implementation plan — vì cả 2 phase còn thiếu thông tin BE nên chưa TDD được.
>
> **Last updated:** 2026-05-28 (post-openapi refresh + Phase 1 ship)

---

## 0. Bạn đang ở đâu (đọc trước)

Toàn bộ flow bot mong muốn được định nghĩa bởi prototype `public/bot-launch-prototype.html` (bản mới nhất, 4757 dòng). Đã bóc thành 6 phase:

| Phase | Nội dung                                | Trạng thái                                                                    | Artifact                                                  |
| ----- | --------------------------------------- | ----------------------------------------------------------------------------- | --------------------------------------------------------- |
| 0     | Submit create bot                       | ✅ **DONE in code**                                                           | `ExportDialog.handleSubmit` → `POST /bot-strategy/create` |
| 1     | Lifecycle (start/stop/sync/delete)      | ✅ **DONE in code (PR #12, await review merge)**                              | `docs/superpowers/plans/2026-05-21-bot-lifecycle.md`      |
| 3     | Backtest                                | 📝 plan tightened (Gap 2 + results shape known), chưa build                   | `docs/superpowers/plans/2026-05-27-backtest.md`           |
| 2     | Launchpad + dry-run/live                | 📝 plan cần split 2a (unblocked) + 2b (mới unblock với /agent/\*), chưa build | `docs/superpowers/plans/2026-05-27-launchpad-dry-live.md` |
| **4** | **Rich monitoring (real-time)**         | 🟡 **PARTIAL UNBLOCK — plan-able với workaround**                             | **doc này, §1**                                           |
| **5** | **Monetization (tier/paywall/billing)** | ⛔ **CHƯA PLAN — BE + product chặn**                                          | **doc này, §2** + business model doc                      |

**Build order đã chốt: 1 → 3 → 2 → (4, 5).** Phase 4 còn block một phần (2 endpoint), Phase 5 chặn toàn bộ ngoài tầm FE.

**Context roadmap đầy đủ:** memory `project_bot_flow_roadmap.md`.

---

## 1. PHASE 4 — Rich Monitoring (real-time bot operation)

### 1.1. Goal

Thay màn monitor **mock** hiện tại bằng dữ liệu thật: open trades, PnL/equity curve, activity feed, performance — cho cả dry-run và live bot. Đây là phần "vận hành bot" mà Phase 1/2/3 chỉ làm tới mức status pill (`running/stopped`).

### 1.2. Prototype screens cần hiện thực hoá

- `DryRunMonitorScreen` / `LiveMonitorScreen` (prototype): metrics (open trades, PnL today, wallet, auto-stop), live equity curve, recent activity feed, Cypheus narrative.
- `BacktestResultScreen`: equity curve + max-drawdown/Sharpe/avg-trade (phần metric nâng cao — xem §1.5).

### 1.3. Trạng thái hiện tại của code

`src/features/bot-monitoring/BotMonitoringPage.tsx` (~3839 dòng) **chạy hoàn toàn bằng mock** — `import { botApi } from './mockBotData'` (KHÔNG phải `bot.api.ts` thật) + `hyperliquid.service.ts` cho market data thật. Nút Stop còn `// TODO(wallet-team)`. **Phase 4 = thay nguồn dữ liệu mock này bằng BE thật**, giữ nguyên phần lớn UI/animation đã polish.

### 1.4. BE contract — partial unblock (refresh 2026-05-28)

**Còn empty (2 endpoint — vẫn cần Tuấn document):**

| Endpoint                | Method | Vấn đề                                            |
| ----------------------- | ------ | ------------------------------------------------- |
| `/bot/{id}/open_trades` | GET    | response `schema = {}` — không có shape           |
| `/bot/{id}/db_trades`   | GET    | response `schema = {}` (alternative — cũng empty) |
| `/bot/{id}/performance` | GET    | response `schema = {}`                            |

**🆕 Workaround đã typed (Tuấn vừa thêm trong openapi refresh 2026-05-28):**

| Endpoint                 | Method | Response                     | Use case                                                                                                                               |
| ------------------------ | ------ | ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `/bot/{id}/audit_logs`   | GET    | `array<BotAuditLogOut>` ✅   | Thay `/logs` cho activity feed. Field: `{id, bot_id, server_id, action, triggered_by, result, error_details, timestamp}`               |
| `/backtest/{id}/candles` | GET    | `BacktestCandlesResponse` ✅ | Equity curve cho `BacktestResultScreen` (Phase 3 nâng cao). Field: `{backtest_id, pair, timeframe, range_start, range_end, candles[]}` |
| `/bot/{id}/restart`      | POST   | `BotStatusOut` ✅            | Lifecycle action mới — restart bot (defer Phase 1.1 nếu cần)                                                                           |
| `/bot/rotate-wallet`     | POST   | —                            | Rotate agent wallet (Phase 2b advanced)                                                                                                |

**Real-time:** spec mới đã **xoá** 3 WS endpoints cũ (`/ws/bot/{id}/info`, `/ws/connections/*`) → Phase 4 confirm REST polling (tái dùng `useBotStatusPoll` pattern của Phase 1, cadence ~3s). WS không có trong roadmap nữa.

**Control nâng cao (typed, dùng sau):** `/bot/{id}/force_entry`, `/force_exit`, `/set_stoploss`, `/test_signal` — vẫn có sẵn cho "manual intervention".

### 1.5. ✅ RESOLVED — Backtest `results` shape known từ sample

`BE/backtest_200.json` (sample Tuấn gửi 2026-05-28) đã xác nhận shape:

- `results = { strategy: { [name]: RawFreqtradeReport }, strategy_comparison: Array<BacktestComparisonItem> }`
- `BacktestComparisonItem` chứa: trades, profit_total_abs/pct, winrate (0-1), sharpe, sortino, calmar, profit_factor, max_drawdown_account (0-1 ratio), max_drawdown_abs (string!), duration_avg (string).
- Top-level `total_profit` = absolute USDT/USDC (= `profit_total_abs` rounded). **Gap 2 closed.**

Phase 3 plan (`docs/superpowers/plans/2026-05-27-backtest.md`) đã update:

- `BacktestComparisonItem` interface FE-defined local.
- `extractMetrics` đọc trực tiếp `results.strategy_comparison[0]` typed.
- `formatTotalProfit(v, currency)` với USDT suffix.

§1.5 sub-gap CLOSED — không cần BE document `results` nữa (FE owns local type).

### 1.6. FE work outline (khi unblock toàn bộ)

- `bot-monitoring/monitoring.api.ts`:
  - `getOpenTrades(id)` + `getPerformance(id)` — typed **sau khi Tuấn document** (2 endpoint còn empty).
  - `getAuditLogs(id)` — typed **NGAY** (`BotAuditLogOut[]`), dùng cho activity feed thay `/logs`.
- Hook poll cho từng nguồn (hoặc 1 hook gộp), cadence khác nhau (trades 3s, performance 8s, audit_logs 5s…).
- Thay các `use*` mock trong `BotMonitoringPage.tsx` (`useSnapshot`, `useFills`, `useEquityCurve`, `useCycle`) bằng nguồn thật; map BE shape → các type UI hiện có (`PerformanceSnapshot`, `Fill`, `EquityPoint` trong `bot-monitoring/types.ts`).
- Giữ Hyperliquid market data thật (`hyperliquid.service.ts`) như cũ.
- Tận dụng `/backtest/{id}/candles` cho equity curve trong `BacktestResultScreen` (Phase 3.1 nâng cao).

### 1.7. ⛔ BLOCKER còn lại — câu hỏi cuối cho Tuấn

> "Em ơi, shape JSON của 2 endpoint cuối vẫn `schema={}` trong openapi:
>
> - `GET /bot/{id}/open_trades` (hoặc nếu deprecated thì xác nhận dùng `/db_trades` — nhưng `/db_trades` cũng đang empty)
> - `GET /bot/{id}/performance`
>
> Document trong openapi hoặc gửi 1 sample response giúp anh.  
> `/audit_logs` + `/backtest/{id}/candles` đã typed rồi — FE dùng được, cảm ơn em."

→ Sau khi có 2 shape này: BE regen `openapi.json` (tốt nhất) HOẶC FE tự type từ sample.

### 1.8. Ready-to-write-a-plan khi:

- [ ] Có schema/sample cho `/open_trades` (hoặc `/db_trades`) + `/performance`. _(2 endpoint cuối)_
- [x] ~~Phase 1 đã merge (poll pattern + botApi)~~ — DONE (PR #12, awaiting code-review GO).
- [x] ~~Chốt: polling vs WS~~ — DONE: polling (WS endpoints đã removed từ spec).
- [x] ~~`results` shape~~ — RESOLVED (xem §1.5).

### 1.9. Open questions

- `/performance` có trả sẵn equity-curve series không (cho live bot), hay FE phải tự dựng từ trades? _(Cho backtest, `/backtest/{id}/candles` đã có; live monitoring chưa rõ.)_
- Auto-stop 7-day (Free) — do BE enforce hay FE chỉ hiển thị? _(Liên quan Phase 5.)_

---

## 2. PHASE 5 — Monetization (tier / paywall / billing)

### 2.1. Goal

Tier Free / Pro ($9) / Max ($15) với caps; paywall ở các điểm chặn; billing + checkout. Đây là lớp đan **xuyên suốt** Phase 2/3/4 (gate mọi action theo plan của user).

### 2.2. Business design — ĐÃ XONG, đừng làm lại

Toàn bộ pricing/tiers/funnel/positioning đã thiết kế kỹ ở:
**`docs/superpowers/specs/2026-05-21-backtest-drytest-business-model-design.md`** — có tier matrix (§4.1), gating per-feature (§8–10), paywall placements (§6.2), pricing vs competitor (§7), 6 revenue streams (§5).

Tóm tắt caps (từ doc + prototype `PaywallModal`):

|                   | Free             | Pro $9      | Max $15     |
| ----------------- | ---------------- | ----------- | ----------- |
| Backtest/tháng    | 5                | ∞           | ∞           |
| History           | 7d, candle-close | 365d + tick | 365d + tick |
| Dry-run đồng thời | 1                | 3           | 10          |
| Dry-run duration  | 7d auto-stop     | ∞           | ∞ + WS      |
| Live bots         | 0                | 1           | 5           |
| Cypheus AI        | —                | 5/tháng     | ∞           |

### 2.3. Trạng thái hiện tại

**Không có gì** — FE chưa có khái niệm tier; BE chưa có endpoint billing/subscription/usage nào (chỉ `/user/*` auth, đã deprecated cho wallet auth). Trong các plan Phase 2/3 hiện tại, mọi paywall/tier-cap đã **cố tình bỏ** (coi mọi user = không giới hạn) để không chặn build.

### 2.4. BE contract CẦN CÓ (chưa tồn tại)

- **Subscription/plan:** đọc plan hiện tại của user (`free|pro|max`), upgrade/downgrade, trạng thái thanh toán.
- **Usage tracking + enforcement:** đếm backtest/tháng, số dry-run/live đang chạy, và **enforce ở BE** (FE-only gating dễ bypass).
- **Payment:** tích hợp cổng thanh toán (Stripe? crypto? — chưa chốt), webhook xác nhận.

### 2.5. FE work outline (khi đã unblock)

- `features/billing/` store: `plan` + `usage` + caps (mirror `set-plan` reducer trong prototype, dòng ~675).
- Paywall modals: `PaywallModal` (so 3 tier), `LivePaywallModal`, upgrade prompts — port từ prototype.
- `CheckoutScreen` / `CheckoutSuccessScreen` / `BillingScreen` — port từ prototype.
- **Gating integration points** (cài vào các phase đã build):
  - Phase 2 Launchpad: card Live `gated` khi `plan==='free'` → mở paywall thay vì confirm.
  - Phase 3 Backtest: chặn khi hết 5 runs/tháng; lock 30d/365d + tick cho Free.
  - Phase 4: dry-run duration auto-stop + concurrent-bot caps.

### 2.6. ⛔ BLOCKER — quyết định + việc cần trước khi plan

1. **Product chốt pricing** (doc đề xuất Pro $9 / Max $15 — cần anh Tri/team duyệt) + payment provider.
2. **BE build** subscription + usage + enforcement + payment webhook.
3. Cho tới lúc đó: giữ stub "mọi user = free không cap" trong Phase 2/3/4.

### 2.7. Ready-to-write-a-plan khi:

- [ ] Pricing + payment provider chốt.
- [ ] BE có endpoint: get-plan, get-usage, upgrade/checkout, webhook.
- [ ] Phase 2/3/4 đã merge (để biết chính xác chỗ cài gate).

### 2.8. Open questions

- Payment: Stripe (fiat) hay on-chain (hợp với Coin98 wallet)?
- Enforcement: BE chặn cứng hay FE gate + BE audit?
- "Cancel ≠ data loss" (giữ bot 90 ngày sau hủy — business doc §6.4): BE cần soft-state.

---

## 3. Cho AI mới: bắt đầu thế nào

1. **Đọc theo thứ tự:** memory `project_bot_flow_roadmap.md` → 3 plan (1 → 3 → 2) → doc này (4, 5) → business-model doc (cho 5).
2. **Nếu được giao build:** làm Phase 1 → 3 → 2 trước (BE đủ 100%, không cần hỏi ai). Mỗi plan có TDD steps + Self-Review sẵn.
3. **Đừng động Phase 4/5 cho tới khi unblock** — gửi đúng câu hỏi BE ở §1.7, và đẩy quyết định pricing ở §2.6 cho team. Tick xong checklist "Ready-to-write-a-plan" mới viết plan TDD.
4. **Verify lại trước khi tin "blocked":** BE có thể đã regen `openapi.json` thêm schema. Chạy lại audit (grep `schema` rỗng cho open_trades/logs/performance; grep endpoint billing/subscription) trước khi kết luận.
