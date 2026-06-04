# Source of Truth — Payload format `/bot-strategy/create`

> **Chốt ngày 2026-06-04 (Tuấn BE gửi).** Hai file dưới là **bản ghi THẬT** từ hệ thống BE
> (request + response, `status_code: 201` — bot tạo thành công). Tuấn xác nhận:
> _"FE phải làm theo format này thì BE mới chạy."_
>
> ⇒ **Đây là chân lý (source of truth) cho format payload FE gửi lên `POST /bot-strategy/create`.**
> Khi FE và spec/Zod schema mâu thuẫn với 2 file này → **2 file này đúng**, sửa FE theo.

## Các file source-of-truth (Tuấn gửi 2026-06-04)

| File                                                     | Minh hoạ                                                                                                                                                                                                                               |
| -------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `user_24_bot_strategy_create_POST_20260604_024552.json`  | Bot ROI + risk, signals **rỗng** (cấu trúc tối thiểu 4 ô signal).                                                                                                                                                                      |
| `user_24_bot_strategy_create_POST_20260604_025319.json`  | Bot **indicator BBANDS**, điền **cả 4 ô** entry/exit long+short → format chuẩn indicator + condition + bot 2 chiều.                                                                                                                    |
| `indicator_whitelist.json`                               | **Danh mục 14 indicator BE support** (id, type talib/pandas_ta, inputs, **outputs**, parameters). ⭐ UI Tuấn render từ file này → FE phải dùng cùng catalog.                                                                           |
| `user_24_bot_strategy_update_PATCH_20260604_035922.json` | PATCH `/bot-strategy/{id}` — mẫu **serialize đầy đủ mọi indicator**: multi-output (1 entry / output, có `output`), pandas_ta (`pandas_ta_func`), multi-timeframe (`timeframe`), `requires_datetime_index`, **custom_indicator_items**. |

### Format serialize indicator (rút từ PATCH file — đã verify)

- **talib 1 output** (RSI, EMA, SMA, ADX, OBV, SAR): `{name, type:"talib", parameters}` — **không** có `output`.
- **talib nhiều output** (BBANDS, MACD, STOCH, STOCHRSI): **mỗi output 1 entry**, có `"output": "<id>"` (vd `upperband`, `macd`, `slowk`, `fastk`).
- **pandas_ta** (NATR, VWAP, SUPERTREND, CHANDELIER_EXIT): thêm `"pandas_ta_func": "<func>"`; VWAP thêm `"requires_datetime_index": true`; SUPERTREND nhiều output `SUPERT_7_3.0`...
- **multi-timeframe**: indicator trên informative timeframe có thêm `"timeframe": "1h"`; `configurations.informative_timeframes` liệt kê các tf phụ. (strategy trade 5m nhưng cần data 1h.)
- **custom_indicator_items**: user tự định nghĩa indicator (`{name, source_type, source_col, source_field, source_timeframe, operation, period}`).
- `parameters` chỉ chứa param không-default? — PATCH cho thấy STOCH chỉ gửi `fastk_period:5` (bỏ slowk/slowd) → **xác nhận với Tuấn** (gửi đủ hay chỉ non-default).

## Những điểm format đã rút ra (verified bằng code FE, 2026-06-04)

Chỗ FE hiện **đang lệch** so với 2 file mẫu (cần sửa FE / hỏi BE):

1. **op cross**: mẫu BE dùng **quá khứ** `crossed_above` / `crossed_below`; FE đang gửi hiện tại `crosses_above` (`ConditionRow.tsx:35`). → FE sửa được.
2. **Tên indicator**: mẫu BE `"BBANDS"`; FE dùng `"BB"` (`indicator-registry.ts:122`). → cần map đầy đủ từ BE.
3. **field `output`**: mẫu BE có `"output": "upperband"`; FE **không gửi** (`serializer.ts:48-54`). → cần list `output` hợp lệ từ BE.
4. **`right_indicator`**: mẫu BE `"BBANDS (Upper Band) - 2.0, 2.0, 14"`; FE gửi shorthand `"BB-20"`. → cần **công thức ghép chuỗi** từ BE (không được tự chế).
5. **`left`**: mẫu BE `"candle.close"` — FE **khớp** ✅.
6. **Cấu trúc 4 ô signal** (`entry_long`/`exit_long`/`entry_short`/`exit_short`, mỗi ô `{logic, conditions:[]}`) — FE **khớp** ✅ (luôn gửi đủ 4 key). Khác biệt: mẫu BE điền **cả 4** (bot 2 chiều); FE hiện chỉ điền 2 ô theo 1 chiều đã chọn.
7. **Field FE gửi DƯ** (mẫu không có): top-level `stoploss`, `trailing_stop`, `telegram`, `process_throttle_secs`; trong `configurations`: `interface_version`, `timeframe`, `can_short`, `leverage`, `position_adjustment_enable`... → cần BE xác nhận **ignore hay reject**.

## Đã được giải đáp (2026-06-04)

- ✅ Tên indicator + outputs + params → `indicator_whitelist.json`. (FE phải đổi: `BB`→`BBANDS`, `MA`→`SMA`/`EMA`, `Stochastic`→`STOCH`; bỏ `ATR` không có trong whitelist; thêm ADX/OBV/STOCHRSI/SAR/SUPERTREND/VWAP/NATR/CHANDELIER_EXIT.)
- ✅ Cách serialize indicator (output / pandas_ta_func / timeframe / requires_datetime_index) → file PATCH.
- ✅ `stoploss`: BE đọc `configurations.risk.stoploss`; top-level bỏ; `%` là **sau leverage** (Tuấn xác nhận).
- ✅ Bot 2 chiều: BE điền cả 4 ô signal (file create #2).

## Tuấn trả lời tiếp (2026-06-04, đợt 2)

- ✅ **`right_indicator`:** thứ tự param trong chuỗi **không quan trọng**; BE match theo **key** (tên indicator + output). Multi-output (BBANDS, SUPERTREND) phải kèm `output`; single-output không cần. → FE không phải chế chuỗi y hệt; vẫn nên verify round-trip thật 1 lần.
- ✅ **Tắt SL:** truyền `risk.stoploss: **null**` (không phải -1.0/-0.4). BE tự lo phần Freqtrade.
- ✅ **leverage/process_only:** top-level (mẫu create đã rõ). Field dư: Tuấn OK cho FE bỏ khớp mẫu.

## Tuấn trả lời tiếp (2026-06-04, đợt 3) — chốt param

- ✅ **`parameters`: gửi ĐỦ** mọi param (theo whitelist) vào `parameters` của indicator.
- ⚠️ **File PATCH mâu thuẫn param (STOCH chỉ `fastk_period`; SAR/NATR/SUPERTREND `{}`) = BUG UI của Tuấn** (thiếu field) — em ấy sẽ update. **KHÔNG bắt chước** chỗ thiếu param đó.
- ✅ **multi-output:** 1 indicator + 1 set param → thư viện trả nhiều output; `output` chọn cột. Mỗi output dùng = 1 entry, cùng param, khác `output`.
- ✅ **talib vs pandas_ta**: 2 thư viện → format khác (pandas_ta thêm `pandas_ta_func`, output templated `SUPERT_7_3.0`; VWAP `requires_datetime_index:true`).
- ✅ **FE render UI từ `indicator_whitelist.json`** (field config + output picker per indicator).

## CÒN MỞ

- E1 trailing khi tắt SL (`stoploss:null` + `trailing_stop:true`) — BE runtime nhận không (chưa có mẫu).
