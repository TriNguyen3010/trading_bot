# API Spec — Bot & Strategy

> ✅ **BE đã share OpenAPI spec gốc**: `Data/openapi.json` (142KB, 79 schemas, OpenAPI 3.x).
> Document này được rebuild dựa trên file đó — chính xác đến từng field, type, default, enum, constraint.
>
> **Title**: `Gamma Trade Platform`, **Version**: `0.1.0`.
>
> **Endpoint chính FE phải dùng** = group `bot-strategy`:
> - `POST /bot-strategy/create` — tạo bot + strategy atomic
> - `PATCH /bot-strategy/{bot_id}` — update atomic
>
> Endpoint legacy `/bot/create`, `/strategy/create` vẫn tồn tại để backward compatibility — **FE mới KHÔNG dùng**.

---

## Mục lục

**Cho người mới (đọc lần đầu):**
- [0. Domain primer — sản phẩm này làm gì?](#0-domain-primer--sản-phẩm-này-làm-gì)
- [0.1. Glossary — thuật ngữ trading cần biết](#01-glossary--thuật-ngữ-trading-cần-biết)
- [0.2. Mental model — flow từ UI tới sàn](#02-mental-model--flow-từ-ui-tới-sàn)
- [0.3. Worked example — giải thích 1 payload thật](#03-worked-example--giải-thích-1-payload-thật)

**Reference (tra cứu):**
1. [Tổng quan & Authentication](#1-tổng-quan--authentication)
2. [POST /bot-strategy/create](#2-post-bot-strategycreate)
3. [PATCH /bot-strategy/{bot_id}](#3-patch-bot-strategybot_id)
4. [Response schemas](#4-response-schemas)
5. [`StrategyConfigurations` — chi tiết](#5-strategyconfigurations--chi-tiết)
6. [Sub-schemas tham chiếu](#6-sub-schemas-tham-chiếu)
7. [Error response (422)](#7-error-response-422)
8. [Migration từ payload cũ](#8-migration-từ-payload-cũ)
9. [Đính chính so với phân tích screenshots](#9-đính-chính-so-với-phân-tích-screenshots)
10. [Action items cho FE](#10-action-items-cho-fe)
11. [External references — đi sâu hơn](#11-external-references--đi-sâu-hơn)

> **Lần đầu đọc**: 0 → 1 → 2 → 5 (có thể skip mục 6 chi tiết). Các section còn lại tra cứu khi cần.

---

## 0. Domain primer — sản phẩm này làm gì?

**Trading bot builder** = tool cho user tạo bot giao dịch tiền điện tử **không cần code Python**.

Cụ thể:

1. User mở UI → điền form (chọn sàn, cặp coin, indicator, điều kiện vào/ra lệnh, risk).
2. FE gửi payload JSON lên BE (`POST /bot-strategy/create`).
3. **BE tự động sinh ra file code Python** (`.py`) tuân theo framework [**Freqtrade**](https://www.freqtrade.io/) — đây là trading bot framework mã nguồn mở phổ biến nhất.
4. BE start 1 process Freqtrade, load file code đó, kết nối tới sàn (Binance/Bybit/Hyperliquid...) qua thư viện **CCXT**.
5. Bot chạy 24/7: theo dõi giá, tính indicator, kiểm tra điều kiện → đặt/đóng lệnh tự động.

**Tóm gọn**: Tool này biến **JSON config** thành **Python strategy file** rồi chạy Freqtrade với strategy đó. Hiểu được lớp này là hiểu phần lớn các field trong payload (vì hầu hết field map 1-1 với config Freqtrade gốc).

### 0.1. Glossary — thuật ngữ trading cần biết

| Thuật ngữ | Giải thích ngắn |
|---|---|
| **Pair** (cặp giao dịch) | Cặp tiền user trade. Format `BASE/QUOTE` (vd `BTC/USDT` = mua/bán BTC bằng USDT). Notation `BTC/USDT:USDT` = perpetual futures. |
| **Spot** | Mua/bán coin thật, sở hữu ngay. Không có đòn bẩy. |
| **Futures** | Giao dịch hợp đồng tương lai. Có **đòn bẩy** (leverage) — vay tiền của sàn để trade lớn hơn vốn. |
| **Margin** | Tương tự futures nhưng vay coin ngay trên spot. |
| **Perpetual** | Hợp đồng futures **không có ngày đáo hạn** — phổ biến nhất trên crypto. |
| **Leverage** (đòn bẩy) | Hệ số nhân vốn (`leverage: 10` = vốn $100 → trade $1000). Lãi gấp 10 lần, nhưng lỗ cũng gấp 10 lần. |
| **Margin mode** | `cross` = dùng toàn bộ ví làm tài sản đảm bảo. `isolated` = chỉ dùng margin riêng cho từng vị thế. |
| **Liquidation** | Khi lỗ chạm ngưỡng → sàn force-close vị thế, mất toàn bộ margin. `liquidation_buffer` = đệm an toàn. |
| **Long** | Đặt lệnh **mua trước, bán sau** — kỳ vọng giá tăng. |
| **Short** | Đặt lệnh **bán trước, mua lại sau** — kỳ vọng giá giảm. **Chỉ futures/margin** mới short được (`can_short`). |
| **Stake** | Số tiền user dùng cho **1 trade**. `stake_amount: 100` = mỗi lệnh dùng 100 USDT. |
| **Stake currency** | Đồng tiền dùng để stake (USDT, USDC...). |
| **Dry run** | Chạy giả lập (paper trading) — bot decision như thật nhưng **không gửi lệnh thật** lên sàn. Dùng để test strategy. |
| **Candle / OHLCV** | 1 nến = data 1 khoảng thời gian (open/high/low/close/volume). VD nến `5m` = 5 phút. |
| **Timeframe** | Độ rộng 1 nến: `1m`, `5m`, `1h`, `1d`... Strategy hoạt động trên 1 timeframe chính. |
| **Indicator** (technical analysis) | Công thức toán biến đổi giá thành tín hiệu. VD `RSI`, `MACD`, `Bollinger Bands`. Dùng để phát hiện xu hướng / overbought / oversold. |
| **TA-Lib** | Thư viện C indicator phổ biến nhất, ~162 indicator. Tên UPPERCASE (`RSI`, `MACD`). |
| **Pandas-TA** | Thư viện indicator viết Python, tên lowercase (`rsi`, `macd`). |
| **Entry signal** | Điều kiện **vào lệnh** (mở trade). |
| **Exit signal** | Điều kiện **thoát lệnh** (đóng trade). |
| **Stoploss (SL)** | Cắt lỗ: tự động đóng trade khi lỗ chạm ngưỡng. Số âm (vd `-0.10` = 10% lỗ). |
| **Trailing stop** | SL "động": khi trade có lời, SL tự nâng lên theo, khoá phần lời lại. |
| **ROI** (Return On Investment) | Mục tiêu chốt lời. `roi_steps` = bậc thang chốt theo thời gian (mở 0 phút yêu cầu lời 10%, sau 30 phút giảm xuống 5%...). |
| **Take Profit (TP)** | Tự động đóng khi đạt mục tiêu lời. Trong Freqtrade thường được biểu diễn qua `minimal_roi`/`roi_steps`. |
| **Max open trades** | Số trade mở **đồng thời** tối đa. `-1` = không giới hạn. |
| **DCA** (Dollar Cost Averaging) | Khi trade đang lỗ, mua thêm để hạ giá vốn trung bình. Tương ứng `position_adjustment_enable`. |
| **Pyramiding** | Ngược DCA — trade đang lời thì vào thêm để tăng vị thế. |
| **Time-in-Force (TIF)** | Cách lệnh xử lý nếu không khớp: `GTC` (Good Till Cancelled), `FOK` (Fill or Kill), `IOC` (Immediate or Cancel), `PO` (Post Only). |
| **Order types** | `limit` = đặt giá cụ thể, chờ khớp. `market` = mua/bán ngay theo giá thị trường. |
| **Order book** | Sổ lệnh — danh sách bids (mua) và asks (bán) đang chờ. |
| **CCXT** | Thư viện Python kết nối tới ~100 sàn crypto qua API thống nhất. Freqtrade dùng nó. |
| **FreqAI** | Module ML của Freqtrade. Train model dự đoán giá, dùng prediction làm tín hiệu thay (hoặc kết hợp với) rule-based. |
| **Hybrid strategy** | Vừa rule-based, vừa dùng FreqAI ML model. |
| **Startup candle count** | Số nến cần warm-up trước khi bot bắt đầu trade. Indicator như RSI-14 cần ít nhất 14 nến để tính. |
| **Informative timeframe** | Timeframe phụ để strategy đọc thêm context (vd strategy 5m có thể đọc thêm 1h để biết xu hướng lớn). |

### 0.2. Mental model — flow từ UI tới sàn

```
┌────────────┐  POST /bot-strategy/create  ┌─────────────┐
│   USER     │ ───────────────────────────▶│   FE app    │
│            │                             │  (form UI)  │
└────────────┘                             └──────┬──────┘
                                                  │ JSON payload
                                                  ▼
┌──────────────────────────────────────────────────────────┐
│                       BACKEND                            │
│                                                          │
│  1. Validate payload (Pydantic)                          │
│  2. Code generator: payload → strategy.py (Freqtrade)    │
│  3. Lưu DB: bot record + strategy record                 │
│  4. Spawn process Freqtrade                              │
└──────────────────────────────────┬───────────────────────┘
                                   │
                                   ▼
┌──────────────────────────────────────────────────────────┐
│                      FREQTRADE                           │
│                                                          │
│  ┌──────────────┐    ┌──────────────┐    ┌────────────┐ │
│  │ Fetch OHLCV  │───▶│ Run strategy │───▶│ Place order│ │
│  │ from exchange│    │ (your .py)   │    │            │ │
│  └──────────────┘    └──────────────┘    └─────┬──────┘ │
│         ▲                                       │        │
└─────────┼───────────────────────────────────────┼────────┘
          │                                       │
          │ via CCXT                              │ via CCXT
          │                                       ▼
       ┌──┴────────────────────────────────────────┐
       │   EXCHANGE (Binance / Bybit / Hyperliquid)│
       └───────────────────────────────────────────┘
```

**Hệ quả với mental model:**

- Mỗi field trong payload **tương ứng 1 dòng config** trong file `config.json` của Freqtrade hoặc 1 attribute trong class strategy `.py`. Đó là lý do nhiều field optional có default — vì Freqtrade đã có default sẵn.
- **Không phải FE → BE → DB** đơn thuần như CRUD app. FE → BE **sinh code Python** → run Freqtrade. Bug có thể xảy ra ở 3 chỗ: (a) FE payload sai, (b) BE generator sai, (c) Freqtrade chạy strategy không như kỳ vọng.
- Update strategy (PATCH) phải **regenerate file `.py`** và restart Freqtrade → không phải just-update-DB.

### 0.3. Worked example — giải thích 1 payload thật

File `Data/user_2_bot_strategy_create_POST_20260428_042734.json` là log production thật (status 201 OK). Đây là 1 strategy "**ADX trending + Bollinger breakout**" trên BTC futures Hyperliquid. Mình giải thích từng phần để newcomer ngấm:

#### Phần 1 — Bot identity & exchange

```json
{
  "bot_name": "my_bot",
  "exchange_name": "hyperliquid",
  "strategy_name": "asdasd",          // ← user đặt tên random :)
  "dry_run": true,                     // paper trading, không tiền thật
  "stake_currency": "USDT",
  "stake_amount": 10.0,                // mỗi trade $10
  "max_open_trades": 7,                // tối đa 7 trade cùng lúc
  "timeframe": "5m",                   // xét nến 5 phút
  "pair": "BTC/USDT:USDT",            // BTC vs USDT, perpetual
  "dry_run_wallet": 1000.0,            // ví giả lập $1000
}
```

→ Đọc đoạn này: "Bot tên `my_bot` chạy trên Hyperliquid, paper trading với $1000 ví giả, mỗi trade $10, được mở tối đa 7 trade cùng lúc trên cặp BTC/USDT futures, xét nến 5 phút."

#### Phần 2 — Trading mode (futures + leverage)

```json
{
  "trading_mode": "futures",
  "margin_mode": "isolated",           // mỗi vị thế dùng margin riêng
  "liquidation_buffer": 0.05,          // an toàn cách giá thanh lý 5%
  "leverage": 8,                       // đòn bẩy 8x
  "can_short": true,                   // được mở short (vì futures)
  "position_adjustment_enable": false, // không DCA
}
```

→ "Futures với leverage 8x, isolated margin (mất riêng từng vị thế nếu liquidation), bot được phép short. Không DCA khi lỗ."

#### Phần 3 — Strategy logic (phần phức tạp nhất)

```json
"configurations": {
  "strategy_type": "statistical",       // rule-based, không AI
  "startup_candle_count": 20,           // warm-up 20 nến trước khi trade
  
  "risk": {
    "stoploss": -0.1,                   // SL 10%
    "trailing_stop": false
  },
  "roi_steps": [
    { "minutes": 0, "roi": 0.01 }       // chốt lời ngay 1% nếu có
  ],
  
  "signals": {
    "candlestick": ["close"],           // chỉ dùng giá close
    "indicators": [
      { "name": "ADX", "type": "talib", "parameters": { "timeperiod": 14 } },
      { "name": "BBANDS", "type": "talib", "output": "upperband",
        "parameters": { "timeperiod": 14, "nbdevup": 2.0, "nbdevdn": 2.0 } },
      { "name": "OBV", "type": "talib", "parameters": {} }
    ],
    
    "entry_long": {
      "logic": { "type": "AND", "threshold": null },
      "conditions": [
        {
          "left": "candle.close",
          "op": "crossed_above",
          "right_type": "indicator",
          "right_indicator": "BBANDS (Upper Band) - 2.0, 2.0, 14",
          "lookback": 0
        },
        {
          "left": "ADX-14",
          "op": "is_going_up",
          "right_type": "none",
          "lookback": 0,
          "percentage": 0.0,
          "operator": "AND"             // ← chỉ condition[1] trở đi mới có
        }
      ]
    }
  }
}
```

**Đọc logic này thành tiếng Việt:**

> Mở **long** khi (giá close vừa **crossed_above** đường Bollinger Upper Band 14 chu kỳ) **VÀ** (chỉ số ADX-14 đang đi lên).

→ Đây là pattern "**breakout**" — đợi giá vượt qua dải trên Bollinger (signal đột phá) **kèm** ADX tăng (xác nhận có xu hướng).

**Indicators được khai báo:**
- `ADX` — đo độ mạnh của xu hướng (không quan tâm chiều)
- `BBANDS` — Bollinger Bands, dải biến động giá. Output `upperband` = dải trên
- `OBV` — On-Balance Volume, áp lực mua/bán theo volume

`exit_long.conditions: []` rỗng → **không có exit signal**, bot chỉ thoát qua SL hoặc ROI.

#### Phần 4 — Custom exit nâng cao

```json
"custom_exit": {
  "duration_enabled": true,
  "duration_value": 24.0,
  "duration_unit": "hours",                  // exit sau 24h
  "profit_ratio_enabled": true,
  "profit_ratio": 2.0,                       // exit khi lời = 2x SL
  "max_duration_enabled": true,
  "max_duration_value": 72.0,
  "max_duration_unit": "hours",              // force-exit sau 72h
  "time_window_enabled": true,
  "time_start": "23:00",
  "time_end": "23:59",                       // chỉ exit từ 23:00-23:59 UTC
  "partial_enabled": true,
  "partial_levels": [
    { "profit": 2.0, "amount": 50.0 }        // chốt 50% khi lời 2%
  ]
}
```

→ Phức tạp, kết hợp nhiều rule exit: thời gian (24h, 72h), R:R 2x, time-window, partial exit.

#### Phần 5 — Response trả về

```json
"response": {
  "bot": { "id": 74, "bot_name": "my_bot", "status": "stopped" },
  "strategy": { "id": 18, "name": "asdasd" }
}
```

→ Bot và strategy đã được tạo (id 74 và 18). Status `stopped` — bot **chưa chạy**, user phải gọi tiếp `POST /bot/{id}/start` để start.

#### Bài học từ ví dụ này

1. Payload lớn nhưng có cấu trúc rõ: bot identity → trading mode → strategy logic → custom exit. FE form nên chia tab/step theo các nhóm này.
2. `signals.indicators[]` khai báo trước, sau đó được **reference trong conditions** qua format đặc biệt (`"BBANDS (Upper Band) - 2.0, 2.0, 14"`).
3. `entry_*`/`exit_*` rỗng `[]` là hợp lệ — nghĩa là không signal cho hướng đó.
4. `custom_exit` là layer phụ trên `roi_steps` + `risk.stoploss` — chồng nhau, BE handle priority nội bộ.

---

## 1. Tổng quan & Authentication

- **Auth**: `OAuth2PasswordBearer` (Bearer token trong header `Authorization`).
- **Content-Type**: `application/json`.
- **Atomic guarantee**: Either both records (bot + strategy) are created and all files written, or neither is — no partial state.
- **Toàn bộ endpoints** được liệt kê trong file `openapi.json` (15 group, ~50 endpoint). Document này chỉ cover group `bot-strategy`.

---

## 2. POST /bot-strategy/create

**Schema**: `UnifiedBotStrategyCreate` → response `BotStrategyOut` (`201`)

### 2.1. Required fields (9)

| # | Field | Type | Constraints | Mô tả |
|---|---|---|---|---|
| 1 | `bot_name` | string | `minLength: 1` | Tên bot human-readable. Examples: `my_bot`. |
| 2 | `exchange_name` | string | `minLength: 1` | Exchange ID theo CCXT. Examples: `binance`, `bybit`, `hyperliquid`. |
| 3 | `strategy_name` | string | `minLength: 1` | Class name strategy (cũng dùng làm tên record DB). Examples: `SampleStrategy`, `MyCustomStrategy`. |
| 4 | `dry_run` | boolean | — | `true` = paper trading; `false` = live. |
| 5 | `stake_currency` | string | Enum: `USDT`, `USDC`, `BTC`, `ETH`, `BNB`, `BUSD` | Quote currency. |
| 6 | `stake_amount` | number \| `"unlimited"` | number: `> 0`; string: const `"unlimited"` (case-sensitive) | Stake mỗi trade. |
| 7 | `max_open_trades` | integer | `>= -1` | Số trade đồng thời. `-1` = unlimited. |
| 8 | `timeframe` | string | Enum (xem 2.3) | Khung thời gian nến. |
| 9 | `pair` | string | Format `BASE/QUOTE` | Cặp giao dịch (ví dụ `BTC/USDT`). BE convert thành list internally. |

### 2.2. Optional fields (36)

| Field | Type | Default | Constraints | Mô tả |
|---|---|---|---|---|
| `exchange` | object \| null | — | `additionalProperties: true` | Legacy full exchange config. Field con override default. |
| `dry_run_wallet` | number \| null | 1000 | `>= 0` | Wallet giả lập trong dry-run. |
| `fiat_display_currency` | string \| null | `"USD"` | Enum (xem 2.4) | Tiền tệ hiển thị PnL. |
| `stoploss` | number \| null | null | `< 0` (exclusiveMaximum: 0) | Tỉ lệ SL âm (`-0.10` = 10%). |
| `trailing_stop` | boolean \| null | null | — | Bật trailing SL. |
| `trailing_stop_positive` | number \| null | null | `0–1` | Trailing offset khi đã có lời. |
| `trailing_stop_positive_offset` | number \| null | null | `0–1` | Profit ratio min trước khi `trailing_stop_positive` kích hoạt. |
| `trailing_only_offset_is_reached` | boolean \| null | null | — | Trailing chỉ kích hoạt sau khi đạt offset. |
| `minimal_roi` | object\<string, number\> \| null | null | Map `minutes -> roi` | Ví dụ `{"0": 0.10, "30": 0.05}`. |
| `use_exit_signal` | boolean \| null | null | — | Dùng exit signal của strategy. |
| `exit_profit_only` | boolean \| null | null | — | Bỏ qua exit signal khi lỗ. |
| `exit_profit_offset` | number \| null | null | — | Profit ratio min trước khi exit signal được áp dụng. |
| `ignore_roi_if_entry_signal` | boolean \| null | null | — | Không exit theo ROI khi có entry signal mới. |
| `ignore_buying_expired_candle_after` | number \| null | null | — | Số giây sau khi candle close mà entry signal cũ bị bỏ qua. |
| `trading_mode` | string \| null | `"spot"` | Enum: `spot`, `margin`, `futures` | Loại thị trường. |
| `margin_mode` | string \| null | null | Enum: `cross`, `isolated` | **Required** khi `trading_mode = futures` hoặc `margin`. |
| `liquidation_buffer` | number \| null | null | `0.0–1.0` | Buffer khỏi giá thanh lý (futures only). |
| `leverage` | integer \| null | 1 | `1–125` | Đòn bẩy futures/margin. |
| `can_short` | boolean \| null | futures: true; spot: false | — | Cho phép short. |
| `position_adjustment_enable` | boolean \| null | null | — | Bật DCA. |
| `max_entry_position_adjustment` | integer \| null | null | `>= -1` | Số entry bổ sung tối đa. `-1` = unlimited. |
| `cancel_open_orders_on_exit` | boolean \| null | false | — | Hủy mọi open order khi bot dừng. |
| `process_only_new_candles` | boolean \| null | null | — | Chỉ chạy strategy trên nến mới. |
| `force_entry_enable` | boolean \| null | null | — | Cho phép force-entry qua Telegram/API. |
| `unfilledtimeout` | `UnfilledTimeoutConfig` \| null | null | — | Xem 6.6. |
| `entry_pricing` | `EntryPricingConfig` \| null | null | — | Xem 6.7. |
| `exit_pricing` | `ExitPricingConfig` \| null | null | — | Xem 6.8. |
| `order_types` | `OrderTypesConfig` \| null | null | — | Xem 6.9. |
| `order_time_in_force` | `OrderTimeInForceConfig` \| null | null | — | Xem 6.10. |
| `telegram` | `TelegramConfig` \| null | null | — | Xem 6.11. |
| `freqai` | `FreqAIConfig` (bot version) \| null | null | — | Xem 6.12.A. ⚠️ Schema này **khác** với `freqai` trong `StrategyConfigurations`. |
| `process_throttle_secs` | integer \| null | null | — | Số giây min giữa các vòng lặp bot. |
| `strategy_description` | string \| null | null | — | Mô tả strategy. |
| `strategy_type` | string | `"statistical"` | Enum: `statistical`, `ai_powered`, `hybrid` | Cách generate strategy. |
| `configurations` | `StrategyConfigurations` | — | — | **Object lớn** chứa toàn bộ logic strategy. Xem mục 5. |
| `ai_powered` | boolean | false | — | ⚠️ **Deprecated** — dùng `strategy_type='ai_powered'` thay thế. |

### 2.3. Enum `timeframe` (top-level)

`"1m"`, `"3m"`, `"5m"`, `"15m"`, `"30m"`, `"1h"`, `"2h"`, `"4h"`, `"8h"`, `"12h"`, `"1d"`, `"3d"`, `"1w"`

> ⚠️ **`StrategyConfigurations.timeframe` có thêm `"6h"`** mà top-level không có (xem 5).

### 2.4. Enum `fiat_display_currency` (39 values)

Fiat: `AUD`, `BRL`, `CAD`, `CHF`, `CLP`, `CNY`, `CZK`, `DKK`, `EUR`, `GBP`, `HKD`, `HUF`, `IDR`, `ILS`, `INR`, `JPY`, `KRW`, `MXN`, `MYR`, `NOK`, `NZD`, `PHP`, `PKR`, `PLN`, `RUB`, `UAH`, `SEK`, `SGD`, `THB`, `TRY`, `TWD`, `ZAR`, `USD`

Crypto: `BTC`, `ETH`, `XRP`, `LTC`, `BCH`, `BNB`

Default: `"USD"`.

### 2.5. Request sample (minimal)

```json
{
  "bot_name": "my_firstbot",
  "dry_run": true,
  "exchange_name": "binance",
  "max_open_trades": 3,
  "pair": "BTC/USDT",
  "stake_amount": 10,
  "stake_currency": "USDT",
  "strategy_name": "SampleStrategy",
  "timeframe": "5m"
}
```

---

## 3. PATCH /bot-strategy/{bot_id}

**Path param**: `bot_id` (integer, required).
**Body schema**: `UnifiedBotStrategyUpdate` → response `BotStrategyOut` (`201`).

Tất cả field đều **optional** (omit = giữ nguyên):

| Field | Type | Mô tả |
|---|---|---|
| `strategy_name` | string \| null | Đổi tên strategy (phải là Python identifier hợp lệ). |
| `strategy_description` | string \| null | Mô tả mới. |
| `strategy_type` | string \| null | Enum: `statistical`, `ai_powered`, `hybrid`. |
| `strategy_configurations` | `StrategyConfigurations` \| null | **Trigger regenerate file strategy** + sync settings ngược về `config.json`. |
| `ai_powered` | boolean \| null | ⚠️ Deprecated. |
| `pair` | string \| null | Cặp trading mới. |
| `stake_currency` | string \| null | (PATCH **không enforce enum** — top-level required field thì có) |
| `stake_amount` | number \| null | `> 0`. |
| `max_open_trades` | integer \| null | `>= -1`. |
| `dry_run` | boolean \| null | — |
| `timeframe` | string \| null | (PATCH **không enforce enum**) |
| `optional` | object \| null | `additionalProperties: true`. Quy tắc merge ở dưới. |

### 3.1. Quy tắc merge của `optional`

Object `optional` cho phép gửi config bổ sung không có ở top-level. Quy tắc BE:

- **Simple keys** → áp dụng trực tiếp vào bot config.
- **`config_overrides`** (nested dict) → **deep-merged** vào bot config.
- **`telegram`**, **`discord`**, **`webhook`**, **`freqai`** → merged vào section tương ứng (không override toàn bộ).

---

## 4. Response schemas

### 4.1. `BotStrategyOut` (response cho cả 2 endpoint atomic)

```ts
{
  bot: BotOut          // required
  strategy: StrategyOut // required
}
```

### 4.2. `BotOut`

| Field | Type | Required |
|---|---|---|
| `id` | integer | ✅ |
| `bot_name` | string \| null | ❌ |
| `status` | string | ✅ |
| `desired_status` | string \| null | ❌ |
| `error_message` | string \| null | ❌ |
| `strategy_name` | string \| null | ❌ |

### 4.3. `StrategyOut`

| Field | Type | Required | Mô tả |
|---|---|---|---|
| `id` | integer | ✅ | |
| `bot_id` | integer | ✅ | FK tới bot |
| `name` | string | ✅ | |
| `description` | string \| null | ❌ | |
| `configurations` | object \| null | ❌ | `additionalProperties: true` — full StrategyConfigurations |
| `ai_powered` | boolean | ✅ | |
| `strategy_type` | string | ✅ | Default `"statistical"` |
| `is_active` | boolean | ✅ | |
| `created_at` | string \| null | ❌ | format: `date-time` ISO 8601 |
| `updated_at` | string \| null | ❌ | format: `date-time` ISO 8601 |

---

## 5. `StrategyConfigurations` — chi tiết

> Object lớn nhất, chứa toàn bộ logic strategy. **Mọi field optional, có default an toàn.**
> Chỉ truyền field nào muốn khác default.

| Field | Type | Default | Constraints | Mô tả |
|---|---|---|---|---|
| `interface_version` | integer | 3 | `2–3` | Freqtrade IStrategy version. Stable hiện tại: 3. |
| `strategy_type` | string | `"statistical"` | Enum: `statistical`, `ai_powered`, `hybrid` | ⚠️ **Cùng tên với top-level** — cần truyền cả 2 chỗ hoặc chỉ 1. Spec không nói rõ ưu tiên cái nào. |
| `timeframe` | string | `"5m"` | Enum 14 giá trị (có `6h`) | Khung nến chính cho `populate_indicators()`. |
| `startup_candle_count` | integer | 200 | `>= 1` | Số nến warmup tối thiểu. |
| `process_only_new_candles` | boolean | true | — | Chỉ chạy khi nến mới close. |
| `informative_timeframes` | string[] | `[]` | Mỗi item enum 14 giá trị | Timeframes phụ (ví dụ `["1h", "4h"]`). FT thêm cột `close_1h`, `high_4h`. |
| `can_short` | boolean | false | — | Cho phép short. Yêu cầu `trading_mode=futures` + `margin_mode=isolated`. |
| `risk` | `RiskConfig` | — | Xem 6.4 | Stop-loss + trailing settings. |
| `roi_steps` | `ROIStep[]` | `[]` | Xem 6.5 | Time-based ROI. Default fallback `{0: 0.10}` khi rỗng. |
| `use_exit_signal` | boolean | true | — | |
| `exit_profit_only` | boolean | false | — | |
| `exit_profit_offset` | number | 0.0 | `>= 0` | |
| `ignore_roi_if_entry_signal` | boolean | false | — | |
| `max_open_trades` | integer \| null | null | `>= -1` | Override bot-level. null = inherit từ bot config. |
| `signals` | `SignalsConfig` | — | Xem 6.1 | Entry/exit conditions + indicators. |
| `custom_indicator_items` | `CustomIndicatorItem[]` | `[]` | Xem 6.3 | Custom indicators tính trước TA. |
| `informative_ohlcv_items` | string[] | `[]` | — | Cột OHLCV informative, ví dụ `"1h.close"`. |
| `freqai` | `FreqAIConfig` (strategy version) | — | Xem 6.12.B | **KHÁC** với `freqai` top-level. |
| `custom_exit` | `CustomExitConfig` | — | Xem 6.2 | Logic exit nâng cao. |
| `leverage` | number | 1.0 | `>= 1.0` | Default leverage. |
| `position_adjustment_enable` | boolean | false | — | DCA. |
| `max_entry_position_adjustment` | integer | -1 | `>= -1` | -1 = unlimited. |

---

## 6. Sub-schemas tham chiếu

### 6.1. `SignalsConfig`

| Field | Type | Mô tả |
|---|---|---|
| `candlestick` | string[] | Cột OHLCV cần (ví dụ `["close", "volume"]`). |
| `indicators` | `IndicatorItem[]` | Indicators tính trong `populate_indicators()`. |
| `entry_long` | object \| null | Condition tree (AND/OR) — `additionalProperties: true`. ⚠️ **BE không define schema cụ thể cho condition tree** — FE tự build cấu trúc nested. |
| `exit_long` | object \| null | Condition tree cho long exit. |
| `entry_short` | object \| null | Condition tree cho short entry (cần `can_short=true`). |
| `exit_short` | object \| null | Condition tree cho short exit. |

> ⚠️ **Quan trọng**: `entry_long`, `exit_long`, `entry_short`, `exit_short` là **free-form object** trong spec. BE chỉ ghi: *"Nested structure produced by the UI condition builder."* Cấu trúc cụ thể (`type: "AND"|"OR"`, `conditions: [...]`, `left`, `op`, `right_*`, `lookback`, `operator`, `percentage`) là **convention nội bộ giữa FE và BE code generator** — KHÔNG được validate ở schema layer. FE phải đảm bảo đúng format khi gửi.

### 6.2. `IndicatorItem`

| Field | Type | Required | Default | Mô tả |
|---|---|---|---|---|
| `name` | string | ✅ | — | Tên indicator (RSI, MACD, SUPERTREND, ...). `minLength: 1`. |
| `type` | string | ❌ | `"talib"` | Library: `talib` hoặc `pandas_ta`. |
| `output` | string \| null | ❌ | null | Cột chọn khi TA-Lib trả nhiều output (ví dụ `"real"`, `"upperband"`). |
| `parameters` | `IndicatorParameter` \| null | ❌ | null | Params truyền vào hàm indicator. |
| `pandas_ta_func` | string \| null | ❌ | null | Tên accessor pandas_ta khi `type="pandas_ta"`. |
| `requires_datetime_index` | boolean | ❌ | false | Set true cho pandas_ta indicators cần DatetimeIndex (VWAP). |
| `timeframe` | string \| null | ❌ | null | Informative timeframe (vd `"1h"`). |

### 6.2.1. Catalog indicator hỗ trợ — TA-Lib & Pandas-TA

Khi user thêm 1 `IndicatorItem` vào strategy, FE cần biết indicator nào hợp lệ + cần input/parameters gì. BE đã cung cấp 2 file catalog đầy đủ:

| File | Số indicator | Categories | Naming convention |
|---|---|---|---|
| `Data/TALib_Documentation (1).md` | **162** | 10 nhóm | **UPPERCASE** (`RSI`, `MACD`, `BBANDS`, ...) |
| `Data/PandasTA_Documentation (1).md` | **121** ⚠️ | 5 nhóm | **lowercase** (`rsi`, `macd`, `bbands`, ...) |

> ⚠️ **Discrepancy**: Header file PandasTA ghi *"Total Indicators: 227"* nhưng table thực tế chỉ có **121 row**. Cần BE confirm con số đúng.

#### File JSON catalog (đã parse sẵn)

Để FE dùng trực tiếp, mình đã convert 2 file MD sang JSON có cấu trúc:

- `Data/indicators_talib.json` — 162 indicators
- `Data/indicators_pandas_ta.json` — 121 indicators

**Schema mỗi indicator:**

```ts
{
  name: string;                  // Tên function. UPPERCASE cho talib, lowercase cho pandas_ta
  description: string;
  inputs: {
    ohlcv: string[];             // Field OHLCV cần: ["open","high","low","close","volume"] hoặc ["price"] (generic)
    params: Array<{              // Parameters với default
      name: string;              // "length", "fast", "slow", "signal", "std_dev", ...
      default: number | string;
    }>;
  };
  returns_count: number;         // 1, 2, 3, hoặc 5 — số array indicator trả về
  outputs: Array<{               // Mảng output keys, length === returns_count
    key: string;                 // VD: "real" (single), "macd"/"macdsignal"/"macdhist" (multi)
    description: string;
  }>;
}
```

**Schema file top-level:**

```ts
{
  source: "talib" | "pandas_ta";
  total: number;                 // declared total từ header
  version?: string;              // chỉ pandas_ta có
  categories: Array<{
    name: string;                // VD: "Momentum Indicators", "Pattern Recognition"
    count: number;               // declared count
    indicators: IndicatorItem[];
  }>;
}
```

#### Phân bổ category

**TA-Lib (162 indicators)**:

| Category | Count |
|---|---|
| Cycle Indicators | 5 |
| Math Operators | 11 |
| Math Transform | 15 |
| Momentum Indicators | 31 |
| Overlap Studies | 19 |
| Pattern Recognition | 61 |
| Price Transform | 5 |
| Statistic Functions | 9 |
| Volatility Indicators | 3 |
| Volume Indicators | 3 |

**Pandas-TA (121 indicators)**:

| Category | Count |
|---|---|
| Momentum | 35 |
| Moving Average | 41 |
| Volume | 12 |
| Volatility | 12 |
| Other | 21 |

#### Phân bổ multi-output

Khi `returns_count > 1`, FE **bắt buộc** cho user chọn `IndicatorItem.output` (key trong mảng `outputs`).

| Source | 1 array (output mặc định "real") | 2 arrays | 3 arrays | 5 arrays |
|---|---|---|---|---|
| TA-Lib | 148 | 9 | 5 | 0 |
| Pandas-TA | 94 | 15 | 10 | 2 |

**Ví dụ multi-output**:
- `MACD` (talib, 3 arrays): `macd`, `macdsignal`, `macdhist`
- `BBANDS` (talib, 3 arrays): `upperband`, `middleband`, `lowerband`
- `bbands` (pandas_ta, 5 arrays): `bbl`, `bbm`, `bbu`, `bbb`, `bbp`
- `STOCH` (talib, 2 arrays): `slowk`, `slowd`
- `aroon` (pandas_ta, 2 arrays): `aroondown`, `aroonup`

#### Cách FE dùng

1. **UI indicator picker**: Khi user bấm "Add Indicator":
   - Toggle source: TA-Lib hay Pandas-TA → load `indicators_talib.json` hoặc `indicators_pandas_ta.json`.
   - Show search + dropdown phân theo category.
   - Khi chọn indicator: render form params từ `inputs.params[]` với default value.
   - Nếu `returns_count > 1`: **bắt buộc** show dropdown chọn `output.key`.

2. **Mapping vào `IndicatorItem` payload**:

```ts
// User chọn TA-Lib RSI period 14
{
  name: "RSI",                    // từ catalog.indicators[].name
  type: "talib",                  // tương ứng catalog source
  output: null,                   // returns_count=1 nên không cần
  parameters: { timeperiod: 14 }  // mapping name → IndicatorParameter field
}

// User chọn TA-Lib MACD output "macdhist"
{
  name: "MACD",
  type: "talib",
  output: "macdhist",             // returns_count=3 → bắt buộc chọn
  parameters: { fastperiod: 12, slowperiod: 26, signalperiod: 9 }
}

// User chọn Pandas-TA bbands output "bbu"
{
  name: "bbands",
  type: "pandas_ta",
  output: "bbu",
  pandas_ta_func: "bbands",       // bằng name khi không có alias
  parameters: { length: 20 }
}
```

#### Mapping param name từ catalog → `IndicatorParameter` schema

Catalog dùng tên thật của indicator (ví dụ `length`, `fast`, `slow`, `std_dev`), trong khi `IndicatorParameter` schema (mục 6.3) chỉ có 9 field cố định. Mapping cần làm phía FE:

| Catalog param name | IndicatorParameter field |
|---|---|
| `length`, `period`, `timeperiod` | `timeperiod` |
| `fast`, `fastperiod` | `fastperiod` |
| `slow`, `slowperiod` | `slowperiod` |
| `signal`, `signalperiod` | `signalperiod` |
| `k`, `fastk_period` | `fastk_period` |
| `d`, `fastd_period` | `fastd_period` |
| `std_dev`, `nbdevup` | `nbdevup` |
| `nbdevdn` | `nbdevdn` |
| `window` | `window` |

⚠️ **Vấn đề**: Catalog có **rất nhiều param name** mà `IndicatorParameter` schema **không cover** (ví dụ `matype`, `scalar`, `offset`, `bb_length`, `kc_length`, `roc1`, `roc2`, `sma1`, ...). Nghĩa là một số indicator phức tạp **không thể truyền đầy đủ params** qua schema hiện tại.

→ **Cần BE confirm**: chỉ support subset 9 param này, hay sẽ mở rộng `IndicatorParameter` schema?

### 6.3. `IndicatorParameter`

| Field | Type | Mô tả |
|---|---|---|
| `timeperiod` | integer \| null (`>= 1`) | Lookback. |
| `window` | integer \| null (`>= 1`) | Rolling window (Ichimoku). |
| `nbdevup`, `nbdevdn` | number \| null | Standard deviations (BBANDS). |
| `fastperiod`, `slowperiod`, `signalperiod` | integer \| null (`>= 1`) | MACD/STOCH. |
| `fastk_period`, `fastd_period` | integer \| null (`>= 1`) | STOCHRSI. |

### 6.4. `CustomIndicatorItem`

| Field | Type | Required | Default | Constraints | Mô tả |
|---|---|---|---|---|---|
| `name` | string | ✅ | — | `minLength: 1` | Tên cột trong DataFrame. |
| `source_type` | string | ❌ | `"ohlcv"` | Enum: `ohlcv`, `indicator` | Nguồn dữ liệu. |
| `source_col` | string \| null | ❌ | null | — | Required khi `source_type="indicator"`. |
| `source_field` | string | ❌ | `"close"` | — | OHLCV field (`open/high/low/close/volume`) hoặc indicator key. |
| `source_timeframe` | string \| null | ❌ | null | — | Informative timeframe (vd `"1h"`). |
| `operation` | string | ❌ | `"rolling_max"` | Enum: `rolling_max`, `rolling_min`, `rolling_mean`, `rolling_std`, `rolling_sum`, `shift`, `pct_change`, `diff` | Phép biến đổi. |
| `period` | integer | ❌ | 20 | `>= 1` | Window/shift/lookback. |

### 6.5. `RiskConfig`

| Field | Type | Default | Constraints | Mô tả |
|---|---|---|---|---|
| `stoploss` | number | -0.1 | `< 0` | SL ratio âm. |
| `trailing_stop` | boolean | false | — | |
| `trailing_stop_positive` | number \| null | null | `0 < x <= 1` | Phải > 0 (Freqtrade requirement). |
| `trailing_stop_positive_offset` | number \| null | null | `0 < x <= 1` | Phải > `trailing_stop_positive`. |
| `trailing_only_offset_is_reached` | boolean | false | — | |

### 6.6. `ROIStep`

| Field | Type | Required | Constraints |
|---|---|---|---|
| `minutes` | integer | ✅ | `>= 0` |
| `roi` | number | ✅ | `>= 0` (ratio 0–1) |

### 6.7. `CustomExitConfig`

| Field | Type | Default | Mô tả |
|---|---|---|---|
| `duration_enabled` | boolean | false | Exit sau thời gian/nến cố định. |
| `duration_value` | number | 24 | `> 0`. |
| `duration_unit` | string | `"hours"` | Enum: `hours`, `days`, `candles`. |
| `profit_ratio_enabled` | boolean | false | Exit khi profit đạt `R:R` của SL. |
| `profit_ratio` | number | 2.0 | `> 0`. |
| `max_duration_enabled` | boolean | false | Force-exit sau max duration. |
| `max_duration_value` | number | 72 | `> 0`. |
| `max_duration_unit` | string | `"hours"` | Enum: `hours`, `days`, `candles`. |
| `time_window_enabled` | boolean | false | Exit chỉ trong window. |
| `time_start` | string | `"23:00"` | Pattern `^\d{2}:\d{2}$` (UTC). |
| `time_end` | string | `"23:59"` | Pattern `^\d{2}:\d{2}$` (UTC). |
| `partial_enabled` | boolean | false | Partial exit qua `adjust_trade_position()`. Yêu cầu `position_adjustment_enable=true`. |
| `partial_levels` | `CustomExitPartialLevel[]` | `[]` | Cặp profit/amount. |

### 6.8. `CustomExitPartialLevel`

| Field | Type | Required | Constraints | Mô tả |
|---|---|---|---|---|
| `profit` | number | ✅ | `> 0` | % profit (1.5 = 1.5%). |
| `amount` | number | ✅ | `0 < x <= 100` | % stake còn lại (50 = 50%). |

### 6.9. `UnfilledTimeoutConfig`

| Field | Type | Required | Default | Constraints | Mô tả |
|---|---|---|---|---|---|
| `entry` | number | ✅ | — | `>= 1` | Timeout entry (theo `unit`). |
| `exit` | number | ✅ | — | `>= 1` | Timeout exit. |
| `exit_timeout_count` | number | ❌ | 0 | `>= 0` | Số retry exit. 0 = unlimited. |
| `unit` | string | ❌ | `"minutes"` | Enum: `minutes`, `seconds` | Đơn vị thời gian. |

### 6.10. `EntryPricingConfig` / `ExitPricingConfig`

Hai schema gần giống nhau:

| Field | Type | Default | Constraints | Mô tả |
|---|---|---|---|---|
| `price_side` | string | `"same"` | Enum: `ask`, `bid`, `same`, `other` | Side orderbook. |
| `use_order_book` | boolean | true | — | Dùng orderbook để chọn giá. |
| `order_book_top` | integer | 1 | `1–50` | Top N levels. |
| `price_last_balance` | number | 0.0 | `0–1` | Interpolate giữa orderbook và last price. |
| `check_depth_of_market` | `CheckDepthOfMarket` \| null | null | — | (chỉ EntryPricing) Guard depth orderbook trước entry. |

**`CheckDepthOfMarket`**:

| Field | Type | Default | Mô tả |
|---|---|---|---|
| `enabled` | boolean | false | |
| `bids_to_ask_delta` | number | 0 | `>= 0`. Min ratio bids/asks để cho entry. |

### 6.11. `OrderTypesConfig`

| Field | Type | Required | Default | Enum |
|---|---|---|---|---|
| `entry` | string | ✅ | — | `limit`, `market` |
| `exit` | string | ✅ | — | `limit`, `market` |
| `stoploss` | string | ✅ | — | `limit`, `market` |
| `stoploss_on_exchange` | boolean | ✅ | — | — |
| `force_exit` | string \| null | ❌ | inherit `exit` | `limit`, `market` |
| `force_entry` | string \| null | ❌ | — | `limit`, `market` |
| `emergency_exit` | string | ❌ | `"market"` | `limit`, `market` |
| `stoploss_on_exchange_interval` | number \| null | ❌ | null | — |
| `stoploss_on_exchange_limit_ratio` | number | ❌ | 0.99 | `0–1` |

### 6.12. `OrderTimeInForceConfig`

| Field | Type | Required | Enum |
|---|---|---|---|
| `entry` | string | ✅ | `GTC`, `FOK`, `IOC`, `PO`, `gtc`, `fok`, `ioc`, `po` (8 giá trị, accept cả case) |
| `exit` | string | ✅ | (cùng enum) |

### 6.13. `TelegramConfig`

| Field | Type | Default | Mô tả |
|---|---|---|---|
| `enabled` | boolean \| null | null | Bật Telegram notifications. |
| `token` | string \| null | null | Bot token từ @BotFather. |
| `chat_id` | string \| null | null | Chat/group ID. |
| `topic_id` | string \| null | null | Thread ID cho supergroup. |
| `authorized_users` | string[] \| null | null | Username Telegram được phép control. |
| `allow_custom_messages` | boolean | true | Strategy gửi message custom. |
| `balance_dust_level` | number \| null | null | `>= 0`. Bỏ qua balance < threshold trong `/balance`. |
| `notification_settings` | `TelegramNotificationSettings` | — | Granularity từng event. |
| `reload` | boolean \| null | null | Append nút Reload vào message. |

### 6.14. `TelegramNotificationSettings`

Mỗi event có 3 giá trị: `"on"`, `"off"`, `"silent"`.

| Field | Type | Default |
|---|---|---|
| `status` | enum \| null | null |
| `warning` | enum \| null | null |
| `startup` | enum \| null | null |
| `entry` | enum \| null | null |
| `entry_fill` | enum | `"off"` |
| `entry_cancel` | enum \| null | null |
| `exit` | enum \| null | null |
| `exit_fill` | enum | `"on"` |
| `exit_cancel` | enum \| null | null |
| `protection_trigger` | enum | `"on"` |
| `protection_trigger_global` | enum | `"on"` |

### 6.15. FreqAI — **Có 2 schema khác nhau!**

#### A. `app__schemas__bot_create__FreqAIConfig` (top-level `freqai` của payload bot create)

Đầy đủ 21 field cho ML production. Field required: `enabled`. Khi `enabled=true` thì các field sau cũng required: `train_period_days`, `backtest_period_days`, `identifier`, `freqaimodel`, `feature_parameters`. Tham chiếu `FreqAIDataSplitParameters`, `FreqAIFeatureParameters`, `FreqAIModelTrainingParameters`, `FreqAIRLConfig`. Chi tiết trong `openapi.json`.

#### B. `app__schemas__strategy__FreqAIConfig` (nested trong `StrategyConfigurations.freqai`)

Schema **đơn giản hơn nhiều**, chỉ 4 field:

| Field | Type | Default | Enum/Constraint | Mô tả |
|---|---|---|---|---|
| `enabled` | boolean | false | — | Bật FreqAI cho strategy này. |
| `feature_indicators` | string[] | `[]` | — | Tên indicators dùng làm feature. Empty = dùng tất cả. |
| `target_type` | string | `"regression"` | Enum: `regression`, `classification` | Task type. |
| `target_candles` | integer | 24 | `>= 1` | Số nến nhìn về tương lai để label. |

→ **2 schema này phục vụ 2 use case khác nhau**: nested = cấu hình code-generation strategy; top-level = runtime ML config của bot.

---

## 7. Error response (422)

Schema `HTTPValidationError`:

```json
{
  "detail": [
    {
      "loc": ["body", "configurations", "signals", "indicators", 0, "name"],
      "msg": "string too short",
      "type": "string_too_short",
      "input": "",
      "ctx": { "min_length": 1 }
    }
  ]
}
```

| Field | Type | Required | Mô tả |
|---|---|---|---|
| `loc` | (string \| integer)[] | ✅ | Path đến field lỗi (như JSON Pointer). |
| `msg` | string | ✅ | Message human-readable. |
| `type` | string | ✅ | Error code (Pydantic v2). |
| `input` | any | ❌ | Giá trị FE đã gửi gây lỗi. |
| `ctx` | object | ❌ | Context bổ sung (min/max, pattern, ...). |

→ FE có thể parse `loc` để map về field tương ứng trong form và highlight lỗi.

---

## 8. Migration từ payload cũ

### 8.1. Mapping từ 2 file legacy → 1 payload `/bot-strategy/create`

**Từ `payload_create_bot.json`** (giữ nguyên hầu hết):

| Field cũ | Field mới | Ghi chú |
|---|---|---|
| `bot_name`, `exchange_name`, `strategy_name`, `dry_run` | giữ nguyên | |
| `stake_currency`, `stake_amount`, `max_open_trades`, `timeframe` | giữ nguyên | |
| `pair: "BTC/USDT:USDT"` | `pair: "BTC/USDT"` | ⚠️ **Đổi**: spec yêu cầu `BASE/QUOTE`, bỏ `:USDT` perpetual notation |
| `dry_run_wallet`, `trading_mode`, `margin_mode`, `liquidation_buffer`, `leverage`, `can_short` | giữ nguyên | |
| `position_adjustment_enable`, `max_entry_position_adjustment`, `cancel_open_orders_on_exit`, `process_only_new_candles`, `force_entry_enable` | giữ nguyên | |
| `telegram` | `telegram` | ⚠️ Match schema `TelegramConfig` (mục 6.13). Field `notification_settings` mở rộng — có nhiều event hơn (xem 6.14) |
| `process_throttle_secs` | giữ nguyên | |

**Từ `payload_create_strategy.json`**:

| Field cũ | Field mới | Ghi chú |
|---|---|---|
| `name` | `strategy_name` | ⚠️ **Đổi tên** |
| `description` | `strategy_description` | ⚠️ **Đổi tên** |
| `strategy_type` (top-level) | `strategy_type` (top-level) | giữ |
| `configurations` | `configurations` | giữ — match `StrategyConfigurations` (mục 5) |
| `bot_id` | ❌ **Bỏ** | Atomic endpoint tự link |
| `ai_powered` | ❌ **Bỏ** | Deprecated, dùng `strategy_type` |

**Bên trong `configurations`** — file cũ có:

| Field | Tình trạng |
|---|---|
| `strategy_type` (nested) | ✅ Spec cho phép — nhưng cũng có ở top-level. Nên check BE ưu tiên cái nào |
| `startup_candle_count`, `informative_timeframes`, `risk`, `roi_steps`, `use_exit_signal`, `exit_profit_only`, `exit_profit_offset`, `ignore_roi_if_entry_signal`, `max_open_trades`, `signals`, `custom_indicator_items`, `informative_ohlcv_items`, `custom_exit` | ✅ Đều khớp spec |

**Field nên bổ sung trong `configurations`** (nếu khác default):

`interface_version` (default 3), `timeframe` (nested, default `"5m"`, có `6h`), `process_only_new_candles` (default true), `can_short` (default false), `freqai` (strategy version), `leverage` (default 1.0), `position_adjustment_enable` (default false), `max_entry_position_adjustment` (default -1).

---

## 8.bis. ⚠️ Đính chính từ log production (`user_2_bot_strategy_create_POST_20260428_042734.json`)

BE đã share 1 request log thực tế **status 201 OK** → đính chính một số điểm trong spec/migration guide:

### Đính chính 1: `pair` format — BE accept cả `BTC/USDT:USDT`

❌ **Trước đây mình ghi**: phải đổi `"BTC/USDT:USDT"` → `"BTC/USDT"` (vì spec example chỉ ghi `BTC/USDT`).

✅ **Thực tế**: BE accept cả 2 format. `pair` field trong spec là `type: string` thuần, không có regex/pattern enforcement. Notation futures perpetual `BTC/USDT:USDT` vẫn pass validation.

→ **Migration guide 8.1 không cần đổi pair format** — giữ nguyên.

### Đính chính 2: `op` enum dùng past tense, không phải present tense

❌ **FE Zod schema hiện tại** (`src/schemas/strategy.schema.ts`): `crosses_above`, `crosses_below`.

✅ **Thực tế BE dùng**: `crossed_above` (past participle).

→ Cần hỏi BE: chuẩn là tense nào, hay accept cả 2? Khi sửa Zod ở Bước 3 implementation plan, nhớ update enum.

### Đính chính 3: `right_indicator` format phức tạp hơn dự đoán

❌ **Trước đây đoán**: `"RSI-14"`, `"custom.MA200_1h"` (đơn giản).

✅ **Thực tế**:

```
{INDICATOR_NAME} ({Output Description}) - {param values comma-separated}
```

Ví dụ: `"BBANDS (Upper Band) - 2.0, 2.0, 14"`.

→ FE phải build utility function format string đúng convention này. Mở câu hỏi với BE: order param trong string thế nào, output mapping (`upperband` → `"Upper Band"`) lấy từ đâu (catalog hay BE tự định)?

### Đính chính 4: Response shape thực tế nhỏ hơn spec

Spec `BotStrategyOut.bot` có 6 field, `BotStrategyOut.strategy` có 10 field. Log thực tế:

```json
{
  "bot": { "id": 74, "bot_name": "my_bot", "status": "stopped" },
  "strategy": { "id": 18, "name": "asdasd" }
}
```

Chỉ 3 field cho bot, 2 cho strategy. Cần BE confirm:
- (a) BE thực sự trả minimal? → spec outdated.
- (b) Log file truncate field null? → spec đúng, log không phản ánh đầy đủ.
- (c) BE bug?

### Convention nhỏ confirmed từ log

- `parameters: {}` (empty object) khi indicator không có param (như `OBV`) — KHÔNG dùng `null`.
- `startup_candle_count` < 200 vẫn OK.
- Condition đầu trong `conditions[]` **không có** field `operator`; condition thứ 2+ có `operator: "AND"|"OR"`.
- Khi `op` thuộc nhóm unary (`is_going_up`, `is_going_down`) → có thêm field `percentage`, các field `right_*` là null/none.
- `ai_powered: false` vẫn được FE gửi mà BE accept (dù deprecated).

---

## 9. Đính chính so với phân tích screenshots

Một số chi tiết từ doc trước (xây trên screenshots) đã được spec đính chính:

| Doc cũ ghi | Spec thực tế | Status |
|---|---|---|
| `strategy_type` nested trong `configurations` là "legacy duplicate" | ❌ Sai. Spec **vẫn có** `strategy_type` trong `StrategyConfigurations` (default `"statistical"`) — không legacy | **Đính chính** |
| `notification_settings` chỉ có vài event | Spec có 11 event types | **Mở rộng** |
| `notification_settings` value: `on`/`off` | Thực ra: `on`/`off`/`silent` (3 giá trị) | **Đính chính** |
| `timeframe` enum giống nhau ở top-level và nested | Top-level **không có** `6h`, nested **có** `6h` | **Đính chính** |
| `freqai` là 1 schema | Có **2 schema khác nhau** (bot vs strategy version) | **Mở rộng** |
| `OrderTimeInForce` enum: `GTC, FOK, IOC, PO` | Thực ra: 8 giá trị (cả uppercase + lowercase) | **Mở rộng** |
| `fiat_display_currency` không rõ enum | Có enum 39 giá trị | **Bổ sung** |
| `Condition` schema cụ thể (left, op, right_*, lookback, ...) | **Spec không định nghĩa** — `entry_long/exit_long/entry_short/exit_short` là free-form `additionalProperties: true` object | **Đính chính** |
| `IndicatorParameter` chỉ có `timeperiod` | Có 9 field: `timeperiod`, `window`, `nbdevup`, `nbdevdn`, `fastperiod`, `slowperiod`, `signalperiod`, `fastk_period`, `fastd_period` | **Mở rộng** |
| `CustomIndicatorItem.operation` chỉ thấy `rolling_mean` | Enum 8 giá trị: `rolling_max`, `rolling_min`, `rolling_mean`, `rolling_std`, `rolling_sum`, `shift`, `pct_change`, `diff` | **Mở rộng** |
| `IndicatorItem` chỉ có `name`, `type`, `parameters` | Có thêm: `output`, `pandas_ta_func`, `requires_datetime_index`, `timeframe` | **Mở rộng** |

---

## 10. Action items cho FE

1. ✅ **Lưu `openapi.json` vào repo** (đã copy vào `Data/openapi.json`).
2. ⏳ **Auto-generate TypeScript types** bằng `openapi-typescript`:
   ```bash
   pnpm add -D openapi-typescript
   pnpm openapi-typescript Data/openapi.json -o src/types/api.d.ts
   ```
3. ⏳ **Build payload sample mới**:
   - `Data/payload_bot_strategy_create.json`
   - `Data/payload_bot_strategy_update.json`
4. ⏳ **Setup runtime validation** (Zod hoặc `ajv` + JSON Schema từ openapi) trước khi submit form.
5. ⏳ **Update form UI**:
   - Đổi `name` → `strategy_name`, `description` → `strategy_description`
   - Bỏ `bot_id`, `ai_powered` khỏi UI
   - Đổi `pair` format: `BTC/USDT:USDT` → `BTC/USDT`
   - Mở rộng UI Telegram notification (11 events × 3 levels)
   - Thêm field `interface_version` (default 3) vào configurations
   - Thêm `timeframe` `6h` vào dropdown của StrategyConfigurations (không có ở top-level)
6. ⏳ **Build FE error handler** parse `loc[]` từ `HTTPValidationError` để highlight field lỗi.
7. ⏳ **Define Condition schema chuẩn nội bộ FE** (vì BE không enforce) — dùng Zod để FE tự đảm bảo cấu trúc condition tree đúng convention.

---

## 11. External references — đi sâu hơn

Vì product này chỉ là **wrapper UI** quanh Freqtrade, **đa số câu hỏi sâu sẽ tìm thấy ở doc Freqtrade gốc**:

### Freqtrade (framework lõi)

- **Doc gốc**: https://www.freqtrade.io/en/stable/
- **Configuration reference** (mọi field config map 1-1 với payload): https://www.freqtrade.io/en/stable/configuration/
- **Strategy customization**: https://www.freqtrade.io/en/stable/strategy-customization/
- **FreqAI**: https://www.freqtrade.io/en/stable/freqai/

### Indicators

- **TA-Lib** (indicator UPPERCASE): https://ta-lib.github.io/ta-lib-python/funcs.html
- **Pandas-TA** (indicator lowercase): https://github.com/twopirllc/pandas-ta
- **Catalog đã parse sẵn** trong repo: `Data/indicators_talib.json`, `Data/indicators_pandas_ta.json`

### Exchange

- **CCXT** (BE dùng để kết nối sàn): https://github.com/ccxt/ccxt
- **Binance API**: https://binance-docs.github.io/apidocs/
- **Hyperliquid docs**: https://hyperliquid.gitbook.io/

### Khái niệm trading

- **Investopedia**: https://www.investopedia.com/ — tra mọi thuật ngữ tài chính (long/short, leverage, stop-loss...).
- **Bollinger Bands explained**: https://www.investopedia.com/terms/b/bollingerbands.asp
- **RSI explained**: https://www.investopedia.com/terms/r/rsi.asp
- **ADX explained**: https://www.investopedia.com/terms/a/adx.asp

### Đề xuất cho dev mới (đọc theo thứ tự)

1. **Mục 0** trong doc này (15 phút) — hiểu sản phẩm và thuật ngữ.
2. **Freqtrade Quickstart** (https://www.freqtrade.io/en/stable/) — đọc 30 phút, làm quen mental model.
3. **Mục 2 và 5** trong doc này (30 phút) — hiểu schema chính.
4. **Mục 0.3 worked example** (15 phút) — connect mental model với schema.
5. Khi cần build form/component → tra cứu **mục 6** sub-schemas.
6. Khi gặp lỗi 422 → tra **mục 7**.

---

## Phụ lục — File trong `Data/`

| File | Vai trò |
|---|---|
| `openapi.json` | 🟢 **Source of truth** — spec gốc từ BE |
| `API_SPEC.md` | 🟢 Document này — bản trích xuất tiếng Việt cho team |
| `IMPLEMENTATION_PLAN.md` | 🟢 Plan triển khai 3 bước (auto-gen types, payload sample, Zod schema) |
| `TALib_Documentation (1).md` | 🟢 Reference catalog 162 indicators TA-Lib (UPPERCASE) |
| `PandasTA_Documentation (1).md` | 🟢 Reference catalog ~121 indicators Pandas-TA (lowercase) |
| `indicators_talib.json` | 🟢 JSON catalog parse từ MD — FE import trực tiếp được |
| `indicators_pandas_ta.json` | 🟢 JSON catalog parse từ MD — FE import trực tiếp được |
| `user_2_bot_strategy_create_POST_20260428_042734.json` | 🟢 **Log production thật** (status 201 OK) — reference cho FE biết BE thực tế accept gì |
| `payload_create_bot.json` | 🔴 **LEGACY** — payload cũ cho `/bot/create` |
| `payload_create_strategy.json` | 🔴 **LEGACY** — payload cũ cho `/strategy/create` |
| `API docs by Redocly/Bot_*.png` | 🟡 Screenshots ban đầu, đã được superseded bởi `openapi.json` |

---

*Last updated: dựa trên `Data/openapi.json` v0.1.0 (Gamma Trade Platform).*
