# Cypheus Dock v2 – Layout + Animated Border

> Update layout `cypheus_dock_plan.md`: chuyển progress dots lên **top-center** (thay vì bên trái), thêm **viền vàng có animation chạy vòng vòng** xung quanh frame (giống GitHub PR card với gradient flow border).

- **Ngày:** 2026-04-26
- **Liên quan:** [`cypheus_dock_plan.md`](./cypheus_dock_plan.md) (v1 – layout cũ)
- **Status:** Plan, áp dụng đè lên v1

---

## 1. Layout v2 – progress dots lên trên

### Trước (v1)
```
┌─────────────────────────────────────────┐
│ ●●●●  All set – ready to export   🤖   │
│ progress    text                avatar  │
└─────────────────────────────────────────┘
```

### Sau (v2) ⭐
```
        ●●●●                        ┐
                                     │ progress trên top center
┌──────────────────────────────────┐ │
│   All set – ready to export 🤖  │ │
│   text                  avatar   │ │
└──────────────────────────────────┘
↑ frame có viền vàng + anim chạy vòng
```

**Ghi chú vị trí progress dots:**
- Dots nằm **trên frame**, căn giữa horizontal.
- Có thể **lồng nửa trên frame** (overlap negative top margin) hoặc **đứng riêng phía trên** với gap nhỏ.
- Khuyến nghị: **đứng riêng** với gap 8px – sạch hơn, không bị frame border đè lên.

---

## 2. Anatomy chi tiết

```
        ┌───────────────┐
        │  ● ● ● ●      │  ← Progress dots (trên frame, center)
        └───────────────┘
              ↕ 8px gap
   ╔═══════════════════════════════════════╗
   ║  ╭─────────────────────────────╮      ║  ← Frame yellow border
   ║  │  All set – ready to export  │  🤖  ║     animated gradient flow
   ║  ╰─────────────────────────────╯      ║
   ╚═══════════════════════════════════════╝
```

**Layer stack:**
1. **Layer 0 – content**: text + avatar (giống v1)
2. **Layer 1 – background**: `--color-bg-surface` solid
3. **Layer 2 – animated border**: yellow gradient rotating quanh perimeter
4. **Layer 3 – progress dots**: floating phía trên, không nằm trong frame

---

## 3. Yellow animated border – đặc tả

### 3.1 Tham khảo
Giống effect ở GitHub PR card (ảnh phải) – có dải sáng (highlight) **chạy vòng vòng** quanh viền card, cảm giác "đang sống / có hoạt động".

### 3.2 Spec

| Property | Value |
|---|---|
| Border width | 2px |
| Border radius | `--radius-full` (pill) |
| Base color | `--brand-primary` opacity 30% (viền tĩnh) |
| Highlight color | `--brand-primary` opacity 100% (dải chạy) |
| Highlight gradient length | ~25% chu vi (vd. 90° trong 360°) |
| Animation duration | **3s** rotation 1 vòng |
| Easing | `linear` |
| Direction | Clockwise (theo chiều kim đồng hồ) |
| Glow halo | `box-shadow: 0 0 16px rgba(250, 204, 21, 0.25)` |

### 3.3 Behavior speed theo state (optional polish)

| State | Animation speed | Glow intensity |
|---|---|---|
| **Idle** | 6s/vòng (chậm, breathing) | 20% |
| **Thinking** | 1.5s/vòng (nhanh, pulse) | 50% |
| **Building** | 2s/vòng (steady fast) | 40% |
| **Done** | 4s/vòng (chậm dần lại) | 30% |

→ Nếu thấy phức tạp, **MVP dùng 1 speed duy nhất 3s/vòng** cho tất cả state – đủ ấn tượng.

---

## 4. CSS implementation – 2 cách

### Cách A – Conic-gradient + @property (modern, khuyến nghị)

```css
@property --border-angle {
  syntax: '<angle>';
  initial-value: 0deg;
  inherits: false;
}

.cypheus-dock {
  position: relative;
  border-radius: 9999px;
  background: var(--color-bg-surface);
  padding: 12px 16px;
}

.cypheus-dock::before {
  content: '';
  position: absolute;
  inset: -2px;                          /* expand 2px ra ngoài */
  border-radius: inherit;
  background: conic-gradient(
    from var(--border-angle),
    transparent 0%,
    var(--brand-primary) 25%,
    transparent 50%,
    transparent 100%
  );
  animation: rotate-border 3s linear infinite;
  z-index: -1;                          /* dưới content */
}

.cypheus-dock::after {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: inherit;
  background: var(--color-bg-surface);
  z-index: -1;                          /* che giữa, để chỉ thấy viền */
}

@keyframes rotate-border {
  to { --border-angle: 360deg; }
}
```

**Ưu điểm:**
- Smooth GPU-accelerated.
- Dễ đổi color/speed qua CSS variable.
- Không cần SVG hay JS.

**Nhược:** `@property` chưa support Firefox cũ → fallback tĩnh viền vàng đơn giản.

### Cách B – Border-image SVG (fallback)

```css
.cypheus-dock {
  border: 2px solid transparent;
  background:
    linear-gradient(var(--color-bg-surface), var(--color-bg-surface)) padding-box,
    conic-gradient(from 0deg, transparent, var(--brand-primary), transparent) border-box;
  animation: rotate-bg 3s linear infinite;
}
```

→ Đơn giản hơn, nhưng less smooth.

---

## 5. Progress dots position (HTML structure)

```tsx
<div className="cypheus-dock-wrapper">
  {/* Dots floating phía trên */}
  <div className="progress-dots">
    {Array.from({ length: 4 }).map((_, i) => (
      <span
        key={i}
        className={cn('dot', i < completedSteps && 'dot-filled')}
      />
    ))}
  </div>

  {/* Frame chính với animated border */}
  <div className="cypheus-dock">
    <span className="status-text">{statusText}</span>
    <CypheusAvatar size="md" />
  </div>
</div>
```

```css
.cypheus-dock-wrapper {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}

.progress-dots {
  display: flex;
  gap: 6px;
}

.dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--color-border-default);
  transition: background 200ms;
}

.dot-filled {
  background: var(--brand-primary);
}
```

---

## 6. Animation polish chi tiết

### 6.1 Dot fill khi step done
- Khi step build xong → dot fill từ trái sang phải, có **scale pulse** 1.2x trong 300ms rồi về 1x.
- Dùng Framer Motion hoặc CSS keyframe đơn giản.

### 6.2 Glow halo
- `box-shadow` quanh dock vàng nhạt (mục 3.2).
- Pulse intensity nhịp 2s (synced với border rotate hoặc độc lập).

### 6.3 Hover state (optional)
- Hover vào dock → border animation tăng tốc 1.5x trong 300ms (nhẹ, không quá đột ngột).
- MVP: skip cho đơn giản.

---

## 7. Z-index update

Không thay đổi từ v1:

| Element | z-index |
|---|---|
| Cypheus Dock wrapper (dots + frame) | **40** |
| Border animation pseudo-element | -1 (relative trong dock) |
| Avatar trong dock | 1 (trong dock) |

---

## 8. Reduced motion fallback

Khi `prefers-reduced-motion: reduce`:
- **Dừng hẳn animation border** – chỉ hiện viền vàng tĩnh (50% opacity).
- Dot vẫn fill khi step done nhưng **không pulse scale**, chỉ fade color.
- Glow halo giữ static, không pulse.

```css
@media (prefers-reduced-motion: reduce) {
  .cypheus-dock::before {
    animation: none;
    background: conic-gradient(
      from 0deg,
      var(--brand-primary) 0%,
      var(--brand-primary) 100%
    );
    opacity: 0.5;
  }
}
```

---

## 9. Acceptance

- [ ] Progress dots nằm **trên** frame, căn giữa horizontal, gap 8px với frame.
- [ ] Frame có border 2px màu vàng `--brand-primary`.
- [ ] Highlight gradient chạy vòng quanh viền clockwise, 3s/vòng, smooth không giật.
- [ ] Glow halo vàng nhạt quanh dock.
- [ ] Dot fill từ trái sang phải khi step build xong, pulse scale 1.2x → 1x.
- [ ] Layout v2 không thay đổi vị trí dock (vẫn bottom-center canvas, 32px from bottom).
- [ ] Avatar vị trí cũ (bên phải trong frame).
- [ ] Reduced motion: border animation tắt, dot pulse fade thay vì scale.
- [ ] Browser fallback (Firefox cũ không support `@property`): viền vàng tĩnh, không animate.

---

## 10. Code snippets sẵn để paste

### Component skeleton

```tsx
// CypheusDock.tsx
export function CypheusDock() {
  const { scriptState, currentStep } = useCypheusStore()
  const completedSteps = currentStep ?? 0

  return (
    <div className="cypheus-dock-wrapper">
      <div className="progress-dots">
        {[0, 1, 2, 3].map(i => (
          <motion.span
            key={i}
            className={cn('dot', i < completedSteps && 'dot-filled')}
            animate={i === completedSteps - 1 ? { scale: [1, 1.2, 1] } : {}}
            transition={{ duration: 0.3 }}
          />
        ))}
      </div>

      <div className="cypheus-dock">
        <span className="status-text">{getStatusText(scriptState, currentStep)}</span>
        <CypheusAvatar size="md" />
      </div>
    </div>
  )
}
```

### CSS module (full)

```css
/* CypheusDock.module.css */
@property --border-angle {
  syntax: '<angle>';
  initial-value: 0deg;
  inherits: false;
}

.wrapper {
  position: fixed;
  bottom: 32px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 40;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  pointer-events: none;
}

.progressDots {
  display: flex;
  gap: 6px;
}

.dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--color-border-default);
  transition: background 200ms ease-out;
}

.dotFilled {
  background: var(--brand-primary);
}

.dock {
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  border-radius: 9999px;
  background: var(--color-bg-surface);
  box-shadow: 0 0 16px rgba(250, 204, 21, 0.25);
  pointer-events: auto;
}

.dock::before {
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

.dock::after {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: inherit;
  background: var(--color-bg-surface);
  z-index: -1;
}

@keyframes rotate-border {
  to { --border-angle: 360deg; }
}

@media (prefers-reduced-motion: reduce) {
  .dock::before {
    animation: none;
    background: var(--brand-primary);
    opacity: 0.4;
  }
}
```

---

*End of plan v2.*
