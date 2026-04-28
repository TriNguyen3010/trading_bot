# Implementation Plan — API Spec Integration

> Plan thực thi 3 bước: (1) auto-gen TS types, (2) build payload sample mới, (3) update Zod schemas + thêm validation cho condition tree.
>
> **Bối cảnh codebase**: Project đã có `zod`, `@hookform/resolvers`, `vitest`, và 3 file Zod schemas hiện tại (`src/schemas/{bot,strategy,bundle}.schema.ts`) **đang mirror format LEGACY**. Plan này KHÔNG build từ đầu — mà refactor những thứ đã có cho khớp `Data/openapi.json`.
>
> **Order**: 1 → 2 → 3 (bước sau phụ thuộc bước trước).

---

## Bước 1 — Auto-generate TypeScript types từ `openapi.json`

### 1.1. Mục tiêu

Có file `src/types/api.d.ts` chứa toàn bộ types từ OpenAPI spec. Mọi component / service gọi API import types từ đây thay vì gõ tay. Khi BE update spec → chạy 1 lệnh, types tự đồng bộ.

### 1.2. Việc cần làm

**1.2.1. Install dev dependency**

```bash
pnpm add -D openapi-typescript
```

Tool này không cần runtime, chỉ chạy lúc dev/build.

**1.2.2. Thêm script vào `package.json`**

Thêm 2 script vào `"scripts"`:

```json
{
  "gen:api": "openapi-typescript Data/openapi.json -o src/types/api.d.ts",
  "gen:api:watch": "openapi-typescript Data/openapi.json -o src/types/api.d.ts --watch"
}
```

**1.2.3. Chạy lần đầu**

```bash
pnpm gen:api
```

Output: `src/types/api.d.ts` (~1500 dòng).

**1.2.4. Tạo helper module `src/types/api-helpers.ts`**

File này expose các type quan trọng nhất bằng tên ngắn, để code app không phải gõ `components["schemas"]["UnifiedBotStrategyCreate"]` mỗi lần:

```ts
import type { components, paths } from "./api";

// Schemas
export type Schemas = components["schemas"];

// Request payloads
export type CreatePayload = Schemas["UnifiedBotStrategyCreate"];
export type UpdatePayload = Schemas["UnifiedBotStrategyUpdate"];

// Response
export type BotStrategyResponse = Schemas["BotStrategyOut"];
export type BotResponse = Schemas["BotOut"];
export type StrategyResponse = Schemas["StrategyOut"];

// Sub-schemas (dùng nhiều)
export type StrategyConfigurations = Schemas["StrategyConfigurations"];
export type SignalsConfig = Schemas["SignalsConfig"];
export type IndicatorItem = Schemas["IndicatorItem"];
export type CustomIndicatorItem = Schemas["CustomIndicatorItem"];
export type CustomExitConfig = Schemas["CustomExitConfig"];
export type RiskConfig = Schemas["RiskConfig"];
export type ROIStep = Schemas["ROIStep"];
export type TelegramConfig = Schemas["TelegramConfig"];

// Errors
export type ValidationError = Schemas["HTTPValidationError"];

// Endpoint paths (dùng cho fetch wrapper sau này)
export type Paths = paths;
```

**1.2.5. Commit `src/types/api.d.ts` vào git (KHÔNG gitignore)**

Lý do: nếu gitignore, người clone fresh chưa có `node_modules` sẽ không build được. Thay vào đó, **CI verify** rằng file đã commit khớp với `openapi.json` mới nhất (xem 1.2.7).

**1.2.6. Cập nhật `setup_local.sh`**

Thêm `pnpm gen:api` vào cuối script setup → đảm bảo dev mới clone về có types đúng.

**1.2.7. (Optional) Thêm CI check**

Script `pnpm gen:api && git diff --exit-code src/types/api.d.ts` — nếu file generated khác file đã commit → CI fail. Đảm bảo không ai quên regen sau khi sửa `openapi.json`.

### 1.3. Verification

- `pnpm typecheck` pass.
- Mở 1 file bất kỳ, import `CreatePayload` từ helper, gõ `payload.` → IDE gợi ý 45 field.
- Gõ `payload.stake_currency = "XRP"` → TypeScript báo đỏ vì `XRP` không trong enum `"USDT"|"USDC"|"BTC"|"ETH"|"BNB"|"BUSD"`.

### 1.4. File tạo/sửa

| File | Thao tác |
|---|---|
| `package.json` | Thêm 2 script + 1 devDep |
| `src/types/api.d.ts` | **Tạo mới** (auto-gen) |
| `src/types/api-helpers.ts` | **Tạo mới** (helper) |
| `setup_local.sh` | Thêm 1 dòng `pnpm gen:api` |

### 1.5. Effort

~10–15 phút. Risk thấp: chỉ thêm dev dependency, không động code app.

---

## Bước 2 — Build payload sample mới

### 2.1. Mục tiêu

Có 2 file JSON mẫu **đầy đủ** trong `Data/`, đã migrate từ format legacy sang format mới. Dùng để: (a) test Postman/Bruno trước khi tích hợp, (b) làm fixture cho unit test ở Bước 3, (c) reference cho dev mới.

### 2.2. Việc cần làm

**2.2.1. Tạo `Data/payload_bot_strategy_create.json`**

Lấy nội dung từ `Data/payload_create_bot.json` + `Data/payload_create_strategy.json`, áp dụng migration mapping (theo `API_SPEC.md` mục 8):

- Gộp 2 file thành 1 object phẳng (top-level fields của bot + `configurations`).
- ~~Đổi `pair: "BTC/USDT:USDT"` → `pair: "BTC/USDT"`~~ → **KHÔNG cần đổi**, BE accept cả 2 format (xem `API_SPEC.md` mục 8.bis).
- Đổi `name` → `strategy_name`, `description` → `strategy_description`.
- Bỏ `bot_id`, bỏ `ai_powered` (cả top-level lẫn nested).
- Mở rộng `telegram.notification_settings`: thêm các event còn thiếu (`status`, `warning`, `startup`, `entry`, `entry_cancel`, `exit`, `exit_cancel`) với value `"on"|"off"|"silent"` thay cho `"on"|"off"` cũ.
- Thêm `interface_version: 3` vào `configurations`.

**2.2.2. Tạo `Data/payload_bot_strategy_update.json`**

Tạo payload PATCH minimal: chỉ thay `pair`, `stake_amount`, `strategy_configurations` (1 field con).

**2.2.3. Validate sample**

Viết script tạm `scripts/validate-sample.mjs` dùng `ajv` hoặc Zod parse sample → đảm bảo accept. Output: in ra success hoặc lỗi cụ thể.

```bash
node scripts/validate-sample.mjs Data/payload_bot_strategy_create.json
```

(Khi Bước 3 xong, có thể xoá script tạm này, dùng Zod schema chính thức.)

### 2.3. Verification

- File JSON syntax valid (`jq . file.json`).
- Script validate pass.
- Optional: dùng Postman/Bruno gọi BE thật với payload này → 201 OK.

### 2.4. File tạo/sửa

| File | Thao tác |
|---|---|
| `Data/payload_bot_strategy_create.json` | **Tạo mới** |
| `Data/payload_bot_strategy_update.json` | **Tạo mới** |
| `scripts/validate-sample.mjs` | **Tạo mới** (tạm, có thể xoá sau B3) |
| `Data/payload_create_bot.json` | **Giữ lại** — đổi tên thành `payload_create_bot.legacy.json` để rõ ràng |
| `Data/payload_create_strategy.json` | **Giữ lại** — đổi tên thành `payload_create_strategy.legacy.json` |

### 2.5. Effort

~20–30 phút. Risk thấp.

---

## Bước 3 — Update Zod schemas + validate condition tree

### 3.1. Mục tiêu

Refactor 3 file Zod hiện tại cho khớp spec mới. **Quan trọng nhất**: định nghĩa condition tree schema (vì BE không validate ở schema layer — đây là responsibility của FE).

### 3.2. Bối cảnh

**File hiện tại (LEGACY format):**
- `src/schemas/bot.schema.ts` — mirror `payload_create_bot.json`
- `src/schemas/strategy.schema.ts` — mirror `payload_create_strategy.json`, đã có `conditionOpSchema` (9 op) và `conditionRightTypeSchema` (3 type)
- `src/schemas/bundle.schema.ts` — wrap `{bot, strategy, meta}` cho 1-file export

**Các vấn đề cần fix:**
- 2 schema bot/strategy tách rời → spec mới là 1 payload unified
- `telegramNotificationSettings` chỉ có 4 event với 2 value → spec có 11 event với 3 value
- `bundleSchema.{bot, strategy}` → cần thay bằng `unifiedBotStrategyCreateSchema`
- Condition tree đã có sẵn `conditionOpSchema` nhưng chưa có toàn bộ `Condition`, `Logic`, `SignalsBlock` schema rõ ràng
- Chưa có cross-field refinement (ví dụ: `right_type='number'` thì `right_number` phải có)

### 3.3. Việc cần làm

**3.3.1. Refactor `src/schemas/bot.schema.ts`**

Trở thành schema cho **bot runtime fields** (subset của UnifiedBotStrategyCreate, không có configurations/strategy_*):

- Mở rộng `telegramNotificationSettingsSchema`: thêm 7 event còn thiếu (`status`, `warning`, `startup`, `entry`, `entry_cancel`, `exit`, `exit_cancel`), value enum thành `["on", "off", "silent"]`. Field default: `entry_fill="off"`, `exit_fill="on"`, `protection_trigger="on"`, `protection_trigger_global="on"`.
- Mở rộng `telegramSchema`: thêm `topic_id`, `authorized_users`, `balance_dust_level`, `reload`.
- Bổ sung enum cho `stake_currency`: `["USDT","USDC","BTC","ETH","BNB","BUSD"]`.
- Bổ sung enum cho `timeframe` (13 giá trị, không có `6h` ở top-level).
- Bổ sung enum `trading_mode`, `margin_mode`, `fiat_display_currency` (39 giá trị).
- Thêm constraint: `stake_amount` là `number > 0` HOẶC string const `"unlimited"`.
- ~~Thêm `pair` regex: `^[A-Z0-9]+\/[A-Z0-9]+$`~~ → **bỏ regex strict** (BE accept cả `BTC/USDT:USDT` perpetual notation theo log production). Chỉ kiểm tra `min(1)` non-empty là đủ.
- Thêm sub-schemas: `unfilledTimeoutSchema`, `entryPricingSchema`, `exitPricingSchema`, `orderTypesSchema`, `orderTimeInForceSchema` (theo `API_SPEC.md` mục 6).

**3.3.2. Refactor `src/schemas/strategy.schema.ts`**

Trở thành schema cho **strategy fields** trong UnifiedBotStrategyCreate:

- Giữ và mở rộng `conditionOpSchema` — verify khớp với `op` BE accept (hỏi BE list đầy đủ nếu cần — spec hiện tại cho free-form, FE quyết định).
- Thêm schema `Condition`, `Logic`, `SignalsBlock`:
  ```ts
  const logicSchema = z.object({
    type: z.enum(["AND", "OR"]),
    threshold: z.number().nullable(),
  });

  const conditionSchema = z.object({
    left: z.string().min(1),
    op: conditionOpSchema,
    right_type: conditionRightTypeSchema,
    right_number: z.number().nullable(),
    right_indicator: z.string().nullable(),
    lookback: z.number().int().min(0).default(0),
    operator: z.enum(["AND", "OR"]).optional(), // chỉ có từ index >= 1
    percentage: z.number().optional(), // chỉ có với op kiểu unary
  }).superRefine((data, ctx) => {
    // Cross-field rules
    if (data.right_type === "number" && data.right_number === null) {
      ctx.addIssue({ code: "custom", path: ["right_number"], message: "Required when right_type=number" });
    }
    if (data.right_type === "indicator" && !data.right_indicator) {
      ctx.addIssue({ code: "custom", path: ["right_indicator"], message: "Required when right_type=indicator" });
    }
    if (data.right_type === "none" && (data.right_number !== null || data.right_indicator !== null)) {
      ctx.addIssue({ code: "custom", path: ["right_type"], message: "Both right_number and right_indicator must be null when right_type=none" });
    }
  });

  const signalsBlockSchema = z.object({
    logic: logicSchema,
    conditions: z.array(conditionSchema),
  });
  ```
- Thêm `signalsConfigSchema` với 6 field (`candlestick`, `indicators`, `entry_long`, `exit_long`, `entry_short`, `exit_short`).
- Thêm `indicatorItemSchema` (7 field theo spec mục 6.2).
- Thêm `indicatorParameterSchema` (9 field).
- Thêm `customIndicatorItemSchema` với enum `operation` đầy đủ (8 giá trị).
- Thêm `customExitConfigSchema` (13 field, có `time_start`/`time_end` regex `HH:MM`).
- Thêm `riskConfigSchema` với refinement: nếu `trailing_stop_positive_offset` có thì phải > `trailing_stop_positive`.
- Thêm `roiStepSchema`.
- Thêm `strategyConfigurationsSchema` (top-level của StrategyConfigurations, ~22 field).

**3.3.3. Cross-reference refinements ở `strategyConfigurationsSchema`**

Đây là phần BE không validate được — FE phải tự lo:

```ts
strategyConfigurationsSchema.superRefine((data, ctx) => {
  // (1) Indicator references trong condition phải tồn tại
  const declaredIndicators = new Set([
    ...data.signals.indicators.map(i => `${i.name}-${i.parameters?.timeperiod ?? ''}`),
    ...data.custom_indicator_items.map(c => `custom.${c.name}`),
  ]);

  const allConditions = [
    ...(data.signals.entry_long?.conditions ?? []),
    ...(data.signals.exit_long?.conditions ?? []),
    ...(data.signals.entry_short?.conditions ?? []),
    ...(data.signals.exit_short?.conditions ?? []),
  ];

  for (const [idx, cond] of allConditions.entries()) {
    if (cond.right_type === "indicator" && cond.right_indicator) {
      if (!declaredIndicators.has(cond.right_indicator)) {
        ctx.addIssue({
          code: "custom",
          path: ["signals", "...", idx, "right_indicator"],
          message: `Indicator '${cond.right_indicator}' chưa được khai báo trong indicators[] hoặc custom_indicator_items[]`,
        });
      }
    }
  }

  // (2) roi_steps phải sort theo minutes tăng dần
  const minutes = data.roi_steps.map(s => s.minutes);
  if (minutes.some((m, i) => i > 0 && m <= minutes[i - 1])) {
    ctx.addIssue({ code: "custom", path: ["roi_steps"], message: "roi_steps phải sort theo minutes tăng dần" });
  }

  // (3) entry_short/exit_short không rỗng → can_short phải true
  const hasShortConditions =
    (data.signals.entry_short?.conditions?.length ?? 0) > 0 ||
    (data.signals.exit_short?.conditions?.length ?? 0) > 0;
  if (hasShortConditions && !data.can_short) {
    ctx.addIssue({ code: "custom", path: ["can_short"], message: "Phải bật can_short khi có short conditions" });
  }

  // (4) custom_exit.partial_enabled=true → position_adjustment_enable=true
  if (data.custom_exit.partial_enabled && !data.position_adjustment_enable) {
    ctx.addIssue({ code: "custom", path: ["position_adjustment_enable"], message: "Phải bật khi custom_exit.partial_enabled=true" });
  }

  // (5) custom_exit.partial_levels: tổng amount phải <= 100
  const totalAmount = data.custom_exit.partial_levels.reduce((s, lv) => s + lv.amount, 0);
  if (totalAmount > 100) {
    ctx.addIssue({ code: "custom", path: ["custom_exit", "partial_levels"], message: `Tổng amount = ${totalAmount}%, phải <= 100%` });
  }
});
```

**3.3.4. Refactor `src/schemas/bundle.schema.ts` → `unified-bot-strategy.schema.ts`**

Thay thế bundle pattern cũ bằng schema unified:

```ts
export const unifiedBotStrategyCreateSchema = z.object({
  // 9 required từ bot.schema
  bot_name, exchange_name, strategy_name, dry_run,
  stake_currency, stake_amount, max_open_trades, timeframe, pair,
  // 36 optional
  ...allOptionalFields,
  // strategy fields
  strategy_description, strategy_type, configurations: strategyConfigurationsSchema,
});

export const unifiedBotStrategyUpdateSchema = z.object({
  // tất cả optional
}).partial();
```

Cross-field refinement bổ sung ở level top:
- `trading_mode === "futures"` hoặc `"margin"` → `margin_mode` required.
- `can_short === true` → `trading_mode` phải là `futures`.
- `leverage > 1` → `trading_mode` không phải `spot`.

**3.3.5. Type alignment với auto-gen types**

Verify rằng `z.infer<typeof unifiedBotStrategyCreateSchema>` **assignable** với `CreatePayload` từ Bước 1:

```ts
import type { CreatePayload } from "@/types/api-helpers";

type ZodInferred = z.infer<typeof unifiedBotStrategyCreateSchema>;

// Compile-time assertion
const _check: CreatePayload = {} as ZodInferred; // phải compile pass
const _check2: ZodInferred = {} as CreatePayload; // ngược lại cũng pass
```

Nếu có lệch → fix Zod schema cho khớp.

**3.3.6. Tích hợp vào form**

Cập nhật form code dùng RHF + `@hookform/resolvers/zod`:

```ts
import { zodResolver } from "@hookform/resolvers/zod";
import { unifiedBotStrategyCreateSchema } from "@/schemas/unified-bot-strategy.schema";

const form = useForm<CreatePayload>({
  resolver: zodResolver(unifiedBotStrategyCreateSchema),
});
```

Khi user bấm submit → Zod validate → fail → form tự highlight field lỗi (RHF handle).

**3.3.7. Unit tests**

Tạo `src/schemas/__tests__/unified-bot-strategy.test.ts`:

- **Good fixtures**:
  - parse `Data/payload_bot_strategy_create.json` (từ Bước 2) → expect pass.
  - parse `request` của `Data/user_2_bot_strategy_create_POST_20260428_042734.json` (log production status 201) → expect pass. Nếu fail → schema FE đang strict hơn BE thực tế (không tốt).
- **Bad fixtures**: tạo các payload sai cố ý:
  - Missing required field → expect fail tại field đó.
  - `stake_currency: "XRP"` → expect fail enum.
  - ~~`pair: "BTC/USDT:USDT"` → expect fail regex~~ → **bỏ test này**, BE accept format này. Thay bằng: `pair: ""` (empty) → expect fail `min(1)`.
  - `right_type: "number"` không có `right_number` → expect fail refinement.
  - `roi_steps` không sort → expect fail refinement.
  - Indicator reference không tồn tại → expect fail refinement.
  - `can_short: false` nhưng có `entry_short.conditions` → expect fail refinement.
  - `partial_levels` tổng amount > 100% → expect fail refinement.
- Run: `pnpm test`.

### 3.4. Verification

- `pnpm typecheck` pass (đặc biệt phần type alignment 3.3.5).
- `pnpm test` pass.
- Mở form trên UI, gõ giá trị invalid → thấy lỗi inline trên field.

### 3.5. File tạo/sửa

| File | Thao tác |
|---|---|
| `src/schemas/bot.schema.ts` | **Sửa lớn** — mở rộng theo spec |
| `src/schemas/strategy.schema.ts` | **Sửa lớn** — thêm sub-schemas |
| `src/schemas/bundle.schema.ts` | **Đổi tên + rewrite** → `unified-bot-strategy.schema.ts` |
| `src/schemas/__tests__/unified-bot-strategy.test.ts` | **Tạo mới** |
| Form code dùng schema cũ | **Update** import path + resolver |
| `src/features/conditions/ConditionRow.tsx` | **Verify** UI sinh đúng `Condition` shape |

### 3.6. Effort

~3–5 giờ (tùy tốc độ refactor + viết test). Đây là bước nặng nhất nhưng ROI cao nhất.

### 3.7. Risk & mitigation

| Risk | Mitigation |
|---|---|
| Existing form code break vì schema thay đổi | Refactor schema xong, search-replace import; chạy `pnpm typecheck` để TS chỉ ra mọi chỗ break |
| Lệch convention condition tree giữa FE và BE | Sau khi viết Zod, gửi sample condition cho BE confirm format khớp với code generator |
| `op` enum FE có nhưng BE không support | Hỏi BE list đầy đủ `op` mà code generator handle; thêm/bớt enum tương ứng |
| Auto-gen type và Zod inferred type lệch nhau | Bước 3.3.5 catch ngay compile-time, sửa khi xảy ra |

---

## Tổng kết — timeline

| Bước | Effort | Phụ thuộc |
|---|---|---|
| 1. Auto-gen types | 10–15 phút | None |
| 2. Payload sample | 20–30 phút | (optional) Bước 1 — để verify type khớp |
| 3. Zod schemas + validation | 3–5 giờ | Bước 1 (cần types để align), Bước 2 (cần fixture cho test) |

**Tổng**: ~4–6 giờ developer time, làm tuần tự.

---

## Definition of Done

- [ ] `pnpm gen:api` chạy thành công, `src/types/api.d.ts` tồn tại và commit.
- [ ] `Data/payload_bot_strategy_create.json` + `payload_bot_strategy_update.json` tạo xong, validate pass.
- [ ] 3 file trong `src/schemas/` đã refactor, 1 file test mới có ≥ 8 case.
- [ ] `pnpm typecheck`, `pnpm lint`, `pnpm test` pass.
- [ ] Form trên UI submit invalid payload → hiện lỗi đúng field.
- [ ] Test E2E (manual với Postman/Bruno) gọi BE thật → 201 OK với payload mới.

---

## Câu hỏi cần BE confirm trước khi triển khai (chặn nhỏ)

1. **Full list `op`** mà code generator BE handle:
   - FE Zod hiện tại có: `>`, `<`, `>=`, `<=`, `==`, `crosses_above`, `crosses_below`, `is_going_up`, `is_going_down`.
   - **Log production cho thấy BE dùng `crossed_above`** (past tense), khác `crosses_above` (present tense) của FE.
   - Cần BE confirm: chuẩn là tense nào? Có cả `crossed_below` không? Có thêm op khác không?
2. **`right_indicator` reference format**:
   - Trước đây đoán: `"custom.{name}"`, `"{NAME}-{period}"`.
   - **Log production cho thấy format thật**: `"BBANDS (Upper Band) - 2.0, 2.0, 14"` — phức tạp hơn nhiều.
   - Cần BE share document chính thức về convention này (order param, output mapping...).
3. **`signals.candlestick`** giá trị hợp lệ chỉ là `["open","high","low","close","volume"]` hay còn key khác?
4. **PATCH `/bot-strategy/{bot_id}`**: nếu gửi field nhưng giá trị `null` → BE coi là "set về null" hay "skip update"?
5. **Response shape thực tế**: Log production trả về subset rất nhỏ (`bot.{id, bot_name, status}`, `strategy.{id, name}`). Spec define đầy đủ 16 field. Đâu là đúng — spec hay log?

Câu 1 và 2 **chặn** Bước 3 (vì ảnh hưởng tới Zod schema). Câu 3, 4, 5 không chặn nhưng cần để FE handle response đúng.
