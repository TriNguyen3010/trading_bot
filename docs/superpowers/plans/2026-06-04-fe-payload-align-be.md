# FE Payload Alignment với BE Source-of-Truth — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: dùng superpowers:subagent-driven-development hoặc superpowers:executing-plans để chạy task-by-task. Step dùng checkbox (`- [ ]`).

**Goal:** Sửa payload FE (`buildUnifiedPayload` → `/bot-strategy/create`) để **khớp đúng format BE** trong 4 file source-of-truth ở `BE/`, để bot tạo ra chạy đúng cấu hình.

**Architecture:** Pipeline `BuilderState → buildUnifiedPayload (serializer.ts) → unifiedBotStrategyCreateSchema.parse → POST`. Sửa ở serializer + schema + indicator-registry + condition-tree. Bám 4 file source-of-truth, **không chế format**.

**Tech Stack:** TypeScript, Zod, Vitest. Source of truth: `BE/PAYLOAD_SOURCE_OF_TRUTH.md` + 4 file mẫu.

---

## Bản đồ khoảng cách (FE hiện tại ⨉ BE source-of-truth)

| Vùng                                      | FE hiện tại                                  | BE chuẩn (file mẫu)                      | Mức                         |
| ----------------------------------------- | -------------------------------------------- | ---------------------------------------- | --------------------------- |
| Validate bot SHORT                        | `parse` **throw** (configurations.can_short) | submit OK                                | 🔴 Blocker                  |
| op cross                                  | `crosses_above` (hiện tại)                   | `crossed_above` (quá khứ)                | 🔴                          |
| Catalog indicator                         | 6 cái, id viết tắt `BB-20`                   | 14 cái whitelist (`BBANDS`...)           | 🔴                          |
| `output` per indicator                    | không có                                     | bắt buộc cho multi-output                | 🔴                          |
| pandas_ta_func / requires_datetime_index  | không gửi                                    | có                                       | 🟠                          |
| `right_indicator` string                  | `"BB-20"`                                    | `"BBANDS (Upper Band) - 2.0, 2.0, 14"`   | 🔴 (chờ Tuấn)               |
| leverage / process_only_new_candles       | gửi 2 nơi lệch (top 10 vs nested 1)          | chỉ top-level                            | 🟠                          |
| stoploss tắt SL                           | `-0.4` hardcode                              | BE đọc risk.stoploss, % sau leverage     | 🟠                          |
| Field dư (interface_version, telegram...) | gửi                                          | mẫu không có                             | 🟡 (chờ Tuấn ignore/reject) |
| multi-timeframe informative               | chưa có UI                                   | `timeframe` key + informative_timeframes | ⏸ defer                     |
| custom_indicator_items                    | chưa có UI                                   | có                                       | ⏸ defer                     |
| bot 2 chiều                               | chỉ 1 chiều                                  | điền cả 4 ô                              | ⏸ product decision          |

---

## PHASE 0 — Trả lời từ Tuấn (2026-06-04) — phần lớn đã chốt

- ✅ **`right_indicator`:** thứ tự param trong chuỗi **không quan trọng**, BE match theo **key** (tên indicator + output). Multi-output (BBANDS, SUPERTREND...) phải chọn `output`; single-output thì không. → KHÔNG còn chặn Phase 2; vẫn nên test round-trip thật 1 lần.
- ⏳ **`parameters` (đủ/non-default):** Tuấn đang check lại UI bên BE → **CHỜ**. Tạm thời FE gửi **đủ param** (an toàn nhất, mẫu RSI/EMA/MACD/BBANDS đều gửi đủ).
- ✅ **Tắt SL:** `configurations.risk.stoploss: **null**` (Tuấn: "disable stoploss thì truyền stoploss null"). KHÔNG dùng `-1.0`/`-0.4`. → dùng ở Task 1.4.
- ✅ **leverage/process_only:** mẫu create để ở **top-level**, configurations bỏ (đã rõ từ file). → Task 1.3.
- ✅ **Field dư:** Tuấn OK cho FE bỏ field dư khớp mẫu.

**Gate:** Phase 1 + Phase 2 đều chạy được. Chỉ luật `parameters` (Task 2.2) chờ Tuấn — tạm gửi đủ param.

---

## PHASE 1 — FE fixes KHÔNG chặn (làm ngay, TDD)

### Task 1.1: Bot SHORT submit được (sửa schema rule sai)

**Bối cảnh:** `strategyConfigurationsSchema` superRefine rule (3) check `data.can_short` (= `configurations.can_short`, default `false`) → bot short (có entry_short) **luôn fail parse**. Nhưng file mẫu BE có `can_short` ở **top-level**, configurations **không** mang `can_short`. Rule này khiến FE chặt hơn BE → sai hướng.

**Files:**

- Modify: `src/schemas/unified-bot-strategy.schema.ts:489-499` (rule 3 trong `strategyConfigurationsSchema`)
- Test: `src/lib/serializer.test.ts`

- [ ] **Step 1 — Test đỏ:** thêm test: build bot short (direction='short', có entry_short) qua `buildUnifiedPayload` → `unifiedBotStrategyCreateSchema.safeParse` phải `success === true`.

```ts
it('short indicator bot passes unified schema (regression: can_short rule)', () => {
  const store = useBuilderStore.getState();
  store.resetAll();
  store.patchBotConfig({
    pair: 'BTC-USDC',
    marketType: 'futures',
    leverage: 10,
  });
  store.patchStrategy({
    name: 'S',
    indicators: [makeIndicator('RSI')],
    entryConditions: {
      groupConnector: 'AND',
      groups: [
        {
          id: 'g',
          intraConnector: 'AND',
          rules: [
            {
              id: 'r',
              left: 'RSI-14',
              op: '<',
              right_type: 'number',
              right_number: 30,
              right_indicator: null,
              lookback: 0,
            },
          ],
        },
      ],
    },
  });
  store.patchDirection({ direction: 'short', orderType: 'market' });
  store.patchCloseMethod({
    type: 'tp_sl',
    tpEnabled: false,
    tpLevels: [],
    slEnabled: false,
    slValue: -3,
  });
  const res = unifiedBotStrategyCreateSchema.safeParse(
    buildUnifiedPayload(useBuilderStore.getState()),
  );
  expect(res.success).toBe(true);
});
```

- [ ] **Step 2 — Chạy, xác nhận đỏ:** `npx vitest run src/lib/serializer.test.ts -t "can_short rule"` → FAIL với issue `configurations.can_short`.
- [ ] **Step 3 — Fix:** **bỏ rule (3)** — xoá block `/* (3) Short conditions imply can_short */` (schema.ts:489-499). BE không enforce kiểu này (mẫu để can_short top-level).
- [ ] **Step 3b — Sửa test đỏ sẵn có (review bắt):** `src/schemas/__tests__/unified-bot-strategy.test.ts:285` ("rejects short conditions when can_short is false") sẽ đỏ → **đảo** thành assert short conditions PASS. Sửa comment stale ở `ImportDialog.test.tsx:105-109`.
- [ ] **Step 4 — Chạy, xác nhận xanh:** test mới PASS, test cũ đã đảo PASS. `pnpm test` toàn xanh.
- [ ] **Step 5 — Commit:** `fix(schema): drop can_short rule that blocked short-bot submit (BE checks top-level can_short)`

### Task 1.2: op cross gửi quá khứ (`crossed_above`)

**Bối cảnh:** FE emit `crosses_above` (ConditionRow.tsx:35); mẫu BE dùng `crossed_above`. Convert tại lúc serialize (giữ UI/state hiện tại present-tense, chỉ đổi trên dây). Đã có chiều ngược (deserialize coerce past→present ở serializer.ts:491-495) nên không vỡ round-trip.

**Files:**

- Modify: `src/lib/condition-tree.ts:39-51` (`ruleToBE`)
- Test: `src/lib/condition-tree.test.ts` (tạo nếu chưa có) hoặc `serializer.test.ts`

- [ ] **Step 1 — Test đỏ:** serialize 1 rule op `crosses_above` → BE item `op === 'crossed_above'`; `crosses_below` → `crossed_below`; op khác giữ nguyên.

```ts
it('serializes cross ops to BE past tense', () => {
  const tree = {
    groupConnector: 'AND',
    groups: [
      {
        id: 'g',
        intraConnector: 'AND',
        rules: [
          {
            id: 'r',
            left: 'candle.close',
            op: 'crosses_above',
            right_type: 'indicator',
            right_number: null,
            right_indicator: 'BB-20',
            lookback: 0,
          },
        ],
      },
    ],
  } as const;
  const be = serializeTreeToBE(tree);
  expect((be.conditions[0] as { op: string }).op).toBe('crossed_above');
});
```

- [ ] **Step 2 — Chạy đỏ.**
- [ ] **Step 3 — Fix:** trong `ruleToBE`, map khi gán `op`:

```ts
const TENSE: Record<string, string> = { crosses_above: 'crossed_above', crosses_below: 'crossed_below' };
// ...
op: (TENSE[rule.op] ?? rule.op) as BEPlainItem['op'],
```

- [ ] **Step 4 — Chạy xanh** + `pnpm test`.
- [ ] **Step 5 — Commit:** `fix(serializer): emit past-tense cross ops to match BE (crossed_above)`

### Task 1.3: Hết gửi `configurations.leverage`/`process_only_new_candles` lệch top-level

**Bối cảnh:** schema default inject `leverage:1`, `process_only_new_candles:true`, `interface_version`, `can_short:false`, `position_adjustment_enable`, `max_entry_position_adjustment` vào `configurations` (vì `buildStrategyPayload` không set, Zod `.default()` điền). → lệch top-level (`leverage:10`), và mẫu BE **không có** mấy field này trong configurations. Nguy hiểm nhất: nếu BE đọc `configurations.leverage` → bot chạy 1x. ⚠️ **Chờ Phase 0 xác nhận BE đọc field ở đâu**; nếu BE đọc top-level (như mẫu) thì bỏ default trong configurations là an toàn + khớp mẫu.

**Files:**

- Modify: `src/schemas/unified-bot-strategy.schema.ts:435,439,441,461,462,463` (đổi `.default(x)` → `.optional()` cho các field configurations không có trong mẫu)
- Test: `src/lib/serializer.test.ts`

- [ ] **Step 1 — Test đỏ:** `buildUnifiedPayload` (leverage top=10) → sau parse, `configurations` **không** chứa key `leverage` (hoặc nếu giữ thì = 10, không phải 1). Assert `'leverage' in wire.configurations === false`.
- [ ] **Step 2 — Chạy đỏ** (hiện configurations.leverage = 1).
- [ ] **Step 3 — Fix:** đổi trong `baseStrategyConfigurationsSchema`: `interface_version`, **`timeframe`**, `process_only_new_candles`, `can_short`, `leverage`, `position_adjustment_enable`, `max_entry_position_adjustment` (7 field — review bổ sung `timeframe`) từ `.default(...)` → `.optional()`. (Đã verify review: không consumer nào đọc `configurations.<field>` này.)
- [ ] **Step 4 — Chạy xanh** + `pnpm typecheck` + `pnpm test`.
- [ ] **Step 5 — Commit:** `fix(schema): stop injecting configurations defaults that conflict with top-level (leverage/process_only/...)`

### Task 1.4: stoploss khi tắt SL = `null` + bỏ top-level

**Bối cảnh:** BE đọc `configurations.risk.stoploss`; Tuấn chốt **tắt SL → `risk.stoploss: null`**. Hiện FE ghi `-0.4` (stop −40% margin thật). Top-level `stoploss` BE bỏ + mẫu không có → bỏ luôn.

**⚠️ DECOUPLE (review bắt):** KHÔNG đổi `buildRisk` (dùng chung legacy `buildBundle` → `bundleSchema` bắt `number`). Chỉ override null tại chỗ build unified.

**Files:**

- Modify: `src/lib/serializer.ts` `buildUnifiedPayload` — sau khi có `strategy.configurations`, override: `configurations.risk.stoploss = (close.type==='tp_sl' && close.slEnabled) ? close.slValue/100 : null`. **Không sửa `buildRisk`.**
- Modify: `src/lib/serializer.ts:406-408` — bỏ field `stoploss`+`trailing_stop` top-level khỏi `buildUnifiedPayload`.
- Modify: `src/schemas/unified-bot-strategy.schema.ts:358` — `riskConfigSchema.stoploss` → `z.number().nullable()` (bỏ `.default`). **`strategy.schema.ts` giữ nguyên `number`.**
- Modify: `src/lib/serializer.ts:612-613` — deserialize unified: `slEnabled = risk?.stoploss != null`; `slValue = (risk?.stoploss ?? -0.04)*100`. **`deserializeBundle:311-313` giữ nguyên.**
- Test: `src/lib/serializer.test.ts`

- [ ] **Step 1 — Test đỏ:** (a) bot tp_sl tắt SL → `wire.configurations.risk.stoploss === null`; (b) bật SL → `=== slValue/100`; (c) `'stoploss' in wire === false`; (d) round-trip unified: `risk.stoploss=null` → deserialize `slEnabled===false`, `slValue` không NaN; (e) **legacy bundle SL-off vẫn parse OK** (`buildBundle` → `bundleSchema.safeParse` success, `risk.stoploss === -0.4`).
- [ ] **Step 2 — Chạy đỏ.**
- [ ] **Step 3 — Fix** theo Files trên (override ở unified, schema unified nullable, deserialize unified).
- [ ] **Step 4 — Chạy xanh** + `pnpm test` + `pnpm typecheck`.
- [ ] **Step 5 — Commit:** `fix(serializer): SL-off sends risk.stoploss=null per BE (unified only); drop top-level stoploss`

**Gate Phase 1:** dừng cho Tri review. Có thể dump payload thật so lại với `BE/user_24_..._024552.json` (signals rỗng) để chắc khớp.

---

## PHASE 2 — Indicator catalog theo whitelist (đã gỡ chặn)

> Tuấn xác nhận: `right_indicator` match theo **key** (tên indicator + output), thứ tự param trong chuỗi không quan trọng. Multi-output phải kèm `output`. → làm được; test round-trip thật để chốt.

### Task 2.1: Catalog từ `indicator_whitelist.json`

- [ ] Đưa `indicator_whitelist.json` thành nguồn của `INDICATOR_REGISTRY` (14 indicator, đúng `id` BBANDS/SMA/EMA/STOCH/..., `type` talib|pandas_ta, `outputs`, `parameters` từ whitelist). Bỏ `ATR` (không có trong whitelist), tách `MA`→`SMA`+`EMA`, đổi `BB`→`BBANDS`, `Stochastic`→`STOCH`.
- [ ] Migrate template catalog (`src/templates/catalog/*`) + builder store dùng tên cũ (`BB`/`MA`/`Stochastic`/`ATR`).
- [ ] Test: mỗi entry whitelist load được; tên khớp.

### Task 2.2: `IndicatorItem.output` + serialize multi-output

- [ ] Thêm `output?: string` vào IndicatorItem (đã có `timeframe?`). UI cho chọn output với indicator multi-output (BBANDS upper/middle/lower, MACD macd/signal/hist, STOCH slowk/slowd, STOCHRSI fastk/fastd) — render từ `outputs` trong whitelist.
- [ ] `serializeIndicators`: emit `{name, type, output?, parameters, pandas_ta_func?, requires_datetime_index?, timeframe?}` — **1 entry / output được dùng**, cùng param khác `output`. talib single-output không gửi `output`. pandas_ta thêm `pandas_ta_func`.
- [ ] **`parameters` gửi ĐỦ** mọi param theo whitelist (Tuấn chốt đợt 3). ⚠️ KHÔNG bắt chước param thiếu trong file PATCH — đó là bug UI Tuấn, em ấy đang sửa.
- [ ] Test: so output serialize với mẫu PATCH NHƯNG **param phải đủ** (không theo chỗ PATCH thiếu).

### Task 2.3: `right_indicator` reference theo key + output

- [ ] `ConditionRow` UI: với indicator multi-output, cho chọn `output`; set `right_indicator` chứa đúng tên indicator + output (thứ tự param không bắt buộc — BE match theo key).
- [ ] **Verify round-trip thật:** tạo bot BBANDS-cross trên local → gửi BE → 201 + bot gen đúng. Chốt format chuỗi cuối cùng từ kết quả thật (không chế).
- [ ] Test: condition tham chiếu BBANDS upperband → `right_indicator` chứa `BBANDS` + map được output `upperband`.

**Gate Phase 2:** dump payload bot BBANDS, **diff byte phần signals** với `BE/user_24_..._025319.json` → phải khớp.

---

## PHASE 3 — Nâng cao (DEFER — cần Tri quyết product)

- [ ] **Multi-timeframe informative:** UI chọn informative timeframe; indicator gắn `timeframe`; `informative_timeframes` liệt kê. (mẫu PATCH có.)
- [ ] **custom_indicator_items:** UI cho user tự định nghĩa (rolling_max/min/mean...). (mẫu PATCH có.)
- [ ] **Bot 2 chiều:** cho điền cả entry/exit long+short trong 1 bot (mẫu create #2). Đập lại bước Direction.

→ 3 mục này là feature mới, nên **brainstorm riêng** trước khi plan chi tiết. Bản này chỉ lo conformance create-payload cho phạm vi hiện có.

---

## Self-review

- Spec coverage: mọi dòng "Bản đồ khoảng cách" có task (Phase 1 cho 🔴/🟠 không-chặn; Phase 2 cho indicator; Phase 3 defer cho ⏸).
- Gating rõ: Phase 1 độc lập; Phase 2 chờ `right_indicator`; Phase 3 chờ product.
- Không chế: chỗ chưa có spec (`right_indicator`) đánh dấu chờ Tuấn, không bịa công thức.
