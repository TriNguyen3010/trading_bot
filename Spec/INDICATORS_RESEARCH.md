# Indicators Research — Trading Bot Builder

> Báo cáo research các technical indicators cho Strategy Builder, đối tượng user
> mục tiêu là **Beginner**. Mục đích: trả lời câu hỏi *"Có 389 indicators trong
> 2 file JSON, mình nên show cái nào cho user và xử lý phần còn lại thế nào?"*

Ngày: 2026-05-04
Tác giả: Research session
Liên quan tới: `Data/indicators_talib.json`, `Data/indicators_pandas_ta.json`,
`src/features/indicators/indicator-registry.ts`

---

## 1. Tình trạng hiện tại

### 1.1. 2 file JSON đang có

| File | Source | Tổng số | Số category | Ghi chú |
|---|---|---|---|---|
| `Data/indicators_talib.json` | TA-Lib | **162** | 10 | Có cả Math/Stat/Pattern (gần phân nửa là phụ) |
| `Data/indicators_pandas_ta.json` | Pandas-TA 0.3.16+ | **227** | 5 | Đã có sẵn `params` + default value |

Tổng cộng **389 records**, sau khi dedupe (case-insensitive theo `name`) còn lại
**~233 indicators duy nhất**. Có **33 indicators trùng tên** giữa 2 thư viện
(RSI, MACD, ATR, BBANDS, EMA, SMA, ADX, MFI, CCI, …) — những cái này nên ưu tiên
một thư viện duy nhất khi user cấu hình, tránh để user phải chọn giữa
"RSI (TA-Lib)" và "rsi (Pandas-TA)".

### 1.2. Phân bố theo category

**TA-Lib (162):**
- Momentum Indicators — 31
- Overlap Studies (MA, BB, SAR, …) — 19
- Pattern Recognition (CDL\*) — **61** ← chiếm 38% nhưng đa số ít dùng trong bot
- Math Operators — 11
- Math Transform — 15
- Statistic Functions — 9
- Cycle Indicators (HT_\*) — 5
- Price Transform — 5
- Volatility Indicators — 3
- Volume Indicators — 3

**Pandas-TA (227):**
- Momentum — 35
- Moving Average — 41
- Volume — 12
- Volatility — 12
- Other (helpers: crossover, peaks, trend, …) — 21
- *(Pandas-TA còn các module Cycles, Performance, Statistics, Trend, Candles
  trong thư viện gốc nhưng JSON này gom lại 5 nhóm chính.)*

### 1.3. Registry hiện hardcode trong code

`src/features/indicators/indicator-registry.ts` đang chỉ liệt kê **6 indicators**:
RSI, MA, MACD, BB, ATR, Stochastic. Đây là **technical debt** — nếu phải bổ sung
từng indicator thì sẽ không bao giờ scale được lên 389 cái.

---

## 2. 4 nhóm indicator chính (mental model cho user)

Toàn bộ industry literature đều đồng thuận chia indicator thành 4 nhóm. Đây là
khung mà UI nên trình bày cho user beginner thay vì để 10 category kỹ thuật của
TA-Lib.

| Nhóm | Trả lời câu hỏi | Đại diện | Khi nào dùng |
|---|---|---|---|
| **Trend** | Giá đang đi hướng nào? | EMA, SMA, MACD, ADX, SAR | Trend-following bot |
| **Momentum** | Đà tăng/giảm mạnh hay yếu? | RSI, Stochastic, CCI, Williams %R | Mean-reversion, scalp |
| **Volatility** | Biên độ dao động bao nhiêu? | Bollinger Bands, ATR, Keltner | Đặt SL/TP, breakout |
| **Volume** | Lực đằng sau cú move có thật không? | OBV, MFI, CMF, VWAP | Confirm signal |

**"Rule of Three"** mà các tài liệu khuyến nghị: 1 trend + 1 momentum + 1
volume/volatility — không bao giờ chồng 3 momentum lên nhau (RSI + Stoch + CCI
là cùng đo một thứ, sẽ tạo giả tín hiệu).

---

## 3. Tier 1 — Must-have (default visible, ~9 indicators)

Đây là danh sách tôi đề xuất show ngay cho beginner, không cần click "Advanced".
Chọn dựa trên: (a) có mặt trong cả TA-Lib và Pandas-TA (an toàn về backend),
(b) được mọi nguồn tài liệu 2026 nêu tên, (c) đủ phủ 4 nhóm.

| # | Indicator | Nhóm | Output | Param mặc định | Use case ngắn gọn |
|---|---|---|---|---|---|
| 1 | **RSI** | Momentum | `0–100` | length=14 | Overbought >70, oversold <30 |
| 2 | **MACD** | Trend + Momentum | `macd`, `signal`, `hist` | 12/26/9 | Cross signal line = đổi xu hướng |
| 3 | **EMA** | Trend | giá | length=20/50/200 | Pullback tới EMA = entry |
| 4 | **SMA** | Trend | giá | length=20/50/200 | Đường trung bình kinh điển |
| 5 | **Bollinger Bands** | Volatility | upper/middle/lower | length=20, std=2 | Chạm band = squeeze/breakout |
| 6 | **ATR** | Volatility | giá | length=14 | Tính SL = entry ± 1.5×ATR |
| 7 | **ADX** | Trend strength | `0–100` | length=14 | >25 = trend đủ mạnh để follow |
| 8 | **Stochastic** | Momentum | %K, %D | 14/3/3 | Cross %K/%D trong vùng 20/80 |
| 9 | **OBV** | Volume | cumulative | (không) | Phân kỳ giá vs OBV = warning |

> **Tại sao không có VWAP / SuperTrend / Ichimoku?** Cả ba đều rất phổ biến trên
> TradingView nhưng VWAP **không có trong TA-Lib** (chỉ Pandas-TA), SuperTrend
> và Ichimoku Cloud **không có trong cả 2 file JSON** hiện tại. Nếu muốn thêm
> phải custom implement ở backend trước.

---

## 4. Tier 2 — Advanced (ẩn sau toggle "Show all")

Show khi user click "Advanced indicators" hoặc gõ search. Khoảng **~20 cái**
phủ thêm các use case nâng cao mà retail trader vẫn thường xài.

**Momentum (oscillator phụ):**
- **MFI** — RSI có cộng thêm volume
- **CCI** — Commodity Channel Index, đo độ lệch khỏi SMA
- **Williams %R** — gần giống Stochastic đảo ngược
- **Stochastic RSI** — Stoch áp lên RSI, nhạy hơn
- **MOM / ROC** — % thay đổi đơn giản
- **CMO** — Chande Momentum Oscillator
- **TSI / TRIX** — smoothed momentum

**Trend / MA biến thể:**
- **WMA, DEMA, TEMA, KAMA, HMA** — các loại MA nâng cao
- **SAR (Parabolic SAR)** — trailing stop indicator (chỉ TA-Lib)
- **Aroon / Aroon Oscillator** — đo thời gian từ high/low gần nhất
- **+DI / −DI** (đi kèm ADX) — directional movement

**Volatility:**
- **Keltner Channel (KC)** — như BB nhưng dùng ATR (chỉ Pandas-TA)
- **NATR** — ATR chuẩn hóa theo %
- **Donchian / TRANGE**

**Volume:**
- **CMF** — Chaikin Money Flow (chỉ Pandas-TA)
- **AD / ADOSC** — Chaikin A/D
- **VWAP** — volume-weighted average price (chỉ Pandas-TA)

---

## 5. Hidden — Không show trong UI cho beginner

Những nhóm sau chiếm ~120/389 records nhưng **không nên** để user beginner đụng
vào. Vẫn giữ trong registry để power user search được, nhưng đừng list ra:

| Nhóm | Số lượng | Lý do ẩn |
|---|---|---|
| **Pattern Recognition (CDL\*)** | 61 | Mỗi cái là 1 mẫu nến (Doji, Hammer, …); kết quả là −100/0/+100, khó dùng làm condition trong rule-based bot. Nếu cần thì gom thành 1 multi-select "Candlestick patterns" duy nhất. |
| **Math Operators** | 11 | ADD, SUB, MAX, MIN — đây là building block toán học, không phải indicator. |
| **Math Transform** | 15 | ACOS, SIN, LN, SQRT — tương tự, là utility. |
| **Statistic Functions** | 9 | LINEARREG, STDDEV, BETA — chỉ quant mới dùng trực tiếp. |
| **Cycle Indicators (HT_\*)** | 5 | Hilbert Transform — DSP-level, hầu như không retail trader nào dùng. |
| **Price Transform** | 5 | AVGPRICE, MEDPRICE — quá đơn giản, gần như input chứ không phải indicator. |
| **Pandas-TA "Other"** | 21 | `crossover`, `above`, `below`, `peaks` — đây là **utility/comparator**, đã được ConditionBuilder của project xử lý ở tầng khác (`condition.operator`), không nên show như indicator riêng. |

→ Giảm từ **389 → ~70 indicators** thực sự cần thiết hiển thị.

---

## 6. Combo gợi ý sẵn (preset cho beginner)

Beginner thường không biết phối indicator. Project nên có sẵn **preset
strategies** trong UI (đã có folder `src/templates/catalog/` rồi). Vài combo
kinh điển:

| Combo | Indicators | Ý tưởng |
|---|---|---|
| **Triple Threat** (phổ biến nhất) | EMA(200) + MACD + Volume | Trend + Momentum + Confirmation |
| **RSI + MACD** | RSI(14) + MACD | Backtest 77% win rate (Gate.io 2026 study) |
| **Bollinger Squeeze** | BB(20,2) + Volume | Volatility breakout |
| **Mean Reversion** | RSI(14) + BB(20,2) | Mua khi RSI<30 và giá chạm lower band |
| **Trend Following** | EMA(50) + ADX(14) | Vào lệnh khi ADX>25 và giá > EMA |
| **Scalp** | EMA(9) + EMA(21) + Stoch | Cross 2 EMA + Stoch xác nhận |

Project đã có template `rsi-oversold-eth-1h`, `macd-momentum-bnb`,
`breakout-btc-15m`… → tốt rồi, chỉ cần đảm bảo indicator gốc của các template
này nằm trong Tier 1.

---

## 7. Pitfalls cần tránh khi config

1. **Redundancy** — RSI + Stoch + CCI là 3 momentum oscillator đo cùng thứ. Cảnh
   báo user khi họ chọn nhiều hơn 1 indicator cùng nhóm.
2. **Lookahead bias** — vài indicator (ZigZag, một số fractal) phải repaint, không
   dùng được cho bot live. Trong file JSON hiện tại **chưa có flag này** — nên
   bổ sung field `"realtime_safe": true/false`.
3. **Multi-output indicator** — MACD trả 3 output (`macd`, `signal`, `hist`),
   Stochastic trả 2 (`%K`, `%D`). UI cần cho user chọn output nào tham gia
   condition. File Pandas-TA đã expose `outputs[]` đầy đủ — nên dùng nó làm
   source of truth.
4. **Param mặc định** — TA-Lib JSON đang để `params: []` rỗng (RSI, MACD…).
   Phải hardcode lookup table hoặc lấy từ Pandas-TA tương ứng.
5. **Crypto specific** — vài indicator cổ điển (Aroon, CCI 14) tune cho stock
   daily. Crypto 24/7 + volatility cao hơn → có nguồn khuyên dùng RSI(9 hoặc 11)
   thay vì 14. Cho phép user chỉnh nhưng default vẫn nên là giá trị classic.

---

## 8. Đề xuất UX cho UI Builder

Áp cho `IndicatorPicker.tsx`:

1. **Default view** = Tier 1 (9 cards lớn, có icon + mô tả 1 dòng).
2. **Tab "By type"** = 4 nhóm Trend / Momentum / Volatility / Volume.
3. **Tab "All indicators"** = full list ~70 (Tier 1 + Tier 2), có search bar.
4. **Toggle "Show experimental"** = mở thêm Cycle / Statistic / Pattern (Hidden tier).
5. **Search bar** = autocomplete theo `name` + `description` (full-text trên
   389 records vẫn nhanh, không cần backend).
6. **Indicator card hover** = preview output channel + param defaults từ JSON.
7. **Recently used** (localStorage) — beginner thường lặp lại cùng 3-4 indicator.
8. **Conflict warning** — khi user thêm RSI rồi chọn thêm Stoch → hiển thị
   "Cả hai đều là momentum oscillator, có thể tạo tín hiệu giả".

---

## 9. Đề xuất kiến trúc dữ liệu (high-level)

> *Phần này vượt scope báo cáo (user chỉ chọn "must-have list"), nhưng để 1 mục
> ngắn vì nó liên quan trực tiếp tới câu "không biết xử lý lượng indicator
> lớn".*

Thay vì hardcode 389 indicator vào `indicator-registry.ts`:

1. **Source of truth** = 2 file JSON đã có sẵn, **không sao chép lại** trong code.
2. **Build-time** chạy script `scripts/build-indicator-registry.ts` để:
   - Load 2 JSON, dedupe theo `name`.
   - Gắn metadata bổ sung (tier, category, tags) qua **một file override duy
     nhất** `src/features/indicators/indicator-meta.ts` (chỉ ~70 entries Tier 1+2).
   - Output ra `indicator-registry.generated.ts` mà UI import.
3. **Runtime** = `IndicatorPicker` chỉ đọc registry đã merge, hiển thị theo tier.
4. **Fallback** cho 300+ indicator còn lại = dùng metadata từ JSON gốc, không
   cần custom param UI (auto generate từ `params[]`).

---

## 10. Tóm tắt — Trả lời câu hỏi của bạn

> *"Có 389 indicators, không biết xử lý thế nào?"*

- Đừng cố hiển thị tất cả. **Show 9 cái Tier 1 mặc định**, ẩn ~20 Tier 2 sau
  một toggle, đẩy ~120 indicator phụ trợ (Math/Stat/Cycle/Pattern) vào "experimental".
- Group theo **4 nhóm trader thực tế dùng** (Trend / Momentum / Volatility /
  Volume), KHÔNG theo 10 category kỹ thuật của TA-Lib.
- Dùng 2 file JSON làm **source of truth metadata**; chỉ override tier/label/icon
  cho ~70 cái cần care. Các indicator còn lại vẫn searchable nhưng auto-generate
  UI param.
- Tạo sẵn **6 preset combos** để beginner click 1 phát là có chiến lược chạy
  được, thay vì phải tự ráp.
- Thêm **conflict warning** khi user chọn nhiều indicator cùng nhóm.

→ Bước tiếp theo nên: (a) viết script merge/dedupe 2 JSON, (b) tạo file
`indicator-meta.ts` với 70 entries Tier 1+2, (c) refactor `IndicatorPicker.tsx`
theo UX 4-tab phía trên.

---

## Sources

- [Best Crypto Indicators for Beginners in 2026 — TheBlockverse](https://www.theblockverse.co/best-crypto-indicators-for-beginners/)
- [10 Best Indicators for Crypto Trading 2026 — Ventureburn](https://ventureburn.com/best-crypto-trading-indicators/)
- [How to Use MACD, RSI, Bollinger Bands 2026 — Gate Web3](https://web3.gate.com/crypto-wiki/article/how-to-use-technical-indicators-macd-rsi-and-bollinger-bands-for-crypto-trading-in-2026-20260204)
- [Top Crypto Trading Bot Indicators 2026 — Troniex](https://www.troniextechnologies.com/blog/crypto-trading-bot-indicators)
- [Top Six Crypto Trading Indicators — Cryptohopper](https://www.cryptohopper.com/blog/top-six-crypto-trading-indicators-and-how-to-use-them-on-cryptohopper-8204)
- [10 Best Indicators 2026 — Token Metrics](https://tokenmetrics.com/blog/10-best-indicators-for-crypto-trading-and-analysis-in-2026/)
- [4 Types of Trading Indicators — Cryptohopper](https://www.cryptohopper.com/blog/168-trading-101-technical-analysis-for-beginners)
- [Trend, Momentum, Volatility, Volume — Quantshare](https://www.quantshare.com/sa-446-different-types-of-trading-indicators-trend-momentum-volatility-and-volume)
- [Crypto Bots with Technical Indicators 2025 — Wundertrading](https://wundertrading.com/journal/en/learn/article/integrating-crypto-bots-with-technical-indicators)
