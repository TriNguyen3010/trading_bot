# PROJECT OVERVIEW — Strategy Builder Tool

> **Last updated**: 2026-05-04
> **Audience**: dev mới onboard. Đọc xong file này hiểu được app làm gì,
> kiến trúc thế nào, ship đến đâu, cần đào tiếp ở chỗ nào.

---

## 1 · App này là gì

Web app **Strategy Builder Tool** — UI để user thiết kế **trading bot
strategy** rồi **export JSON** gửi sang Backend để chạy thực tế.
Backend đang ở giai đoạn integrate sàn DEX **Hyperliquid** (xem §11).

User flow rút gọn:
```
1. Mở app          → empty canvas + Cypheus AI panel bên trái
2. Pick template   → Cypheus animate setup (~6s) → bot configured
   HOẶC tự fill    → 2 phase: Bot Basics + Strategy
3. Review JSON     → live preview pane
4. Export          → download bot-strategy-{name}.json
```

Sàn target: **Hyperliquid** (perpetual DEX). Mode: `dry-run` (paper) hoặc
`live` (real funds).

---

## 2 · Stack

| Layer | Tool |
|---|---|
| Build | Vite 6 + TypeScript 5.7 + pnpm 10 |
| UI | React 18 + Tailwind 3 + shadcn/ui (Radix primitives) |
| State | Zustand 5 (with `persist` middleware) |
| Forms / validation | React Hook Form 7 + Zod 3 |
| Motion | Framer Motion 11 |
| JSON view | prism-react-renderer |
| Toast | Sonner |
| Icons | Lucide React |
| Test | Vitest 2 + jsdom 25 + @testing-library/react |
| Routing | React Router 7 |

**Deploy**: Vercel (rule SPA fallback ở `vercel.json`).

---

## 3 · Branches

| Branch | State | Purpose |
|---|---|---|
| `main` | Production. Đẩy lên Vercel. | Stable. Code đã merge. |
| `feat/2-phase-ui` | **= main** (synced 2026-05-01) | Branch dev hiện tại. Tiếp tục commit feature lên đây rồi merge vào main. |

Cả 2 cùng commit `a45b7a5` (2026-05-01 hotfix). Không lệch nhau.

**Quy ước**:
- Feature branch off từ `main`, đặt tên `feat/<topic>` hoặc `fix/<topic>`.
- Sequential PR scheme: `PR-<TOPIC><N>` trong commit message (vd. `PR-J1`, `PR-W3`).
- Merge bằng `--ff-only` khi feature branch ahead of main, no divergence.

---

## 4 · Run local

```bash
pnpm install
pnpm dev          # http://localhost:5173

# CI parity:
pnpm typecheck    # tsc -b --noEmit  ← dùng cái này, KHÔNG dùng `npx tsc --noEmit`
pnpm test         # vitest run
pnpm build        # tsc -b && vite build  ← match Vercel build
pnpm lint         # eslint
```

⚠️ **Trap**: `npx tsc --noEmit` chạy với root `tsconfig.json` (chỉ có
`references`, không có `compilerOptions`) → **không check gì cả**. Luôn
dùng `pnpm typecheck`.

---

## 5 · Cấu trúc thư mục

```
trading_bot/
├── src/
│   ├── components/ui/         shadcn primitives (button, dialog, sheet, ...)
│   ├── features/              ← feature-folder pattern, mỗi domain 1 folder
│   │   ├── bot-builder/       2-phase canvas + drawer + steps + store
│   │   ├── bot-summary/       "What this bot does" rule-based translator
│   │   ├── close-method/      TP/SL, ROI, indicator-exit forms
│   │   ├── conditions/        ConditionRow + ConditionBuilder (entry rules)
│   │   ├── cypheus/           AI assistant (chat panel, dock, animation)
│   │   ├── export-import/     ExportDialog + ImportDialog + file-utils
│   │   ├── fx/                DotGridSpotlight visual effect
│   │   ├── indicators/        TA indicator registry (RSI, MACD, BB, ...)
│   │   ├── layout-prefs/      Persisted UI prefs (panel collapsed, summary hidden)
│   │   └── templates/         Gallery UI + filter + tracking
│   ├── pages/                 BuilderPage (single-page app, only one route)
│   ├── lib/                   serializer, validator, phase-helpers, utils, pair-format
│   ├── schemas/               Zod schemas (BE shape source of truth)
│   ├── templates/             Template engine + 8-template catalog + animation
│   ├── i18n/                  en.ts (all user-facing strings)
│   ├── types/                 builder.types, api.d.ts (auto-gen từ openapi.json)
│   ├── hooks/                 useKeyboardShortcuts (Ctrl+E export, Ctrl+I import)
│   ├── styles/                tokens.css, fonts
│   ├── test/                  setup.ts (jsdom polyfills)
│   ├── routes.tsx             1-route SPA → /builder
│   └── main.tsx               app entry
├── Data/
│   ├── openapi.json           BE OpenAPI spec
│   ├── API_SPEC.md            BE API human-readable spec
│   ├── IMPLEMENTATION_PLAN.md BE integration plan
│   ├── payload_bot_strategy_*.json  Reference payloads (create/update)
│   ├── indicators_*.json      TALib + PandasTA indicator catalogs
│   └── hyperliquid_*.csv      Top-100 pair volume reference
├── Spec/
│   ├── trading_bot_spec.md    Top-level product spec
│   ├── PROJECT_OVERVIEW.md    ← bạn đang đọc
│   └── Phase 1/               18+ plan docs (xem §10)
├── Ref_screen/                Design reference screenshots (cho Cypheus, FX, ...)
├── public/                    Static (logo.png)
├── scripts/                   validate-sample.mjs (AJV validator cho BE/payload_*.json)
└── tsconfig.{json,app,node}.json   Project references — root delegates to .app
```

---

## 6 · Domain model — BuilderState (single source of truth)

Định nghĩa: **`src/types/builder.types.ts`**.

```ts
BuilderState {
  botName: string

  botConfig: BotConfigForm {
    pair, timeframe, tradingMode (dry-run|live), leverage,
    exchange, marketType (spot|futures), marginMode,
    maxOpenTrades, stakeCurrency, stakeAmount, dryRunWallet
  }

  strategy: EntryStrategyForm {
    name, candlestick[], indicators[], entryConditions: ConditionGroup,
    startupCandleCount, informativeTimeframes[]
  }

  directionForm: DirectionForm {
    direction (long|short), orderType (market|limit),
    limitOffsetPct, slippageTolerance
  }

  closeMethod: CloseMethodForm {
    type (tp_sl|roi|indicator|manual),
    // tp_sl branch
    tpEnabled, tpLevels[], slEnabled, slValue, trailingEnabled, ...
    // roi branch
    roiSteps[]
    // indicator branch
    exitConditions: ConditionGroup
  }

  // bookkeeping
  stepStatus: { 'bot-config' | 'entry-strategy' | 'direction' | 'close-method' → status }
  isDirty, lastSavedAt, openStep, drawerTab, ...
}
```

**Quan trọng**: dù UI là **2-phase** (Bot Basics + Strategy), data layer
**vẫn 4 stepStatus IDs** (legacy, no migration). `Strategy phase` aggregate
3 sub-steps (entry-strategy + direction + close-method) ở UI layer
(`src/lib/phase-helpers.ts`). Xem §7.

---

## 7 · Architecture decisions chính

### 7.1 — 2-phase UI presentation (UI-only refactor)
Spec: `Spec/Phase 1/two_phase_ui_plan.md`. PR-1→PR-4 (Apr 2026).

User chỉ thấy 2 cards: **Bot Basics** + **Strategy** — không phải 4 step
như spec gốc. Lý do: 4 step cũ bị fragmented (Direction + Close là một
chuỗi cứng nên không có lý do tách).

```
DATA LAYER (UNCHANGED)              UI LAYER (NEW)
─────────────────────                ──────────────────
stepStatus['bot-config']      ───→  Phase 1: Bot Basics
stepStatus['entry-strategy']        ┐
stepStatus['direction']        ┼───→ Phase 2: Strategy (composite)
stepStatus['close-method']     ┘
```

Phase 2 drawer là **composite single-pane** (`StrategyDrawerContent.tsx`):
3 collapsible sections (Entry / Action / Advanced), không Setup/Configure
tabs. Save 1 nút → batch `setStepStatus()` 3 sub-steps cùng lúc.

### 7.2 — Phase 1 composite (2026-05-01)
Tương tự cho Phase 1: gộp Setup + Configure tabs thành 1 form duy nhất
(`BotConfigDrawerContent.tsx`). User feedback: 2-tab wizard confusing.

### 7.3 — IDE-style left sidebar
Spec: `feat/2-phase-ui` (Apr 2026).

Panel trái (Cypheus) theo pattern VS Code / Linear:
- Expanded (400px): nav rail dọc + content area
- Collapsed (48px): icon-only strip, user vẫn thấy section icons
- Click section icon khi collapsed → vừa expand vừa switch section

2 sections: **Chat** (Cypheus narrative) + **JSON** (live preview).

### 7.4 — Unified BE schema (Apr–May 2026)
Spec: `src/schemas/unified-bot-strategy.schema.ts` + `BE/IMPLEMENTATION_PLAN.md`.

Backend đổi shape: trước split `{bot, strategy}` (legacy), giờ flat
**`UnifiedBotStrategyCreate`** (1 file, 9 required + 36 optional fields).

FE đã migrate hoàn toàn:
- Schema: `unifiedBotStrategyCreateSchema` (Zod)
- Builder: `buildUnifiedPayload(state)` → `UnifiedBundle`
- Deserializer: `deserializeUnifiedPayload(bundle)` (round-trip safe)
- Export/Import dialogs: dùng schema mới, filename `bot-strategy-{slug}.json`
- JSON live view: 1 pane (không còn `bot.json` / `strategy.json` tabs)

`UnifiedBundle` extends `UnifiedBotStrategyCreate` với 3 FE-only field
(`order_type`, `limit_offset_pct`, `close_method_type`) — Zod tự strip
khi BE validate, FE đọc lại được khi import. Round-trip lossless.

Legacy code (`buildBundle` / `bundleSchema` / `deserializeBundle`) còn
trong `src/lib/serializer.ts` nhưng không có caller nào — chờ cleanup PR.

### 7.5 — Cypheus = scripted AI assistant (không phải LLM thật)
Spec: `Spec/Phase 1/cypheus/cypheus_spec.md`.

Cypheus là **mock AI** — script chạy ở client với typewriter animation.
Không gọi API model nào. Khi user pick template → animation engine
(`src/templates/animation.ts`) chạy:
1. Reset state, set Cypheus thinking → building
2. Pin drawer Phase 1 → typewriter pair → snap timeframe/mode → typewriter leverage → snap rest
3. Pin drawer Phase 2 (composite) → stage candlestick chips → snap indicators → snap entry conditions → direction → close method
4. Show summary view → "All set ✓" → auto-close 2s

Drawer **auto-scrolls** theo section đang fill (`drawer-scroll.ts` +
`data-cy-anchor` markers). Honors `prefers-reduced-motion`.

### 7.6 — Bot Summary (rule-based translator)
Spec: `Spec/Phase 1/bot_summary_plan.md`.

"What this bot does" card dịch BuilderState → human-readable English
prose. **Không dùng LLM** — pure rules trong
`src/features/bot-summary/translators/*` (market, risk, condition,
close-method, direction, indicator-name).

HYBRID 4-layer disclosure:
- L1 pristine → render nothing
- L2 partial / L3 simple → all sections expanded
- L4 complex → auto-collapse Entry/Exit khi >3 lines

Gap footer surfaces fields chưa translate được (BE sees full JSON, user
sees "couldn't fully translate" warning).

Snapshot tests ở `src/features/bot-summary/__tests__/`.

### 7.7 — Bot Templates catalog
Spec: `Spec/Phase 1/bot_templates_plan.md`.

8 starter templates ở `src/templates/catalog/`:
- `cypheus-default` (intermediate, balanced — Bollinger Breakout BTC)
- `conservative-dca-btc` (beginner, conservative)
- `grid-stable-usdt-pairs` (beginner, conservative)
- `rsi-oversold-eth-1h` (beginner, conservative)
- `breakout-btc-15m` (intermediate, balanced)
- `macd-momentum-bnb` (intermediate, aggressive)
- `multi-tf-trend-alts` (advanced, balanced)
- `scalping-btc-1m` (advanced, aggressive)

**Filter chips** (gallery `FilterChips.tsx`):
- Difficulty / Risk / Tag rows
- **Facet narrowing**: pill nào ra 0 kết quả khi combine với filter hiện
  tại → disabled tự động (không cho user vào dead-end). Logic ở
  `filter.ts/computeDimensionCounts()`.

Apply flow: dirty-state guard → ConfirmReplace → animation OR snap-apply
(Shift+click hoặc reduced-motion).

Snapshot tracking: nếu user edit sau khi apply template → "Diverged" badge
(`useDivergedFromTemplate.ts`).

### 7.8 — Drawer fixed width 480px
Spec: builder.store.ts `FIXED_DRAWER_WIDTH`.

Drawer cố định 480px (per user request 2026-04-30). Resize handle đã xoá.
ConditionRow bị overflow khi force `sm:flex-row` → **2-row layout**
consistent (Apr 2026 hotfix).

### 7.9 — Layout prefs (persisted)
File: `src/features/layout-prefs/layout-prefs.store.ts`.

`leftPanelCollapsed`, `botSummaryHidden` persisted ở localStorage.
Reload trang giữ nguyên trạng thái.

---

## 8 · State stores

| Store | File | Persist? | Purpose |
|---|---|---|---|
| `useBuilderStore` | `bot-builder/store/builder.store.ts` | ✅ | Toàn bộ BuilderState (botConfig, strategy, direction, closeMethod, stepStatus, openStep, ...). |
| `useCypheusStore` | `cypheus/store/cypheus.store.ts` | ❌ | Phase, state, avatar, messages, drawer mode, panel tab. Cypheus state ephemeral. |
| `useLayoutPrefsStore` | `layout-prefs/layout-prefs.store.ts` | ✅ | UI prefs: `leftPanelCollapsed`, `botSummaryHidden`. |
| `useTemplatesDialogStore` | `templates/templates-dialog.store.ts` | ❌ | Gallery dialog open/close + detail modal. |
| `useTemplateTrackingStore` | `templates/store.ts` | ✅ | `appliedTemplateId` (for "Based on..." badge + diverge detection). |
| `useExportDialogStore` | `export-import/export-dialog.store.ts` | ❌ | Export dialog open/close. |

**Persist keys**: `bot-builder`, `layout-prefs`, `template-tracking`.
Migration: chưa có version migration nào — clear localStorage nếu schema
break. Plan: `Spec/Phase 1/cypheus/drawer_persistence_plan.md` cho future.

---

## 9 · Backend integration

Source: `BE/openapi.json` + `BE/API_SPEC.md`.

| Endpoint | FE caller | Notes |
|---|---|---|
| `POST /bot-strategy/create` | (chưa wire) | Body = `UnifiedBotStrategyCreate`. Validated bằng `unifiedBotStrategyCreateSchema`. |
| `PATCH /bot-strategy/{bot_id}` | (chưa wire) | Body = `UnifiedBotStrategyUpdate` (partial, schema có sẵn). |

**Hiện trạng**: FE export ra file JSON, **chưa POST trực tiếp**. Tích hợp
HTTP client + auth (wallet connect) là milestone tiếp theo (xem §11).

**Type generation**:
```bash
pnpm gen:api          # openapi-typescript BE/openapi.json → src/types/api.d.ts
pnpm gen:api:watch    # watch mode
```

**Sample validator** (CI gate):
```bash
pnpm validate:sample:create   # AJV check BE/payload_bot_strategy_create.json
pnpm validate:sample:update   # AJV check BE/payload_bot_strategy_update.json
```

---

## 10 · Spec / plan docs

`Spec/Phase 1/` chứa toàn bộ plan + decision log. **Đọc theo thứ tự ưu
tiên**:

| File | Đọc khi | Status |
|---|---|---|
| `README.md` | First — tổng quan Phase 1 milestones | – |
| `ux_design_spec.md` | UX golden path + visual states | – |
| `implementation_plan.md` | Sprint roadmap | – |
| `two_phase_ui_plan.md` | 2-phase UI redesign architecture | ✅ Implemented |
| `bot_summary_plan.md` | Rule-based translator design | ✅ Implemented |
| `bot_templates_plan.md` | Templates catalog + animation engine | ✅ Implemented |
| `cypheus/cypheus_spec.md` | Cypheus persona + scripted demo | ✅ Implemented |
| `cypheus/cypheus_dock_v2_plan.md` | Dock layout + states | ✅ Implemented |
| `cypheus/drawer_persistence_plan.md` | Drawer state across reload | – |
| `card_redesign_plan.md` | Step card visual design | ✅ Implemented |
| `setup_progress_plan.md` | Progress widget per phase | ✅ Implemented |
| `json_empty_state_plan.md` | JSON pane empty/CTA design | ✅ Implemented |
| `drawer_sequential_progression_plan.md` | Drawer save→next routing | ✅ Implemented |
| `DESIGN_GUIDELINES.md` + `design_guideline.md` | Color tokens, spacing, motion | – |
| `card_yellow_stages_plan.md` | Configured-stage contrast | ✅ Implemented |
| `fixes_plan.md` | Bug fix log | – |
| `ui_json_gap_analysis.md` | UI ↔ JSON shape audit | – |

---

## 11 · Đang nghiên cứu / chưa ship

### 11.1 — Wallet connection (Coin98) + Hyperliquid integration
Đang ở giai đoạn discussion. Chưa code. Quyết định pattern:

- **Custody**: Hyperliquid agent wallet (BE giữ private key của agent —
  agent không withdraw được, protocol-level enforcement)
- **Pattern**: Manual paste (user paste agent privkey vào form, BE encrypt + lưu)
- **Per-bot vs per-user**: chưa chốt với BE
- **Form fields**: master address (auto từ Coin98) + agent private key
- **Mode**: Dry-run = không cần API key, Live = cần

Roadmap đề xuất:
- PR-W1: Wallet adapter (Coin98 + MetaMask, Arbitrum + Ethereum)
- PR-W2: AuthService.mock + SIWE login flow stub
- PR-W3: HyperliquidConnectionService.mock + Connections page
- PR-W4: SecretInput component + Test connection state machine
- PR-W5: Builder integration (Live/Dry-run toggle + Connection picker)
- PR-W6: Bundle hygiene (strip secrets từ export)
- PR-W7+: Swap mock → real BE service

Service interface strategy: định nghĩa `AuthService` /
`HyperliquidConnectionService` ở FE trước → BE phản biện trên file
TS interface concrete (xem chat history 2026-05-01 với BE).

### 11.2 — Backtest button
Stub (`disabled` + tooltip "arrives in Phase 2"). Cần BE endpoint.

### 11.3 — Multi-strategy
Hiện tại 1 bot = 1 strategy. `AddStrategyButton` đã có UI ("Coming soon")
nhưng data layer chưa support array.

---

## 12 · Tests + quality gates

```bash
pnpm test         # 146 tests, 14 files (~3-5s)
pnpm typecheck    # 0 errors expected
pnpm lint         # eslint --max-warnings 0
pnpm build        # full prod build (~5s)
```

Key test files:
- `src/lib/serializer.test.ts` — round-trip BuilderState ↔ unified JSON
- `src/lib/phase-helpers.test.ts` — phase aggregation logic
- `src/lib/validator.setup.test.ts` — required field gating
- `src/features/bot-summary/__tests__/*` — translator snapshots
- `src/features/templates/filter.test.ts` — facet narrowing logic
- `src/features/bot-builder/components/StepDrawer.test.tsx` — composite + tabs paths
- `src/features/bot-builder/components/drawer-scroll.test.ts` — anchor scroll helper
- `src/features/cypheus/JsonLiveView.test.tsx` — JSON pane empty/CTA states
- `src/templates/__tests__/validate-all-templates.test.ts` — CI gate: every catalog template parses

CI: Vercel runs `pnpm build` (= `tsc -b` + `vite build`). Type errors
block deploy.

---

## 13 · Onboarding tour (suggested)

**Day 1 — đọc**:
1. File này (`Spec/PROJECT_OVERVIEW.md`) ← đang đọc
2. `README.md` (root) — quick start
3. `Spec/Phase 1/README.md` — milestones
4. `Spec/Phase 1/ux_design_spec.md` — golden path
5. `src/types/builder.types.ts` — domain model
6. `src/pages/BuilderPage.tsx` — entry composition

**Day 1 — chạy**:
```bash
pnpm install && pnpm dev
# → http://localhost:5173
# → Click Templates → pick "Bollinger Breakout" → xem animation
# → Inspect JSON pane bên trái
# → Click Export → download bundle
# → resetAll → tự build manual qua 2 phase
```

**Day 2 — sửa thử bug nhỏ**:
- Tìm 1 i18n string (`src/i18n/en.ts`), đổi text, xem hot reload
- Thêm 1 indicator vào `INDICATOR_REGISTRY` (`src/features/indicators/`)
- Thêm 1 template mới vào `src/templates/catalog/` (CI test sẽ catch nếu shape sai)

**Day 3 — đọc chuyên sâu**:
1. `src/lib/serializer.ts` — heart của data layer
2. `src/templates/animation.ts` — engine của Cypheus
3. `src/features/bot-builder/components/StepDrawer.tsx` — drawer dispatch logic
4. `src/features/bot-summary/summarize.ts` + 1 translator (vd. `condition.ts`)

**Tuần 2** — pick 1 task ở §11 (wallet, backtest, multi-strategy) hoặc
hỏi maintainer.

---

## 14 · Conventions + gotchas

- **i18n-first**: mọi string user-facing ở `src/i18n/en.ts`. Component
  không hardcode text. Mới thêm string → add ở đây trước.
- **Snake_case ở payload, camelCase ở FE**: serializer là biên giới.
  Đừng leak `bot_name` ra ngoài serializer/schemas.
- **Pair format**: UI `BTC-USDC`, JSON `BTC/USDC` (spot) hoặc
  `BTC/USDC:USDC` (perpetual). Biên giới ở `src/lib/pair-format.ts`.
- **Cypheus state vs Builder state**: 2 store độc lập. Đừng mix
  (Cypheus ephemeral, Builder persisted).
- **Drawer fixed 480px**: layout fragile ở widths nhỏ hơn — dùng 2-row
  / wrap thay vì sm:flex-row.
- **Composite drawer pattern**: cả Phase 1 + Phase 2 đều có composite
  Drawer Content. Pattern: `<XDrawerContent onCancel onSave>` + StepDrawer
  prop `xCompositeContent`.
- **`@ts-expect-error`**: tránh dùng. Nếu cần, run `pnpm typecheck` xác
  nhận TS thực sự complain trước khi commit.
- **Files không động vào**:
  - `src/types/api.d.ts` — auto-gen từ openapi
  - `BE/openapi.json` — BE source, không sửa
  - `_tmp_6_*` ở root — artifact cũ, ignore

---

## 15 · Liên hệ + maintainer notes

- **Repo**: `github.com/TriNguyen3010/trading_bot`
- **Default branch**: `main`
- **Active branch**: `feat/2-phase-ui` (= main)
- **Deploy**: Vercel (auto từ `main`)
- **BE**: nhánh khác, owner team backend. FE talk qua `BE/openapi.json`
  + payload samples + spec docs.

Khi stuck:
1. Xem `Spec/Phase 1/<topic>_plan.md` tương ứng (mọi feature lớn đều
   có plan + decision log).
2. Chạy `git log --oneline -- <file>` xem commit history file đó.
3. Hỏi maintainer kèm context: file nào, error gì, đã thử gì.
