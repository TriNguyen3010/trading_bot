# FIXES PLAN — Phase 1 MVP UX adjustments

> Plan để fix 3 vấn đề UX user báo cáo sau khi mở local lần đầu (2026-04-26).
> Không đụng tới logic đã làm xong M0-M6, chỉ chỉnh UI layer.

---

## Tóm tắt 3 vấn đề

| # | Vấn đề | Severity | Effort |
|---|---|---|---|
| 1 | Background dots chỉ phủ một phần canvas, không trải đều toàn bộ | Medium | ~10 min |
| 2 | Right drawer width fix cứng + có overlay dim canvas | Medium (UX) | ~30 min |
| 3 | JSON tab có khoảng trống lớn vô ích trên đỉnh | **HIGH (bug)** | ~10 min |

**Khuyến nghị thứ tự:** #3 → #1 → #2 (bug trước, polish sau, feature mới cuối cùng).

---

## #3 · JSON tab — empty space ở đỉnh

### Triệu chứng (từ screenshot user)
```
[◆ Cypheus]  [{} JSON ◀ active]
                                    ← ~70% panel height TRỐNG
            (empty black area)
                                    
bot.json ▌ strategy.json            ← sub-tabs đang ở GẦN ĐÁY panel
1 {
2   "bot_name": "Untitled bot",
3   "exchange_name": "binance",     ← JSON code chỉ hiện vài line ở đáy
…
```

### Root cause

Trong `src/features/cypheus/CypheusPanel.tsx`:

```tsx
<TabsContent value="cypheus" className="flex flex-1 flex-col overflow-hidden">
  <CypheusChat /> …
</TabsContent>
<TabsContent value="json" className="flex flex-1 flex-col overflow-hidden">
  <JsonLiveView />
</TabsContent>
```

**Cơ chế bug:** Radix dùng HTML `hidden` attribute (default `display: none`) để ẩn inactive `TabsContent`. Nhưng class `flex` trong className **override** `display: none` từ `hidden` attribute (CSS thắng HTML attribute). Kết quả:
- **Cả 2 TabsContent đều render đồng thời**, mỗi cái có `flex-1`
- Inner Tabs root (parent) là flex column → 2 con chia 50/50 height
- Khi user click JSON: Cypheus TabsContent (chat trống) chiếm nửa trên = empty space; JSON TabsContent chiếm nửa dưới = nơi sub-tabs + code hiện ra

### Fix

Thay class `flex` bằng `data-[state=active]:flex` để chỉ apply `display: flex` khi tab active. Khi inactive → không có display class → `hidden` attribute hoạt động bình thường (display: none).

**Trước:**
```tsx
<TabsContent value="cypheus" className="flex flex-1 flex-col overflow-hidden">
```

**Sau:**
```tsx
<TabsContent value="cypheus" className="data-[state=active]:flex flex-1 flex-col overflow-hidden">
```

Áp dụng cùng pattern cho mọi `TabsContent` có class `flex` trong project (kiểm tra grep).

### Bonus polish
- Trong `JsonLiveView.tsx`: đổi `<div className="flex h-full flex-col">` của JsonPane → `<div className="flex flex-1 flex-col overflow-hidden">` để flex chain liền mạch (tránh phụ thuộc `h-full` lên parent với computed height).
- TabsContent inner (bot.json / strategy.json): cũng dùng `data-[state=active]:flex flex-1 flex-col`.
- Giảm `pt-3` → `pt-2` ở `JsonLiveView` sub-tabs wrapper cho compact hơn.

### Optional: JSON live preview phản ánh setup (vs full schema)

User nhắc "nội dung sẽ tạo ra khi user setup, chứ ko phải fix cứng". Hiện JSON preview show full payload với defaults (`exchange_name: "binance"`, `leverage: 1`, `trading_mode: "futures"` …) → cảm giác hardcoded.

**2 cách:**

| Cách | Mô tả | Trade-off |
|---|---|---|
| A | Giữ nguyên full schema. Fix layout là đủ → user thấy JSON ngay. | Đơn giản, nhưng vẫn nhìn như template với defaults |
| B | Tạo `buildPartialBotPayload(state)` cho preview, chỉ include fields user TOUCHED. Track `touched: Set<string>` trong builder.store. ExportDialog vẫn dùng full schema. | JSON minimal, grow dần khi user setup → cảm giác "live build" |

**Đề xuất:** Cách B vì match đúng intent user. Nhưng nếu rush, làm A trước (5 min), B sau (20 min thêm).

### Files
- `src/features/cypheus/CypheusPanel.tsx` — fix `TabsContent` className
- `src/features/cypheus/JsonLiveView.tsx` — fix inner `TabsContent` + `JsonPane` root
- *(optional B)* `src/lib/serializer.ts` — thêm `buildPartialBotPayload`, `buildPartialStrategyPayload`
- *(optional B)* `src/features/bot-builder/store/builder.store.ts` — thêm `touched` tracking

### Test checklist
- [ ] Click tab JSON → content xuất hiện ngay từ đầu panel, không empty space
- [ ] Click tab Cypheus → chat hiện ngay, không leak JSON
- [ ] Switch qua lại không lag/flicker
- [ ] Sub-tabs `bot.json` / `strategy.json` nằm ngay dưới top tabs (không lệch xuống đáy)
- [ ] Edit form trong drawer → JSON cập nhật real-time, line flash xanh
- [ ] (Cách B) JSON ban đầu chỉ `{ "bot_name": "Untitled bot" }`, grow dần khi setup

---

## #1 · Background dots phủ toàn bộ canvas

### Triệu chứng
Dots chỉ visible ở phần trên/giữa canvas. Phần dưới step list và phần xa cursor → đen, không có dots.

### Root cause
1. `<DotGridSpotlight>` dùng `absolute inset-0` bên trong `<main className="flex-1 overflow-y-auto">`. Canvas size = visible viewport height (`getBoundingClientRect().height`). Khi step list ngắn, không có content fill main, canvas cũng không trải dài.
2. `BASE_ALPHA = 0.14` quá mờ → idle dots gần như tàng hình trên nền `#0A0A0B`. Vùng có dots cũng dễ trông như "không có" nếu cursor không gần đó.
3. Trên scrolling: canvas scroll cùng content → dots không follow viewport (lệ thuộc vào kích thước scroll content).

### Fix

#### A. Đổi positioning sang fixed
Move `<DotGridSpotlight>` từ trong `<main>` ra ngoài, position fixed cover vùng canvas:

```tsx
<DotGridSpotlight
  className="fixed pointer-events-none z-0"
  style={{
    top: 'var(--layout-header)',
    left: 'var(--layout-left-panel)',
    right: 0,
    bottom: 0,
  }}
/>
```

Hoặc giữ trong `<main>` nhưng sửa positioning logic trong component:
- `position: fixed` thay `absolute`
- Tự đo container parent rect qua ResizeObserver, sync với canvas pixel size

→ Chọn cách 1 (đặt fixed ở BuilderPage level) đơn giản hơn.

#### B. Tăng visibility idle dots
Trong `DotGridSpotlight.tsx`:
```ts
const BASE_ALPHA = 0.22;   // was 0.14
const SPACING = 26;        // was 22 — thoáng hơn
```

#### C. Drawer khi mở → dim density 30% (giữ logic spec gốc)
Thêm prop `dimmed: boolean` truyền vào DotGridSpotlight:
- Khi drawer open + non-modal → dimmed=true → all alpha × 0.3
- Khi drawer close → dimmed=false → normal

→ Optional, làm sau khi #2 xong (vì #2 mới có drawer non-modal).

### Files
- `src/features/fx/DotGridSpotlight.tsx` — `BASE_ALPHA`, `SPACING`, optional `dimmed` prop
- `src/pages/BuilderPage.tsx` — move canvas ra ngoài `<main>`, position fixed

### Test checklist
- [ ] Mở `/builder` → dots visible toàn vùng giữa (full height + width của canvas area)
- [ ] Scroll step list → dots stay fixed (không scroll cùng)
- [ ] Cursor di chuyển → spotlight follow mượt
- [ ] Edge: cursor di về Left panel area → dots vùng giữa fade out đúng
- [ ] `prefers-reduced-motion` → static grid, no animation

---

## #2 · Right drawer — resizable + non-modal + no dim

### Triệu chứng
- Drawer width fix cứng 720px
- Có overlay dim canvas → user không nhìn được step cards/JSON khi đang edit
- Click outside drawer tự đóng → user không thể click step khác mà không bị mất state

### Root cause
1. `<Sheet>` (wrapper Radix Dialog) dùng default `modal={true}` → có overlay + click outside auto close
2. `<SheetContent>` nhận prop `width: number = 720` rồi pass vào inline style. Không có resize handle.
3. Spec gốc viết "left panel vẫn active khi drawer open" nhưng implement chưa hoàn thiện non-modal.

### Fix

#### A. Non-modal mode + bỏ dim
**`src/components/ui/sheet.tsx`:**
```tsx
// Mở rộng Sheet wrapper để nhận `modal` prop
export interface SheetProps {
  modal?: boolean;
  // … các prop khác từ DialogPrimitive.Root
}
```
Forward xuống `<DialogPrimitive.Root modal={modal}>`.

**`src/features/bot-builder/components/StepDrawer.tsx`:**
```tsx
<Sheet open={open} onOpenChange={…} modal={false}>
  <SheetContent
    hideOverlay  // bỏ <SheetOverlay>
    style={{ width: drawerWidth }}
    onInteractOutside={(e) => e.preventDefault()}  // không tự đóng
  >
    …
  </SheetContent>
</Sheet>
```

#### B. Drawer width state trong store
**`src/features/bot-builder/store/builder.store.ts`:**
```ts
const DEFAULT_DRAWER_WIDTH = 720;
const MIN_DRAWER_WIDTH = 480;
const MAX_DRAWER_WIDTH = 1200;

// trong BuilderState
drawerWidth: number;

// trong actions
setDrawerWidth: (width: number) => set({
  drawerWidth: Math.max(MIN_DRAWER_WIDTH, Math.min(MAX_DRAWER_WIDTH, width)),
});

// trong persist partialize → include drawerWidth
```

#### C. Resize handle component
**NEW `src/features/bot-builder/components/DrawerResizeHandle.tsx`:**

```tsx
// Visual: 4px wide bar, position absolute, left edge của SheetContent
// Cursor: col-resize
// Hover: opacity tăng + brand color
// Drag: capture pointer, listen mousemove globally, update store

interface Props {
  currentWidth: number;
  onResize: (width: number) => void;
}

export function DrawerResizeHandle({ currentWidth, onResize }: Props) {
  const [dragging, setDragging] = useState(false);
  const startRef = useRef({ x: 0, w: 0 });

  const onPointerDown = (e: React.PointerEvent) => {
    e.preventDefault();
    setDragging(true);
    startRef.current = { x: e.clientX, w: currentWidth };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragging) return;
    const delta = startRef.current.x - e.clientX;  // drag trái → wider
    onResize(startRef.current.w + delta);
  };

  const onPointerUp = (e: React.PointerEvent) => {
    setDragging(false);
    e.currentTarget.releasePointerCapture(e.pointerId);
  };

  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label="Resize drawer"
      tabIndex={0}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onKeyDown={(e) => {
        // Arrow keys for keyboard resize
        if (e.key === 'ArrowLeft') onResize(currentWidth + 16);
        if (e.key === 'ArrowRight') onResize(currentWidth - 16);
      }}
      className={cn(
        'absolute -left-1 top-0 z-10 h-full w-2 cursor-col-resize',
        'before:absolute before:inset-y-0 before:left-1 before:w-px before:bg-border',
        'hover:before:bg-brand hover:before:w-0.5',
        'focus-visible:before:bg-brand focus-visible:outline-none',
        dragging && 'before:bg-brand before:w-0.5',
      )}
    />
  );
}
```

Tích hợp vào `<SheetContent>`:
```tsx
<SheetContent style={{ width: drawerWidth }} hideCloseButton={false}>
  <DrawerResizeHandle currentWidth={drawerWidth} onResize={setDrawerWidth} />
  …
</SheetContent>
```

#### D. Update DotGridSpotlight với drawer state (link với #1.C)
Khi drawer mở → giảm density dots (alpha × 0.3) → user focus vào drawer.

```tsx
const drawerOpen = useBuilderStore((s) => s.openStep !== null);
<DotGridSpotlight dimmed={drawerOpen} />
```

#### E. Keyboard accessibility
- Esc đóng drawer (Radix Dialog tự handle khi open)
- Arrow Left/Right trên handle → resize ±16px
- Tab navigate vào handle → focus ring brand

### Files
- `src/components/ui/sheet.tsx` — add `modal` prop, forward `onInteractOutside`
- `src/features/bot-builder/components/StepDrawer.tsx` — `modal={false}`, `hideOverlay`, attach `<DrawerResizeHandle>`
- `src/features/bot-builder/components/DrawerResizeHandle.tsx` — NEW
- `src/features/bot-builder/store/builder.store.ts` — add `drawerWidth` + `setDrawerWidth` + persist
- `src/types/builder.types.ts` — add `drawerWidth: number` to `BuilderState`
- `src/features/fx/DotGridSpotlight.tsx` — add `dimmed` prop (link với #1.C)
- `src/pages/BuilderPage.tsx` — read `openStep` để pass `dimmed` xuống canvas

### Test checklist
- [ ] Open drawer → canvas vẫn click được; click step khác → drawer chuyển sang step đó
- [ ] Canvas KHÔNG bị overlay dim đen (chỉ dots dim 30%)
- [ ] Drag mép trái drawer → width thay đổi smooth
- [ ] Refresh trang → width persist từ localStorage
- [ ] Min/max width clamp đúng (480-1200)
- [ ] Esc vẫn đóng drawer
- [ ] Tab vào handle → focus ring; Arrow keys resize
- [ ] Step list center vẫn căn giữa canvas khi drawer wider
- [ ] JSON tab live update vẫn hoạt động trong khi user resize

### Edge cases
- Drag cursor nhanh ra ngoài handle → `setPointerCapture` giữ event
- Resize quá nhỏ → snap min 480px
- Resize quá lớn → snap max 1200px
- Mobile (Phase 2): force full-width drawer, hide resize handle

---

## Dependencies giữa các fix

```
#3 (JSON tab)       — độc lập, fix trước
#1 (Background)     — độc lập (basic fix); #1.C cần #2 xong
#2 (Drawer resize)  — độc lập (basic fix)
```

#1 phần C (dim dots khi drawer open) phụ thuộc #2 (cần drawer non-modal). Nếu làm #1 trước #2, skip 1.C, làm sau khi #2 done.

---

## Estimate tổng

| Phase | Effort | Notes |
|---|---|---|
| #3 JSON tab fix (className + layout) | 10 min | Ưu tiên cao, root cause rõ |
| #3 Optional B (touched tracking + partial serializer) | +20 min | Polish, không bắt buộc |
| #1 Background full coverage | 10 min | Đổi positioning + bump alpha |
| #2 Drawer non-modal + resize | 30 min | Component mới + store + persist |
| #1.C Drawer-aware dim dots | 5 min | Sau khi #2 xong |
| **Total** | **~55-75 min** | |

---

## Sau khi fix xong

- [ ] Typecheck `pnpm typecheck` pass
- [ ] Lint `pnpm lint` pass
- [ ] Manual smoke test: full demo flow (greeting → magic build 39s → JSON → resize drawer → export)
- [ ] Update README nếu có thêm keyboard shortcut (Arrow Left/Right resize drawer)
- [ ] Git commit từng fix riêng để dễ revert nếu cần:
  - `fix(json-tab): TabsContent flex leak gây empty space`
  - `fix(fx): dot grid full coverage + brighter idle alpha`
  - `feat(drawer): non-modal + resizable width`

---

*Plan này tuân thủ original design philosophy (shadcn/ui + Radix + Tailwind tokens + Zustand). Không refactor lớn — chỉ fix layer.*
