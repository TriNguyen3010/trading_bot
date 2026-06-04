# Design — FE payload alignment với BE source-of-truth

> **Status:** DRAFT — chờ review trước khi code.
> **Ngày:** 2026-06-04 · **Author:** Claude (Tri duyệt)
> **Plan thực thi:** `docs/superpowers/plans/2026-06-04-fe-payload-align-be.md`
> **Source of truth:** `BE/PAYLOAD_SOURCE_OF_TRUTH.md` + 4 file `BE/user_24_*` + `BE/indicator_whitelist.json`

## 1. Mục tiêu & phạm vi

Sửa payload FE gửi `POST /bot-strategy/create` để **khớp đúng** format BE đã xác nhận (4 file mẫu), để bot tạo ra chạy đúng cấu hình. **Phạm vi doc này = Phase 1** (4 fix không phụ thuộc rework catalog). Phase 2 (catalog indicator theo whitelist) + Phase 3 (multi-tf/custom/2-chiều) có doc/brainstorm riêng sau.

**Không làm trong Phase 1:** đổi catalog 6→14 indicator, thêm `output`, multi-timeframe, custom_indicator_items, bot 2 chiều.

## 2. Quyết định đã chốt (từ Tuấn, 2026-06-04)

| Vấn đề                              | Chốt                                                   |
| ----------------------------------- | ------------------------------------------------------ |
| BE đọc stoploss ở đâu               | `configurations.risk.stoploss` (top-level bị bỏ)       |
| Tắt SL gửi gì                       | `risk.stoploss: **null**`                              |
| `%` stoploss                        | sau leverage (BE tự hiểu; FE giữ nguyên `slValue/100`) |
| leverage / process_only_new_candles | **top-level** (configurations không mang)              |
| Field dư                            | FE bỏ cho khớp mẫu — Tuấn OK                           |
| can_short                           | top-level (mẫu create không có trong configurations)   |
| `right_indicator`                   | match theo key + output; **Phase 2**                   |
| `parameters` đủ/non-default         | ⏳ CHỜ Tuấn — Phase 2, tạm gửi đủ                      |

## 3. Hiện trạng FE (verified bằng đọc code + dump payload thật 2026-06-04)

`buildUnifiedPayload` (serializer.ts:367) sinh payload, rồi `unifiedBotStrategyCreateSchema.parse` (ExportDialog.tsx:103) → POST. Sau parse, payload thật trên dây có các vấn đề:

1. **Bot SHORT:** `schema.parse` **throw** `configurations.can_short` ("Must enable can_short when short conditions present") — vì `buildStrategyPayload` không set `configurations.can_short`, schema default `false`, rule (3) ở schema.ts:489-499 chặn. → short không submit được. (đã verify bằng test tạm.)
2. **op cross:** FE emit `crosses_above` (ConditionRow.tsx:35; ruleToBE giữ nguyên `rule.op`); mẫu BE dùng `crossed_above`.
3. **configurations defaults injected:** Zod `.default()` thêm `interface_version:3`, `process_only_new_candles:true`, `can_short:false`, `leverage:1`, `position_adjustment_enable:false`, `max_entry_position_adjustment:-1` vào configurations — mẫu create KHÔNG có; `leverage:1` còn **mâu thuẫn** top-level (vd 10).
4. **stoploss:** tắt SL → FE ghi `risk.stoploss:-0.4` + top-level `stoploss:null`. Mẫu/BE muốn `risk.stoploss:null`, không top-level.

## 4. Thay đổi đề xuất (Phase 1)

### 4.1 Bot SHORT — bỏ rule (3) trong `strategyConfigurationsSchema`

- **File:** `src/schemas/unified-bot-strategy.schema.ts:489-499`
- **Đổi:** xoá block rule (3). Lý do: rule check `configurations.can_short` nhưng (a) configurations schema không thấy top-level can_short, (b) mẫu create để can_short top-level + configurations bỏ → BE không enforce kiểu này. FE đang chặt hơn BE = sai hướng.
- **Rủi ro:** rule này từng để "bảo vệ" short-without-can_short. Sau khi bỏ, top-level `can_short` (serializer.ts:122 = `direction==='short'`) vẫn đúng. Không mất an toàn thật.

### 4.2 op cross → quá khứ khi serialize

- **File:** `src/lib/condition-tree.ts:39-51` (`ruleToBE`)
- **Đổi:** map `crosses_above→crossed_above`, `crosses_below→crossed_below` lúc emit. Giữ UI/state present-tense (đỡ churn). Chiều deserialize đã coerce past→present (serializer.ts:491-495) nên round-trip không vỡ.
- **Rủi ro:** chỗ khác đọc `op` trên BE-shape? Chỉ serializer dùng. Translators/summary đọc state (present) — không đụng.

### 4.3 Hết inject configurations defaults lệch

- **File:** `src/schemas/unified-bot-strategy.schema.ts` — đổi `interface_version`(435), **`timeframe`(437)**, `process_only_new_candles`(439), `can_short`(441), `leverage`(461), `position_adjustment_enable`(462), `max_entry_position_adjustment`(463) từ `.default(x)` → `.optional()`. **(7 field — review bổ sung `timeframe`.)**
- **Lý do:** mẫu create không có chúng trong configurations; `leverage:1` mâu thuẫn top-level `leverage:10`.
- **Đã verify (review):** KHÔNG consumer nào đọc `configurations.<field>` này — chỉ `api.d.ts` (auto-gen) + schema. Build/summary/backtest đọc top-level (`serializer.ts:122-126,394-398`, `bot-summary/translators/risk.ts:54`, `backtest-helpers.ts:118`). `deserializeUnifiedPayload` đọc `cfg.startup_candle_count/.signals/.risk/.roi_steps/.custom_exit/.informative_timeframes/.use_exit_signal` — không đụng 7 field. → **an toàn**.

### 4.4 Tắt SL → `risk.stoploss: null` + bỏ top-level ⚠️ DECOUPLE khỏi legacy

- **⚠️ Review bắt:** `buildRisk` (serializer.ts:74) dùng chung cho **cả legacy `buildBundle`** (serializer.ts:201) — mà `bundleSchema`→`strategy.schema.ts riskSchema.stoploss`(99) là `z.number()` **không nullable**. Nếu `buildRisk` trả `null` → export bundle legacy SL-off **fail parse**, và `deserializeBundle:311-313` (`risk.stoploss > -0.4`, `*100`) ra sai `slValue`.
- **Quyết định: KHÔNG đổi `buildRisk`.** Giữ `buildRisk` trả số (`-0.4` sentinel) cho legacy. Chỉ **override `null` tại chỗ build unified**.
- **Files & đổi:**
  - `serializer.ts` `buildUnifiedPayload` (sau khi lấy `strategy.configurations`): set `configurations.risk.stoploss = (close.type==='tp_sl' && close.slEnabled) ? close.slValue/100 : null`. (Override riêng cho unified; `buildStrategyPayload` gọi độc lập trong `buildBundle` không bị ảnh hưởng — 2 lần gọi khác nhau.)
  - `serializer.ts:406-408`: bỏ field `stoploss` + `trailing_stop` top-level khỏi `buildUnifiedPayload`.
  - `unified-bot-strategy.schema.ts:358`: `riskConfigSchema.stoploss` → `z.number().nullable()` (bỏ `.default`). **strategy.schema.ts giữ nguyên `number`.**
  - `serializer.ts:612-613` (deserialize unified): `slEnabled = risk?.stoploss != null`; `slValue = (risk?.stoploss ?? -0.04)*100` (guard `-0.04` tránh NaN khi null). **deserializeBundle (311-313) giữ nguyên.**
- **E1 — trailing khi SL off:** schema refine trailing (369-386) KHÔNG đụng `stoploss` → null không vỡ schema. Còn lại là câu hỏi runtime BE (chưa có mẫu) → **flag Tuấn, không chặn Phase 1**.

## 5. Edge cases cần reviewer soi

- E1. tp_sl + SL off + trailing ON → stoploss null + trailing true: hợp lệ với BE? schema `riskConfigSchema` refine (trailing offset > positive) còn đúng khi stoploss null?
- E2. Sau khi bỏ configurations defaults: bot tạo từ template cũ (localStorage state cũ) deserialize có vỡ không?
- E3. Round-trip export→import: bỏ top-level stoploss + risk.stoploss nullable → import lại đúng slEnabled/slValue?
- E4. Bỏ rule (3): còn test nào assert rule (3) throw không (sẽ đỏ)?
- E5. `bundleSchema` / legacy `buildBundle` path còn dùng — đổi riskConfig nullable có ảnh hưởng legacy schema không?

## 6. Test strategy

TDD mỗi task (đỏ→fix→xanh). Sau Phase 1: dump payload thật (script tạm) so với `BE/user_24_..._024552.json` (signals rỗng) — field-by-field phải khớp (trừ phần indicator để Phase 2). `pnpm typecheck/lint/test` xanh.

## 6.bis Test phải cập nhật khi bỏ rule (3) — review bắt

- `src/schemas/__tests__/unified-bot-strategy.test.ts:285` ("rejects short conditions when can_short is false") assert rule (3) throw → **xoá / đảo** thành "short conditions PASS (can_short top-level)". Bắt buộc trong Task 1.1.
- `ImportDialog.test.tsx:105-109`: comment "Satisfy rule (3)" thành stale → sửa comment; assertion thật (short+spot guard ImportDialog.tsx:83-86) vẫn đúng, không cần đổi logic.

## 7. Câu hỏi mở / flag Tuấn (không chặn Phase 1)

- Q-param (Phase 2): chờ Tuấn.
- E1 trailing + SL-off (`stoploss:null` + `trailing_stop:true`): BE runtime chấp nhận? (schema FE ok.)
- Field dư còn lại sau Phase 1 (top-level `telegram`/`process_throttle_secs`/`max_entry_position_adjustment`; `risk` 5 field; `custom_exit` 14 field): Tuấn nói ignore — coi là known-acceptable divergence, không fix trong Phase 1.

## 8. Review log

- 2026-06-04: reviewer (dump payload thật + grep) → NEEDS CHANGES. Đã áp: (1) thêm `timeframe` vào 4.3; (2) decouple `buildRisk` khỏi legacy ở 4.4; (3) ghi rõ test phải sửa (6.bis). Các mục "Nice" (field dư) → mục 7, defer.
