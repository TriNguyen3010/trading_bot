# Drawer Persistence trong Cypheus Mode

> Spec **fix UX flicker** khi Cypheus đang chạy magic build. Right drawer phải **luôn mở** xuyên suốt magic build, content swap mượt giữa các step thay vì slide-open/slide-close 4 lần.

- **Ngày:** 2026-04-25
- **Liên quan:** `cypheus_spec.md` (section 5 Magic Build Script)
- **Status:** Bổ sung cho cypheus spec, cần áp dụng khi implement

---

## 1. Vấn đề (current behavior)

Trong magic build script hiện tại:

```
[T+11s]  Drawer slide IN (250ms)   ← Step 1 mở
[T+18s]  Drawer slide OUT (250ms)  ← Step 1 đóng
[T+19s]  Drawer slide IN (250ms)   ← Step 2 mở
[T+27s]  Drawer slide OUT (250ms)  ← Step 2 đóng
[T+28s]  Drawer slide IN (250ms)   ← Step 3 mở
[T+33s]  Drawer slide OUT (250ms)  ← Step 3 đóng
[T+34s]  Drawer slide IN (250ms)   ← Step 4 mở
[T+44s]  Drawer slide OUT (250ms)  ← Step 4 đóng
```

→ 8 lần slide animation × 250ms = **2 giây bị "giật"** trong demo 45 giây. Cảm giác màn hình **rung lắc, không liền mạch**.

User feedback: *"Right panel mở ra mở vào liên tục, tạo cảm giác màn hình giật giật."*

---

## 2. Mong đợi (desired behavior)

Drawer mở **đúng 1 lần** khi Cypheus bắt đầu build, **đứng yên** đến khi build xong, content **swap mượt** giữa các step.

```
[T+11s]  Drawer slide IN (250ms)         ← Mở 1 lần duy nhất
[T+11s → 44s]  Content transition giữa step 1 → 2 → 3 → 4 (cross-fade 150ms)
[T+44s]  Drawer ở trạng thái Step 4 done, vẫn mở
[T+45s+] User chủ động đóng (hoặc auto-close sau 3s)
```

→ Chỉ **2 slide animation** (mở đầu + đóng cuối) thay vì 8 → **giảm 75% cảm giác giật**.

---

## 3. State machine mới cho Drawer

### 3.1 Drawer mode

```ts
type DrawerMode = 'closed' | 'manual' | 'cypheus-pinned'
```

| Mode | Khi nào | Behavior |
|---|---|---|
| `closed` | Default, không edit | Drawer ẩn, slide right |
| `manual` | User click step card | Slide IN, hiện form step đó. User Save/Cancel → slide OUT |
| `cypheus-pinned` | Cypheus magic build đang chạy | Slide IN 1 lần, **PINNED** đến khi build done. Content swap internally |

### 3.2 Transitions

```
closed ──[user click step]──→ manual
manual ──[Save / Cancel]────→ closed
closed ──[Cypheus start build]──→ cypheus-pinned
cypheus-pinned ──[Cypheus build done]──→ closed (auto sau 2s) hoặc manual (nếu user click step)
cypheus-pinned ──[user click "Create new bot"]──→ closed
```

**Rule quan trọng:**
- Trong `cypheus-pinned`, **bỏ qua mọi click vào step card** (Cypheus đang điều khiển).
- Trong `cypheus-pinned`, ẩn nút `[Cancel]` + `[Save]` + `[Save & Next]` (auto-save bởi script).
- Sau khi build xong, drawer ở mode `cypheus-pinned-done` (state cuối) hiện 2s rồi auto-close. User có thể click bất kỳ đâu để dismiss sớm.

---

## 4. Content transition giữa steps

Khi Cypheus chuyển từ Step N → Step N+1 trong drawer:

### 4.1 Animation timing

```
[T+0]    Drawer header old: "1. Bot Config"
[T+0]    Drawer body old: form Bot Config
         ↓ Cypheus dispatch advanceToStep(2)
[T+0]    Body fade out (opacity 1→0, 100ms)
[T+100]  Body content swap (instant, off-screen)
[T+100]  Header text update: "1. Bot Config" → "2. Entry Strategy" (cross-fade 150ms)
[T+100]  Body fade in (opacity 0→1, 150ms)
[T+250]  Done. New step content fully visible.
```

**Tổng: 250ms** cho một transition (so với 500ms slide-out + slide-in cũ).

### 4.2 Visual chi tiết

```
┌─ Drawer ────────────────────────────┐
│ Header                              │
│ ┌─────────────────────────────────┐ │
│ │ 2. Entry Strategy          [×*] │ │  ← title cross-fade
│ └─────────────────────────────────┘ │
│                                     │
│ ┌─ Setup ──┐ ┌─ Configure ──┐       │
│ │ active   │ │              │       │  ← tab Setup luôn active
│ └──────────┘ └──────────────┘       │     khi Cypheus build
│                                     │
│ Form content                        │
│ (fade out 100ms, swap, fade in 150)│
│                                     │
│ [Cypheus đang fill từng field      │
│  với typing animation]              │
│                                     │
│ ────────────────────────────        │
│ ⚡ Cypheus is configuring...        │  ← footer status thay vì button
└─────────────────────────────────────┘

* [×] disabled khi cypheus-pinned, hover tooltip:
  "Cypheus is building. Click 'Create new bot' to stop."
```

### 4.3 Header progression indicator

Để user biết Cypheus đang ở step nào, header drawer thêm **progress dots**:

```
┌─────────────────────────────────────┐
│ 2. Entry Strategy          [×]      │
│ ● ● ○ ○                              │  ← step 1, 2 done. 3, 4 pending
└─────────────────────────────────────┘
```

Hoặc gọn hơn: text `Step 2 of 4` cạnh title.

---

## 5. Backdrop & Step list dim trong Cypheus mode

### 5.1 Hiện tại
Backdrop dim 50% xuất hiện khi drawer mở, biến mất khi đóng → cũng "giật" theo drawer.

### 5.2 Mới
- Backdrop dim **stay 50%** xuyên suốt `cypheus-pinned` mode.
- Step card bên trái (đang dim) hiện **state preview** cho step hiện tại:
  - Step 1 đã ✓ → giữ ✓ xanh.
  - Step 2 đang build → pulse vàng glow nhẹ (cùng pace với Cypheus).
  - Step 3, 4 vẫn ⚪ pending.
- Khi Cypheus chuyển step trong drawer → step card pulse cũng chuyển sang step mới.

→ Tạo sense **liên kết** giữa drawer (right) và step list (left).

---

## 6. Update Magic Build Script timeline

Sửa lại timeline trong `cypheus_spec.md` mục 5.2:

```
[T+0.0s]  User submits.
[T+0.3s]  User bubble. Avatar thinking.
[T+1.5s]  Cypheus message: "Got it. Let me build..."
[T+3.5s]  Cypheus message (note demo).

[T+5.0s]  Pause. Step 1 card pulse.

[T+5.5s]  ╔══ Drawer slide IN (250ms) ═════════════
          Drawer mở Step 1. cypheus-pinned mode.
          Backdrop dim 50%. Header: "1. Bot Config • Step 1 of 4"

[T+6.0s]  Cypheus: "Setting up bot configuration..."
[T+7.0s]  Auto-fill: Pair "BTC-USDC" (typing)
[T+8.5s]  Auto-fill: Timeframe 5m
[T+9.0s]  Auto-fill: Trading mode Dry-run
[T+9.5s]  Auto-fill: Leverage 20
[T+10.0s] Cypheus message: "BTC-USDC offers high liquidity..."

[T+12.0s] ─── Step 1 complete ──────────────────
          Step 1 card (left): pending → ✓ xanh
          Drawer header transition: "1. Bot Config" → "2. Entry Strategy"
          Drawer body cross-fade (100ms out + 150ms in = 250ms)
          Step 2 card (left): pulse vàng start

[T+12.5s] Cypheus: "Defining entry conditions..."
[T+13.0s] Auto-toggle: Candlestick chips Close, Volume
[T+14.0s] Auto-add: RSI(14) indicator chip
[T+15.0s] Auto-add: Condition RSI-14 < 30
[T+16.0s] Cypheus: "RSI below 30 signals oversold..."

[T+18.5s] ─── Step 2 complete ──────────────────
          Step 2 card: ✓
          Drawer header: "2. Entry Strategy" → "3. Direction & Order"
          Body cross-fade
          Step 3 card pulse

[T+19.0s] Cypheus: "Going Long with Market orders..."
[T+19.5s] Auto-toggle: Long, Market

[T+21.5s] ─── Step 3 complete ──────────────────
          Step 3 card: ✓
          Drawer header: "3..." → "4. Close Method"
          Body cross-fade
          Step 4 card pulse

[T+22.0s] Cypheus: "Setting take-profit and stop-loss..."
[T+23.0s] Auto-select: TP/SL tab
[T+24.0s] Auto-fill: TP level 1 (5%, close 50%)
[T+25.0s] Auto-fill: TP level 2 (10%, close 25%)
[T+26.0s] Auto-fill: SL -3%
[T+27.0s] Cypheus: "5% TP at half position..."

[T+29.0s] ─── Step 4 complete ──────────────────
          Step 4 card: ✓
          Drawer header transition: title "4. Close Method" → "All set ✓"
          Body cross-fade to summary view (xem mục 7)

[T+30.0s] Cypheus: "All set."
[T+31.0s] Cypheus: "Review the JSON in the {} JSON tab,
                   then click Export when ready."

[T+32.0s] ╚══ Drawer slide OUT (250ms) ════════════
          Backdrop fade out
          Avatar → idle
          → DONE
```

**Tổng thời lượng: ~32 giây** (gọn hơn 45 giây cũ vì không tốn 7×250ms slide).

→ **Tiết kiệm 13 giây + giảm "giật" rõ rệt.**

---

## 7. Drawer summary view (after build complete)

Trước khi drawer slide OUT, hiện 1 màn summary 2 giây:

```
┌─ Drawer ──────────────────────┐
│ All set ✓                 [×] │
│ ● ● ● ●                        │
├───────────────────────────────┤
│                               │
│   ✓ 1. Bot Config             │
│      BTC-USDC · 5m · 20x      │
│                               │
│   ✓ 2. Entry Strategy         │
│      RSI < 30                 │
│                               │
│   ✓ 3. Direction & Order      │
│      Long · Market            │
│                               │
│   ✓ 4. Close Method           │
│      TP/SL                    │
│                               │
│ ───────────────────────────── │
│ [Review JSON] [Close]         │
└───────────────────────────────┘
```

User có thể:
- Click `[Review JSON]` → drawer đóng, focus chuyển sang Left Panel JSON tab.
- Click `[Close]` → drawer đóng.
- Không làm gì → auto-close sau 2 giây.

---

## 8. Edge cases

| Tình huống | Behavior |
|---|---|
| User click step card khi drawer đang `cypheus-pinned` | Ignore click, optional toast: "Cypheus is building. Wait or click 'Create new bot'." |
| User click "Create new bot" giữa magic build | Confirm dialog (như spec gốc) → reset → drawer slide OUT → state về initial |
| User click `[×]` close drawer khi `cypheus-pinned` | Disabled (faded), tooltip explain. KHÔNG cho close giữa chừng (vì content swap đang chạy). Hoặc cho close → cancel build → reset state. *(Đề xuất: disable button, force user dùng "Create new bot" để hủy.)* |
| Refresh page giữa magic build | Cypheus restart từ greeting (không persist scriptState). Drawer closed. |
| Window resize (responsive) khi cypheus-pinned | Drawer giữ nguyên width 720px. Nếu viewport < 1840px → collapsed left panel để có chỗ. |

---

## 9. Implementation notes

### 9.1 Component changes

**`StepDrawer`:**
- Thêm prop `mode: 'manual' | 'cypheus-pinned' | 'cypheus-summary'`
- Khi `cypheus-pinned`:
  - Hide footer buttons
  - Show footer status text "⚡ Cypheus is configuring..."
  - Disable `[×]` button
  - Render content theo `currentStepId` từ Zustand
- Khi `cypheus-summary`:
  - Render summary view (mục 7)
  - Show 2 button: Review JSON / Close
  - Auto-close timer 2s

**Zustand store update:**
```ts
type CypheusState = {
  scriptState: 'idle' | 'thinking' | 'building' | 'summary' | 'done'
  currentStepId: 1 | 2 | 3 | 4 | null
  drawerMode: 'closed' | 'manual' | 'cypheus-pinned' | 'cypheus-summary'
  // ...
}
```

### 9.2 Animation library

- Body cross-fade: dùng Framer Motion `<AnimatePresence mode="wait">` với key = `currentStepId`.
- Header text cross-fade: same pattern.
- Drawer slide: shadcn Sheet built-in (nhưng chỉ trigger 1 lần đầu + 1 lần cuối).

```tsx
<Sheet open={drawerMode !== 'closed'}>
  <SheetContent>
    <AnimatePresence mode="wait">
      <motion.div
        key={currentStepId}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.15 }}
      >
        {renderStepContent(currentStepId)}
      </motion.div>
    </AnimatePresence>
  </SheetContent>
</Sheet>
```

### 9.3 Script runner changes

Thay vì 4 lần `open-drawer` / `close-drawer`, chỉ còn:

```ts
// magic-build.script.ts
[
  { type: 'open-drawer', stepId: 1, mode: 'cypheus-pinned', delay: 5500 },
  // ... fill step 1 fields ...
  { type: 'mark-step-done', stepId: 1, delay: 12000 },
  { type: 'switch-drawer-step', stepId: 2, delay: 12500 },  // NEW – internal swap
  // ... fill step 2 fields ...
  { type: 'switch-drawer-step', stepId: 3, delay: 18500 },
  // ...
  { type: 'switch-drawer-step', stepId: 4, delay: 21500 },
  // ...
  { type: 'show-summary', delay: 29000 },                   // NEW – summary view
  { type: 'close-drawer', delay: 32000 },
]
```

---

## 10. Acceptance criteria

- [ ] Drawer chỉ slide IN 1 lần khi magic build bắt đầu.
- [ ] Drawer chỉ slide OUT 1 lần khi build hoàn tất (sau summary 2s).
- [ ] Content giữa step transition mượt < 250ms cross-fade, không giật.
- [ ] Step card bên trái pulse đồng bộ với drawer header (current step).
- [ ] Backdrop dim 50% giữ nguyên không nháy.
- [ ] Footer drawer ở `cypheus-pinned` hiện status text, không có button.
- [ ] User click step card khi pinned → ignore (optional toast).
- [ ] Drawer summary view hiện 2s với 4 step ✓ + 2 button Review JSON / Close.
- [ ] Tổng thời lượng magic build ≤ 35 giây (giảm từ 45s cũ).
- [ ] Pass usability test: 5/5 user không cảm thấy "giật" trong demo.

---

*End of spec.*
