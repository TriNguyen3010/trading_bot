# DESIGN GUIDELINE – Strategy Builder Tool

> Tài liệu nền tảng về **hệ thiết kế (design system)** và **brand** cho tool. Là "bảng kiểu" mà designer và dev cùng bám vào khi dựng component mới – tránh mỗi người một style. Bổ sung cho `ux_design_spec.md` (interaction) và `implementation_plan.md` (tech).

- **Ngày:** 2026-04-24
- **Trạng thái brand:** ⏳ Logo + brand color đang chờ user cung cấp – section 3 đang dùng **placeholder neutral**, sẽ swap sau.
- **Đối tượng:** Designer + FE developer + PM

---

## 1. Triết lý Design System

### 1.1 Tiếp cận: "Build từ gốc trên nền shadcn + Radix"

Không có design system nội bộ → **không cố gò vào bộ có sẵn**. Thay vào đó dựng một layer mỏng dựa trên:

```
┌─────────────────────────────────────────┐
│  Strategy Builder components            │  ← Domain (node, chip, condition row)
├─────────────────────────────────────────┤
│  shadcn/ui (Button, Input, Dialog…)     │  ← UI primitives (copy source, tự custom)
├─────────────────────────────────────────┤
│  Radix UI (headless)                    │  ← A11y + keyboard
├─────────────────────────────────────────┤
│  Tailwind + design tokens (CSS vars)    │  ← Visual language
└─────────────────────────────────────────┘
```

**Lý do:**
- shadcn **không phải npm package**, mà là source copy-paste → full quyền custom theo brand (khi user đưa brand color).
- Radix giải quyết 80% a11y & keyboard navigation ngầm.
- Tailwind tokens dễ swap theme sau (nếu Phase 2 muốn thêm light).

### 1.2 Nguyên tắc

1. **One source of truth:** mọi màu/spacing/radius phải là CSS variable, không hardcode hex trong component.
2. **Composable, không inheritable:** tạo Button biến thể mới bằng `variant` prop, không extend class.
3. **A11y first:** mọi component có focus visible, aria đúng, contrast đạt AA.
4. **Dark-only MVP** (chốt), nhưng tokens đặt tên theo **semantic** (`--color-bg-surface`) để Phase sau thêm light dễ.

---

## 2. Typography

### 2.1 Font chính: **Inter**

Dùng Inter vì:
- Tối ưu cho UI dense (số, bảng, chữ nhỏ).
- Miễn phí, Google Fonts + self-host đều OK.
- Hỗ trợ **tabular-nums** (số thẳng cột – quan trọng cho field Leverage, stake amount).
- Cảm giác trung tính, không quá tech-y như JetBrains Mono hay quá friendly như Poppins.

**Swap alternatives** nếu user cung cấp font brand riêng sau:
- **Geist** – Vercel, tương đương Inter nhưng hiện đại hơn (cần license check).
- **IBM Plex Sans** – nếu cần cảm giác enterprise.
- **SF Pro** – chỉ nếu target Apple ecosystem.

### 2.2 Scale

| Token | Size | Line height | Weight | Dùng cho |
|---|---|---|---|---|
| `--text-xs` | 11px | 16px | 500 | Caption, hint nhỏ |
| `--text-sm` | 13px | 20px | 400 | Body, label |
| `--text-base` | 14px | 22px | 400 | Body nội dung chính |
| `--text-md` | 15px | 24px | 600 | Heading node |
| `--text-lg` | 18px | 28px | 600 | Dialog title, section heading |
| `--text-xl` | 20px | 28px | 700 | Bot name header |
| `--text-2xl` | 24px | 32px | 700 | Page heading (ít dùng) |

### 2.3 Numeric formatting

Tất cả element hiển thị số cần:

```css
font-variant-numeric: tabular-nums;
font-feature-settings: "tnum", "ss01";
```

Tránh: 4 chữ số thập phân không cần thiết (`20.0000x` ❌ → `20x` ✓). Chỉ hiện decimal khi thực sự cần (giá token, %, PnL).

---

## 3. Brand (placeholder – chờ user cung cấp)

> ⏳ **TODO:** User sẽ cung cấp logo + brand color. Phần này là khung tạm, swap khi có brand.

### 3.1 Logo slot

Tạo placeholder SVG 32×32 tạm (chữ "S" trong vòng tròn, dùng `--accent-primary`).

Vị trí hiện:
- Header top-left (32×32).
- Favicon (32×32, 48×48, 192×192).
- Empty state illustration (accent điểm nhấn).
- OpenGraph image (1200×630) – khi share link.

File cần chuẩn bị khi có brand:
```
public/brand/
├── logo.svg              (fullsize, vector)
├── logo-32.png
├── logo-mark.svg         (chỉ icon, không có chữ)
├── favicon.ico
├── favicon-32.png
├── favicon-192.png
├── og-image.png
└── wordmark.svg          (nếu có chữ đi kèm logo)
```

### 3.2 Brand color

**Trạng thái tạm (neutral):**

| Token | Giá trị tạm | Ghi chú |
|---|---|---|
| `--brand-primary` | `#FACC15` (yellow-400, dùng như accent hiện tại) | **Swap khi có brand** |
| `--brand-secondary` | `#A78BFA` (violet-400) | Placeholder |
| `--brand-gradient-start` | `#FACC15` | Placeholder cho gradient accent |
| `--brand-gradient-end` | `#FB923C` | Placeholder |

Khi user đưa brand color:
1. Chạy contrast check: brand primary phải đạt ≥ 4.5:1 với `--bg-canvas` (#0A0A0B).
2. Nếu brand có gradient, nên có **tint/shade scale 50–900** (Tailwind style).
3. Cập nhật `tailwind.config.ts` và `tokens.css`.

### 3.3 Voice & tone

Dù không có brand guideline cụ thể, giữ tone:
- **Chuyên nghiệp nhưng không cứng nhắc.** Không dùng exclamation mark (`!`) ngoài báo lỗi.
- **Ngắn gọn, hành động rõ.** "Export JSON" thay vì "Click here to export JSON file".
- **Không viết tắt tùy tiện.** "Take profit" full, không "TP" trừ khi là mnemonic trader quen.
- **Số ≥ 1000 có dấu phân cách:** `$100,000` không `$100000`.
- **English only (MVP chốt).** Tách strings vào `src/i18n/en.ts` dù chỉ 1 ngôn ngữ, dễ thêm VI sau.

---

## 4. Color Tokens

Phân loại theo **semantic**, không theo màu. Khi cần đổi "xanh" thành "lime", chỉ đổi value, không đổi tên.

### 4.1 Surface (nền)

| Token | Hex | Dùng |
|---|---|---|
| `--color-bg-canvas` | `#0A0A0B` | Nền toàn canvas |
| `--color-bg-surface` | `#17171A` | Nền node, card |
| `--color-bg-surface-hover` | `#1F1F23` | Hover |
| `--color-bg-surface-active` | `#27272A` | Pressed, selected |
| `--color-bg-overlay` | `rgba(0,0,0,0.6)` | Modal backdrop |
| `--color-bg-input` | `#0F0F11` | Input field |

### 4.2 Border

| Token | Hex | Dùng |
|---|---|---|
| `--color-border-default` | `#2A2A2E` | Viền node mặc định |
| `--color-border-subtle` | `#1F1F23` | Divider mờ |
| `--color-border-strong` | `#3F3F46` | Viền cần nhấn |
| `--color-border-success` | `#10B981` | Node configured |
| `--color-border-warning` | `#FBBF24` | Warning |
| `--color-border-danger` | `#EF4444` | Error |
| `--color-border-focus` | `var(--brand-primary)` | Focus ring |

### 4.3 Text

| Token | Hex | Dùng |
|---|---|---|
| `--color-text-primary` | `#FAFAFA` | Body chính |
| `--color-text-secondary` | `#A1A1AA` | Label, hint |
| `--color-text-muted` | `#52525B` | Placeholder |
| `--color-text-inverse` | `#09090B` | Trên nền `--brand-primary` |
| `--color-text-success` | `#34D399` | Long, profit |
| `--color-text-danger` | `#F87171` | Short, loss |

### 4.4 Semantic (trading domain)

| Token | Hex | Dùng |
|---|---|---|
| `--color-long` | `#10B981` | Nhãn Long, take profit |
| `--color-short` | `#EF4444` | Nhãn Short, stop loss |
| `--color-neutral` | `#A1A1AA` | Direction chưa chọn |
| `--color-flow-default` | `#3F3F46` | Edge chưa active |
| `--color-flow-long` | `#10B981` | Edge direction Long |
| `--color-flow-short` | `#EF4444` | Edge direction Short |
| `--color-flow-signal` | `var(--brand-primary)` | Edge từ Config → Entry |

### 4.5 Opacity scale

Dùng `/NN` suffix Tailwind: `bg-brand-primary/10` = 10% alpha. Khuyến nghị chỉ dùng **5**, **10**, **20**, **40**, **80**, **100**.

---

## 5. Spacing & Radius

### 5.1 Spacing scale (Tailwind default + extend)

```
--space-0: 0
--space-1: 4px
--space-2: 8px
--space-3: 12px
--space-4: 16px    ← node padding
--space-5: 20px
--space-6: 24px    ← gap section
--space-8: 32px
--space-10: 40px   ← gap node dọc
--space-16: 64px
--space-20: 80px   ← gap node ngang
```

### 5.2 Radius

| Token | Value | Dùng |
|---|---|---|
| `--radius-sm` | 4px | Chip, tag |
| `--radius-md` | 8px | Button, input, card nhỏ |
| `--radius-lg` | 12px | Node, dialog |
| `--radius-xl` | 16px | Drawer, panel lớn |
| `--radius-full` | 9999px | Toggle, pill |

### 5.3 Elevation (shadow)

Dark theme → ít dùng shadow, thay bằng **border + backdrop-blur**. Nhưng vẫn có scale:

```
--shadow-sm: 0 1px 2px rgba(0,0,0,0.4)
--shadow-md: 0 4px 12px rgba(0,0,0,0.5)
--shadow-lg: 0 12px 32px rgba(0,0,0,0.6)
--shadow-glow-brand: 0 0 24px rgba(250,204,21,0.25)  ← dùng cho CTA hover
```

---

## 6. Iconography

### 6.1 Bộ icon chính: **Lucide React**

- Open source, MIT, match shadcn/ui.
- 1400+ icon đủ cho tool này.
- Stroke 1.5px, khớp với dark theme.

### 6.2 Custom icons (cần design)

Một số concept trading không có trong Lucide, cần vẽ:

| Icon | Dùng ở |
|---|---|
| 🕯️ Candlestick | ConfigBot node, chip candlestick |
| 📊 Indicator (sóng) | Add indicator button |
| 🧱 Condition group | Add group button |
| 🔀 Direction long/short | DirectionNode |
| 🎯 Take profit | CloseMethod |
| 🛡️ Stop loss | CloseMethod |
| 🤖 Bot badge | Header |

Style:
- Stroke 1.5px, cùng weight với Lucide.
- Size 16px / 20px / 24px (3 size).
- Export SVG + JSX component (để dùng className fill).

### 6.3 Favicon & app icon

Cùng với logo brand (section 3).

---

## 7. Illustration Style (cho Empty state)

User đã xác nhận **cần illustration cho empty state**. Định hướng:

### 7.1 Mood board

- **Minimal line-art** – một vài đường nét, không cố gắng realistic.
- **Monochrome + 1 accent color** (dùng `--brand-primary`) – không màu mè.
- **Isometric nhẹ** cho canvas empty, 2D flat cho dialog empty.
- Tham khảo: **Stripe dashboard empty state**, **Linear**, **Vercel** – sang trọng, không cute.

### 7.2 Các scene cần vẽ

| Scene | Mô tả | Size |
|---|---|---|
| **Canvas empty** | 4 node mờ đặt sẵn theo flow, có dấu `+` lớn ở giữa, text "Start here →" | 480×320 SVG |
| **Import empty** | Icon file SVG với dấu `+` | 120×120 |
| **Error canvas crash** | "Robot bị hỏng" – humor nhẹ | 240×240 |
| **Export success** | Checkmark + file icon | 120×120 |

### 7.3 Guidelines

- **Vector only (SVG).** Không PNG raster.
- **Inline SVG** để có thể style bằng `currentColor` + animate.
- **Accessibility:** có `<title>` + `<desc>` cho screen reader.
- **Tối đa 3 màu** trong một scene (bg, stroke, accent).

### 7.4 Ai làm?

- Designer 0.5 FTE (đã note trong plan Sprint 0) → deliverable 3–4 SVG.
- Nếu rush: dùng **unDraw.com** (miễn phí, tùy biến màu) cho MVP, thay illustration brand ở Phase 2.

---

## 8. Motion Guideline

### 8.1 Easing presets

```
--ease-out-quick:    cubic-bezier(0.2, 0.8, 0.2, 1)   /* default hover/exit */
--ease-in-out-snap:  cubic-bezier(0.6, 0, 0.4, 1)     /* expand/collapse */
--ease-spring:       cubic-bezier(0.34, 1.56, 0.64, 1) /* overshoot – CTA press */
--ease-linear:       linear                            /* loop animation edge */
```

### 8.2 Duration scale

| Token | ms | Dùng |
|---|---|---|
| `--duration-instant` | 100 | Focus ring, micro-press |
| `--duration-fast` | 150 | Hover color |
| `--duration-normal` | 200 | Expand/collapse, drawer |
| `--duration-slow` | 300 | Shake error, success pulse |
| `--duration-loop-edge` | 2000 | Edge dashed flow |

### 8.3 Framer Motion / CSS?

- **CSS transition** cho micro (hover, focus, toggle).
- **Framer Motion** cho choreographed (expand node, drawer, list stagger).
- **GSAP** chỉ khi thực sự cần (phức tạp timeline).

### 8.4 Reduce motion

Cả `prefers-reduced-motion: reduce` lẫn toggle user preference trong settings (Phase 2) đều phải:
- Tắt edge loop animation.
- Thay expand/collapse animation bằng instant.
- Giữ fade (opacity) vì không gây vertigo.

---

## 9. Component Library Foundation

### 9.1 Base components cần có từ Sprint 1

Copy từ shadcn (`npx shadcn-ui@latest add`):

- `Button` – primary / secondary / ghost / destructive + sizes (sm/md/lg/icon)
- `Input`, `Textarea`, `Label`
- `Select` (Radix) – dropdown Pair, Timeframe
- `Dialog` – confirm delete, import, **Coming soon** (Add strategy Phase 2)
- **`Sheet`** – right-side drawer 720px (Setup/Configure tabs) — **trọng tâm chính**
- `Popover` – indicator param edit, tooltip rich
- `Tooltip` – hints
- `Tabs` – 2 tab Setup/Configure trong Sheet, tabs Close method type
- `Switch` – Live/Dry-run toggle, trailing stop
- `Badge` – chip candlestick, direction label, state badge step card
- `Separator`
- `ScrollArea` – list step card khi nhiều, scroll trong drawer
- `Toast` – Sonner (khuyến nghị thay vì shadcn toast)
- `Command` (cmdk) – search indicator picker

### 9.2 Domain components tự build

**Step list & drawer:**

| Component | Mô tả |
|---|---|
| `StepCard` | Card hiển thị step trong vertical list (icon + title + summary + state badge) |
| `StepConnector` | Vertical line + `+` button giữa các step card |
| `StepDrawer` | Right-side drawer 720px, header + 2 tabs (Setup/Configure) + footer (Cancel/Save/Save & Next) |
| `AddStrategyButton` | Dashed full-width button cuối list, MVP click → "Coming soon" dialog |
| `IndicatorChip` | Chip hiển thị indicator + param (trong drawer Entry Strategy) |
| `ConditionRow` | Row AND/OR với 3 dropdown |
| `ConditionGroup` | Visual box wrap conditions |
| `ChipToggle` | Multi-select chip (candlestick Open/Close/High/Low/Volume) |
| `NumberInput` | Input số với step/min/max + format tabular |
| `EmptyState` | Illustration + CTA |
| `ComingSoonDialog` | Dialog cho Add strategy (Phase 2 placeholder) |

**Cypheus AI panel** *(chi tiết: `cypheus/cypheus_spec.md`)*:

| Component | Mô tả |
|---|---|
| `CypheusPanel` | Container 400px left panel, header với 2 tab (Cypheus / JSON) |
| `CypheusAvatar` | Avatar 32×32 (header) / 48×48 (greeting), 3 state idle/thinking/speaking, accept Lottie/SVG/PNG |
| `CypheusChat` | Chat thread scrollable, message bubble Cypheus + User |
| `MessageBubble` | Bubble – Cypheus có border-left brand-primary, user align right |
| `CypheusInput` | Multi-line input + send button, KHÔNG voice |
| `CreateNewBotButton` | Reset toàn bộ state, có confirm dialog |
| `JsonLiveView` | Tab thứ 2 trong panel, 2 sub-tab `bot.json`/`strategy.json`, line flash xanh khi change |
| `JsonViewer` | Syntax-highlight JSON dùng `prism-react-renderer` |
| `TypewriterText` | Text typing animation 30ms/char dùng cho Cypheus messages |

### 9.3 Storybook

Khuyến nghị dùng **Storybook** từ Sprint 1 để:
- Isolate test từng component.
- Designer review mà không cần chạy full app.
- Document variants cho FE onboard sau.

Effort: +3 ngày sprint 1 (chấp nhận được cho long-term).

---

## 10. File & tên gọi (để đồng bộ FE ↔ Design)

### 10.1 Cấu trúc token file

```
src/styles/
├── tokens.css           # CSS variables (section 4, 5)
├── fonts.css            # @font-face Inter
└── globals.css          # reset + base

tailwind.config.ts       # map tokens → Tailwind utility
```

### 10.2 Naming convention

| Loại | Convention | Ví dụ |
|---|---|---|
| CSS variable | kebab-case, scope semantic | `--color-bg-surface` |
| Tailwind extend | kebab + khớp token | `bg-surface`, `text-primary` |
| Component file | PascalCase | `ConfigBotNode.tsx` |
| Hook | camelCase, prefix `use` | `useAutoSave.ts` |
| Figma frame | `[Category]/ComponentName/State` | `Node/ConfigBot/Configured` |
| Figma layer | `ComponentName/element` | `ConfigBot/Title` |

---

## 11. Checklist khi tạo component mới

- [ ] Có dùng CSS variable / Tailwind token (không hardcode hex)?
- [ ] Có `variant` prop cho các biến thể?
- [ ] Có focus state (`focus-visible:ring`)?
- [ ] Có disabled state?
- [ ] Aria attribute đúng?
- [ ] Keyboard navigation test OK?
- [ ] Storybook story đủ variant?
- [ ] Unit test cho logic (không test style)?
- [ ] Match Figma ± 2px?

---

## 12. Roadmap design system

| Phase | Deliverable |
|---|---|
| **Sprint 0** | Token file + Figma foundation + 3–4 illustration SVG + brand placeholder |
| **Sprint 1** | Base components (shadcn setup) + Node variants + Storybook online |
| **Sprint 2** | Domain components đầy đủ (ConditionBuilder, IndicatorChip…) + Motion pass |
| **Sprint 3** | Icon set custom (candlestick, indicator…) + Polish pass theo usability test |
| **Post-MVP** | Swap brand khi user cung cấp + Light theme (optional) |

---

## 13. Open items cần user cung cấp

1. ⏳ **Logo** (SVG, wordmark, mark-only) – asynchronous, có lúc nào gửi cũng swap được.
2. ⏳ **Brand color primary** (hex hoặc Figma) – càng sớm càng đỡ rework.
3. ⏳ **Brand color secondary / accent** (nếu có) – optional.
4. ⏳ **Brand font** (nếu không phải Inter) – optional.
5. ⏳ **Tagline / product name** chính thức – cho header + OG image.

**Nếu sau Sprint 2 vẫn chưa có brand:** ship MVP với neutral placeholder (yellow accent), swap ở Phase 2 – cost thấp vì tokens đã semantic hoá.

---

*End of design guideline.*
