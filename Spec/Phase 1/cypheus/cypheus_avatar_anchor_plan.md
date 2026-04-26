# Cypheus Avatar – Contextual Anchor (Step 1 ↔ Dock)

> Plan: Cypheus avatar **không cố định ở Dock**. Lúc idle (chưa interact), avatar nằm **trong Step 1 card** kèm border vàng animated để guide user click vào. Khi user bắt đầu interact (gõ chat hoặc click Step 1) → avatar **fly sang Dock**, dock hiện lên với progress.

- **Ngày:** 2026-04-26
- **Liên quan:** [`cypheus_dock_v2_plan.md`](./cypheus_dock_v2_plan.md), [`avatar_animation_plan.md`](./avatar_animation_plan.md)
- **Status:** Plan, áp dụng đè lên dock v2

---

## 1. Lý do thay đổi

Dock floating ở dưới canvas đang **quá nổi** so với việc thực sự cần làm – là click Step 1. Idle state nên **chỉ điểm rõ chỗ user cần đi tới đầu tiên**, không spread attention xuống dock.

→ Đổi thành: avatar đi theo **focus point** của user.

---

## 2. State machine 3 phase

| Phase | Trigger | Avatar ở đâu | Dock | Step 1 border |
|---|---|---|---|---|
| **A. Idle (initial)** | Page load, chưa user interact | **Trong Step 1 card** (góc phải) | **Hidden** | **Animated yellow glow** (như viền dock cũ) |
| **B. Active (user starts)** | User gõ submit Cypheus HOẶC click Step 1 (mở drawer manual) | **Trong Dock** (bottom) | **Visible** với progress | Bình thường (border default) |
| **C. Reset** | User click "Create new bot" | Quay về **Step 1 card** | **Hidden** | **Animated yellow glow** lại |

---

## 3. Phase A – Idle state (chính screen mẫu user gửi)

### 3.1 Visual

```
┌──────────────────────────────────────────────────────────┐
│  Send a message to Cypheus, or click any step below      │
│                       ↓                                  │
│                                                          │
│  ╔══════════════════════════════════════════════════╗   │
│  ║ [⚙] STEP 1                                       ║   │
│  ║     Bot Config            Tap to configure →  🤖 ║   │  ← avatar 64×64
│  ╚══════════════════════════════════════════════════╝   │
│   ↑ border: yellow animated gradient flow                │
│                                                          │
│  ┌──────────────────────────────────────────────────┐   │
│  │ [📊] STEP 2                                      │   │
│  │     Entry Strategy        Tap to configure → ⚪  │   │  ← border default
│  └──────────────────────────────────────────────────┘   │
│  ...                                                     │
└──────────────────────────────────────────────────────────┘
```

### 3.2 Avatar trong Step 1 card

- Vị trí: **góc phải** của Step 1 card, thay thế dotted circle placeholder.
- Size: **64×64** (lớn hơn dock 48×48 vì là focus point).
- Animation: `hello.webm` chạy 1 lần khi load → fade về `avatar.png` static.
- Vertical alignment: căn giữa Step 1 card height.
- Spacing: padding-right 24px từ edge card.

### 3.3 Border animated yellow của Step 1

Áp dụng **same animated border style** với dock v2:
- Border 2px conic-gradient yellow chạy clockwise.
- Speed: 3s/vòng (linear).
- Glow halo: `box-shadow: 0 0 20px rgba(250, 204, 21, 0.3)`.

→ Hiệu ứng **"đây là điểm vàng cần click"** rất rõ ràng.

### 3.4 Step 2, 3, 4 vẫn đứng yên

Các step còn lại giữ border default. Chỉ Step 1 có hiệu ứng glow → user không bị phân tâm.

### 3.5 Hint text trên cùng

```
Send a message to Cypheus, or click any step below
                       ↓
```

→ Giữ nguyên, vì hint này dẫn user tới cả 2 đường (Cypheus chat hoặc click step).

---

## 4. Phase B – Active state (dock hiện)

### 4.1 Trigger

Bất kỳ event nào dưới đây → chuyển từ Phase A sang Phase B:

1. **User submit message vào Cypheus chat** → Cypheus magic build sẽ chạy.
2. **User click Step 1 card** → Drawer mở, user fill manual.
3. **User click bất kỳ Step 2/3/4** (less common) → Drawer mở step đó.

→ Phase B có 2 sub-mode:
- **B-magic**: Cypheus đang auto-build (avatar `coding.webm` loop).
- **B-manual**: User đang fill drawer thủ công (avatar `avatar.png` static, vì Cypheus không "đang code").

### 4.2 Transition animation (Phase A → B)

```
[T+0ms]    User triggers (submit hoặc click step)
[T+0ms]    Step 1 border yellow animation FADE OUT (300ms)
[T+0ms]    Avatar BEGIN MOVE từ Step 1 → Dock position
            (Framer Motion layoutId shared element transition, 400ms ease-out)
[T+0ms]    Dock SLIDE UP từ bottom (translateY 20px → 0, opacity 0 → 1, 300ms)
[T+400ms]  Avatar landed in Dock
[T+400ms]  Dock border animation start
```

→ Transition **liền mạch**, không nháy hay bay lộn xộn.

### 4.3 Dock layout

Giữ nguyên như `cypheus_dock_v2_plan.md`:
- Progress dots top center
- Frame yellow border animated
- Status text + avatar (48×48 trong dock, nhỏ hơn vì context dock đã rõ)

---

## 5. Phase C – Reset (Create new bot)

User click **"Create new bot"** → confirm → reset:

```
[T+0ms]    Confirm dialog OK
[T+0ms]    Dock SLIDE DOWN + FADE OUT (250ms)
[T+0ms]    Avatar MOVE từ Dock → Step 1 (400ms ease-out)
[T+0ms]    Tất cả step card reset state ⚪
[T+400ms]  Avatar landed in Step 1
[T+500ms]  Step 1 border yellow animation FADE IN
[T+500ms]  Cypheus chào lại từ đầu (greeting message)
            ▶ hello.webm play 1 lần ở Step 1 vị trí
```

---

## 6. Edge cases

| Tình huống | Behavior |
|---|---|
| User hover Step 1 ở Phase A | Cursor pointer, glow border sáng thêm 10% (subtle hover state) |
| User scroll khi avatar ở Step 1 | Avatar cuộn theo step list (vì attached vào card). Khi scroll out of view, KHÔNG fallback sang dock – vẫn ẩn cho tới khi user trigger. |
| Magic build xong (Phase B → done) | Avatar **vẫn ở dock**, không quay về Step 1. Chỉ khi user "Create new bot" mới quay về. |
| User click Step 2/3/4 trước khi click Step 1 (case lạ) | Coi như B-manual triggered → avatar fly từ Step 1 → Dock như bình thường. |
| Refresh page khi đang Phase B | Quay về Phase A (avatar về Step 1). State BuilderState giữ nguyên qua localStorage. |
| Cypheus avatar `hello` chạy ở Step 1 | One-shot, sau đó về `avatar.png` static. Border yellow vẫn loop. |
| Reduced motion | Avatar không animate fly – jump cut từ Step 1 → Dock (300ms fade out → fade in). Border yellow chuyển static. |

---

## 7. Z-index update

| Element | z-index |
|---|---|
| Step list | 10 |
| Step 1 (Phase A) – animated border | 11 (slightly above khác step để glow nổi) |
| **Avatar trong Step 1** (Phase A) | **12** |
| Toolbar | 30 |
| **Dock** (Phase B/C) | **40** |
| **Avatar trong Dock** (Phase B/C) | **41** (cùng dock) |
| Drawer backdrop | 45 |
| Right drawer | 50 |

---

## 8. Implementation – shared element transition

Cách clean nhất: dùng **Framer Motion `layoutId`**. Avatar component duy nhất, render ở 2 vị trí khác nhau tuỳ phase.

```tsx
// CypheusAvatar.tsx
function CypheusAvatar({ size, anchor }: { size: number; anchor: 'step1' | 'dock' }) {
  const { avatarState } = useCypheusStore()

  return (
    <motion.div
      layoutId="cypheus-avatar"   // ← shared element transition
      transition={{ duration: 0.4, ease: 'easeOut' }}
      style={{ width: size, height: size }}
    >
      <AvatarMedia state={avatarState} />
    </motion.div>
  )
}
```

```tsx
// In StepList.tsx
function StepList() {
  const { phase } = useCypheusStore()  // 'idle' | 'active'

  return (
    <>
      <StepCard id={1} highlightAnimated={phase === 'idle'}>
        {phase === 'idle' && <CypheusAvatar size={64} anchor="step1" />}
      </StepCard>
      <StepCard id={2} />
      <StepCard id={3} />
      <StepCard id={4} />
    </>
  )
}

// Dock chỉ render khi phase === 'active'
function CypheusDock() {
  const { phase } = useCypheusStore()
  if (phase === 'idle') return null

  return (
    <motion.div
      initial={{ y: 20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: 20, opacity: 0 }}
      className="cypheus-dock-wrapper"
    >
      <ProgressDots />
      <div className="dock">
        <span>{statusText}</span>
        <CypheusAvatar size={48} anchor="dock" />
      </div>
    </motion.div>
  )
}
```

→ Khi `phase` đổi từ `idle` → `active`:
- Avatar unmount khỏi Step 1, mount vào Dock.
- `layoutId="cypheus-avatar"` → Framer Motion **tự animate position transition** giữa 2 vị trí.
- Dock animate slide up độc lập.

---

## 9. State machine update

```ts
// cypheus.store.ts
type Phase = 'idle' | 'active'   // NEW high-level state

type CypheusState = {
  phase: Phase                          // Avatar anchor + dock visibility
  scriptState: 'idle' | 'thinking' | 'building' | 'done'  // Cypheus build state
  currentStep: number | null
  // ...
}

// Triggers
function onUserSubmit() {
  setPhase('active')        // ← avatar fly to dock, dock shows
  setScriptState('thinking')
}

function onStepCardClick(stepId: number) {
  setPhase('active')        // ← same
  openDrawer(stepId, 'manual')
}

function onCreateNewBot() {
  setPhase('idle')          // ← avatar back to Step 1, dock hides
  resetBuilderState()
  resetCypheusChat()
  playGreeting()
}
```

---

## 10. Step 1 card layout chi tiết (Phase A)

```tsx
// StepCard.tsx (only for Step 1 in idle phase)
<motion.div
  className={cn('step-card', phase === 'idle' && stepId === 1 && 'step-card-highlighted')}
>
  <div className="step-card-content">
    <div className="step-icon">⚙</div>
    <div className="step-info">
      <span className="step-label">STEP 1</span>
      <h3>Bot Config</h3>
    </div>
  </div>

  <div className="step-card-right">
    <span className="tap-hint">Tap to configure →</span>
    {phase === 'idle' && stepId === 1 ? (
      <CypheusAvatar size={64} anchor="step1" />
    ) : (
      <StatusDot state={stepState} />  // ⚪ / ✓ / !
    )}
  </div>
</motion.div>
```

CSS animated border (giống dock v2):

```css
.step-card-highlighted {
  position: relative;
}

.step-card-highlighted::before {
  content: '';
  position: absolute;
  inset: -2px;
  border-radius: inherit;
  background: conic-gradient(
    from var(--border-angle),
    transparent 0deg,
    var(--brand-primary) 90deg,
    transparent 180deg
  );
  animation: rotate-border 3s linear infinite;
  z-index: -1;
}

.step-card-highlighted::after {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: inherit;
  background: var(--color-bg-surface);
  z-index: -1;
}

.step-card-highlighted {
  box-shadow: 0 0 20px rgba(250, 204, 21, 0.3);
}
```

---

## 11. Acceptance

- [ ] Phase A (page load): Avatar 64×64 nằm trong Step 1 card góc phải, Step 1 border vàng animated, dock ẩn.
- [ ] Step 2/3/4 ở Phase A: border default, không glow.
- [ ] User submit Cypheus chat → avatar fly từ Step 1 → Dock smoothly trong 400ms.
- [ ] User click Step 1 card → avatar fly + drawer mở đồng thời.
- [ ] Step 1 border yellow fade out 300ms khi avatar rời.
- [ ] Dock slide up từ bottom 300ms.
- [ ] Phase B (active): Dock visible, avatar 48×48 trong dock, Step 1 border default.
- [ ] User "Create new bot" → avatar fly từ Dock → Step 1 trong 400ms, dock slide down, Step 1 border yellow animated lại.
- [ ] Cypheus magic build kết thúc → avatar **vẫn ở dock** (không quay về Step 1).
- [ ] Refresh page khi đang Phase B → reload về Phase A.
- [ ] Reduced motion: jump cut thay vì fly animation.
- [ ] Framer Motion `layoutId` shared element transition hoạt động không nháy/giật.

---

## 12. Update các file khác

Sau khi plan này được duyệt, cần update đồng bộ:

- **`cypheus_spec.md`** mục 5 (script timeline) – thêm bước fly avatar trước khi drawer mở.
- **`cypheus_dock_v2_plan.md`** – thêm note dock có 2 visibility state (idle hide / active show).
- **`avatar_animation_plan.md`** – thêm note avatar có 2 anchor (Step 1 / Dock).
- **`drawer_persistence_spec.md`** – timeline magic build, T+5.5s drawer mở thì avatar đã fly trước đó (T+5.0s).
- **`design_guideline.md`** mục 9.2 – thêm component `StepCardHighlighted`.

---

*End of plan.*
