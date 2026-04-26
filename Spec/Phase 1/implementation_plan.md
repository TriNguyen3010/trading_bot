# IMPLEMENTATION PLAN – Strategy Builder Tool

> Tài liệu này phân tích bản spec (`trading_bot_spec.md`) và đề xuất kế hoạch triển khai **theo 3 phase**: MVP (strategy builder UI + JSON export), Phase 2 (multi-strategy + backend), Phase 3 (auth ví C98 + DEX).

> **⚠ Trọng tâm MVP = UI/UX.** Đây là công cụ cấu hình strategy, cái user chạm vào đầu tiên và nhớ lâu nhất là trải nghiệm builder, không phải backend. **Luôn đọc `ux_design_spec.md` trước khi code** – plan này chỉ bàn về **cách build**; UX spec bàn về **build cái gì và cảm giác ra sao**.

- **Ngày:** 2026-04-24 (cập nhật scope – UX-first)
- **Liên quan:**
  - `Spec/trading_bot_spec.md` – feature spec (gì cần có)
  - `Spec/ux_design_spec.md` – **UI/UX spec (quan trọng nhất cho MVP)**
  - `Spec/design_guideline.md` – **Design system, tokens, brand, illustration, motion**
  - `Data/payload_create_bot.json`, `Data/payload_create_strategy.json` – output format

---

## 0. Tổng quan 3 phase

| Phase | Scope | Thời lượng | Mục tiêu |
|---|---|---|---|
| **Phase 1 – MVP (đang làm)** | Interactive builder UI + Single strategy + **Export JSON** | **~6 tuần** | Demo được luồng config bot; có file JSON đúng schema để dev backend copy test |
| **Phase 2 – Multi-strategy + Backend integration** | Multi-strategy canvas, Deploy/Backtest API, Dashboard | +6 tuần | Kết nối backend, deploy bot thật (CEX) |
| **Phase 3 – Web3 (C98 + DEX)** | Login ví Coin98, DEX config, on-chain signing | +4 tuần | Bot trade on-chain qua C98 |

**Ưu tiên hiện tại:** Phase 1 – focus hoàn toàn vào UX builder + xuất JSON. Không code auth, không gọi backend, không multi-strategy. Các phase sau vẫn giữ trong tài liệu (section 10, 11, 12) để team có roadmap dài hạn.

---

## 1. Recommended Tech Stack (MVP)

| Layer | Lựa chọn | Lý do |
|---|---|---|
| Framework | **React 18 + TypeScript + Vite** | HMR nhanh, type-safe cho schema JSON phức tạp |
| Layout | **3-cột:** Left panel 400px + Step list 720px + Right drawer 720px (overlay) | Có Cypheus AI assistant + JSON live view bên trái |
| UI components | **shadcn/ui + Radix + Tailwind CSS** | Dark theme khớp mockup, copy-paste source |
| Drawer | **shadcn Sheet (Radix Dialog)** – 720px right-side | Right drawer cho Setup/Configure form |
| State | **Zustand** | Builder state + Cypheus state (messages, scriptState) |
| Form | **React Hook Form + Zod** | Validation schema-based, infer TS type |
| Routing | **React Router v7** | 1 route MVP: `/builder` |
| Icon | **Lucide React** | Khớp style screenshot |
| Motion | **Framer Motion** | Drawer slide, card pulse, message stream, JSON line flash |
| Cypheus avatar | **`lottie-react`** (nếu Lottie) hoặc **CSS animate** (nếu SVG/PNG static) | 3 state idle/thinking/speaking |
| Cypheus AI | **Custom scripted state machine** (no LLM, no backend) | Demo mode – kịch bản hardcode |
| Cursor effect | **Custom Canvas 2D** (particle hoặc dot-grid spotlight – chốt sau) | Background canvas trống quanh step list |
| Toast | **Sonner** | Nhẹ, dark-native |
| JSON syntax highlight | **prism-react-renderer** | JSON live view (left panel tab) |
| Component dev | **Storybook** | Isolate test + handoff designer |
| Test | **Vitest** + **React Testing Library** | Unit test cho serializer + script runner |
| Lint/Format | **ESLint + Prettier + Husky + lint-staged** | |
| Package manager | **pnpm** | |

> **Pivot quan trọng (2026-04-25):**
> - Layout từ vertical list đơn lẻ → **3-cột với Left panel Cypheus**.
> - **Bỏ JSON drawer riêng** (đã merge vào tab JSON trong Left panel).
> - **Bỏ driver.js onboarding tour** (Cypheus magic build chính là onboarding).
> - **Vẫn client-only** – Cypheus là mock scripted, không cần backend.

### Chưa dùng ở MVP (để Phase 2/3)

- ~~React Query~~ – chưa có backend, không cần server state lib.
- ~~wagmi / RainbowKit / Coin98 SDK~~ – chưa login ví.
- ~~Axios~~ – chưa call API; chỉ cần `URL.createObjectURL` để download JSON.
- ~~Recharts / Lightweight-Charts~~ – chưa có dashboard runtime.
- ~~Playwright E2E~~ – MVP unit test là đủ; E2E để Phase 2.
- ~~i18n (react-i18next)~~ – MVP English only, chỉ cần file `i18n/en.ts` tách strings (sẵn sàng swap).
- ~~driver.js~~ – không cần onboarding tour vì Cypheus magic build đã thay thế.
- ~~LLM API / Anthropic / OpenAI / Vercel Functions~~ – Cypheus là mock scripted, không cần backend.

**Gợi ý:** vẫn đưa Zod vào từ MVP để schema validate payload – sau này Phase 2 dùng chung cho backend contract test.

### Folder bổ sung (MVP)

```
src/features/
├── cypheus/                       # Cypheus AI assistant (scripted)
│   ├── CypheusPanel.tsx           # Container 400px left panel + 2 tab
│   ├── CypheusChat.tsx            # Chat thread
│   ├── CypheusInput.tsx           # Multi-line input + send
│   ├── CypheusAvatar.tsx          # 3 state idle/thinking/speaking
│   ├── MessageBubble.tsx          # User + Cypheus bubble variants
│   ├── JsonLiveView.tsx           # Tab thứ 2 trong panel
│   ├── CreateNewBotButton.tsx     # Reset toàn bộ + confirm dialog
│   ├── script/
│   │   ├── greeting.script.ts     # Greeting auto khi load
│   │   ├── magic-build.script.ts  # Magic build 45s
│   │   └── script-runner.ts       # State machine + animation timing
│   └── store/cypheus.store.ts     # Zustand: messages[], scriptState
│
└── fx/                            # Background visual effect
    ├── CursorParticles.tsx        # Hoặc DotGridSpotlight (chốt sau)
    ├── useCursorParticles.ts
    └── particle-pool.ts
```

**Đã bỏ:** ~~`features/onboarding/`~~ (Cypheus thay thế driver.js tour).

---

## 2. Kiến trúc tổng thể (MVP)

```
┌───────────────────────────────────────────────────────────┐
│  React SPA (Vite) – client-only, không cần backend        │
│                                                           │
│  Route MVP:                                               │
│    /         → redirect /builder                          │
│    /builder  → Vertical step list + Right drawer          │
│                                                           │
│  Feature modules (MVP):                                   │
│    ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│    │ bot-builder/ │  │ indicators/  │  │ conditions/  │  │
│    │ (StepList    │  │              │  │              │  │
│    │  + Drawer)   │  │              │  │              │  │
│    └──────────────┘  └──────────────┘  └──────────────┘  │
│    ┌──────────────┐  ┌────────────────┐                  │
│    │ close-method/│  │ export-import/ │                  │
│    └──────────────┘  └────────────────┘                  │
│    ┌──────────────┐  ┌──────────────┐                    │
│    │ onboarding/  │  │ fx/          │                    │
│    │ (driver.js)  │  │ (particles)  │                    │
│    └──────────────┘  └──────────────┘                    │
│                                                           │
│  Core:                                                    │
│    stores/ (zustand – persist localStorage)               │
│    lib/    (serializer.ts, validator.ts)                  │
│    schemas/ (zod: bot.schema, strategy.schema)            │
│    components/ui/ (shadcn)                                │
└───────────────────────────────────────────────────────────┘
```

**Không có backend ở MVP.** State lưu `localStorage` (auto-save). Deploy button đổi thành **"Export JSON"** → download 2 file (`bot.json`, `strategy.json`) hoặc gộp 1 file `.json`.

### Data flow MVP

```
User click step card
      │
      ▼
Drawer 720px slide từ phải, canvas dim 50%
      │
      ▼
User điền form trong tab Setup / Configure
      │
      ▼
React Hook Form (per-step) ── validate on blur (Zod)
      │
      ▼
Click "Save & Next" hoặc "Save"
      │
      ▼
Zustand store (BuilderState) ── persist localStorage (debounce 1s)
Card cập nhật state: pending → configured ✓
      │
      ▼ (click "Export" trên header)
Zod validate toàn bộ → fail? highlight step lỗi + tooltip
      │ pass
      ▼
serializer.buildBotPayload(state)        → bot.json
serializer.buildStrategyPayload(state)   → strategy.json
      │
      ▼
Download file (Blob + URL.createObjectURL)
hoặc Copy to clipboard
hoặc Show JSON trong drawer view
```

---

## 3. Cấu trúc thư mục (MVP)

```
src/
├── main.tsx
├── App.tsx
├── routes.tsx
│
├── pages/
│   └── BuilderPage.tsx
│
├── features/
│   ├── bot-builder/
│   │   ├── StepList.tsx                 # Vertical list 4 step card căn giữa
│   │   ├── steps/
│   │   │   ├── BotConfigStep.tsx        # StepCard + drawer content
│   │   │   ├── EntryStrategyStep.tsx
│   │   │   ├── DirectionStep.tsx
│   │   │   └── CloseMethodStep.tsx
│   │   ├── components/
│   │   │   ├── StepCard.tsx             # Card collapsed view
│   │   │   ├── StepConnector.tsx        # Vertical line + `+` button
│   │   │   ├── StepDrawer.tsx           # Sheet 720px + Setup/Configure tabs
│   │   │   ├── AddStrategyButton.tsx    # Coming soon button
│   │   │   └── HeaderToolbar.tsx        # Bot name + Backtest + Export
│   │   └── store/builder.store.ts
│   │
│   ├── indicators/
│   │   ├── IndicatorPicker.tsx
│   │   ├── IndicatorChip.tsx
│   │   ├── IndicatorParamForm.tsx
│   │   └── indicator-registry.ts        # RSI/MA/MACD/BB/ATR/Stochastic
│   │
│   ├── conditions/
│   │   ├── ConditionBuilder.tsx         # AND/OR (no nested for MVP)
│   │   ├── ConditionRow.tsx
│   │   └── OperatorSelect.tsx
│   │
│   ├── close-method/
│   │   ├── CloseMethodTabs.tsx          # Manual / TP-SL / Indicator / ROI
│   │   ├── TpSlForm.tsx
│   │   ├── RoiStepsForm.tsx             # ROI table
│   │   └── IndicatorExitForm.tsx
│   │
│   ├── export-import/
│   │   ├── ExportDrawer.tsx             # Preview JSON + Download + Copy
│   │   ├── ImportDialog.tsx             # Paste hoặc upload JSON
│   │   └── file-utils.ts
│   │
│   ├── onboarding/
│   │   ├── TourProvider.tsx             # driver.js wrapper
│   │   ├── tour-steps.ts                # 5 step tour config
│   │   └── useTour.ts
│   │
│   └── fx/
│       ├── CursorParticles.tsx          # Canvas full-screen background
│       ├── useCursorParticles.ts
│       └── particle-pool.ts
│
├── lib/
│   ├── serializer.ts
│   ├── deserializer.ts
│   ├── validator.ts
│   ├── pair-format.ts                   # BTC-USDC ↔ BTC/USDT:USDT
│   └── constants.ts
│
├── schemas/
│   ├── bot.schema.ts
│   ├── strategy.schema.ts
│   └── indicator.schema.ts
│
├── components/
│   ├── ui/                              # shadcn (Sheet, Tabs, Dialog,…)
│   └── common/
│
├── hooks/
│   ├── useAutoSave.ts
│   ├── useUndoRedo.ts
│   └── useKeyboardShortcuts.ts
│
├── i18n/
│   └── en.ts                            # Tách strings để dễ thêm VI sau
│
└── types/
    ├── bot.types.ts
    └── builder.types.ts
```

**Không có** `api/`, `features/auth/`, `features/dashboard/`, `features/backtest/`, `BotListPage`, `BotDashboardPage` – để Phase 2+.

**Đã bỏ so với plan canvas:** `Canvas.tsx`, `nodes/*Node.tsx`, `edges/DashedEdge.tsx` – không còn React Flow.

---

## 4. Data model (TypeScript) – nguồn sự thật

Zod schema match chính xác 2 file payload mẫu (copy y nguyên, không thêm field DEX/wallet):

```ts
// schemas/strategy.schema.ts
export const conditionSchema = z.object({
  left: z.string(),
  op: z.enum([">", "<", ">=", "<=", "==",
              "crosses_above", "crosses_below",
              "is_going_up", "is_going_down"]),
  right_type: z.enum(["indicator", "number", "none"]),
  right_number: z.number().nullable(),
  right_indicator: z.string().nullable(),
  lookback: z.number().int().default(0),
  percentage: z.number().optional(),
  operator: z.enum(["AND", "OR"]).optional(),
});

export const indicatorSchema = z.object({
  name: z.string(),
  type: z.enum(["talib", "pandas_ta", "custom"]),
  parameters: z.record(z.union([z.number(), z.string()])),
});

export const strategyPayloadSchema = z.object({
  name: z.string().min(1),
  description: z.string().nullable(),
  strategy_type: z.literal("statistical"),
  configurations: z.object({
    startup_candle_count: z.number().int().positive(),
    informative_timeframes: z.array(z.string()),
    risk: riskSchema,
    roi_steps: z.array(z.object({ minutes: z.number(), roi: z.number() })),
    signals: signalsSchema,
    custom_indicator_items: z.array(customIndicatorSchema),
    custom_exit: customExitSchema,
    // ...
  }),
  bot_id: z.number().default(0),        // MVP hardcode 0, Phase 2 mới nhận từ server
  ai_powered: z.boolean().default(false),
});

export type StrategyPayload = z.infer<typeof strategyPayloadSchema>;
```

**Canvas state MVP** – chỉ 1 strategy:

```ts
// types/canvas.types.ts
export type BuilderState = {
  botName: string;
  configBot: ConfigBotForm;
  strategy: EntryStrategyForm;            // MVP: SINGLE, không phải array
  nodes: RFNode[];
  edges: RFEdge[];
  isDirty: boolean;
  lastSavedAt: number | null;
};

export type EntryStrategyForm = {
  id: string;
  name: string;
  candlestick: Candlestick[];
  indicators: IndicatorItem[];
  direction: "long" | "short";
  orderType: "market" | "limit";
  entryConditions: ConditionGroup;
  closeMethod: CloseMethodForm;
};
```

> **Chuẩn bị cho Phase 2:** khi nâng lên multi-strategy, đổi `strategy: EntryStrategyForm` thành `strategies: EntryStrategyForm[]` – thiết kế BuilderState từ MVP nên để `id` sẵn trong strategy để việc migrate dễ.

---

## 5. Lộ trình Phase 1 – MVP (3 sprint × 2 tuần = ~6 tuần)

> **Nhấn mạnh:** Sprint 1 bắt đầu **sau khi** Figma có design token + node states (xem `ux_design_spec.md` mục 14). Không code chay theo screenshot – dễ rework.

### Sprint 0 (tuần 0–1, song song với sprint 1) – Design & UX kickoff
**Mục tiêu:** chốt được "cảm giác" tool trước khi build. Bám sát `design_guideline.md`.

- [ ] Designer hoàn thành Figma 4 node × 4 state (pending/editing/configured/error)
- [ ] Figma cho ConditionBuilder (1 group + nested group)
- [ ] Figma cho Export drawer + JSON preview
- [ ] Figma cho **Onboarding tour** 5 step (mục 16 UX spec)
- [ ] **3–4 illustration SVG** cho empty state (mục 7 design_guideline)
- [ ] Usability test giả lập bằng Figma prototype với 2–3 user trước code
- [ ] Export design tokens → `tailwind.config.ts` (mục 4-5 design_guideline)
- [ ] Chốt animation spec (mục 8 design_guideline)
- [ ] Placeholder brand: logo tạm + yellow accent – sẵn sàng swap khi user cung cấp

**Deliverable:** Figma ký duyệt + tokens file + illustrations + tour flow; FE có nền tảng code pixel-perfect.

### Sprint 1 – Foundation + 3-column Layout + FX foundation (2 weeks) – **UX foundation**
**Mục tiêu:** setup project, render 3-column layout, 4 step card, drawer 2 tab hoạt động, Left panel structure (Cypheus + JSON tab) skeleton.

- [ ] Init Vite + TS + Tailwind + shadcn/ui + ESLint + Prettier + Husky
- [ ] Import design tokens từ Sprint 0 vào Tailwind config
- [ ] Routing `/builder` (MVP 1 route duy nhất)
- [ ] Zod schemas copy y từ `payload_create_bot.json` + `payload_create_strategy.json`
- [ ] Import Inter font (self-host) + `font-variant-numeric: tabular-nums` global
- [ ] **3-column layout shell:** Left panel 400px + Step list 720px center + Right drawer 720px (overlay)
- [ ] **`StepList`** vertical, max-width 720px, căn giữa
- [ ] **`StepCard`** với **3 state** (pending ⚪ / configured ✓ / error !) – icon góc phải card
- [ ] **`StepConnector`** vertical line + `+` button (MVP click → toast "Coming soon")
- [ ] **`StepDrawer`** dùng shadcn Sheet, width 720px, slide right, overlay dim 50% canvas (KHÔNG dim left panel)
- [ ] Drawer có **2 tab** (Setup / Configure) với shadcn Tabs – không có tab Test
- [ ] Drawer footer: `[Cancel]` + `[Save]` + `[Save & Next →]`
- [ ] **`AddStrategyButton`** cuối list, dashed border, click → dialog "Coming soon"
- [ ] **`CypheusPanel`** skeleton: 2 tab (Cypheus / JSON), tab switching cơ bản
- [ ] **`CypheusAvatar`** component – 3 state placeholder (chờ asset)
- [ ] **`JsonLiveView`** skeleton: 2 sub-tab `bot.json`/`strategy.json`, render JSON từ store
- [ ] Zustand store + auto-save localStorage (debounce 1s) + `Saved 2s ago` indicator
- [ ] Header toolbar: bot name inline edit + Backtest stub + Export stub
- [ ] **Background effect** (particle hoặc dot-grid spotlight – chốt sau): chỉ ở vùng giữa, density giảm 30% khi drawer mở
- [ ] Focus ring + keyboard navigation (Tab qua step card, Enter mở drawer, Esc đóng, Ctrl+/ Ctrl+J toggle Cypheus tab)
- [ ] **Storybook setup** với ≥ 4 component stories (StepCard, StepDrawer, CypheusPanel, JsonLiveView)
- [ ] `src/i18n/en.ts` – tất cả string UI đi qua đây
- [ ] Vitest setup + smoke test

**Deliverable:** mở `/builder` thấy 3-column layout đúng Figma, Left panel 2 tab switch được, Cypheus avatar placeholder hiện, 4 step card có đầy đủ state, click card mở drawer 2 tab, JSON live view tab render JSON từ store, keyboard-only navigate được.

### Sprint 2 – Forms & Core UX patterns (2 weeks) – **Interaction heavy**
**Mục tiêu:** đầy đủ form trong drawer + các interaction pattern quan trọng (chip, indicator chip, condition builder).

- [ ] **`BotConfigStep` drawer:**
  - Tab Setup: Pair (typeahead search), Timeframe, Trading mode (Live/Dry-run + confirm đỏ khi Live), Leverage
  - Tab Configure: Exchange, Spot/Futures, Margin mode, Max open trades, Dry-run wallet, API key fields, Telegram
- [ ] Live validation **on-blur**, clamp leverage, pair search ≥ 2 char
- [ ] **`EntryStrategyStep` drawer:**
  - Tab Setup: Candlestick **chip toggle** + Indicator(s) + Conditions
  - Tab Configure: custom indicator timeframe, lookback default
- [ ] `IndicatorPicker` popover + search (theo screen 3)
- [ ] Indicator registry: RSI, MA, MACD, BB, ATR, Stochastic (metadata + param schema)
- [ ] `IndicatorChip` **inline cog popover** chỉnh param + timeframe (UX spec mục 6.4)
- [ ] Drag để reorder indicator chip trong drawer
- [ ] `ConditionBuilder` AND/OR **flat list** (no nested group cho MVP – đã chốt): pill AND/OR trái, drag handle reorder, row state màu
- [ ] **`DirectionStep` drawer:**
  - Tab Setup: Long/Short toggle + Market/Limit toggle
  - Tab Configure: Limit offset % (chỉ khi Limit), Slippage tolerance
- [ ] **`CloseMethodStep` drawer:**
  - Tab Setup: chọn Method type (Manual / TP-SL / Indicator / **ROI**)
  - Tab Configure: chi tiết theo method (TP-SL multi-level, ROI table, exit conditions, trailing options)
- [ ] `TpSlForm`: take profit multi-level với `+ Add level`, warning nếu tổng % > 100
- [ ] **`RoiStepsForm`** (mới): table {minutes, roi%}, +Add level, hint "Sau X phút, thoát nếu lời ≥ Y%"
- [ ] `IndicatorExitForm` reuse ConditionBuilder
- [ ] Microinteraction pass 1: card pulse khi configured, chip scale, drawer slide spring
- [ ] **Save & Next** flow: drawer tự chuyển sang step kế tiếp khi user bấm Save & Next
- [ ] Add Strategy button hoàn thiện: dialog "Coming soon" với illustration

**Deliverable:** cấu hình được bot "RSI < 30" với TP/SL giống JSON mẫu; mọi interaction trong drawer mượt, Save & Next chain hoạt động, keyboard friendly.

### Sprint 3 – Cypheus Magic Build + Export + UX Polish (2 weeks)
**Mục tiêu:** Cypheus chạy đúng kịch bản 45 giây, JSON live view hoàn thiện, validate, export JSON chuẩn, polish.

**Cypheus AI implementation:**
- [ ] **`CypheusAvatar`** integrate asset từ designer (Lottie hoặc SVG/PNG) với 3 state idle/thinking/speaking
- [ ] **`MessageBubble`** + `TypewriterText` component – typing animation 30ms/char
- [ ] **`CypheusInput`** – multi-line, Enter submit, Shift+Enter newline, KHÔNG voice
- [ ] **`script-runner`** state machine: queue ScriptStep với delay + execute
- [ ] **`greeting.script.ts`** – auto chạy khi load (5s), Cypheus chào
- [ ] **`magic-build.script.ts`** – kịch bản 45s đầy đủ (xem `cypheus/cypheus_spec.md` mục 5)
- [ ] **`CreateNewBotButton`** + confirm dialog – reset toàn bộ state + clear chat + restart greeting
- [ ] **Off-script handler** – user gõ bất cứ gì (kể cả lần 2) → trigger magic build (idempotent)
- [ ] **Speed control** dev-only: query param `?demo-speed=2x`
- [ ] Zustand `cypheus.store.ts`: messages[], scriptState (idle/thinking/building/done), currentStep

**JSON live view:**
- [ ] **`JsonLiveView`** hoàn thiện: syntax highlight (prism-react-renderer)
- [ ] **Line flash xanh** khi field thay đổi (1s fade)
- [ ] Sub-tab `bot.json`/`strategy.json` switch
- [ ] Copy + Download nút mỗi sub-tab
- [ ] "Updated Xs ago" indicator

**Export/Import:**
- [ ] `lib/serializer.ts` convert BuilderState → 2 payload JSON
- [ ] `lib/deserializer.ts` parse JSON → BuilderState (import lại)
- [ ] Export click trên header → trigger download 2 file (hoặc 1 bundle – chốt sau)
- [ ] ImportDialog: paste JSON hoặc upload `.json` → parse lenient, báo lỗi dòng cụ thể
- [ ] **(Bỏ)** ~~Drawer JSON view riêng~~ – đã merge vào Left Panel JSON tab

**Validation & UX polish:**
- [ ] Validation timing: on-blur cho field, on-submit (Export) focus lỗi đầu tiên
- [ ] Step card error state: border đỏ + icon ⚠ + tooltip lý do
- [ ] Export button disable với tooltip liệt kê lỗi còn lại
- [ ] Undo/Redo (Ctrl+Z/Ctrl+Y) + toast Sonner "Undone"
- [ ] Keyboard shortcut: Del, Ctrl+E export, Ctrl+I import, Ctrl+/ Cypheus tab, Ctrl+J JSON tab, ? help overlay
- [ ] Confirm dialog khi xóa node/indicator có data
- [ ] 2–3 template preset – có thể chọn từ **Cypheus chat** hoặc empty state card
- [ ] **(Bỏ)** ~~Onboarding tour driver.js~~ – Cypheus đã làm onboarding
- [ ] Polish background effect: throttle khi drawer mở, fine-tune màu khớp brand
- [ ] **Usability test** với 5 user thật + đo time-to-first-export với Cypheus magic flow
- [ ] Accessibility sweep WCAG AA
- [ ] Unit test coverage `serializer.ts` + `script-runner.ts` ≥ 80%

**Deliverable MVP hoàn chỉnh:**
- User vào tool → Cypheus chào → user gõ bất cứ gì → magic build chạy 45s → 4 step ✓ → JSON sẵn sàng → click Export → file `.json` tải về.
- "Create new bot" reset được state.
- Manual edit qua right drawer vẫn hoạt động bình thường sau khi Cypheus xong.
- Pass accessibility, time-to-first-export ≤ 60s với Cypheus, ≤ 5 phút manual.

### Definition of Done (MVP)

**Functional:**
1. User tạo 1 strategy RSI/Bollinger (Long hoặc Short) + TP/SL 2 level → bấm Export → nhận đúng 2 file JSON giống `payload_create_bot.json` + `payload_create_strategy.json`.
2. Import lại file vừa xuất → UI dựng đúng state ban đầu.
3. Auto-save localStorage hoạt động, refresh không mất data.
4. Validate đầy đủ, không export được payload thiếu field bắt buộc.
5. Unit test coverage `lib/serializer.ts` + `schemas/*` ≥ 80%.

**UX (bắt buộc cho MVP):**
6. **Time-to-first-export ≤ 5 phút** với user mới, không hướng dẫn (đo qua usability test).
7. ≥ 4/5 user trong usability test hoàn thành bài tập "build Bollinger Breakout".
8. Pass toàn bộ **UX Checklist** (UX spec mục 12) trong mọi feature.
9. Contrast WCAG AA, keyboard-only flow đầy đủ, respect `prefers-reduced-motion`.
10. Không có lỗi UX critical: modal chồng modal, disable câm, validate khi gõ, import sai mất data cũ.

**Deliverable:**
11. README hướng dẫn chạy local + video demo 60s + screenshot flow chính.

---

## 6. Rủi ro MVP

| Rủi ro | Mức độ | Mitigation |
|---|---|---|
| Schema payload thực tế khác bản mẫu | Cao | Zod schema version hoá; align với backend sớm trong sprint 1 |
| Nested condition group phức tạp | Trung bình | MVP giới hạn 1 level, Phase 2 nâng 2 level |
| React Flow performance lần đầu làm | Thấp (vì chỉ 1 strategy) | Demo trước, chưa stress test |
| User mất dữ liệu khi refresh | Trung bình | Auto-save localStorage debounce 1s |
| Gap UI ↔ payload (field thiếu UI như `roi_steps`, `telegram`) | Trung bình | MVP cho user nhập qua "Advanced panel" dạng form key-value tạm; Phase 2 làm UI đẹp |

---

## 7. Phase 2 – Multi-strategy + Backend integration (future, ~6 tuần)

Đưa những gì **tạm hoãn ở MVP** lên làm:

### 7.1 Multi-strategy
- Đổi `BuilderState.strategy` → `strategies: EntryStrategyForm[]`.
- Nút "+ Add strategy" (screen 4, 6, 7) render thêm nhánh Entry Strategy song song trên canvas.
- Layout auto (dagre/elkjs) để canvas tự sắp xếp khi add/remove.
- Serializer build N payload_create_strategy từ 1 BuilderState.
- **Chốt với backend:** gửi N request cùng `bot_id` hay 1 request array (xem Open questions spec mục 6.1).

### 7.2 Backend integration
- Thêm `api/` layer (axios + React Query).
- Thay "Export JSON" bằng "Deploy bot" → POST `/api/bots` → POST N × `/api/strategies`.
- Thêm "Backtest" drawer với form chọn khoảng ngày.
- Dashboard page `/bots/:id/dashboard` (Comp.png): stat cards, equity curve, trade list.
- Websocket/polling cho unrealized PnL realtime.

### 7.3 UX nâng cao
- Validation nâng cấp: test connection API key sàn.
- Warning đỏ khi switch Live mode.
- Confirm dialog khi xóa strategy đã cấu hình.
- E2E test Playwright.

**Effort Phase 2:** ~6 tuần = 3 sprint.

---

## 8. Phase 3 – Web3 (Coin98 Wallet + DEX) (future, ~4 tuần)

Đưa toàn bộ Section **"Authentication – login bằng Coin98 Wallet"** + **"DEX Integration"** vào thực thi sau khi Phase 2 xong.

### 8.1 Login bằng Coin98 Wallet (tóm tắt)

Tích hợp combo:
- **Custom wagmi connector** cho C98 extension (detect `window.coin98.provider` + `window.ethereum.isCoin98`).
- **`@coin98t/coin98-connect` SDK** cho multi-chain (EVM + Solana + Near + Sui).
- **WalletConnect v2** làm fallback cho mobile.

Auth flow SIWE (EVM) / SIWS (Solana):
```
Connect wallet → GET /api/auth/nonce → sign message qua C98 (off-chain, không tốn gas)
→ POST /api/auth/verify → nhận JWT → dùng cho mọi request
```

Abstraction `AuthProvider` interface – khi Phase 3 code, scaffold cơ bản có thể làm ngay từ Phase 2 để dễ migrate.

### 8.2 DEX Integration

Thay đổi **Node Config bot**:
- Bỏ Exchange API key / secret → thay bằng wallet đã connect.
- Thêm: Network (BSC/Solana/Polygon…), DEX Protocol (PancakeSwap/Jupiter/Raydium…), Slippage tolerance, Gas strategy, Max gas USD, MEV protection, Token approval policy.
- Token pair thay từ CEX symbol → token address on-chain (có autocomplete).

Payload JSON mở rộng: `owner_wallet`, `network`, `chain_id`, `dex_protocol`, `router_address`, `base_token` / `quote_token` (address + decimals), `execution`, `signing`.

Hai mô hình ký transaction:
- **A – User signs every trade** (an toàn nhất, MVP Phase 3).
- **B – Session key / ERC-4337** (true auto-trade, làm sau Phase 3 nếu cần).

### 8.3 Rủi ro Phase 3 (thêm)

| Rủi ro | Mitigation |
|---|---|
| User mất tiền do bug build tx | Audit logic, dry-run bắt buộc, spend limit |
| Gas spike, MEV front-run | max_gas_usd cap, Flashbots/Jito |
| RPC downtime | Multi-RPC fallback (Ankr + QuickNode) |
| Token approval bị lợi dụng | Default per-trade approve, cảnh báo rõ |
| Giá on-chain khác giá CEX | Cross-check qua Chainlink oracle |

### 8.4 Câu hỏi cần chốt trước Phase 3

1. Chain chính: BSC, Solana, hay cả hai?
2. Mô hình ký A (user sign) hay B (session key) cho MVP Phase 3?
3. DEX protocol nào ưu tiên: PancakeSwap V3, Jupiter, Uniswap V3…?
4. Ngoài C98 có cần support MetaMask/Phantom ngay không?
5. Dry-run simulate bằng Tenderly (trả phí) hay fork local?
6. Spot only hay có perp DEX (GMX/Drift) để có leverage?

**Effort Phase 3:** ~4 tuần = 2 sprint.

---

## 9. Team & effort tổng (3 phase)

| Phase | Sprint | Tuần | Resource |
|---|---|---|---|
| **Sprint 0 (design)** | – | 1 tuần | **0.5 Designer (full-time) + PM** |
| Phase 1 (MVP) | 3 sprint | ~6 tuần | 1 FE lead + 1 FE mid + **0.5 designer** (support xuyên suốt) |
| Phase 2 | 3 sprint | ~6 tuần | thêm 1 BE + 0.5 QA |
| Phase 3 | 2 sprint | ~4 tuần | thêm 1 Web3 engineer + contract audit |
| **Tổng** | **8 sprint** | **~17 tuần** | |

Nếu ưu tiên chỉ Phase 1: **~7 tuần / 1.25 FE + 0.5 designer**.

> **Lưu ý về designer:** Vì MVP là UX-first, designer **không phải resource phụ**. Designer cần:
> - Full-time Sprint 0 (kickoff Figma).
> - Part-time sprint 1–3 để review implementation, điều chỉnh Figma, tham gia usability test.
> - Nếu không có designer → FE lead phải đảm nhận luôn role design, effort MVP cộng thêm ~1 tuần.

---

## 10. Quyết định đã chốt + câu hỏi còn lại

### Đã chốt (2026-04-24)

| Item | Quyết định |
|---|---|
| Design system | Build từ đầu: shadcn + Radix + tokens (`design_guideline.md`) |
| Font | **Inter** (self-host) |
| Logo + brand color | User cung cấp sau – MVP dùng placeholder neutral, tokens đã semantic hoá |
| Empty state illustration | **Có**, 3–4 SVG style minimal line-art mono + accent |
| Onboarding tour | **Có trong MVP** – driver.js, 5 step, ≤ 60s |
| Cursor particle effect | **Có trong MVP** – custom Canvas 2D, inspired by Google Stitch |
| Ngôn ngữ | English only (tách `i18n/en.ts`) |
| Theme | Dark only (tokens sẵn sàng cho light Phase 2) |

### Còn cần chốt trước Sprint 1

1. **Target user của MVP:** Dev backend (cần JSON chuẩn để test API) hay Demo cho stakeholder (cần UI đẹp hơn)?
   → Quyết định mức polish UI trong sprint 3.
2. **Format export:** 2 file rời (`bot.json` + `strategy.json`) hay 1 file bundle (`{"bot":..., "strategy":...}`)?
3. **Field thiếu UI** (`roi_steps`, `telegram`, `margin_mode`…) – MVP có "Advanced JSON panel" để nhập thủ công không, hay hardcode default?
4. **Import lại bot:** chỉ paste JSON, hay upload file `.json`, hay cả hai?
5. **Template preset:** có muốn ship sẵn 2–3 template không? (Bollinger Breakout, RSI Mean Reversion, MACD Cross) – khuyến nghị **có**, vì dùng làm fixture cho empty state cards.
6. **Logo/brand color:** khi nào gửi? Càng sớm càng đỡ rework token.

---

*End of implementation plan – version MVP-focused, UX-first.*
