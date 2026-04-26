# UI ↔ JSON GAP ANALYSIS

> Đối chiếu từng element trong UI màn hình Builder (`2_Entry_strategy.png`) với 2 payload JSON (`payload_create_bot.json`, `payload_create_strategy.json`). Mục đích: tìm ra **field nào thừa trong UI**, **field nào thiếu trong JSON**, và **field JSON nào không có UI**.

- **Ngày:** 2026-04-24
- **UI tham chiếu:** `Ref_screen/2_Entry_strategy.png` (mặc định builder, 1 strategy)
- **JSON tham chiếu:**
  - `Data/payload_create_bot.json` (35 dòng)
  - `Data/payload_create_strategy.json` (154 dòng)

---

## 1. Tổng quan kết quả

```
┌─────────────────────────────────────────┐
│  Tổng số UI element:   ~20              │
│  ├── Match hoàn toàn:   12  ✅          │
│  ├── Match nhưng cần chuẩn hoá:  3  ⚠️  │
│  └── Không có trong JSON: 5  ❌          │
│                                         │
│  Tổng số JSON field:   ~40              │
│  ├── Có UI:             12  ✅          │
│  ├── Không có UI (ẩn hợp lý): 10 ⚪     │
│  └── Không có UI (cần bổ sung): 18 ❌   │
└─────────────────────────────────────────┘
```

**Kết luận:** UI hiện tại cover **≈ 30%** field JSON. Phần lớn field JSON (advanced settings như risk management, ROI, telegram, position adjustment…) chưa có UI tương ứng.

---

## 2. Chi tiết từng UI element

### 2.1 Header

| UI Element | JSON field | Trạng thái |
|---|---|---|
| Bot name "Bollinger Breakout" (editable) | `bot_name` (bot.json) | ✅ Match |
| "Changes auto-saved" indicator | *(không cần, UI state)* | ⚪ N/A |
| "Close" button | *(không cần, navigation)* | ⚪ N/A |
| "Backtest" button | *(action, không phải data)* | ⚪ N/A |
| "Deploy bot" button | *(action, trigger submit)* | ⚪ N/A |

### 2.2 Config bot node (collapsed trong ảnh)

| UI Element | JSON field | Trạng thái |
|---|---|---|
| "Timeframe 5m" | `timeframe: "5m"` (bot.json) | ✅ Match |
| "BTC-USDC" + icon | `pair: "BTC/USDT:USDT"` (bot.json) | ⚠️ Format khác – UI dùng `BTC-USDC`, JSON dùng `BTC/USDT:USDT`. Cần chuẩn hoá converter |
| "Leverage 20x" | `leverage: 10` (bot.json) | ⚠️ Giá trị mẫu khác, nhưng field match |
| "Live Trade" | `dry_run: true/false` (bot.json) | ⚠️ Inverse mapping: Live = `dry_run=false` |
| "$100,000" | `stake_amount: 100.0` **HOẶC** `dry_run_wallet: 1000.0`? | ❓ **Chưa rõ** – `$100,000` đang hiển thị số nào? Giá trị này khớp với `dry_run_wallet` hơn (vì là số tiền dry-run). Cần làm rõ. |

### 2.3 Entry Strategy 1 node

| UI Element | JSON field | Trạng thái |
|---|---|---|
| Tên "Entry Strategy 1" | `name` (strategy.json) | ✅ Match |
| Icon candle + text "Candlestick price data:" | *(label, không phải data)* | ⚪ N/A |
| Chip "Open" | `configurations.signals.candlestick[]` (strategy.json) | ✅ Match |
| Chip "Close" | ^ | ✅ |
| Chip "High" | ^ | ✅ |
| Chip "Low" | ^ | ✅ |
| Chip "Volume" | ^ | ✅ |
| Button "Add indicator" | `configurations.signals.indicators[]` | ✅ Match (button tạo item trong mảng) |
| Button "Add group" | `configurations.signals.entry_long.conditions[]` (với `operator: AND/OR`) | ✅ Match (nhưng schema JSON chưa hỗ trợ **nested** group rõ ràng – xem 2.7) |

### 2.4 Direction node

| UI Element | JSON field | Trạng thái |
|---|---|---|
| "Direction: Long / Short" toggle | Derive qua việc fill `entry_long.conditions[]` hoặc `entry_short.conditions[]` + `can_short: true` | ✅ Match (gián tiếp) |
| "Order type: Market / Limit" toggle | **KHÔNG CÓ** trong 2 file JSON | ❌ **Thiếu JSON** |

### 2.5 Close method node

| UI Element | JSON field | Trạng thái |
|---|---|---|
| Tab "Manual" | *(không cấu hình gì)* | ⚪ N/A |
| Tab "TP/SL" | `configurations.risk.stoploss` + `configurations.risk.trailing_*` + `configurations.custom_exit.partial_levels[]` | ✅ Match |
| Tab "Indicator" | `configurations.signals.exit_long.conditions[]` / `exit_short` | ✅ Match |
| *(thiếu)* – **tab nào đang được chọn?** | Không có field rõ ràng – derive từ việc field nào có data | ⚠️ **Implicit** – nên thêm `close_method_type: "manual" \| "tp_sl" \| "indicator"` |

### 2.6 Footer node

| UI Element | JSON field | Trạng thái |
|---|---|---|
| Button "Add strategy" | **KHÔNG CÓ** – JSON chỉ hỗ trợ 1 strategy/request | ❌ **Thiếu JSON** (xem Section 4) |

### 2.7 Canvas utilities (góc phải dưới)

| UI Element | JSON field | Trạng thái |
|---|---|---|
| "+" button (zoom in / add) | *(UI action)* | ⚪ N/A |
| "i" button (info) | *(UI action)* | ⚪ N/A |

---

## 3. Field THIẾU TRONG JSON (UI có, JSON không)

Những field này nếu muốn giữ UI như hiện tại thì **backend cần mở rộng schema**:

| # | Field cần thêm vào JSON | Lý do | Đề xuất schema |
|---|---|---|---|
| 1 | **`order_type`** | UI có toggle Market/Limit, JSON không có | Thêm vào `payload_create_bot.json` hoặc `payload_create_strategy.json.configurations`: `"order_type": "market" \| "limit"` |
| 2 | **`limit_price`** hoặc **`limit_offset_pct`** | Nếu chọn Limit thì cần giá | Chỉ required khi `order_type === "limit"`: `"limit_price": number \| null` hoặc offset % vs market |
| 3 | **`close_method_type`** | Không rõ user chọn tab Manual/TP-SL/Indicator | Thêm vào `configurations`: `"close_method_type": "manual" \| "tp_sl" \| "indicator"` |
| 4 | **Hỗ trợ nhiều strategy / request** | UI có "Add strategy" tạo N nhánh, JSON chỉ 1 | 2 phương án (xem Section 4) |
| 5 | **Nested condition group** | UI "Add group" có thể lồng nhau nhiều tầng | Schema hiện chỉ có `conditions[]` phẳng với `operator`. Cần recursive: `conditions: (Condition \| { logic, conditions[] })[]` |

**Ưu tiên:** 1 + 2 (order type) và 3 (close method type) nên làm MVP. 4 + 5 để Phase 2.

---

## 4. Vấn đề Multi-strategy (quan trọng)

UI có nút **"Add strategy"** cho phép tạo nhiều Entry Strategy song song. JSON hiện tại:

**Trong `payload_create_bot.json`:**
- `"strategy_name": "MultiTimeframe"` – **string đơn**, không phải array.

**Trong `payload_create_strategy.json`:**
- Là 1 object strategy, bên trong `signals` chỉ có 1 `entry_long` / 1 `entry_short`.
- Có `bot_id` → gợi ý relation 1 bot → N strategy.

**Ba hướng giải quyết (đã nêu trong spec gốc):**

| Hướng | Cách làm | Pros | Cons |
|---|---|---|---|
| **A** | Gửi N request `POST /strategies`, mỗi cái có cùng `bot_id` | Ít đụng schema | Không atomic, cần handle partial failure |
| **B** | Mở rộng `payload_create_strategy` thành `{ bot_id, strategies: [...] }` | Atomic, 1 request | Thay đổi schema lớn |
| **C** | Gộp vào 1 strategy với logic OR | Không đổi schema | Mất khả năng config khác nhau cho từng nhánh (Direction, Close method riêng) – **không khuyến nghị** |

**Khuyến nghị:** **A** – vì `bot_id` đã có sẵn trong schema, backend hầu như đã nghĩ theo hướng này.

---

## 5. Field THIẾU UI (JSON có, UI không hiển thị)

Phân loại theo mức độ ưu tiên:

### 5.1 Cần bổ sung UI (quan trọng) – ưu tiên cao

| JSON field | Value mẫu | Lý do cần UI |
|---|---|---|
| `bot.exchange_name` | `"binance"` | User phải chọn sàn – quan trọng |
| `bot.stake_currency` | `"USDT"` | Derive từ pair được, nhưng cần hiển thị |
| `bot.max_open_trades` | `10` | User cần kiểm soát số lệnh mở |
| `bot.dry_run_wallet` | `1000.0` | Chỉ hiện khi `dry_run=true` |
| `bot.trading_mode` | `"futures"` | Spot vs Futures – rất quan trọng |
| `bot.margin_mode` | `"cross"` | Cross vs Isolated – quan trọng với futures |
| `strategy.configurations.startup_candle_count` | `200` | UI có field "Candle count" (Config bot expanded) – cần ở đâu đó |
| `strategy.configurations.informative_timeframes` | `["1h"]` | Cần UI nếu dùng indicator đa timeframe |
| **`strategy.configurations.roi_steps`** | `[{minutes:0,roi:1.5}, ...]` | Exit by ROI rất phổ biến – **thiếu UI đáng kể** |

### 5.2 Cần UI (advanced) – ưu tiên trung bình

| JSON field | Value mẫu | Ghi chú |
|---|---|---|
| `bot.can_short` | `true` | Có thể derive từ Direction = Short |
| `bot.position_adjustment_enable` | `true` | DCA (Dollar Cost Average) – advanced |
| `bot.max_entry_position_adjustment` | `-1` | Đi kèm với DCA |
| `bot.cancel_open_orders_on_exit` | `true` | Advanced |
| `bot.telegram.*` | `{...}` | Notification settings – nên có tab riêng |
| `strategy.configurations.risk.stoploss` | `-0.4` | **Map được vào tab TP/SL** – nhưng UI screen 5 mới show |
| `strategy.configurations.risk.trailing_*` | | ^ |
| `strategy.configurations.exit_profit_only` | `true` | Advanced exit rule |
| `strategy.configurations.exit_profit_offset` | `0.05` | ^ |
| `strategy.configurations.custom_exit.partial_levels[]` | `[...]` | Multi-level TP – **có UI trong screen 5**, nhưng screen 2 chưa show |
| `strategy.configurations.custom_indicator_items` | `[...]` | Custom indicator đa timeframe (vd MA200_1h) |

### 5.3 Có thể ẩn / hardcode default – ưu tiên thấp

| JSON field | Value mẫu | Gợi ý |
|---|---|---|
| `bot.strategy_name` | `"MultiTimeframe"` | Auto = tên strategy đầu tiên, không cần UI riêng |
| `bot.liquidation_buffer` | `0.05` | Hardcode default, advanced settings |
| `bot.process_only_new_candles` | `false` | Hardcode default |
| `bot.force_entry_enable` | `false` | Hardcode default |
| `bot.process_throttle_secs` | `60` | Hardcode default |
| `strategy.description` | `null` | Optional – có thể thêm field description |
| `strategy.strategy_type` | `"statistical"` | Hardcode default (tương lai nếu có strategy_type khác mới cần UI) |
| `strategy.configurations.ignore_roi_if_entry_signal` | `false` | Advanced |
| `strategy.configurations.max_open_trades` | `-1` | Conflict với bot-level – cần thống nhất |
| `strategy.informative_ohlcv_items` | `[]` | Advanced |
| `strategy.ai_powered` | `false` | Advanced toggle |
| `strategy.bot_id` | `26` | Server trả sau khi tạo bot |

---

## 6. Vấn đề khác cần lưu ý

### 6.1 Format pair
- UI: `BTC-USDC`
- JSON: `BTC/USDT:USDT`

Format JSON là **Freqtrade convention** (`BASE/QUOTE:SETTLE`). UI cần **converter**:

```ts
// lib/pair-format.ts
"BTC/USDT:USDT" → display "BTC-USDT"
"BTC-USDT" + trading_mode=futures → "BTC/USDT:USDT"
"BTC-USDT" + trading_mode=spot    → "BTC/USDT"
```

### 6.2 Unit của stake_amount vs dry_run_wallet
- `stake_amount: 100.0` – số tiền **mỗi lệnh** đặt.
- `dry_run_wallet: 1000.0` – **tổng số dư** giả lập.
- UI hiển thị `$100,000` → không rõ là cái nào. Cần hỏi PM.

### 6.3 Leverage conflict
- UI: `Leverage 20x`
- JSON: `"leverage": 10`
Chỉ là ví dụ khác nhau trong mock – không có mâu thuẫn schema.

### 6.4 Entry Strategy tên vs JSON
- UI: `"Entry Strategy 1"`
- JSON: `name: "MultiTimeframe"` (tên strategy kỹ thuật)
Có thể là 2 cấp:
- **Display name** (hiển thị UI) vs **technical name** (dùng backend, snake_case).
- Cần thống nhất: 1 field thôi, hay 2?

### 6.5 Close method "Manual" không có field
Nếu user chọn Manual, JSON sẽ có `configurations.signals.exit_long.conditions = []` và `configurations.risk.*` dùng default. Nhưng không có flag rõ ràng. Nên thêm `close_method_type: "manual"` để rõ intent.

---

## 7. Recommendation để cover đầy đủ

### 7.1 Schema JSON cần mở rộng (backend)

```jsonc
// payload_create_bot.json – thêm
{
  // ... fields hiện có ...
  "order_type": "market",                // ❗ NEW
  "limit_offset_pct": null,              // ❗ NEW (chỉ khi order_type=limit)
  "close_method_type": "tp_sl"           // ❗ NEW (tab đang chọn)
}
```

```jsonc
// payload_create_strategy.json.configurations.signals – nested group
{
  "entry_long": {
    "logic": { "type": "AND", "threshold": null },
    "conditions": [
      // atomic condition hoặc nested group
      { "left": "...", "op": ">", ... },
      {
        "logic": { "type": "OR", "threshold": null },   // ❗ NEW nested
        "conditions": [
          { "left": "...", "op": "<", ... },
          { "left": "...", "op": ">", ... }
        ]
      }
    ]
  }
}
```

### 7.2 UI cần bổ sung (frontend)

**Trong node Config bot (expanded) thêm các field:**
- Exchange (dropdown: Binance/OKX/…)
- Trading mode (Spot/Futures toggle)
- Margin mode (Cross/Isolated toggle, chỉ khi Futures)
- Max open trades (number)
- Dry-run wallet (chỉ hiện khi Dry-run)

**Thêm panel mới "Advanced settings" (collapse default):**
- ROI steps table (add/remove level với minutes + roi%)
- Position adjustment (DCA) toggle
- Exit profit only + offset
- Telegram notification settings

**Làm rõ Close method tabs:**
- Lưu rõ tab đang chọn → `close_method_type` trong JSON

**Nested condition group:**
- "Add group" trong group đã có → cho phép lồng 1 tầng (2 level tổng)

### 7.3 UX suggestion

Chia Config bot node thành **2 tab**:
- **Basic:** Pair, Timeframe, Leverage, Max margin, Trading mode (Live/Dry-run)
- **Advanced:** Exchange, Trading mode (Spot/Futures), Margin mode, Max open trades, Dry-run wallet, Position adjustment

Hoặc dùng **"Advanced" accordion** mở ra khi cần.

---

## 8. Action items

### Immediate (cần chốt trước khi build)
- [ ] Hỏi PM: `$100,000` = `stake_amount` hay `dry_run_wallet`?
- [ ] Hỏi backend: chấp nhận thêm 3 field mới (`order_type`, `limit_offset_pct`, `close_method_type`) không?
- [ ] Hỏi backend: cho phép nested condition group không? (Nếu không → UI giới hạn 1 level)
- [ ] Chốt convention pair format: UI `BTC-USDC` ↔ JSON `BTC/USDC:USDC`

### Sprint 2 (FE)
- [ ] Bổ sung field trong Config bot node (Exchange, Trading mode, Margin mode, Max open trades, Dry-run wallet)
- [ ] Thêm `close_method_type` vào state + serializer
- [ ] Thêm Order type với Limit price conditional

### Sprint 3 (FE)
- [ ] Panel "Advanced settings" (ROI steps, telegram, DCA)
- [ ] Pair converter utility
- [ ] Validation matrix (futures bắt buộc có margin_mode, limit bắt buộc có price…)

### Phase 2
- [ ] Multi-strategy (hướng A – N request cùng bot_id)
- [ ] Nested condition group (≥ 2 level)

---

## 9. TL;DR

**Tóm tắt nhanh:**

✅ **UI và JSON match ở core:** bot_name, pair, timeframe, leverage, dry_run, candlestick chips, indicators, entry conditions, TP/SL, exit by indicator.

❌ **UI có nhưng JSON thiếu 5 thứ:**
1. Order type (Market/Limit) + limit price
2. Close method type (tab đang chọn)
3. Multi-strategy (Add strategy button)
4. Nested condition group
5. Pair format convention

❌ **JSON có nhưng UI thiếu 18 thứ quan trọng:**
- Exchange, trading mode (spot/futures), margin mode, max open trades
- Dry-run wallet, stake currency
- ROI steps (rất phổ biến)
- Telegram settings
- Advanced exit rules (exit_profit_only, offset)
- Custom indicator items
- Và nhiều field advanced khác

**Kết luận:** UI hiện tại là version rút gọn (screenshot mức intro). Để đầy đủ, cần thêm:
- 1 panel **"Advanced"** trong Config bot node (gom trading_mode, exchange, max_open_trades, telegram…)
- 1 panel **"Exit rules"** trong Close method (gom roi_steps, exit_profit_only…)
- 3 field mới trong JSON schema (order_type, limit_offset, close_method_type)

---

*End of gap analysis.*
