# Cypheus Dock – gộp Avatar + Progress

> Plan gộp **avatar Cypheus** (trên cùng panel chat) + **progress bar** (dưới cùng panel chat) thành **1 widget nổi (dock)** neo trên canvas, layer cao để không bị che. Logic state machine giữ nguyên, chỉ đổi layout + UI.

- **Ngày:** 2026-04-26
- **Lý do:** Avatar dễ scroll out-of-view khi chat dài, progress bar bị input + button che khi chat panel hẹp. Gộp vào 1 dock luôn hiện cố định → user luôn biết "Cypheus đang ở đâu, build đến bước nào".

---

## 1. Khái niệm

Tạo một **floating widget hình pill** chứa 3 phần (trái → phải):

```
┌─────────────────────────────────────────────────┐
│ ● ● ● ●   Set up your bot to get started   🤖   │
│ progress       status text              avatar   │
└─────────────────────────────────────────────────┘
```

- **Anchored** vào canvas (không phải vào panel chat)
- **z-index cao** (overlay, trên step card nhưng dưới drawer/dialog)
- **Luôn hiện** mọi state (idle, building, done)

---

## 2. Anatomy widget

| Element | Mô tả | Size |
|---|---|---|
| **Progress dots** | 4 dot tròn, fill theo step ✓ | 8px dot, 6px gap |
| **Status text** | Text contextual theo state | text-sm, color secondary |
| **Avatar Cypheus** | `avatar.png` / `hello.webm` / `coding.webm` (xem `avatar_animation_plan.md`) | 48×48 hoặc 56×56 |

**Container:**
- Background: `--color-bg-surface` với border `--color-border-default`
- Radius: `--radius-full` (pill)
- Padding: 12px 16px
- Shadow: `--shadow-md` để nổi lên trên canvas
- Width: auto (fit content), max-width ~480px

---

## 3. Vị trí neo

Anchored ở **bottom-center của step list canvas**, cách bottom 32px:

```
┌─────────┬─────────────────────────────────────┐
│  Left   │  HEADER                             │
│  panel  │                                     │
│         │   ┌─────────────────────────────┐   │
│  ◆Cyph. │   │ STEP 1: Bot Config        ⚪│   │
│         │   └─────────────────────────────┘   │
│  Hi,    │                                     │
│  I'm    │   ┌─────────────────────────────┐   │
│  Cypheus│   │ STEP 2: Entry Strategy    ⚪│   │
│         │   └─────────────────────────────┘   │
│  ...    │                                     │
│         │   ┌─────────────────────────────┐   │
│         │   │ STEP 3: Direction & Order ⚪│   │
│         │   └─────────────────────────────┘   │
│  Input  │                                     │
│  +Create│   ┌─────────────────────────────┐   │
│  new bot│   │ STEP 4: Close Method      ⚪│   │
│         │   └─────────────────────────────┘   │
│         │                                     │
│         │   ╔═════════════════════════════╗   │  ← Cypheus Dock
│         │   ║ ●●●● Set up your bot…  🤖 ║   │     (floating, 32px from bottom)
│         │   ╚═════════════════════════════╝   │
└─────────┴─────────────────────────────────────┘
```

**CSS positioning:**
```css
.cypheus-dock {
  position: fixed;            /* hoặc absolute trong canvas container */
  bottom: 32px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 40;                /* > step list (10), < right drawer (50) */
}
```

→ Khi user scroll step list, dock **vẫn đứng yên** (không scroll theo).
→ Khi right drawer mở, dock vẫn hiện vì **left panel + canvas vẫn visible**.

---

## 4. State variants

Dock đổi nội dung theo state (logic state machine giữ nguyên từ `cypheus_spec.md`):

| State | Progress dots | Status text | Avatar anim |
|---|---|---|---|
| **Idle** (page load) | `○○○○` | *"Set up your bot to get started"* | `hello.webm` → static |
| **Building Step 1** | `●○○○` | *"Configuring bot…"* | `coding.webm` loop |
| **Building Step 2** | `●●○○` | *"Defining entry conditions…"* | `coding.webm` loop |
| **Building Step 3** | `●●●○` | *"Setting direction & order…"* | `coding.webm` loop |
| **Building Step 4** | `●●●●` | *"Configuring exit method…"* | `coding.webm` loop |
| **Done** | `●●●●` ✓ | *"All set – ready to export"* | `hello.webm` → static |
| **After "Create new bot"** | `○○○○` | *"Set up your bot to get started"* | `hello.webm` → static |

**Progress dot color:**
- Filled `●`: `--brand-primary` (yellow)
- Empty `○`: `--color-border-default` (gray)
- Khi step build xong: dot pulse 1 lần (animation 400ms)

---

## 5. Thay đổi trong Left Panel

Vì avatar + progress đã chuyển ra dock, **Left Panel gọn hơn**:

**Trước:**
```
┌─ Left Panel ─────────┐
│ ◆ Cypheus  {} JSON   │
│ ────────────────     │
│ [LARGE AVATAR]   ◀── chuyển ra dock
│                      │
│ [Hi, I'm Cypheus]    │
│ [I'll help you…]     │
│                      │
│ ...                  │
│                      │
│ ●●●● Set up bot… ◀── chuyển ra dock
│ ────────────────     │
│ [Input]    [send]    │
│ [Create new bot]     │
└──────────────────────┘
```

**Sau:**
```
┌─ Left Panel ─────────┐
│ ◆ Cypheus  {} JSON   │
│ ────────────────     │
│ [Hi, I'm Cypheus]    │  ← chat bắt đầu ngay từ trên
│ [I'll help you…]     │
│                      │
│ ...                  │
│                      │
│ ────────────────     │
│ [Input]    [send]    │
│ [Create new bot]     │
└──────────────────────┘
```

**Avatar nhỏ trong message bubble** (24×24) vẫn giữ – đó là avatar context cho từng message, không phải avatar chính.

---

## 6. Behavior & interactions

| Tương tác | Behavior |
|---|---|
| Click vào dock | (Optional Phase 2) Mở quick-jump menu để jump tới step nào đó. **MVP: không click được.** |
| Hover dock | Cursor default, không tooltip (đã có status text rồi) |
| Drawer mở | Dock vẫn hiện (z-index < drawer). Nếu drawer chiếm 720px bên phải mà dock đang ở 50% center của canvas thì dock sẽ nằm ở phần canvas còn lại bên trái. |
| Resize window < 1200px | Dock fix bottom-center vẫn OK. Mobile (Phase 2) chuyển thành bottom-bar full width. |
| Reduced motion | Avatar không animate, progress dot pulse fade thay vì pulse scale. |

---

## 7. Z-index hierarchy (cập nhật)

| Element | z-index |
|---|---|
| Background canvas (particle/spotlight) | 0 |
| Step list | 10 |
| Step card hover state | 20 |
| Toolbar bottom-right | 30 |
| **Cypheus Dock** | **40** ⭐ |
| Right drawer | 50 |
| Drawer backdrop dim | 45 |
| Modal/dialog (Coming soon, Confirm) | 60 |
| Toast (Sonner) | 70 |
| Tooltip | 80 |

→ Dock luôn nổi trên step list, dưới drawer/modal.

---

## 8. Implementation gọn

```tsx
// CypheusDock.tsx
function CypheusDock() {
  const { scriptState, currentStep } = useCypheusStore()
  const totalSteps = 4
  const completedSteps = currentStep ?? 0

  const statusText = useMemo(() => {
    if (scriptState === 'idle')      return 'Set up your bot to get started'
    if (scriptState === 'thinking')  return 'Thinking…'
    if (scriptState === 'building')  return BUILDING_TEXT[currentStep]
    if (scriptState === 'done')      return 'All set – ready to export'
  }, [scriptState, currentStep])

  return (
    <div className="cypheus-dock">
      <ProgressDots completed={completedSteps} total={totalSteps} />
      <span className="status-text">{statusText}</span>
      <CypheusAvatar size="md" />  {/* 48×48 */}
    </div>
  )
}

const BUILDING_TEXT: Record<number, string> = {
  1: 'Configuring bot…',
  2: 'Defining entry conditions…',
  3: 'Setting direction & order…',
  4: 'Configuring exit method…',
}
```

```tsx
// CypheusPanel.tsx (đơn giản hoá)
function CypheusPanel() {
  return (
    <div className="cypheus-panel">
      <Tabs>
        <TabsList>
          <TabsTrigger value="cypheus">◆ Cypheus</TabsTrigger>
          <TabsTrigger value="json">{} JSON</TabsTrigger>
        </TabsList>
        <TabsContent value="cypheus">
          <CypheusChat />          {/* không còn avatar lớn ở trên */}
          <CypheusInput />
          <CreateNewBotButton />
        </TabsContent>
        <TabsContent value="json">
          <JsonLiveView />
        </TabsContent>
      </Tabs>
    </div>
  )
}
```

---

## 9. Edge cases

| Tình huống | Behavior dock |
|---|---|
| User chuyển sang JSON tab | Dock vẫn hiện (vì là canvas-level, không phải panel-level) |
| Drawer mở overlay | Dock vẫn hiện, nằm bên trái drawer |
| User resize chat panel (Phase 2 nếu có drag resize) | Dock độc lập, không bị ảnh hưởng |
| Không gian canvas quá hẹp (drawer mở + viewport nhỏ) | Dock có thể bị che 1 phần. Khuyến nghị: khi viewport < 1200px, dock dời lên trên drawer (bottom: 100px). |
| Cypheus đang typing message dài | Dock không bị ảnh hưởng (avatar chính nằm ở dock, không trong chat) |

---

## 10. Acceptance

- [ ] Dock pill anchored bottom-center của step list canvas, cách bottom 32px.
- [ ] Chứa đủ 3 phần: progress dots, status text, avatar Cypheus.
- [ ] z-index 40 – nổi trên step card, dưới drawer/modal.
- [ ] Avatar play đúng anim theo state (hello/coding/idle) – tận dụng `CypheusAvatar` đã có.
- [ ] Progress dot pulse 1 lần khi step vừa build xong.
- [ ] Status text update đúng theo state machine.
- [ ] Left panel gọn hơn: bỏ avatar lớn ở trên + bỏ progress bar dưới input.
- [ ] Khi right drawer mở, dock vẫn hiện và không bị che.
- [ ] Click "Create new bot" → dock reset về state idle.

---

*End of plan.*
