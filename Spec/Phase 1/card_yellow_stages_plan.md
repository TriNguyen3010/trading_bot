# CARD STAGE COLOR UNIFICATION — Phase 1 MVP

> Plan: thống nhất **tất cả các stage của Step Card về màu vàng (brand)** —
> pending / editing / configured / error đều dùng tone vàng, phân biệt qua
> **opacity / saturation / icon shape / glow** thay vì hue khác nhau.
>
> Tham chiếu:
> - `src/features/bot-builder/components/StepCard.tsx` (4 status hiện tại đang dùng 4 hue: gray / brand / bullish / danger).
> - `src/features/bot-builder/components/StepConnector.tsx` (line giữa các step — hiện dùng bullish khi cả 2 đã configured).
> - `src/styles/tokens.css` (brand palette `#f0b90b`, brand-hover `#fcd535`, brand-active `#d9a400`, brand-subtle 10%).
> - `Spec/Phase 1/card_redesign_plan.md` (status state machine).

---

## 1 · Vấn đề / motivation

Hiện tại 4 status mỗi cái 1 hue:

| Status | Border | Status icon | Icon container |
|---|---|---|---|
| pending | `border-border` (gray) | `CircleDashed` muted | gray |
| editing | `border-brand` + glow | `CircleDashed` brand pulse | gray |
| configured | `border-bullish/40` (green) | `Check` bullish | bullish-subtle |
| error | `border-danger` (red) | `AlertTriangle` danger | gray |

Yêu cầu của user: **tất cả về vàng** — gắn brand color làm signal duy nhất xuyên
suốt status machine của card. Lý do nội suy:
- Đồng bộ với brand identity (vàng).
- Tránh gây xao nhãng bằng "đèn giao thông" green/red khi user còn đang khám phá flow.
- Vàng đậm/nhạt + icon shape vẫn đủ phân biệt 4 trạng thái.

> Lưu ý quan trọng: brand color hiện tại = `#f0b90b` cũng chính là
> `--color-warning`. Nên việc dùng vàng cho error vẫn nằm trong palette hợp lệ.

---

## 2 · Phân biệt 4 stage CHỈ qua sắc độ vàng + icon

### 2.1 Bảng mapping mới

| Status | Border | Surface tint | Status icon | Icon container | Glow |
|---|---|---|---|---|---|
| **pending** | `border-brand/15` | `bg-surface` | `CircleDashed` `text-brand/40` | `border-brand/15 bg-canvas text-fg-secondary` | none |
| **editing** | `border-brand` | `bg-surface` | `CircleDashed` `text-brand` + `motion-safe:animate-pulse` | `border-brand/40 bg-brand-subtle text-brand` | `shadow-glow` |
| **configured** | `border-brand/50` | `bg-surface` | `Check` `text-brand` | `border-brand/50 bg-brand-subtle text-brand` | none |
| **error** | `border-brand` (cùng editing) | `bg-surface` | `AlertTriangle` `text-brand` (color cảnh báo qua icon shape + ring) | `border-brand bg-brand-subtle text-brand` | `ring-2 ring-brand/40` (subtle inset ring để khác editing glow) |

Khoảng cách sắc độ:

```
brand/15  →  brand/50  →  brand          (border progression)
muted     →  pulse     →  static  →  ring (energy progression)
○         →  ○ pulse   →  ✓       →  !    (icon progression)
```

### 2.2 Tại sao 4 cấp này phân biệt được

- **pending** rất nhạt (15% opacity border) → user đọc ngay là "chưa chạm".
- **editing** full saturation + glow + pulsing icon → "đang được tương tác".
- **configured** medium opacity 50% + icon ✓ → "xong, không cần action".
- **error** full saturation + AlertTriangle icon + thêm `ring` để **khác editing**
  (cùng đậm nhưng editing glow mềm còn error có ring rõ). Tooltip
  "Issue: …" giữ nguyên (text-danger trong tooltip vẫn được phép — đó là
  **inside-content**, không phải status indicator của card).

### 2.3 Accessibility + readability concerns

- Color blindness: tất cả vàng cùng hue → user CVD vẫn phân biệt được vì 4 cấp
  opacity + 4 icon shape khác nhau (○ / ○ pulse / ✓ / !). Pass WCAG-friendly
  cho status differentiation by shape.
- Contrast: `border-brand/15` trên `bg-surface` đủ hiển thị; nếu test render
  thấy quá nhạt thì bump lên `brand/20`.
- AlertTriangle là icon convention nhận diện tức thì cho lỗi → giữ shape, đổi
  màu → vẫn truyền tải.

> **Decision point** (xin xác nhận trước khi implement):
> Phương án "all yellow" cho error đánh đổi mất signal đỏ — convention universal.
> Nếu sau khi review thực tế thấy yếu, fallback an toàn là **giữ icon
> `AlertTriangle` ở `text-danger`** (vẫn vàng border + bg, chỉ icon đỏ). Plan
> này mặc định đề xuất *all yellow strict*; nếu user prefer fallback thì swap
> 1 dòng.

---

## 3 · Scope: chỉ STATUS, KHÔNG đụng tới trading semantics

Quan trọng: nhiều chỗ trong app dùng `bullish` (xanh) / `bearish` (đỏ) cho
domain trading — KHÔNG được unify thành vàng vì đó là ngôn ngữ của thị trường:

| Phải GIỮ NGUYÊN (trading semantics, không phải card status) |
|---|
| `DirectionSummary`: Long = bullish green / Short = bearish red |
| `BotConfigSummary`: Live = bearish red / Dry-run = bullish green (cảnh báo real money) |
| `CloseMethodSummary`: TP = bullish green / SL = bearish red |
| `StepCardSummary > EntryStrategySummary`: candle channel selected = brand (đã sẵn vàng) |
| Tooltips text: `text-danger` cho từ "Issue:" |

**Plan này CHỈ touch:**
- Card border + status icon (nội bộ StepCard.tsx).
- Icon container (cái box nhỏ chứa Sliders/LineChart/etc icon).
- StepConnector line color (vì line là phần "status flow" giữa cards, không
  phải trading semantic — sẽ bàn ở §5).
- Status pills/dots trong `SetupProgress` widget (xem `setup_progress_plan.md`)
  — nếu đã build, cần align cùng palette.

---

## 4 · Implementation cụ thể

### 4.1 Refactor `StepCard.tsx`

#### A. Đổi map `statusIcon`

```tsx
const statusIcon: Record<StepStatus, { icon: LucideIcon; tone: string; label: string }> = {
  pending: {
    icon: CircleDashed,
    tone: 'text-brand/40',                          // was: text-fg-muted
    label: 'Pending',
  },
  editing: {
    icon: CircleDashed,
    tone: 'text-brand motion-safe:animate-pulse',   // unchanged
    label: 'Editing',
  },
  configured: {
    icon: Check,
    tone: 'text-brand',                              // was: text-bullish
    label: 'Configured',
  },
  error: {
    icon: AlertTriangle,
    tone: 'text-brand',                              // was: text-danger  (decision point §2.3)
    label: 'Has errors',
  },
};
```

#### B. Đổi class set của `<button>` border

```tsx
className={cn(
  'group relative flex w-full flex-col items-stretch overflow-hidden rounded-xl border bg-surface text-left transition-all duration-fast ease-out-quick',
  'hover:bg-surface-hover hover:border-brand/60',                            // was: border-border-strong
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-canvas',
  visualStatus === 'pending'    && 'border-brand/15',                        // was: border-border
  visualStatus === 'editing'    && 'border-brand shadow-glow',                // unchanged
  visualStatus === 'configured' && 'border-brand/50',                         // was: border-bullish/40
  visualStatus === 'error'      && 'border-brand ring-2 ring-brand/40',       // was: border-danger
  isCypheusActive && 'border-brand shadow-glow',                              // unchanged
  isPinned && !isCypheusActive && 'cursor-not-allowed opacity-60',
)}
```

#### C. Đổi icon container

```tsx
<div
  className={cn(
    'flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg border',
    visualStatus === 'pending'    && 'border-brand/15 bg-canvas text-fg-secondary',
    visualStatus === 'editing'    && 'border-brand/40 bg-brand-subtle text-brand',
    visualStatus === 'configured' && 'border-brand/50 bg-brand-subtle text-brand',
    visualStatus === 'error'      && 'border-brand bg-brand-subtle text-brand',
  )}
>
  <Icon className="h-4 w-4" />
</div>
```

> Tooltip "Issue: …" giữ nguyên (text-danger inside tooltip là nội dung, không
> phải status chip).

### 4.2 Refactor `StepConnector.tsx`

Line nối giữa step hiện đang dùng:
- `bullish` khi cả 2 step `configured` → đổi thành `brand` (full saturation, marching ants).
- `brand` khi step trên configured còn step dưới chưa → giữ (đã vàng).
- `edge-default` (gray) khi cả 2 chưa → đổi thành `brand/15` (rất nhạt) để
  đồng bộ với pending border.

```ts
const stroke =
  tone === 'success'
    ? 'var(--brand-primary)'                  // was: var(--color-bullish)
    : tone === 'brand'
      ? 'var(--brand-primary)'
      : 'rgba(240, 185, 11, 0.15)';            // was: var(--color-edge-default)
```

Marching ants animation giữ nguyên cho `success` tone (= cả hai configured) —
visual feel "đã thông luồng" qua animation, không phải qua hue.

> Optional polish: add CSS variable `--color-edge-pending: rgba(240, 185, 11, 0.15)`
> trong tokens.css để không hardcode opacity inline.

### 4.3 Tokens.css — không bắt buộc, nhưng nên thêm

Tạo các token alias để mọi nơi dùng nhất quán, dễ rollback:

```css
/* === STAGE COLORS (yellow-only) === */
--color-stage-pending: rgba(240, 185, 11, 0.15);
--color-stage-active:  var(--brand-primary);
--color-stage-done:    rgba(240, 185, 11, 0.50);
--color-stage-error:   var(--brand-primary);   /* same hue, differentiated by ring */
```

Lợi ích: nếu sau này user muốn đổi mood "configured" thành tone khác (vàng đậm
hơn / cam nhạt) chỉ sửa 1 token.

### 4.4 Align `SetupProgress` (nếu đã/đang build)

Plan `setup_progress_plan.md` định nghĩa:
- Dot configured = bullish / dot error = bearish.

Khi unify, đổi sang:
- Dot pending = `bg-brand/15`
- Dot editing = `bg-brand-subtle text-brand animate-pulse`
- Dot configured = `bg-brand-subtle text-brand` (kèm Check icon)
- Dot error = `bg-brand-subtle text-brand` + AlertTriangle (thêm `ring-1 ring-brand`)

> Action: cập nhật `setup_progress_plan.md` §3.4 visual tokens table khi merge
> plan này.

---

## 5 · Files affected

**Modified:**
- `src/features/bot-builder/components/StepCard.tsx` — bảng `statusIcon`, border classes, icon container.
- `src/features/bot-builder/components/StepConnector.tsx` — stroke color theo tone, fallback brand/15.
- `src/styles/tokens.css` — (optional) thêm 4 alias `--color-stage-*`.
- `Spec/Phase 1/setup_progress_plan.md` — cập nhật bảng visual tokens cho dots/pills.
- `Spec/Phase 1/card_redesign_plan.md` — note thêm dòng "status colors unified to brand per `card_yellow_stages_plan.md`".

**Không cần đụng:**
- Summaries (`BotConfig`, `Direction`, `CloseMethod`, `EntryStrategy`) — chip màu trong đó là **trading semantic**, giữ nguyên.
- Validator / store / serializer — pure visual change.

---

## 6 · Risk / trade-off cần user confirm

| Risk | Severity | Mitigation |
|---|---|---|
| Mất signal đỏ universal cho error | Medium | AlertTriangle icon shape + tooltip text-danger + ring-2 |
| Mất signal xanh "done" | Low | Check icon + brand/50 opacity vs brand/15 pending là rõ |
| editing và error đều full brand → trùng | Medium | error có `ring-2 ring-brand/40` còn editing có `shadow-glow`. Khác visually nhưng cần verify trên 2 trạng thái side-by-side |
| Card pending quá nhạt → không nhận ra là card | Low | bump `border-brand/15` → `brand/20` nếu test thấy yếu |
| Brand-only palette gây "sea of yellow" → mỏi mắt | Medium | summaries vẫn có nhiều màu trading (red/green chip) → break monotony |

**Quyết định cần xác nhận trước khi implement:**

1. Error icon = `text-brand` (strict all-yellow) hay vẫn `text-danger` (lai)? → **plan default = strict**, đổi 1 dòng nếu user prefer lai.
2. StepConnector "success" tone (cả 2 configured) → vẫn marching-ants brand, hay tắt animation luôn để minimal? → **plan default = giữ marching-ants**.

---

## 7 · Implementation steps

| # | Step | Effort |
|---|---|---|
| S1 | (Optional) Thêm 4 alias token `--color-stage-*` vào tokens.css | 5 min |
| S2 | Refactor `StepCard.tsx`: statusIcon map + border classes + icon container | 10 min |
| S3 | Refactor `StepConnector.tsx`: stroke color theo brand | 5 min |
| S4 | Visual sweep: chạy app, click qua 4 status (pending → editing → configured; tạo error bằng cách save Bot Config rỗng → validator complain) | 10 min |
| S5 | Cross-check `SetupProgress` dots align (nếu đã build) | 5 min |
| S6 | Update 2 plan docs cũ với cross-reference | 5 min |
| **Total** | | **~40 min** |

---

## 8 · Test checklist

### Visual smoke

- [ ] Reset app → 4 cards `pending` đều border vàng nhạt 15%, icon `○ text-brand/40`
- [ ] Click Bot Config card → visual chuyển sang `editing`: border vàng full + glow + icon pulse
- [ ] Save Bot Config (data đầy đủ) → card 1 chuyển sang `configured`: border vàng 50% + icon ✓
- [ ] Save Bot Config với `pair=''` (trigger validator issue) → card chuyển sang `error`: border vàng full + ring-2 + icon `!` + tooltip "Issue: ..." vẫn `text-danger` nội dung
- [ ] Hover card pending → border tăng lên `brand/60`, không nhảy về gray
- [ ] StepConnector giữa 2 card pending: line vàng 15% mảnh, dashed, không animate
- [ ] StepConnector khi step trên configured & dưới pending: line brand đậm, dashed, không animate
- [ ] StepConnector khi cả 2 configured: line brand đậm + marching-ants
- [ ] Cypheus pin một card → border-brand + glow (giữ nguyên behavior, vì cypheusActive đã là brand từ trước)

### Accessibility

- [ ] Tab focus ring vẫn brand (đã đúng)
- [ ] AlertTriangle icon đủ nổi với border ring để user CVD nhận ra error
- [ ] Reduce-motion: editing pulse dừng, marching-ants connector dừng, error ring không animate (static)

### Regression

- [ ] Summaries (DirectionSummary Long/Short, BotConfigSummary Live/Dry-run, CloseMethodSummary TP/SL) **vẫn giữ trading semantic colors** — không bị unify nhầm
- [ ] Tooltip "Issue: …" text vẫn `text-danger` (đỏ) — content được giữ
- [ ] Cypheus pinned card không vỡ (cùng tone với editing)

---

## 9 · Out of scope

- Đổi semantic trading colors (Long/Short, Live/Dry-run, TP/SL) → giữ nguyên.
- Đổi global app palette → đây chỉ là card status.
- Animations mới (sweep, confetti khi configured) → defer Phase 2.
- Đổi `--brand-primary` thành màu khác → ngoài phạm vi.

---

## 10 · Commit chia nhỏ đề xuất

```
chore(tokens): add --color-stage-* aliases for unified card stages
refactor(card): unify StepCard status colors to brand-yellow palette
refactor(card): match StepConnector tones to brand-only stage system
docs(plan): cross-link card_yellow_stages_plan.md from card_redesign_plan.md
docs(plan): align setup_progress_plan visual tokens with yellow-only stages
```

---

*Plan tách rõ status (yellow) khỏi trading semantics (bullish/bearish/danger).
Chỉ ~40 phút implement, dễ rollback nếu user thấy "sea of yellow" — chỉ cần
revert 2 file source + 2 file plan.*
