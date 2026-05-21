# SPEC – Trading Bot Configuration UI

> **Mục đích:** Mô tả chi tiết bản thiết kế UI cho trang cấu hình Trading Bot (dạng node-based canvas), phân tích từng tính năng, và bản đồ mapping giữa các ô input trên UI với payload JSON được gửi cho server (`payload_create_bot.json` và `payload_create_strategy.json`).

- **Phiên bản:** 1.0
- **Ngày:** 2026-04-24
- **Nguồn tham chiếu:** `Ref_screen/1_Config_bot.png` → `7_close_method_3.png`, `Comp.png`
- **Payload tham chiếu:** `BE/payload_create_bot.json`, `BE/payload_create_strategy.json`

---

## 1. Tổng quan sản phẩm

Trang web là một **bot-builder trực quan dạng flow/canvas** (giống no-code builder: n8n, Zapier, hay TradingView Pine Editor có UI). User **kéo-thả / kết nối các "node"** để xây dựng một bot giao dịch hoàn chỉnh, sau đó bấm **Deploy bot** hoặc **Backtest** để gửi cấu hình (JSON) lên server.

Tên bot (vd. *"Bollinger Breakout"*) có thể edit tại header. Hệ thống tự động lưu thay đổi (*"Changes auto-saved"*).

### Luồng node chính (trái → phải)

```
Config bot  ──►  Entry Strategy (1..N)  ──►  Direction + Order type  ──►  Close method
```

- **Config bot** (1 node duy nhất): chứa thông tin toàn cục cho bot (pair, timeframe, leverage, API key, trading mode…).
- **Entry Strategy** (có thể có nhiều): mỗi strategy là một "nhánh" với tập indicator + điều kiện vào lệnh riêng.
- **Direction / Order type**: thuộc từng Entry Strategy, quyết định Long/Short + Market/Limit.
- **Close method**: cách thoát lệnh (Manual / TP-SL / Indicator).
- **Add strategy**: tạo thêm một nhánh Entry Strategy mới song song.

---

## 2. Phân tích chi tiết từng tính năng

### 2.1 Header toolbar

| Element | Mô tả | Ghi chú |
|---|---|---|
| Bot name (`Bollinger Breakout`) | Editable text, có icon pencil | Map → `bot_name` |
| Changes auto-saved | Indicator hiển thị trạng thái lưu | Nên kèm timestamp lần lưu gần nhất |
| Close | Đóng / thoát builder | Cần confirm nếu có thay đổi chưa lưu |
| Backtest | Chạy backtest cấu hình hiện tại | Gửi cùng payload như deploy nhưng với `dry_run=true` + khoảng thời gian test |
| Deploy bot | Nút CTA chính (màu vàng) | Gửi đồng thời 2 payload: `create_bot` + `create_strategy` |

### 2.2 Node: **Config bot** (screen 1)

| Field UI | Kiểu | JSON path | Ghi chú |
|---|---|---|---|
| Pair | Dropdown có icon coin (`BTC-USDC`) | `pair` (`"BTC/USDT:USDT"`) | UI hiển thị `BTC-USDC`, nên chuẩn hóa khi gửi |
| Timeframe | Dropdown (`Select time`) | `timeframe` (`"5m"`) | Options: 1m, 5m, 15m, 30m, 1h, 4h, 1d… |
| Candle count | Number input | `configurations.startup_candle_count` (200) | Hiện đang nằm trong strategy payload |
| Leverage | Number input kèm hậu tố `x` | `leverage` (10) | Validation min 1, max theo sàn |
| Max amount margin | Number input (có icon $) | `stake_amount` (100.0) | Đơn vị: USDT |
| Trading mode | Toggle (`Live` / `Dry-run`) | `dry_run` (true/false) | Mặc định Dry-run |
| Exchange API key | Password field | (Không có trong payload mẫu – cần bổ sung) | Luôn mã hóa trước khi gửi |
| Exchange API secret | Password field | (Không có trong payload mẫu – cần bổ sung) | Luôn mã hóa trước khi gửi |

> **Suy luận thêm (cần xác nhận):** các field `exchange_name`, `stake_currency`, `max_open_trades`, `trading_mode` (`futures`/`spot`), `margin_mode` (`cross`/`isolated`), `can_short`, `liquidation_buffer`, `telegram.*` trong payload có thể nằm trong **tab/ panel settings** ẩn – UI hiện chưa show đầy đủ.

### 2.3 Node: **Entry Strategy N** (screen 2, 3, 4)

Mỗi Entry Strategy có cấu trúc:

1. **Header**: tên strategy (`Entry Strategy 1`) editable.
2. **Candlestick price data**: chọn các cột giá để dùng trong điều kiện. Chip multi-select: `Open`, `Close`, `High`, `Low`, `Volume`.
   → Map: `configurations.signals.candlestick` (vd. `["close","volume"]`).
3. **Add indicator**: mở dropdown chọn indicator (screen 3).
   Danh sách indicator hỗ trợ: **RSI, MA, MACD, Bollinger Bands, ATR, Stochastic Oscillator**… (có search box).
   Sau khi chọn, user nhập tham số (vd. `timeperiod=14` cho RSI).
   → Map: `configurations.signals.indicators[]` `{name, type, parameters}`.
4. **Add group**: tạo một "group" chứa nhiều điều kiện nhỏ được nhóm bởi logic AND/OR với threshold tùy chọn.
   → Map: `configurations.signals.entry_long.logic` + `conditions[]`.
5. Điều kiện (`conditions[]`) bao gồm: `left`, `op`, `right_type` (indicator/number/none), `right_number`, `right_indicator`, `lookback`, `operator` (AND/OR ghép giữa các điều kiện).

**Ví dụ trực quan từ JSON mẫu:**

```
candle.close   >    custom.MA200_1h   (lookback 0)
      AND
RSI-14         <    30
      AND
candle.volume  is_going_up  (+20% – percentage)
```

### 2.4 Node: **Direction + Order type** (screen 2)

| Field UI | Kiểu | JSON | Ghi chú |
|---|---|---|---|
| Direction | Toggle 2 trạng thái (`Long` / `Short`) | Điều khiển việc fill `entry_long` hay `entry_short` và cờ `can_short` | Nếu user tạo cả 2 nhánh Direction khác nhau thì bật `can_short=true` |
| Order type | Toggle (`Market` / `Limit`) | Hiện không có trong payload mẫu – cần bổ sung (vd. `order_type`) | Nếu `Limit` thì cần thêm input giá |

### 2.5 Node: **Close method** (screen 1, 2, 5, 7)

Có 3 chế độ tách biệt, hiển thị dưới dạng **tab/segment control**: `Manual`, `TP/SL`, `Indicator`.

#### 2.5.1 Manual
Không có cấu hình – user tự đóng lệnh qua dashboard.

#### 2.5.2 TP/SL (screen 5)
Panel mở rộng gồm 2 phần bật/tắt độc lập:

**Take profit** (multi-level):
- Từng level có: `profit` (%) và `amount` (% khối lượng đóng).
- Nút `+ Add another` để thêm level mới.
- → Map: `configurations.custom_exit.partial_levels[]`.

**Stop loss + Trailing stop**:
- Stop loss (-%) → `configurations.risk.stoploss` (vd. `-0.4`).
- Trailing stop (toggle) → `configurations.risk.trailing_stop`.
- Trailing positive → `trailing_stop_positive`.
- Positive offset → `trailing_stop_positive_offset`.
- Trailing only offset is reached → `trailing_only_offset_is_reached`.

#### 2.5.3 Indicator (screen 7)
Giao diện giống Entry Strategy (Add indicator / Add group) nhưng cho điều kiện **thoát lệnh**.
→ Map: `configurations.signals.exit_long.conditions[]` hoặc `exit_short`.

### 2.6 Multi-strategy (screen 4, 6)

Nút `+ Add strategy` ở cuối canvas → thêm một nhánh Entry Strategy song song.
Các strategy chia sẻ **cùng Config bot** nhưng có thể khác nhau về Direction, Order type, Close method.

**Lưu ý quan trọng:** payload mẫu hiện chỉ cho **một** `entry_long` / `entry_short`. Nếu muốn N strategy thực sự, backend cần:
- (a) Hỗ trợ gửi nhiều `payload_create_strategy`, mỗi cái attach cùng `bot_id`; hoặc
- (b) Mở rộng schema: `strategies: [ {...}, {...} ]` trong 1 request.

### 2.7 Canvas utilities (góc phải dưới)

- **+** – zoom in / add node shortcut.
- **i** – hint/info tooltip.

### 2.8 Stats dashboard (screen Comp.png)

Sau khi deploy, bot có khối số liệu runtime: *Total Profit (Change), Total Profit (Old Time), Unrealized PnL, Win Rate*, card trạng thái "Unrealized" với earning & last trade. Đây là **màn quan sát**, không phải màn cấu hình → gợi ý tách ra route riêng (`/bots/:id/dashboard`).

---

## 3. Mapping UI ↔ JSON (tổng hợp)

### 3.1 `payload_create_bot.json`

| JSON field | Nguồn input trên UI |
|---|---|
| `bot_name` | Header bot name |
| `exchange_name` | (Cần thêm UI – hiện ẩn) |
| `strategy_name` | Auto = tên strategy đầu tiên hoặc tên bot |
| `dry_run` | Config bot → Trading mode |
| `stake_currency` | Derive từ Pair (USDT/USDC) |
| `stake_amount` | Config bot → Max amount margin |
| `max_open_trades` | (Cần thêm) |
| `timeframe` | Config bot → Timeframe |
| `pair` | Config bot → Pair |
| `dry_run_wallet` | (Cần thêm – chỉ hiện khi Dry-run) |
| `trading_mode` | (Cần thêm: Spot / Futures) |
| `margin_mode` | (Cần thêm: Cross / Isolated) |
| `leverage` | Config bot → Leverage |
| `can_short` | Suy ra từ Direction = Short ở 1 strategy bất kỳ |
| `position_adjustment_enable` | (Cần thêm – advanced) |
| `telegram.*` | (Cần thêm – tab Notifications) |

### 3.2 `payload_create_strategy.json`

| JSON field | Nguồn input trên UI |
|---|---|
| `name` | Entry Strategy name |
| `strategy_type` | (Ẩn – default `statistical`) |
| `configurations.startup_candle_count` | Config bot → Candle count |
| `configurations.informative_timeframes` | Derive từ custom indicator timeframes |
| `configurations.risk.stoploss` | Close method → TP/SL → Stop loss |
| `configurations.risk.trailing_*` | Close method → TP/SL → Trailing |
| `configurations.roi_steps[]` | (Chưa có UI – đề xuất thêm panel ROI table) |
| `configurations.use_exit_signal` | Tự động = true nếu Close method = Indicator |
| `configurations.exit_profit_only` | (Advanced – cần thêm) |
| `configurations.signals.candlestick[]` | Entry Strategy → Candlestick chips |
| `configurations.signals.indicators[]` | Entry Strategy → Add indicator |
| `configurations.signals.entry_long.conditions[]` | Entry Strategy (Direction=Long) |
| `configurations.signals.entry_short.conditions[]` | Entry Strategy (Direction=Short) |
| `configurations.signals.exit_long.conditions[]` | Close method = Indicator (nhánh Long) |
| `configurations.signals.exit_short.conditions[]` | Close method = Indicator (nhánh Short) |
| `configurations.custom_indicator_items[]` | Indicator nâng cao kiểu `MA200_1h` (khi chỉ định timeframe khác) |
| `configurations.custom_exit.partial_levels[]` | Close method → TP/SL → Take profit multi-level |
| `bot_id` | Sau khi tạo bot server trả về |
| `ai_powered` | (Toggle ẩn – advanced) |

---

## 4. Gợi ý cải thiện UI/UX

### 4.1 Khả dụng (usability)

1. **Hiển thị status node:** mỗi node có border màu để biểu thị *chưa cấu hình / đã cấu hình / lỗi validation* (xám / xanh / đỏ). Hiện nay các node trông giống nhau, khó biết thiếu gì.
2. **Validate trước khi Deploy:** nút **Deploy bot** nên disable + tooltip liệt kê field còn thiếu (API key, ít nhất 1 condition, TP/SL hợp lệ…). Tránh để server reject.
3. **Preview JSON:** thêm nút **"Preview payload"** (toggle drawer) để dev/power-user nhìn trực tiếp JSON sẽ gửi → rất hữu ích khi debug cấu hình phức tạp.
4. **Keyboard shortcut** cho canvas: `Space + drag` pan, `Ctrl+scroll` zoom, `Del` xóa node, `Ctrl+D` duplicate strategy.
5. **Mini-map / breadcrumb** ở góc khi có ≥ 3 strategy – canvas dễ loạn.

### 4.2 Rõ ràng (clarity)

6. **Gom nhóm Config bot thành 2 tab:** *General* (Pair, Timeframe, Leverage) và *Connection* (API key/secret, Telegram, Notifications). Hiện tại đang dồn hết vào 1 form dài → over-scroll.
7. **Candlestick chip state:** thêm trạng thái "selected" rõ ràng (background xanh). Hiện ảnh 2 nhìn chúng giống hệt nhau dù có/không chọn.
8. **Condition builder:** khi có nhiều điều kiện AND/OR, UI hiện chỉ là danh sách → nên dùng visual group box với nhãn `AND` / `OR` ở bên như Notion filter hoặc Airtable.
9. **Indicator parameter preview:** sau khi chọn indicator (vd RSI), hiển thị ngay card "RSI-14" có thể expand để sửa `timeperiod`, `price source` – đặt inline trong node Entry Strategy.
10. **Glossary tooltip:** các thuật ngữ (`trailing_stop_positive_offset`, `roi_steps`, `lookback`, `is_going_up`) cần icon `?` kèm mô tả tiếng Việt + ví dụ.

### 4.3 An toàn (safety)

11. **Dry-run mặc định + cảnh báo đỏ khi chuyển Live**. Hiện UI đang đưa Live ngang hàng Dry-run, rủi ro user mới bấm nhầm.
12. **Masked API key** kèm nút "Test connection" – gọi endpoint verify trước khi cho Deploy.
13. **Confirm dialog** khi xóa Entry Strategy hay Indicator đã cấu hình (tránh mất dữ liệu).
14. **Undo/Redo** (`Ctrl+Z`) cho mọi thao tác trên canvas. Auto-saved tốt nhưng phải có rollback.

### 4.4 Mở rộng (nice-to-have)

15. **Template gallery**: *Bollinger Breakout*, *Mean Reversion*, *MACD Cross*… – user clone 1-click.
16. **Versioning**: mỗi lần Deploy là 1 version. So sánh diff JSON giữa các version.
17. **Backtest panel inline**: sau khi bấm Backtest, kết quả (equity curve, drawdown, win rate) hiện ra trong drawer phải – không rời canvas.
18. **Share/export**: export cấu hình ra file `.json` hoặc link share (dạng read-only) để team review.
19. **Multi-pair**: cho phép Config bot chọn nhiều pair (bỏ chọn single), UI show từng pair là 1 row nhỏ.
20. **Dark/Light theme**: hiện chỉ có dark. Một số trader thích light khi làm việc ban ngày.

### 4.5 Gaps giữa UI hiện tại và payload

Các field **có trong JSON nhưng thiếu trên UI hiện tại** (cần bổ sung):
`exchange_name`, `stake_currency`, `max_open_trades`, `trading_mode` (spot/futures), `margin_mode`, `liquidation_buffer`, `telegram.*`, `process_throttle_secs`, `roi_steps[]`, `exit_profit_only`, `exit_profit_offset`, `ignore_roi_if_entry_signal`, `position_adjustment_enable`, `cancel_open_orders_on_exit`, `ai_powered`.

Các feature **có trên UI nhưng chưa map payload rõ ràng** (cần thống nhất với backend):
`Order type = Limit` (giá chờ?), `Add group` cho condition (logic lồng nhau bao nhiêu tầng?), `lookback` input ở đâu.

---

## 5. Flow dữ liệu khi bấm **Deploy bot**

```
[UI State]
   │
   ▼
[Validator] ── fail ──► hiện lỗi inline
   │ pass
   ▼
[Serializer]
   ├── build payload_create_bot.json
   └── build payload_create_strategy.json  (N cái nếu nhiều strategy)
   │
   ▼
POST /api/bots                 → trả { bot_id }
   │
   ▼
POST /api/strategies (×N)       (mỗi request kèm bot_id ở trên)
   │
   ▼
POST /api/bots/:id/deploy       (start bot)
   │
   ▼
Navigate → /bots/:id/dashboard  (màn Comp.png)
```

---

## 6. Open questions (cần hỏi lại PM / backend)

1. 1 bot có nhiều strategy song song thì server nhận payload dạng nào (N request hay 1 request có mảng)?
2. `Order type = Limit` cần thêm giá limit / offset %. Field nào trong JSON?
3. `Add group` có hỗ trợ lồng nhau (nested group) không hay chỉ 1 tầng?
4. `custom_indicator_items` trong JSON được build từ đâu trên UI? (Có cần 1 panel "Custom indicator" riêng?)
5. Stats dashboard (Comp.png) có phải cùng trang hay route khác?
6. Quyền edit bot sau khi deploy: cho phép edit live hay phải stop?

---

*End of spec.*
