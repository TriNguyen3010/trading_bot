# Dashboard Redesign — Design Spec

> **Ngày:** 2026-06-06
> **Owner:** Tri (FE) · BE follow-up: Tuấn
> **Trạng thái:** Draft chờ review
> **Reference (mockup):**
>
> - `public/dashboard-redesign-app-style.html` — bản hoàn chỉnh, đúng design system hiện tại (canonical visual reference)
> - `public/dashboard-redesign-demo.html` — bản đầu, có chú thích nguồn dữ liệu chi tiết (provenance legend)

---

## 1. Mục tiêu

Thiết kế lại 2 màn hình **Dashboard (tổng quan)** và **Chi tiết bot** sao cho **nhiều thông tin hơn** bản hiện tại, nhưng **mọi field hiển thị phải map vào dữ liệu BE thật trả về được** — không hiển thị số bịa/mock.

Ràng buộc cốt lõi (Tri yêu cầu): _"những thông tin đưa lên phải đảm bảo BE có đủ thông tin để trả về."_

### Vấn đề của bản hiện tại

`src/pages/DashboardPage.tsx` hôm nay:

- Hero "Portfolio · 30D" lấy **số lớn = 30D PnL** nhưng giá trị luôn là `'—'` (xem `portfolioStats`, dòng 400–417) — BE chưa trả → hero trống.
- `capitalDeployed`, `tradesToday`, `tradesNet` đều `'—'`.
- `BotCard` hiển thị **PnL hero + sparkline + trades/winRate/sharpe** nhưng đó là **MOCK_BOTS** hardcode (dòng 68–127) — không phải data BE; bot thật để các field này `null` nên card trông rỗng.

Kết quả: dashboard hiện tại hoặc trống (bot thật), hoặc toàn số demo (empty state). Cần phiên bản **đầy thông tin bằng data thật**.

---

## 2. Phạm vi

### In scope

- Redesign **Dashboard overview** (`DashboardPage`): hero portfolio + grid bot card + empty state.
- Redesign **Bot detail** (thay/nâng cấp `BotMonitoringPage`): hero KPI + performance (backtest) + open positions + recent trades + status/config/activity + empty state.
- Phủ **state matrix** đầy đủ: running (dry/live), starting, stopping, backtesting, paused, new (chưa làm gì), backtest-failed, error.
- **Routing:** mở detail (`/bots/{id}`) cho **mọi bot** (kể cả PAUSED/ERROR/New), không chỉ bot đang chạy như hiện tại.
- Định nghĩa **provenance** từng field: BE có sẵn / BE cần xác nhận schema / BE cần bổ sung.
- Danh sách **BE asks** gửi Tuấn.

### Out of scope (YAGNI cho bản này)

- Real-time orderbook L2, live spot feed, gainers/losers bubble (các block mock nặng trong `BotMonitoringPage` hiện tại) — **gỡ khỏi bản redesign** vì không có nguồn BE ổn định và không phục vụ mục tiêu "thông tin có thật".
- Live equity curve realtime (chỉ làm equity curve từ **backtest** vì data có sẵn).
- Tính năng filter/sort nâng cao ngoài search hiện có.
- Monetization / phần Phase 5.

---

## 3. Nguyên tắc thiết kế

1. **BE-grounded:** mỗi con số gắn 1 field BE thật (mục §6). Field BE chưa có → render placeholder thành thật (`—`) + nhãn `needs BE`, **không bịa**.
2. **Tái dùng design system hiện tại:** tokens (`src/styles/tokens.css`), `card-coin98-flat`, `Button` variants, badge mode trong `BotCard.modeStyle`, font Inter/JetBrains Mono/Press Start 2P. Không tạo ngôn ngữ thị giác mới.
3. **Empty state không phải màn trống:** bot vừa tạo vẫn có config/status/identity thật ngay (từ `/bot-strategy/create`); chỉ performance/trades là trống → CTA đẩy user đi backtest.
4. **Performance dựa vào backtest:** dữ liệu backtest cực giàu & có sẵn (Sharpe, profit factor, drawdown, exit reasons, equity curve) → là nguồn chính cho phần hiệu suất. PnL/win-rate **live** gate sau BE.

---

## 4. Hai quyết định nâng cấp đã được duyệt

So với bản hiện tại, đổi 2 chỗ để dùng data BE thật thay cho field trống/mock:

|                 | Hiện tại               | Redesign (đã duyệt)                                       | Nguồn                                            |
| --------------- | ---------------------- | --------------------------------------------------------- | ------------------------------------------------ |
| **Hero số lớn** | 30D PnL (luôn `—`)     | **Capital deployed** = tổng `balance` của bot đang chạy   | `/bot/{id}/performance`                          |
| **Card số lớn** | PnL + sparkline (MOCK) | **Balance** (thật) + Open/Lev/Stake + dải "Last backtest" | `/performance` + `/config` + `/backtest/history` |

**30D return + trades today: ẩn hẳn ở v1** (Tier 3, chưa có BE) — thêm lại khi BE có, không để `needs BE` lủng lẳng.

---

## 5. Layout & component

### 5.1. Dashboard overview

```
┌─ AppHeader (pill nổi, giữ nguyên) ─────────────────────────┐
├─ HERO (card-coin98-flat, rounded-3xl) ─────────────────────┤
│  Capital deployed (mono 6xl)                                │
│  active/total · idle · transitioning · open trades         │
├─ Toolbar: "My bots · N total"  [search][↻][Import][New bot]│
├─ Grid 3 cột — BotCard theo state matrix ───────────────────┤
└────────────────────────────────────────────────────────────┘
```

**HERO KPI (đều từ list/config/performance — Tier 1):**

- Capital deployed = Σ `balance` bot đang chạy.
- active = count mode∈{LIVE,DRY-RUN}; total = `/bot/list`.length; idle/transitioning/error count theo `status`+`desired_status`.
- Open trades = Σ số lệnh mở (`/performance`).
- ~~30D return~~ → **ẩn v1** (Tier 3).

**BotCard** (mở rộng từ card hiện tại, giữ `card-coin98-flat rounded-2xl p-4`):

- Badge mode (giữ `modeStyle` hiện có) + tên + `pair · timeframe · created {created_at}` (**dùng `created_at`, KHÔNG dùng uptime** — BE chưa có field thời lượng chạy).
- **Số lớn = Balance** (mono, `tabular-nums`) — từ `/performance` (bot đang chạy); bot không chạy → `—`.
- Micro-stats: chỉ render ô có data từ `/config` (Open `x/max` · Leverage · Stake · Trading mode) — key nào `/config` không trả thì bỏ ô đó.
- Dải **Last backtest**: Win% · Trades · Net% (từ `/backtest/history` item mới nhất). Chưa có → "no backtest".
- Hàng action giữ logic mode hiện tại: Backtest; Start/Stop/Fix connection/Delete; STARTING/STOPPING → spinner disabled.

> **⚠️ Mode vs presentational state:** `DashboardBotMode` (từ `deriveMode`) chỉ có **6 mode lifecycle**: LIVE / DRY-RUN / PAUSED / ERROR / STARTING / STOPPING. Ba "state" dưới đây — **New, Backtesting, Backtest-failed** — KHÔNG phải mode mới; chúng là **lớp hiển thị (presentational)** suy ra từ `mode` kết hợp với _backtest history_ / _backtest job đang chạy_. Không thêm value vào `deriveMode`.

**State matrix BotCard** (9 case demo trong mockup):

| State                              | Badge              | Nội dung đặc thù                                                                        | Field quyết định                                                                                                                                                                                                                            |
| ---------------------------------- | ------------------ | --------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Running · Dry-run                  | `DRY-RUN`          | balance, open, last backtest                                                            | `status=running` + `config.dry_run=true`                                                                                                                                                                                                    |
| Running · Live                     | `LIVE` (xanh)      | balance, open, last backtest (giống Dry-run; **KHÔNG có PnL live** — BE trả N/A nên gỡ) | `dry_run=false`                                                                                                                                                                                                                             |
| Starting                           | `Starting…`        | nút disabled spinner                                                                    | `desired_status=running` + `is_process_running=false`                                                                                                                                                                                       |
| Stopping                           | `Stopping…`        | nút disabled spinner                                                                    | `desired_status=stopped` + `is_process_running=true`                                                                                                                                                                                        |
| Backtesting _(overlay)_            | `Backtesting`      | **spinner indeterminate + text `status`** (`pending`/`running`). KHÔNG có %             | **`/backtest/history?bot_id=X&limit=1` item mới nhất có `status∈{pending,running}`** (bot-scoped, không cần `/jobs`/`parameters.bot_id`)                                                                                                    |
| New _(presentational)_             | `New`              | balance `—`, "no backtest" + CTA "Run first backtest"                                   | mode=PAUSED **và** `/backtest/history` rỗng. ⚠️ Giới hạn đã biết: bot từng chạy rồi pause mà chưa từng backtest cũng rơi vào đây (hiếm) — chấp nhận ở v1, KHÔNG fetch `/audit_logs` mỗi bot chỉ để phân biệt (tránh thêm N request, xem F5) |
| Paused                             | `Paused`           | balance, last backtest, Start                                                           | mode=PAUSED (status=stopped)                                                                                                                                                                                                                |
| Backtest failed _(presentational)_ | `Paused` + errline | "Backtest #x failed: …" + Retry                                                         | mode=PAUSED **và** backtest history item mới nhất `status=failed`                                                                                                                                                                           |
| Error                              | `Error`            | errline `error_message` + Fix connection                                                | mode=ERROR (status=error)                                                                                                                                                                                                                   |

**Empty state (0 bot):** hero về 0; panel CTA "No bots yet" + "Create your first bot" / "Import" + 3 bước Build → Backtest → Dry-run/Go live. (Khác bản hiện tại: bản cũ render MOCK_BOTS làm "demo fallback" → bỏ, thay bằng empty state thật.)

### 5.2. Bot detail

```
┌─ ← Dashboard ──────────────────────────────────────────────┐
├─ HERO: name·badge·state · pair/tf/exchange · created       │
│   KPIs: Balance · Open trades · Win rate (bt) · Net (bt)    │  [Sync][Restart][Stop]
├─ 2 cột ────────────────────────────────────────────────────┤
│ LEFT                                  │ RIGHT               │
│ • Performance (backtest #N):          │ • Status & process  │
│   equity curve + 8 metric +           │ • Configuration     │
│   pills + exit reasons                │ • Activity log      │
│ • Recent trades (backtest results)    │                     │
└────────────────────────────────────────────────────────────┘
```

**Hero KPI (chỉ field BE-real):** Balance + Open trades (`/performance` — bot đang chạy, không chạy → `—`); Win rate + Net (từ **last backtest**, `/backtest/history`). **ĐÃ GỠ:** PnL today, Win-rate live (`/performance` trả N/A), uptime (không có field) — thay bằng các KPI BE-real ở trên + `created_at` ở dòng meta.

**Performance panel (nguồn chính = backtest, data có sẵn & giàu):**

- Equity curve = cộng dồn `profit_abs` theo `close_timestamp` (104 điểm, có thật trong `backtest_200.json`).
- 8 metric: Net profit, Win rate, Trades, Profit factor, Sharpe, Sortino, Max drawdown, Trades/day. ⚠️ Max drawdown: abs ($) ← `max_drawdown_abs` (vd `96.93`); % ← `max_drawdown_account` (vd `0.0953` → render `9.53%`). KHÔNG render `96.93%`.
- Pills: Long/Short split, Wins/Losses, Avg stake, Volume, Expectancy, vs Market.
- Exit reasons: bar theo `exit_reason_summary`.

**Recent trades:** bảng từ `results.trades` (backtest). _(ĐÃ GỠ panel "Open positions live" — `/open_trades` untyped, BE chưa document schema. Thêm lại khi BE có.)_

**Right column (thật ngay):** Status (`state/desired/process/last_heartbeat/error`), Configuration (render các key `/config` thực sự trả về), Activity log (`/audit_logs`).

**Empty state (bot mới):** Performance → "No backtest yet" + CTA; Recent trades → empty; Status = stopped; **Config + Activity vẫn đầy** (có ngay sau create).

---

## 6. Data provenance & field mapping

### Tier 1 — BE có sẵn, dùng ngay 🟢

| UI                                                        | Endpoint                                                                     | Field                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| --------------------------------------------------------- | ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Bot list, tên, status, error, created                     | `GET /bot/list` → `BotOut[]`                                                 | `id, bot_name, status, desired_status, error_message, strategy_name, created_at`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| State chi tiết                                            | `GET /bot/{id}/status` → `BotStatusOut`                                      | `status, desired_status, is_process_running, error_message, last_heartbeat` (KHÔNG có uptime/running-for)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| Config card, leverage, stake, pair, tf, mode              | `GET /bot/{id}/config` → `BotConfigOut.config`                               | ⚠️ **`config` = dict UNTYPED (`additionalProperties:true`)** — parse phòng thủ giống `/performance`. Field & nesting: `dry_run`, `stake_currency`, `stake_amount`, `max_open_trades`, `timeframe`, `trading_mode`, `dry_run_wallet`; **pair ← `config.exchange.pair_whitelist[0]`** (nested, đúng như `bot-list.helpers.ts:66`); exchange name ← `config.exchange.name`. **Cần xác nhận có trong response** (thường nằm ở strategy file, không phải config.json): `leverage`, `stoploss`, `trailing_stop`, `minimal_roi` → không có thì render `—`/ẩn. _(leverage/stake/max/trading_mode đã thấy hiện trong UI admin BE nên nhiều khả năng có.)_ |
| Balance, số lệnh mở                                       | `GET /bot/{id}/performance`                                                  | **CHỈ `balance` + open-trades count** (đã quan sát BE trả runtime/screenshot). ⚠️ openapi response = None (untyped) → **parse phòng thủ**, FE tự định nghĩa type tạm. **KHÔNG dùng PnL/win-rate từ endpoint này** (BE trả N/A → đã gỡ khỏi thiết kế).                                                                                                                                                                                                                                                                                                                                                                                            |
| Last backtest strip + history                             | `GET /backtest/history?bot_id={id}&limit=1` → `BacktestHistoryList`          | item: `trade_count, total_profit, win_rate, status, timerange, timeframe, started_at, completed_at`. ⚠️ `BacktestHistoryItem` **chứa cả `results` (blob ~6000 dòng)** — strip CHỈ đọc field top-level, **bỏ qua `results`**. BE ask: xác nhận list view có trả `results=null` không (tránh payload nặng ×N).                                                                                                                                                                                                                                                                                                                                     |
| Performance panel (equity, metrics, exit reasons, trades) | `GET /backtest/{backtest_id}` → `BacktestHistoryItem.results.strategy[name]` | `trades[]` (`profit_abs, profit_ratio, open/close_rate, leverage, is_short, exit_reason, funding_fees, trade_duration, close_timestamp`), `sharpe, sortino, calmar, profit_factor, expectancy, cagr, max_drawdown_abs/account, trade_count_long/short, avg_stake_amount, total_volume, exit_reason_summary, market_change`                                                                                                                                                                                                                                                                                                                       |
| (optional) Overlay giá lên equity                         | `GET /backtest/{backtest_id}/candles` → `BacktestCandlesResponse`            | candle data — nice-to-have, không bắt buộc v1                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| Activity log                                              | `GET /bot/{id}/audit_logs?limit=` → `BotAuditLogOut[]`                       | `action, triggered_by, result, error_details, timestamp`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| Backtest in-progress (badge `Backtesting`)                | `GET /backtest/history?bot_id=X&limit=1` → item `status`                     | `status∈{pending,running}` → spinner + text. Bot-scoped, đáng tin, **không cần `/jobs`**.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| Created timestamp (card meta + detail hero)               | `GET /bot/list` → `BotOut.created_at`                                        | thay cho uptime                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |

### Tier 2 / Tier 3 — ĐÃ GỠ khỏi thiết kế v1

> **Nguyên tắc (Tri, 2026-06-06):** chỉ build trên data BE đang trả. Field nào BE chưa có → **không đưa vào thiết kế**, hoặc thay bằng data BE-real khác vào đúng ô layout. Không dùng nhãn `needs BE`.

Các feature sau **đã loại khỏi v1** (xem cột "thay bằng"):

| Đã gỡ                          | Lý do BE                                              | Thay bằng (BE-real)                            |
| ------------------------------ | ----------------------------------------------------- | ---------------------------------------------- |
| PnL live / win-rate live       | `/performance` trả N/A                                | Win% + Net% từ last backtest                   |
| Uptime / "running for"         | không có field                                        | `created_at`                                   |
| Backtest progress `%`          | `JobResponse`/`JobStatusResponse` không có `progress` | spinner + `status` string (từ history)         |
| Open positions live            | `/open_trades` untyped, chưa có schema                | (gỡ panel — chỉ giữ Recent trades từ backtest) |
| Hero 30D return / trades today | không có aggregate endpoint                           | (gỡ — hero dùng capital deployed)              |

### Tier 3 — Cần BE bổ sung mới, hiện chưa có ⚪

| UI                            | Cần BE                                        |
| ----------------------------- | --------------------------------------------- |
| Hero "30D return" / "30D PnL" | Aggregate realized PnL theo cửa sổ thời gian. |
| Hero "trades today" / "net"   | Aggregate số lệnh & PnL trong ngày.           |
| Per-bot live sparkline        | Lịch sử equity/PnL live theo bot.             |

→ Tier 3 trong UI **chỉ hiển thị khi BE sẵn sàng**; trước đó để `—` + `needs BE`, hoặc ẩn.

---

## 7. BE asks (gửi Tuấn) — TƯƠNG LAI, v1 KHÔNG phụ thuộc

> v1 build hoàn toàn trên data BE đang có → **không có ask nào là blocker**. Các ask dưới đây để **mở lại** các feature đã gỡ ở §6 (PnL live, uptime, open positions, progress %, aggregate hero). Làm xong cái nào thì FE bật lại feature tương ứng.

1. **Chuẩn hoá `GET /bot/{id}/performance`** — hiện **response openapi = None (untyped)**. Đề nghị trả schema rõ ràng, tối thiểu:
   - `balance` (đang có), `open_trades_count` (đang có)
   - `total_pnl_abs`, `total_pnl_pct` (realized + unrealized) — hiện N/A
   - `win_rate`, `closed_trades_count` — hiện N/A
   - `running_seconds` hoặc `started_at` (cho uptime) — hiện chỉ thấy trong UI BE, chưa typed
   - (nice-to-have) `pnl_today_abs/pct`
2. **Document schema `GET /bot/{id}/open_trades` & `/db_trades`** (hiện response = None). Freqtrade trade fields: `pair, is_short, open_rate, current_rate, amount, leverage, profit_abs, profit_ratio, open_date, funding_fees`.
3. **(Tier 3, optional)** endpoint aggregate portfolio: 30D return, trades-today, net — phục vụ hero. Nếu chưa làm, FE ẩn các ô này (đã quyết ẩn ở v1).
4. **`bot_id` trên `JobResponse`:** đưa `bot_id` lên top-level `JobResponse` (hiện chỉ có `parameters` untyped) — hoặc xác nhận `parameters.bot_id` LUÔN tồn tại cho job backtest — để FE map job→bot, gắn overlay "Backtesting" đúng card. (F3)
5. **(optional) `progress` (%) trên `JobResponse`/`JobStatusResponse`:** nếu muốn progress bar thật cho backtest. Hiện không có field nào → FE chỉ hiển thị spinner + status text, không có %. (F1)
6. **Xác nhận `/config` response:** field nào thực sự có trong response (đặc biệt `leverage/stoploss/minimal_roi/trailing_stop` — có thể nằm ở strategy file chứ không phải config.json). (F4)
7. **`/backtest/history` payload:** xác nhận list view trả `results=null` (không kèm blob ~6000 dòng mỗi item) để tránh payload nặng ×N. (F6)

---

## 8. Component breakdown (FE)

| File                                                            | Thay đổi                                                                                                                                                                                                                                                                                                                                                                                                           |
| --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `src/pages/DashboardPage.tsx`                                   | Hero: số lớn = capital deployed; bỏ MOCK_BOTS fallback → empty state thật; `portfolioStats` đọc thêm `/performance` (chỉ bot đang chạy). **Routing: click card cho mọi bot (kể cả PAUSED/ERROR/New) vào `/bots/{id}` detail** (hiện chỉ bot đang chạy mới vào). `LaunchpadModal` GIỮ NGUYÊN (chọn dry-run/live + ví + telegram) — nay được mở từ nút "Start" trên card/detail thay vì mở trực tiếp khi click card. |
| `src/features/bot-monitoring/BotCard` (tách khỏi DashboardPage) | Số lớn = Balance; micro-stats 4 ô; dải Last backtest; render presentational overlay New/Backtesting/Backtest-failed (KHÔNG đụng `deriveMode`).                                                                                                                                                                                                                                                                     |
| `bot.api.ts`                                                    | Thêm `getPerformance(id)` (type tự định nghĩa, parse phòng thủ, **chỉ đọc balance + open-trades**), `getBacktestHistory(botId, limit=1)`, `getBacktest(backtestId)`. **KHÔNG cần `getOpenTrades` / `listJobs`** ở v1 (open positions đã gỡ; backtest-in-progress lấy từ `getBacktestHistory` status).                                                                                                              |
| `BotMonitoringPage.tsx`                                         | Gỡ block mock (orderbook/spot feed/bubble/live equity); thay Performance bằng backtest panel (equity từ `results.trades`); giữ Status/Config/Activity thật; **không có panel Open positions**; thêm empty state; xử lý được bot chưa chạy (vào từ routing mới).                                                                                                                                                    |
| `bot-list.helpers.ts`                                           | `deriveMode` GIỮ NGUYÊN 6 mode. Thêm helper riêng `derivePresentationalState(mode, { historyCount, latestStatus })` → New/Backtesting/Backtest-failed cho UI (BACKTESTING khi `latestStatus∈{pending,running}`; nguồn = `/backtest/history`, KHÔNG dùng `/jobs`).                                                                                                                                                  |
| Types                                                           | `/performance` untyped → khai báo type FE tạm (`BotPerformance`); `/backtest/*` lấy từ `api.d.ts` (`BacktestHistoryItem/List`). Regen `pnpm gen:api` sau khi BE update spec.                                                                                                                                                                                                                                       |

---

## 9. Testing

- `deriveMode` unit test: 6 mode lifecycle (status × dry_run).
- `derivePresentationalState` unit test: New (PAUSED + history rỗng) / Backtesting (có job running) / Backtest-failed (history mới nhất failed) / fallback về mode.
- BotCard render test mỗi state (badge, action buttons, empty-vs-data).
- Dashboard: empty (`/bot/list` = []) → empty state; có bot → grid + hero aggregate.
- Performance panel: parse `results.trades` → equity curve & metrics khớp số trong `backtest_200.json` (Net −36.59, win 44.23%, Sharpe −3.42). Max drawdown: assert abs = `96.93` (từ `max_drawdown_abs`) **và** % = `9.53%` (từ `max_drawdown_account` = `0.0953`) — không nhầm `96.93%`.
- `needs BE` field render `—` khi performance trả N/A (không crash).

---

## 10. Quyết định đã chốt (2026-06-06)

1. **`/performance` request strategy:** ✅ v1 **chỉ gọi `/performance` cho bot đang chạy** (LIVE/DRY-RUN) — bot paused/new/error hiển thị balance `—`. Các call `/config` + `/performance` chạy **song song** (`Promise.all`/`allSettled`), có **loading skeleton per-card** (đã có sẵn trong DashboardPage). Đề nghị Tuấn **gộp balance + open-trades vào `/bot/list`** (BE ask) để sau này chỉ cần 1 request.
   - **Polling `/jobs?job_type=backtest`** (overlay Backtesting): chỉ poll khi có ≥1 bot ở trạng thái có thể đang backtest; cùng nhịp `useBotStatusPoll` hiện có; **không có job → không poll**. (F5)
2. **Open positions live:** ✅ **GỠ HẲN panel khỏi v1** (`/open_trades` untyped). Chỉ giữ Recent trades từ backtest `results.trades`. Thêm lại khi BE document schema.
3. **Hero "30D return" + "trades today":** ✅ **gỡ hẳn**. Detail hero KPI "PnL today / Win rate live" cũng **gỡ hẳn** → thay bằng Win/Net từ last backtest (BE-real).
4. **Gỡ block mock trong `BotMonitoringPage`:** ✅ được phép gỡ orderbook L2, live spot feed, gainers/losers bubble, live equity realtime — không BE-backed.
5. **Nguyên tắc xuyên suốt (Tri):** chỉ build trên data BE **đang trả thật**. Field BE chưa có → KHÔNG đưa vào thiết kế hoặc thay bằng data BE-real khác vào ô đó. Bỏ mọi nhãn `needs BE` khỏi UI. Các field "gỡ" liệt kê ở §6 (Tier 2/3 đã gỡ).

---

## 11. Mockup tham chiếu

- **Canonical:** `public/dashboard-redesign-app-style.html` (đúng design system, EN, 4 view qua thanh "Demo views").
- Data thật nhúng từ `BE/backtest_200.json` (bot Gamma #86, backtest #200): equity curve 104 lệnh, các metric đều là số thật.

---

## 12. Build order (tách 2 PR)

Spec quá lớn cho 1 PR → tách build, mỗi PR ra phần mềm chạy được & test được:

- **PR A — Dashboard overview:** data layer dùng chung (`bot.api` methods, `parseBotPerformance`, `derivePresentationalState`, `computePortfolioStats`) + `DashboardPage` (hero capital deployed, bỏ MOCK_BOTS → empty state), tách component `BotCard`, routing mọi bot vào detail, tests.
- **PR B — Bot detail:** gỡ ~4000 dòng mock trong `BotMonitoringPage` (orderbook/spot/bubble/live equity), dựng Performance panel + equity curve từ backtest (dùng transforms `backtest-results.ts`), Status/Config/Activity thật, Open positions gated, empty state, tests.

PR A → PR B (B phụ thuộc data layer & một số helper của A). Chi tiết task xem plan `docs/superpowers/plans/2026-06-06-dashboard-redesign.md` (Phase 1+2 = PR A, Phase 3 = PR B).
