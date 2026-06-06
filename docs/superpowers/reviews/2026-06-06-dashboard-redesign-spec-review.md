# Dashboard Redesign Spec — Review & Fix Report

> **Ngày:** 2026-06-06
> **Spec được review:** `docs/superpowers/specs/2026-06-06-dashboard-redesign-design.md`
> **Mục tiêu report:** liệt kê các vấn đề đã verify + fix cụ thể, để agent khác **sửa SPEC** (chưa build code).
> **Nguyên tắc:** mọi finding dưới đây đã được đối chiếu trực tiếp với ground-truth, không suy đoán.

---

## 0. TL;DR cho agent fix

Spec BE-grounding tốt, **mọi số backtest §9 khớp `backtest_200.json`**. Cần sửa **1 blocker** + **5 chỗ nên sửa** + thêm **2 BE asks**. KHÔNG sửa code — chỉ chỉnh lại file spec. Sau khi sửa, spec sẵn sàng tách 2 PR để build.

Checklist sửa (theo thứ tự ưu tiên):

- [ ] 🔴 F1 — Bỏ "progress bar job %", thay bằng spinner/status text + thêm BE ask.
- [ ] 🟡 F2 — Sửa §6 dòng 162: `JobStatusResponse` không có `message`.
- [ ] 🟡 F3 — Thêm cách map job→bot + BE ask `bot_id` trên `JobResponse`.
- [ ] 🟡 F4 — Hạ `/config` xuống "untyped, parse phòng thủ" + sửa field list (pair nested, leverage/stoploss/roi có thể không có).
- [ ] 🟡 F5 — Định nghĩa cadence polling `/jobs` + chiến lược N+1 request.
- [ ] 🟡 F6 — Xác nhận `/backtest/history` không kéo blob `results` ×N.
- [ ] 🟢 F7 — Phân biệt rõ max_drawdown abs (96.93) vs % (9.53%).
- [ ] 🟢 F8 — Bổ sung điều kiện cho nhãn "New" để không dán nhầm bot đã chạy.

---

## 1. Ground-truth đã verify

| Nguồn                                     | Verify                                                                                                                                                                                                                                          |
| ----------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `BE/backtest_200.json:11,5225-5242`       | Net `-36.5899`, winrate `0.4423`, sharpe `-3.4213`, `max_drawdown_abs 96.93`, `max_drawdown_account 0.0953`, `trade_count 104`. **Tất cả số §9 khớp.** Path metrics = `results.strategy.Gamma.*`, trades = `results.strategy.Gamma.trades[]`. ✓ |
| `BE/openapi.json` paths                   | Tất cả endpoint spec dùng đều tồn tại (path param là `{bot_id}` chứ không phải `{id}`).                                                                                                                                                         |
| `BotOut`                                  | `id, bot_name, status, desired_status, error_message, strategy_name, locked_by, locked_at, last_heartbeat, created_at` — khớp §6. ✓                                                                                                             |
| `BotStatusOut`                            | `id, bot_name, status, desired_status, is_process_running, error_message, locked_by, locked_at, last_heartbeat` — khớp §6. ✓                                                                                                                    |
| `BacktestHistoryItem`                     | `id, bot_id, user_id, strategy_name, timeframe, timerange, status, trade_count, total_profit, win_rate, started_at, completed_at, results` — strip fields top-level đều có. ✓                                                                   |
| `BotAuditLogOut`                          | `id, bot_id, server_id, request_id, action, triggered_by, result, error_details, timestamp` — khớp §6. ✓                                                                                                                                        |
| `/bot/{bot_id}/performance`               | response schema = `{}` (untyped/None). Spec mô tả đúng. ✓                                                                                                                                                                                       |
| `/bot/{bot_id}/open_trades`, `/db_trades` | response schema = `{}` (untyped). Spec mô tả đúng. ✓                                                                                                                                                                                            |
| `BotConfigOut`                            | `{ config: additionalProperties=true }` — **config là dict UNTYPED** (xem F4).                                                                                                                                                                  |
| `JobStatusResponse`                       | `id, status, result, error, created_at, completed_at` — **không có `message`, không có `progress`** (xem F1, F2).                                                                                                                               |
| `JobResponse` (item của `/jobs`)          | `id, user_id, job_type, status, parameters, result, error, created_at, updated_at, completed_at` — **không có `bot_id` top-level, không có `progress`** (xem F1, F3).                                                                           |

---

## 2. Findings & fix

### 🔴 F1 — "Progress bar job %" không có nguồn BE (vi phạm ràng buộc cốt lõi)

**Ở đâu trong spec:** §5.1 bảng state matrix, dòng `Backtesting *(overlay)* … progress bar job %`; §6 Tier1 dòng `Backtest job progress | … → JobStatusResponse | status, message`.

**Bằng chứng:** `JobStatusResponse` = `id, status, result, error, created_at, completed_at`. `JobResponse` = `…, status, parameters, result, error, …`. Không field nào là `progress`/`percent`. Một thanh "%" sẽ buộc FE bịa số → vi phạm chính §3.1 ("không bịa") và spec chưa gắn nhãn `needs BE`.

**Fix spec:**

1. §5.1: đổi nội dung state Backtesting từ "progress bar job %" → **spinner indeterminate + text trạng thái** (`Backtesting…`, hiển thị `status` string: `pending`/`running`). Không hiển thị %.
2. §6 Tier1 dòng backtest job: sửa field thành `status` (bỏ `message`), ghi rõ "không có % progress".
3. Thêm vào §7 BE asks (optional): "Nếu muốn progress %, BE cần thêm field `progress` vào `JobResponse`/`JobStatusResponse`."

---

### 🟡 F2 — `JobStatusResponse` không có field `message`

**Ở đâu:** §6 Tier1 dòng `… JobStatusResponse | status, message`.

**Bằng chứng:** `JobStatusResponse` không có `message`. `message` chỉ tồn tại trên `JobSubmittedResponse` (response của `POST /backtest/start`, `POST /data/download`), với default `"Job submitted successfully"`.

**Fix spec:** §6 — bỏ `message` khỏi cột field của `JobStatusResponse`; để `status` (+ `error` khi failed). Nếu cần message lúc submit thì lấy từ `JobSubmittedResponse.message`.

---

### 🟡 F3 — Thiếu cách map job → bot (overlay Backtesting gắn vào card nào?)

**Ở đâu:** §5.1 dòng Backtesting ("từ `/jobs?job_type=backtest`"); §8 dòng `listJobs('backtest')`.

**Bằng chứng:** `/jobs` trả `JobResponse[]` nhưng **`JobResponse` không có `bot_id` top-level** — chỉ có `parameters` (dict untyped). Để biết job đang chạy thuộc bot nào (gắn overlay đúng card), FE phải parse `parameters.bot_id` (không đảm bảo tồn tại). Spec chưa mô tả bước này.

**Fix spec:**

1. §5.1 / §8: ghi rõ "map job→bot qua `parameters.bot_id` (untyped, parse phòng thủ); nếu không có → không gắn overlay".
2. Thêm BE ask #4: "Đưa `bot_id` lên top-level `JobResponse` (hoặc xác nhận `parameters.bot_id` luôn có cho job backtest)."

---

### 🟡 F4 — `/config` thực ra UNTYPED + field list §6 sai cấu trúc

**Ở đâu:** §6 Tier1 dòng `Config card … BotConfigOut.config | exchange_name, stake_currency, stake_amount, max_open_trades, dry_run, dry_run_wallet, timeframe, pair, trading_mode, margin_mode, leverage, stoploss, trailing_stop, minimal_roi`.

**Bằng chứng:**

- `BotConfigOut` = `{ config: { additionalProperties: true } }` → **config là dict untyped**, cùng tình trạng `/performance` mà spec đã cảnh báo. Spec đang trình bày `/config` "sạch" hơn thực tế.
- Field phẳng sai: code hiện tại lấy pair từ `config.exchange.pair_whitelist[0]` (`src/features/bot-monitoring/bot-list.helpers.ts:66`), **không** phải field phẳng `pair`. `exchange_name` nhiều khả năng là `exchange.name`.
- `leverage / stoploss / minimal_roi / trailing_stop`: trong Freqtrade thường nằm ở **strategy file**, không phải `config.json` → cần xác nhận có thật trong response `/config` trước khi hứa lên card.

**Fix spec:**

1. §6: chuyển ghi chú cho `/config` thành "config = dict **untyped** (`additionalProperties`), parse phòng thủ giống `/performance`".
2. Sửa field list: `pair` ← `config.exchange.pair_whitelist[0]` (nested); `exchange_name` ← `config.exchange.name`; đánh dấu `leverage/stoploss/minimal_roi/trailing_stop` là **"cần xác nhận có trong /config response"** (BE ask hoặc kiểm tra runtime), nếu không có thì render `—`/ẩn.

---

### 🟡 F5 — N+1 request + cadence polling `/jobs` chưa định nghĩa

**Ở đâu:** §10.1 (chiến lược `/performance`); §5.1 (overlay Backtesting cần `/jobs`).

**Bằng chứng:** Dashboard hiện đã gọi 1 `/config`/bot (`zipBotsAndConfigs`). Redesign cộng thêm 1 `/performance`/bot-đang-chạy + ≥1 `/jobs`. Tổng tải = `list` + N×`config` + M×`performance` + `jobs`. Spec có thừa nhận N+1 và đề xuất BE gộp vào `/bot/list` (tốt), nhưng **không nêu cadence polling `/jobs`** cũng không nói parallelize/cap.

**Fix spec:**

1. §10.1: ghi rõ "các request `/config` + `/performance` chạy song song (Promise.all), có loading skeleton per-card".
2. Thêm: cadence polling `/jobs?job_type=backtest` (vd cùng nhịp `useBotStatusPoll` hiện có, hoặc chỉ poll khi có ≥1 bot ở trạng thái có thể đang backtest). Khi không có job → không poll.

---

### 🟡 F6 — `/backtest/history` có thể kéo blob `results` ×N

**Ở đâu:** §5.1 "dải Last backtest" gọi history/bot; §6 dòng history.

**Bằng chứng:** `BacktestHistoryList.items: BacktestHistoryItem[]`, mà `BacktestHistoryItem` **chứa cả `results`** (blob ~6000 dòng như `backtest_200.json`). Nếu list endpoint populate `results` cho mỗi item → payload nặng ×N card. Spec chỉ dùng field top-level (`trade_count/total_profit/win_rate`) nên logic OK, nhưng rủi ro payload chưa được nêu.

**Fix spec:**

1. §6/§10: ghi chú "dùng `limit=1`, chỉ đọc field top-level của item, **bỏ qua `results`** cho strip".
2. BE ask (gộp vào #1 hoặc note): "xác nhận `/backtest/history` có trả `results=null` trong list view không (tránh payload nặng)".

---

### 🟢 F7 — Phân biệt max_drawdown abs vs %

**Ở đâu:** §9 testing "drawdown 96.93"; §5.2 metric "Max drawdown (abs + %)".

**Bằng chứng:** `max_drawdown_abs = 96.93` ($) nhưng `max_drawdown_account = 0.0953` = **9.53%**. Dễ nhầm render "96.93%".

**Fix spec:** §9 ghi rõ assertion: abs = `96.93` (từ `max_drawdown_abs`), % = `9.53%` (từ `max_drawdown_account`). §5.2 nhắc KPI "%" dùng `account`.

---

### 🟢 F8 — Nhãn "New" có thể dán nhầm bot đã chạy thật

**Ở đâu:** §5.1 dòng `New (presentational)` = `mode=PAUSED và /backtest/history rỗng`.

**Bằng chứng (logic):** Một bot từng chạy/giao dịch rồi pause mà **chưa từng backtest** cũng = PAUSED + history rỗng → bị gắn "New". Hiếm nhưng sai ngữ nghĩa.

**Fix spec:** thêm điều kiện phụ cho "New" (vd `created_at` gần / chưa có audit action `start` trong `/audit_logs`), hoặc chấp nhận và ghi chú giới hạn này trong §5.1.

---

## 3. BE asks cần bổ sung vào §7

- **#4 (mới):** Đưa `bot_id` lên top-level `JobResponse` (hoặc xác nhận `parameters.bot_id` luôn có cho job backtest) — để map job→bot. (F3)
- **#5 (optional):** Thêm `progress` (%) vào `JobResponse`/`JobStatusResponse` nếu muốn progress bar thật. (F1)
- **Bổ sung vào #1 hoặc note:** xác nhận field nào thực sự có trong response `/config` (đặc biệt `leverage/stoploss/minimal_roi/trailing_stop`) và `/backtest/history` có trả `results=null` trong list không. (F4, F6)

---

## 4. Scope (khuyến nghị tách build, áp dụng SAU khi sửa spec)

Spec quá lớn cho 1 PR. Đề xuất chia:

- **PR A — Dashboard overview:** `DashboardPage` (hero capital deployed, bỏ MOCK_BOTS → empty state), tách component `BotCard`, 2 helper (`deriveMode` giữ nguyên + `derivePresentationalState`), routing mọi bot vào detail, tests.
- **PR B — Bot detail:** gỡ ~4000 dòng mock trong `BotMonitoringPage` (orderbook/spot/bubble/live equity), dựng Performance panel + equity curve từ backtest, Status/Config/Activity thật, empty state, tests.

(Đây là khuyến nghị scope — agent fix chỉ cần thêm 1 mục "§ Build order: PR A → PR B" vào spec, chưa build.)

---

## 5. Việc của agent fix

1. Mở `docs/superpowers/specs/2026-06-06-dashboard-redesign-design.md`.
2. Áp 8 fix F1–F8 ở trên (chỉ sửa text spec, KHÔNG đụng code).
3. Thêm BE asks #4/#5 vào §7.
4. Thêm mục build order (PR A → PR B) vào §2 hoặc §8.
5. Báo lại diff các mục đã sửa.
