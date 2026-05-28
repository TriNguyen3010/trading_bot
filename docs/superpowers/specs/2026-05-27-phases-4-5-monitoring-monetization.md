# Phase 4 & 5 Spec — Rich Monitoring + Monetization

> **Mục đích doc này:** AI/dev mới vào đọc xong là biết ngay 2 phase còn lại (chưa có plan) là gì, đang bị chặn bởi cái gì, cần gì để bắt đầu, và viết plan TDD lúc nào. Đây là **spec (design + handoff)**, KHÔNG phải implementation plan — vì cả 2 phase còn thiếu thông tin BE nên chưa TDD được.
>
> **Last updated:** 2026-05-27

---

## 0. Bạn đang ở đâu (đọc trước)

Toàn bộ flow bot mong muốn được định nghĩa bởi prototype `public/bot-launch-prototype.html` (bản mới nhất, 4757 dòng). Đã bóc thành 6 phase:

| Phase | Nội dung                                | Trạng thái                           | Artifact                                                  |
| ----- | --------------------------------------- | ------------------------------------ | --------------------------------------------------------- |
| 0     | Submit create bot                       | ✅ **DONE trong code**               | `ExportDialog.handleSubmit` → `POST /bot-strategy/create` |
| 1     | Lifecycle (start/stop/sync/delete)      | 📝 có plan, chưa build               | `docs/superpowers/plans/2026-05-21-bot-lifecycle.md`      |
| 3     | Backtest                                | 📝 có plan, chưa build               | `docs/superpowers/plans/2026-05-27-backtest.md`           |
| 2     | Launchpad + dry-run/live                | 📝 có plan, chưa build               | `docs/superpowers/plans/2026-05-27-launchpad-dry-live.md` |
| **4** | **Rich monitoring (real-time)**         | ⛔ **CHƯA PLAN — BE chặn**           | **doc này, §1**                                           |
| **5** | **Monetization (tier/paywall/billing)** | ⛔ **CHƯA PLAN — BE + product chặn** | **doc này, §2** + business model doc                      |

**Build order đã chốt: 1 → 3 → 2 → (4, 5).** Phase 4 & 5 là cuối vì bị chặn ngoài tầm FE.

⚠️ **Lưu ý:** `CLAUDE.md §1` hiện stale — ghi Phase 0 submit "chỉ download file / đang làm", nhưng thực tế đã submit thật. Đừng tin dòng đó.

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

### 1.4. BE contract — endpoint CÓ nhưng UNTYPED (đây là blocker)

| Endpoint                | Method | Vấn đề                                      |
| ----------------------- | ------ | ------------------------------------------- |
| `/bot/{id}/open_trades` | GET    | response `schema = {}` — **không có shape** |
| `/bot/{id}/logs`        | GET    | response `schema = {}`                      |
| `/bot/{id}/performance` | GET    | response `schema = {}`                      |

Endpoint tồn tại, gọi được, trả `application/json`, nhưng **openapi.json không định nghĩa shape** → `src/types/api.d.ts` gen ra type rỗng → FE không build typed UI được.

**Control nâng cao (typed, dùng sau):** `/bot/{id}/force_entry`, `/force_exit`, `/set_stoploss`, `/test_signal` — có sẵn, để "manual intervention" sau.

**Real-time:** prototype vẽ `WS /ws/bot/{id}/info` nhưng **spec là REST-only, không có WS**. → Phase 4 dùng **polling** (tái dùng `useBotStatusPoll` pattern của Phase 1, cadence ~3s). WS chỉ làm nếu BE thêm sau.

### 1.5. Sub-gap: backtest `results` (có thể gộp vào đây hoặc Phase 3.1)

`BacktestHistoryItem.results` là `object` untyped. Metric top-level (`trade_count`, `total_profit`, `win_rate`) đã typed; nhưng **max-drawdown / Sharpe / avg-trade / equity-curve nằm trong `results`** mà BE chưa định nghĩa. Phase 3 đã render phòng thủ ("—" nếu thiếu). Khi BE document `results`, siết type trong `src/features/backtest/backtest-helpers.ts` (`extractMetrics`).

### 1.6. FE work outline (khi đã unblock)

- `bot-monitoring/monitoring.api.ts`: `getOpenTrades(id)`, `getLogs(id)`, `getPerformance(id)` (typed sau khi có schema).
- Hook poll cho từng nguồn (hoặc 1 hook gộp), cadence khác nhau (trades 3s, performance 8s…).
- Thay các `use*` mock trong `BotMonitoringPage.tsx` (`useSnapshot`, `useFills`, `useEquityCurve`, `useCycle`) bằng nguồn thật; map BE shape → các type UI hiện có (`PerformanceSnapshot`, `Fill`, `EquityPoint` trong `bot-monitoring/types.ts`).
- Giữ Hyperliquid market data thật (`hyperliquid.service.ts`) như cũ.

### 1.7. ⛔ BLOCKER — câu hỏi chính xác cho BE (Tuấn)

> "Cho mình **shape JSON** (hoặc 1 sample response thật) của 3 endpoint: `GET /bot/{id}/open_trades`, `/logs`, `/performance`, và object `results` trong `GET /backtest/{id}`. Hiện openapi.json để trống schema nên FE không gen type được."

→ Sau khi có: BE regen `openapi.json` (tốt nhất) HOẶC FE tự type từ sample + ghi chú "manual type, chờ BE".

### 1.8. Ready-to-write-a-plan khi:

- [ ] Có schema/sample cho open_trades + logs + performance (+ backtest `results`).
- [ ] Phase 1 đã merge (poll pattern + `botApi`).
- [ ] Chốt: polling (mặc định) hay chờ WS.

### 1.9. Open questions

- `/performance` có trả sẵn equity-curve series không, hay FE phải tự dựng từ trades?
- `/logs` format (free-text lines vs structured events) → quyết định activity-feed mapping.
- Auto-stop 7-day (Free) — do BE enforce hay FE chỉ hiển thị? (liên quan Phase 5).

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
