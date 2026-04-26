# CARD REDESIGN PLAN — Phase 1 MVP

> Plan cho 3 yêu cầu UX mới (2026-04-26):
> 1. Đưa thông tin user đã config **ra ngoài card** (visible trên canvas, như ref design)
> 2. **Rút ngắn** cards pending không cần thiết
> 3. Khi drawer mở, **cards bị drawer che** — phải reflow
>
> Tham chiếu: `Ref_screen/2_Entry_strategy.png`, `Ref_screen/5_close_method.png`, `Ref_screen/6_close_method_2.png`. Phần nối tiếp `fixes_plan.md`.

---

## Tóm tắt 3 yêu cầu

| # | Yêu cầu | Severity | Effort |
|---|---|---|---|
| 4 | Đưa config info ra ngoài canvas (chips/pills visible trên cards) | High (UX) | ~60 min |
| 5 | Rút ngắn pending cards | Medium | ~15 min |
| 6 | Drawer mở → cards bị che → reflow | **HIGH (bug)** | ~15 min |

**Thứ tự đề xuất:** #6 → #5 → #4 (bug fix nhanh → layout polish → feature add lớn).

---

## #6 · Drawer mở → cards canvas không bị che (reflow)

### Triệu chứng
Screenshot user gửi: drawer 720px ở phải. Cards canvas (Bot Config, Entry Strategy, Direction, Close Method) bị **cắt** ở mép phải vì drawer overlay overlap chúng. User mất tính khả kiến của cards khi đang edit.

### Root cause
- `<main>` dùng `flex-1` lấy remaining width sau left panel
- Step list bên trong main: `mx-auto max-w-[720px]` → center trong main full width
- Drawer là `position: fixed; right: 0` → **overlay lên main**, không chiếm flex space (because Radix Portal render ngoài DOM tree của main)
- Khi drawer mở: main vẫn full width → step list center trong main full width → vùng phải của step list bị drawer phủ

### Fix

Dùng CSS variable `--drawer-width` toàn cục, apply `padding-right` cho main → reflow content vào vùng còn lại.

#### A. Set CSS variable từ store state
```tsx
// src/pages/BuilderPage.tsx
const openStep = useBuilderStore((s) => s.openStep);
const drawerWidth = useBuilderStore((s) => s.drawerWidth);

useEffect(() => {
  document.documentElement.style.setProperty(
    '--drawer-width',
    openStep ? `${drawerWidth}px` : '0px',
  );
}, [openStep, drawerWidth]);
```

#### B. Main padding-right với transition smooth
```tsx
<main
  className="relative z-10 flex-1 overflow-y-auto"
  style={{
    paddingRight: 'var(--drawer-width)',
    transition: 'padding-right 250ms cubic-bezier(0.2, 0.8, 0.2, 1)',
  }}
>
```

`padding-right` (không phải `margin-right`) vì:
- Padding: thu nhỏ content box → step list reflow vào content box mới
- Margin: shrink main width nhưng main đã là `flex-1` của parent → không hoạt động như mong muốn

#### C. DotGridSpotlight cũng reflow theo drawer
Background dots không kéo dài đến drawer edge — dừng ở mép drawer:
```tsx
<DotGridSpotlight
  style={{
    top: 'var(--layout-header)',
    left: 'var(--layout-left-panel)',
    right: 'var(--drawer-width)',
    bottom: 0,
    transition: 'right 250ms cubic-bezier(0.2, 0.8, 0.2, 1)',
  }}
/>
```

#### D. ResizeObserver trong DotGridSpotlight đã tự handle resize
Khi `right` thay đổi → canvas size thay đổi → `ResizeObserver` trigger `rebuildGrid()` → dots regen vừa khít. Không cần code thêm.

### Files affected
- `src/pages/BuilderPage.tsx` — `useEffect` set CSS var, `padding-right` transition trên `<main>`, `right: var(--drawer-width)` trên DotGridSpotlight
- `src/styles/tokens.css` — khai báo default `--drawer-width: 0px`

### Test checklist
- [ ] Mở drawer → step list shrink width smooth, không card nào bị che
- [ ] Resize drawer (drag handle) → step list reflow theo real-time
- [ ] Close drawer → step list smooth animate back full width
- [ ] Background dots stop ở drawer edge, không underneath drawer
- [ ] Cursor spotlight follow vùng visible canvas (không qua drawer)
- [ ] `prefers-reduced-motion` → skip transition, instant change
- [ ] Click step card khác trong khi drawer đang mở (non-modal) → drawer chuyển content + step list không nhảy width (vì drawer width unchanged)

---

## #5 · Compact pending cards

### Triệu chứng
Tất cả cards có same height ~88px (padding `px-5 py-4` + 3 dòng text). Pending cards với placeholder summary "Pair, timeframe, leverage, trading mode" nhìn **dài thừa**, làm step list nặng và che mất focus vào step user cần làm.

### Fix

Phân biệt visual height theo status:

| Status | Height | Content |
|---|---|---|
| **Pending** | ~56px | Header row only: Icon + Step N + Title + status icon + subtle "Tap to configure →" hint bên phải |
| **Editing** | ~56px (hoặc cao hơn nếu đã có data tạm) | Pending layout + brand glow border |
| **Configured** | 80-200px (tuỳ content) | Header + `<StepCardSummary>` inline content (chips/pills) |
| **Error** | giống Configured | Header với error border + AlertTriangle + tooltip lý do |

### Implementation

`StepCard.tsx` refactor:

```tsx
<button onClick={() => setOpenStep(stepId)} ...>
  <header className="flex items-center gap-4 py-3 px-5">
    <Icon />
    <div className="flex-1">
      <span className="text-2xs uppercase">Step {index}</span>
      <h3 className="text-md font-semibold">{title}</h3>
    </div>
    {status === 'pending' && (
      <span className="text-xs text-fg-muted flex items-center gap-1">
        Tap to configure
        <ArrowRight className="h-3 w-3" />
      </span>
    )}
    <StatusIcon status={visualStatus} />
  </header>

  {(status === 'configured' || status === 'error') && (
    <div className="border-t border-border-subtle px-5 py-3">
      <StepCardSummary stepId={stepId} />
    </div>
  )}
</button>
```

Pending cards collapse to header only (~56px). Configured cards expand với divider + summary content.

### Files affected
- `src/features/bot-builder/components/StepCard.tsx` — refactor với conditional content
- `src/features/bot-builder/StepList.tsx` — bỏ `summaryFor()` helper (không dùng nữa)

### Test checklist
- [ ] Pending cards height ~56px, không có summary text
- [ ] "Tap to configure →" hint subtle, không dominant
- [ ] Configured cards expand đủ chứa inline content
- [ ] Hover/focus state vẫn hoạt động
- [ ] Smooth transition giữa pending → configured (slide down content)
- [ ] Error cards giữ height như configured

---

## #4 · Inline configured content trên canvas (theo ref design)

### Reference design (`6_close_method_2.png`, `2_Entry_strategy.png`, `5_close_method.png`)

Reference cho thấy mỗi card hiển thị **actual data** trên canvas:
- Bot Config: token icon (₿) + pair label, timeframe pill, leverage pill, live/dry pill, stake amount
- Entry Strategy: candlestick chip toggle, indicator pills (RSI-14, MA-50…), condition summary
- Direction: Long/Short visual toggle, order type pill
- Close Method: 4 method tabs visual + key params

User muốn cùng triết lý: **cards = live mini-dashboards**, không phải summary text khô khan.

### Implementation: 4 summary components

#### A. BotConfigSummary

**Layout (1 row, wrap):**
```
[B] BTC-USDC   [5m]   [20x]   [Live]   $100,000
```

Visual:
- Token icon: prefix với emoji `₿` (BTC), `Ξ` (ETH), `◎` (SOL), …; fallback chip color theo base symbol
- Pair: text `BTC-USDC` với token color
- Timeframe pill: rounded, bg-surface-hover, text-fg
- Leverage pill: 
  - `≤ 10x`: bg-surface-hover, text-fg
  - `> 10x`: bg-warning/10, text-warning, AlertTriangle icon
- Trading mode pill:
  - Live: bg-bearish-subtle, text-bearish (cảnh báo real money)
  - Dry-run: bg-bullish-subtle, text-bullish (an toàn)
- Stake amount: monospace, `$` prefix, no pill (text-only)

Data source: `useBuilderStore((s) => s.botConfig)`.

#### B. EntryStrategySummary

**Layout (multi-row):**
```
Candle: ●Open ✓Close ●High ●Low ✓Volume
Indicators: [RSI-14] [MA-50] [MACD-12-26-9]
Rules: 3 conditions  • RSI-14 < 30 AND candle.close > MA-50 …
```

Visual:
- Candlestick: 5 chips (Open/Close/High/Low/Volume), selected = brand color, unselected = fg-muted với dim
- Indicator pills: như IndicatorChip nhưng read-only (no cog icon, không click). Format: `{name}-{params}` (e.g. `RSI-14`, `MACD-12-26-9`).
- Conditions: hiển thị count + first 1-2 condition strings, "+ N more" nếu nhiều hơn 2.

Data source: `useBuilderStore((s) => s.strategy)`.

Edge case: nếu candlestick + indicators + conditions đều empty → hiện "No entry rules yet" với fg-muted.

#### C. DirectionSummary

**Layout (2 column compact):**
```
Direction       Order type
[↗ Long]        [Market]
```

Hoặc 1 row:
```
[↗ Long]  •  [Market]
```

Visual:
- Direction:
  - Long: bg-bullish-subtle, text-bullish, ArrowUpRight icon
  - Short: bg-bearish-subtle, text-bearish, ArrowDownRight icon
- Order type:
  - Market: bg-surface-hover
  - Limit: bg-surface-hover + offset% pill (vd `Limit -0.5%`) nếu user set offset

Data source: `useBuilderStore((s) => s.directionForm)`.

#### D. CloseMethodSummary

**Layout (depends on method type):**

- **Manual:** "Manual exit • close trades by hand"
- **TP / SL:**
  ```
  [Target] TP/SL  •  TP: 2 levels (5%×50%, 10%×25%)  •  SL: -3%  •  Trailing: off
  ```
- **Indicator:**
  ```
  [LineChart] Indicator exit  •  1 rule  •  RSI-14 > 70
  ```
- **ROI table:**
  ```
  [Clock] ROI  •  4 steps  •  0min @ 1.5%, 30min @ 0.8% …
  ```

Visual:
- Method type pill (with icon): leading visual identifier
- Key params after `•` separator
- Numbers tabular-nums

Data source: `useBuilderStore((s) => s.closeMethod)`.

#### Shared dispatcher

```tsx
// src/features/bot-builder/components/summaries/StepCardSummary.tsx
export function StepCardSummary({ stepId }: { stepId: StepId }) {
  switch (stepId) {
    case 'bot-config': return <BotConfigSummary />;
    case 'entry-strategy': return <EntryStrategySummary />;
    case 'direction': return <DirectionSummary />;
    case 'close-method': return <CloseMethodSummary />;
  }
}
```

Mỗi summary subscribe slice riêng → re-render hiệu quả khi user edit.

### Visual rules chung

- **Read-only chips/pills**: cùng style như interactive nhưng:
  - cursor: default (hoặc `inherit` để không override card click)
  - không hover state riêng (hover lan ra card cha)
  - pointer-events: none (hoặc tránh handler) để click rơi vào card cha
- **Sizing**: pills nhỏ hơn form chips: `h-6 px-2 text-xs`
- **Color coding**:
  - Bullish (Long, Spot, profit): `--color-bullish`
  - Bearish (Short, Live trade, SL): `--color-bearish`
  - Brand: leverage cao, primary highlights
  - Warning: leverage > 10x, total close > 100%
  - Neutral: timeframe, exchange, market type

### Files affected (NEW)

```
src/features/bot-builder/components/summaries/
├── StepCardSummary.tsx          # dispatcher
├── BotConfigSummary.tsx         # token icon + pair + chips
├── EntryStrategySummary.tsx     # candle chips + indicator pills + conditions
├── DirectionSummary.tsx         # long/short + order type
├── CloseMethodSummary.tsx       # method-specific render
└── shared/
    ├── ReadOnlyChip.tsx         # base chip component
    ├── TokenIcon.tsx            # emoji/color based on base symbol
    └── ConditionPreview.tsx     # 1 condition rendered ngắn gọn
```

### Files modified
- `src/features/bot-builder/components/StepCard.tsx` — replace summary string by `<StepCardSummary stepId={stepId} />`
- `src/features/bot-builder/StepList.tsx` — bỏ `summaryFor()` helper (deprecated)

### Test checklist per step

#### Bot Config
- [ ] Token icon đúng (₿ BTC, Ξ ETH, ◎ SOL, fallback chữ cái đầu)
- [ ] Pill colors: Live = bearish (đỏ), Dry-run = bullish (xanh)
- [ ] Leverage > 10x: warning color + AlertTriangle
- [ ] Stake amount tabular-nums, có $ prefix, format thousands
- [ ] Pending: hide summary, show "Tap to configure →"

#### Entry Strategy
- [ ] Candlestick: 5 chips visible, selected highlighted brand
- [ ] Indicator pills: show output ID format chuẩn (RSI-14, MA-50)
- [ ] Conditions: 1-2 inline + "+N more" nếu >2
- [ ] Long condition string truncate với title attr (tooltip)
- [ ] Empty state: "No entry rules yet"

#### Direction
- [ ] Long: bullish color + ArrowUpRight
- [ ] Short: bearish color + ArrowDownRight
- [ ] Order type pill compact
- [ ] Limit: hiện offset% nếu set

#### Close Method
- [ ] Method type icon đúng (Hand/Target/LineChart/Clock)
- [ ] TP/SL: TP levels count formatted, SL negative %
- [ ] ROI: step count + first/last entry preview
- [ ] Indicator: rule count + first rule preview
- [ ] Total close% > 100 → warning

### Edge cases
- Card width khi drawer mở (#6 fixed) — summary content phải wrap gracefully khi width hẹp
- Long pair name (e.g. "1000PEPE-USDT") — truncate hoặc wrap
- Empty config (mới reset) → fallback "Tap to configure"
- Many indicators (>5) → wrap multiple rows hoặc "+N more"

---

## Dependencies

```
#6 (drawer reflow)     — độc lập, fix trước (bug)
#5 (compact pending)   — độc lập (touch StepCard)
#4 (inline summaries)  — phụ thuộc #5 (cùng touch StepCard)
```

#5 + #4 cùng chạm `StepCard.tsx` → làm together: refactor một lần với conditional content (header always, summary only when configured).

## Estimate tổng

| Phase | Effort |
|---|---|
| #6 Drawer reflow (CSS var + padding + DotGrid right) | 15 min |
| #5 StepCard compact pending state | 15 min |
| #4 Summary components × 4 + dispatcher + shared utils | 60 min |
| Testing (typecheck + manual smoke) | 15 min |
| **Total** | **~105 min** |

---

## Sau khi fix xong

- [ ] `pnpm typecheck` pass
- [ ] `pnpm lint` pass (nếu lint chạy được)
- [ ] Manual smoke test:
  1. Reset → 4 cards pending (compact ~56px each)
  2. Click Bot Config → drawer mở, step list reflow sang trái không bị che
  3. Fill BTC-USDC, 5m, 20x, Live → Save → card 1 expand với chips visible
  4. Tiếp tục cấu hình các step → cards expand dần với inline content
  5. Drawer resize → step list theo theo
  6. Cypheus magic build → all cards configured với content visible
- [ ] Update `fixes_plan.md` reference: link tới `card_redesign_plan.md`
- [ ] Git commit từng nhóm:
  - `fix(layout): drawer reflow main + dot grid edge`
  - `feat(card): compact pending state`
  - `feat(card): inline summary components per step (BotConfig/Entry/Direction/Close)`

---

## Notes thiết kế

### Tại sao không restore canvas-style horizontal layout?
Ref images (1-7) là canvas ngang nhưng MVP đã pivot sang vertical step list (per `ux_design_spec.md` mục 4). Vertical:
- Phù hợp focus 1 strategy, builder feel
- Dễ scroll, mobile-friendly hơn
- Drawer slide từ phải khớp với layout

Plan này giữ vertical layout, áp dụng triết lý "show config inline" từ ref vào vertical context.

### Tại sao read-only chips trên canvas thay vì interactive?
- Tránh confusion: user click chip trên card sẽ trigger card click → mở drawer (không edit chip trực tiếp)
- Drawer là single source of truth cho editing
- Card preview cho user biết trạng thái nhanh

### Phase 2 mở rộng (note future)
- Multi-strategy: thêm card Entry Strategy 2, 3, … render song song
- Inline edit chips trên card (skip drawer cho thay đổi nhỏ): defer, MVP đủ với drawer

---

*Plan tuân thủ design language hiện tại (shadcn/ui, Tailwind tokens, Lucide icons). Không phá vỡ Cypheus magic build flow — script vẫn fill data qua store như cũ, summary tự update theo reactive subscription.*
