# 🎨 Trading Bot — Design Guidelines

> **Phiên bản:** 1.0
> **Ngày:** 2026-04-24
> **Phong cách:** Modern Dark (Trading Pro)
> **Tech stack đề xuất:** React 18 + TypeScript + Tailwind CSS + shadcn/ui + Lucide Icons
> **Font:** Inter (UI) + JetBrains Mono (số liệu / code)

---

## 1. Triết lý thiết kế (Design Principles)

Trading bot là công cụ tài chính → UI phải tạo **cảm giác tin cậy, chuyên nghiệp, data-first**. Không decoration thừa, không animation lòe loẹt.

| Nguyên tắc | Diễn giải |
|---|---|
| **Data-first** | Số liệu là vua. Typography và spacing phục vụ việc đọc số nhanh, chính xác. |
| **Clarity over cleverness** | Không label mơ hồ. Không icon thay chữ khi chữ rõ hơn. |
| **Hierarchy rõ ràng** | Một màn hình chỉ có **1 primary action**. Thông tin phụ phải nhìn ra là phụ. |
| **Dense nhưng không rối** | Trader cần nhiều info cùng lúc → dùng spacing nhỏ hơn SaaS thông thường (padding 12–16px thay vì 24px). |
| **Feedback tức thì** | Mọi tương tác phải có phản hồi < 100ms (hover, click, loading, error). |
| **Fail-safe cho hành động nguy hiểm** | Start/stop bot, delete strategy, withdraw → luôn có confirmation modal. |

---

## 2. Hệ màu (Color System)

### 2.1. Design tokens (CSS variables)

Copy block này vào `globals.css` hoặc `tailwind.config`:

```css
:root {
  /* === BACKGROUND === */
  --bg-base:         #0B0E11;  /* Nền chính (body) */
  --bg-surface:      #14181F;  /* Card, panel */
  --bg-elevated:     #1E2329;  /* Modal, dropdown, popover */
  --bg-hover:        #2B3139;  /* Hover state */
  --bg-active:       #363C45;  /* Pressed / selected */
  --bg-input:        #181C22;  /* Input, select, textarea */

  /* === BORDER === */
  --border-subtle:   #1E2329;  /* Divider mờ */
  --border-default:  #2B3139;  /* Border mặc định */
  --border-strong:   #474D57;  /* Border nhấn */
  --border-focus:    #F0B90B;  /* Khi focus input */

  /* === TEXT === */
  --text-primary:    #EAECEF;  /* Chữ chính */
  --text-secondary:  #B7BDC6;  /* Chữ phụ, label */
  --text-tertiary:   #848E9C;  /* Caption, helper */
  --text-disabled:   #5E6673;  /* Disabled */
  --text-inverse:    #0B0E11;  /* Chữ trên nền sáng (btn primary) */

  /* === BRAND === */
  --brand-primary:   #F0B90B;  /* Gold — CTA chính */
  --brand-hover:     #FCD535;
  --brand-active:    #D9A400;
  --brand-subtle:    #F0B90B1A; /* 10% alpha — bg tint */

  /* === TRADING — QUAN TRỌNG === */
  --bullish:         #0ECB81;  /* Long / Buy / Up / Profit */
  --bullish-hover:   #2EBD85;
  --bullish-subtle:  #0ECB811F;
  --bearish:         #F6465D;  /* Short / Sell / Down / Loss */
  --bearish-hover:   #F6647B;
  --bearish-subtle:  #F6465D1F;

  /* === STATUS === */
  --success:         #0ECB81;
  --warning:         #F0B90B;
  --danger:          #F6465D;
  --info:            #3B82F6;

  /* === CHART === */
  --chart-grid:      #1E2329;
  --chart-axis:      #5E6673;
  --chart-1:         #F0B90B;
  --chart-2:         #3B82F6;
  --chart-3:         #A855F7;
  --chart-4:         #EC4899;
  --chart-5:         #14B8A6;
}
```

### 2.2. Quy tắc dùng màu

**Bullish/Bearish (màu xanh/đỏ tài chính):**
- **CHỈ** dùng cho giá trị tài chính: P&L, % change, side (long/short), buy/sell button trong order form.
- **KHÔNG** dùng cho success/error UI chung (ví dụ: toast "Đã lưu") — dùng `--success` / `--danger` thay vì `--bullish` / `--bearish` để tránh user hiểu lầm thành tín hiệu trade.
- Lưu ý accessibility: **luôn kèm icon hoặc ký hiệu** (▲ ▼, +/-) chứ không chỉ dựa màu — có trader bị mù màu đỏ/xanh.

**Brand gold (#F0B90B):**
- Primary button, active tab indicator, focus ring, logo accent.
- Tránh dùng tràn lan — mỗi màn hình tối đa 1–2 chỗ nổi bật.

**Neutral palette:**
- 80% diện tích UI là background + text neutral.
- Dùng độ sáng của nền (base → surface → elevated) để tạo depth thay vì shadow.

---

## 3. Typography

### 3.1. Font stack

```css
--font-sans: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
--font-mono: 'JetBrains Mono', 'SF Mono', Menlo, Consolas, monospace;
```

- **Sans (Inter):** toàn bộ UI — label, nút, text.
- **Mono (JetBrains Mono):** số tiền, % change, order ID, hash, JSON preview. Mono giúp số thẳng cột, dễ so sánh.

### 3.2. Type scale

| Token | Size / Line-height | Weight | Dùng cho |
|---|---|---|---|
| `text-2xs` | 10 / 14 | 500 | Badge nhỏ, tag |
| `text-xs`  | 11 / 16 | 500 | Metadata, timestamp |
| `text-sm`  | 12 / 18 | 400 | Table cell, helper text |
| `text-base`| 14 / 20 | 400 | **Body mặc định** (trading UI dùng 14 thay vì 16) |
| `text-md`  | 16 / 24 | 500 | Sub-heading, label nổi bật |
| `text-lg`  | 18 / 28 | 600 | Card title |
| `text-xl`  | 20 / 28 | 600 | Section title |
| `text-2xl` | 24 / 32 | 700 | Page title |
| `text-3xl` | 32 / 40 | 700 | Hero number (balance, P&L) |
| `text-4xl` | 40 / 48 | 700 | Dashboard headline |

### 3.3. Quy tắc cho số liệu

- **Luôn** `font-variant-numeric: tabular-nums;` cho số — để 9 rộng bằng 1.
- Số tiền: dùng font mono, căn phải.
- % change: đặt màu + dấu (+/-), ví dụ `+2.34%` (bullish) / `-1.82%` (bearish).
- Số lớn: format có phân cách ngàn: `1,234,567.89`.

---

## 4. Spacing & Layout

### 4.1. Spacing scale (4px base)

```
0.5 → 2px     4 → 16px     10 → 40px
1   → 4px     5 → 20px     12 → 48px
1.5 → 6px     6 → 24px     16 → 64px
2   → 8px     7 → 28px     20 → 80px
2.5 → 10px    8 → 32px     24 → 96px
3   → 12px    9 → 36px
```

Dùng thẳng Tailwind scale (`p-2`, `gap-4`, `space-y-6`…).

### 4.2. Layout chuẩn

```
┌─────────────────────────────────────────────┐
│ TOP BAR (56px)       logo · nav · user     │
├──────────┬──────────────────────────────────┤
│          │                                  │
│ SIDEBAR  │   MAIN CONTENT                   │
│ (240px)  │   max-w-[1440px] mx-auto         │
│          │   px-6 py-6                      │
│          │                                  │
└──────────┴──────────────────────────────────┘
```

- **Sidebar:** 240px cố định (có thể thu về 64px icon-only).
- **Top bar:** 56px, sticky.
- **Main content:** padding `24px`, max-width `1440px`.
- **Form config bot:** max-width `720px` để dễ đọc.
- **Config + JSON preview:** chia 2 cột `60% / 40%` hoặc `grid-cols-[1fr_480px]`.

### 4.3. Radius

```
--radius-sm:   4px    /* badge, tag */
--radius-md:   6px    /* input, button */
--radius-lg:   8px    /* card */
--radius-xl:   12px   /* modal, large panel */
--radius-full: 9999px /* pill, avatar */
```

### 4.4. Elevation (dùng border + bg thay shadow đậm)

Dark theme không cần shadow đậm → dùng **độ sáng background layered**:

| Level | Bg | Border | Khi nào dùng |
|---|---|---|---|
| 0 | `--bg-base` | none | Body |
| 1 | `--bg-surface` | `--border-subtle` | Card tĩnh |
| 2 | `--bg-elevated` | `--border-default` | Dropdown, popover |
| 3 | `--bg-elevated` | `--border-default` + `shadow-lg` | Modal, toast |

Shadow dark-mode (nhẹ):
```css
--shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.3);
--shadow-md: 0 4px 8px rgba(0, 0, 0, 0.4);
--shadow-lg: 0 12px 24px rgba(0, 0, 0, 0.5);
```

---

## 5. Components

### 5.1. Button

| Variant | Dùng khi | Style |
|---|---|---|
| **Primary** | CTA chính (Save, Start Bot) | bg gold, text đen |
| **Secondary** | Action phụ (Cancel, Back) | bg surface, border default |
| **Ghost** | Action trong table row, toolbar | bg transparent, hover bg |
| **Destructive** | Xóa, Stop Bot, Cancel Order | bg bearish, text trắng |
| **Success** | Buy / Long button | bg bullish, text trắng |
| **Danger** | Sell / Short button | bg bearish, text trắng |
| **Link** | Inline navigation | text gold, underline hover |

**Sizes:**
- `sm` — height 28px, text 12px, padding 12px
- `md` — height 36px, text 14px, padding 16px (**default**)
- `lg` — height 44px, text 16px, padding 20px

**States bắt buộc:** default, hover, active, focus (ring 2px gold), disabled, loading (spinner thay text).

### 5.2. Input / Form control

- Height: `40px` mặc định, `32px` compact (filter bar).
- Bg: `--bg-input`, border `--border-default`.
- Focus: border chuyển `--brand-primary` + ring 3px `--brand-subtle`.
- Error: border `--danger` + helper text đỏ bên dưới.
- Placeholder: `--text-tertiary`.
- Label: ở trên input, `text-sm`, `--text-secondary`.
- Helper text: dưới input, `text-xs`, `--text-tertiary`.
- **Number input cho trading config:**
  - Font mono, căn phải.
  - Có suffix unit (`USDT`, `%`, `x`) ở bên phải.
  - Step buttons (+/-) nếu là param quan trọng (leverage, risk %).

**Các control cần có:**
Text, Number, Select (dropdown có search), Multi-select, Switch (on/off bot), Radio group, Checkbox, Slider (cho leverage, risk %), Date/time picker, Textarea, Code editor (cho custom strategy script), Tag input (cho list symbols).

### 5.3. Card

```
┌─────────────────────────────────────┐
│  Card Header  (padding 16px)       │
│  ─────────────────────────────      │  ← border-subtle
│                                     │
│  Card Body    (padding 16px)        │
│                                     │
│  ─────────────────────────────      │
│  Card Footer  (padding 12 16px)     │
└─────────────────────────────────────┘
```
- Bg `--bg-surface`, border `--border-subtle`, radius `lg`.
- Header có title `text-md font-semibold` + optional action bên phải.

### 5.4. Table (cực quan trọng cho trading data)

- Header: `bg-elevated`, sticky, text `xs uppercase tracking-wide` `--text-tertiary`.
- Row height: `48px` default, `40px` compact.
- Row hover: `--bg-hover`.
- Zebra stripe: **không** — gây nhiễu. Dùng border mờ giữa row.
- Cell số: font mono, căn phải.
- Cell text: căn trái.
- Cell action: căn phải, chỉ hiện khi hover row.
- Sort indicator: mũi tên nhỏ cạnh header.
- Empty state: icon + text trung tâm, padding 64px.
- Loading: skeleton row (3–5 rows).
- Pagination hoặc virtual scroll nếu > 100 rows.

### 5.5. Badge / Status

Size: `20px` height, `text-xs`, padding `0 8px`, radius `sm`.

| Trạng thái bot | Màu | Label |
|---|---|---|
| Running | `--success` subtle bg, solid text | ● Running |
| Paused | `--warning` subtle bg | ● Paused |
| Stopped | `--text-tertiary` subtle bg | ● Stopped |
| Error | `--danger` subtle bg | ● Error |

Badge "side" trong order table: `LONG` (bullish), `SHORT` (bearish), `BUY` (bullish), `SELL` (bearish).

### 5.6. Modal / Dialog

- Overlay: `rgba(0,0,0,0.6)` + backdrop-blur 4px.
- Container: max-width `560px` (default), `720px` (lg), `960px` (xl).
- Padding: `24px`.
- Header: title + close button (X) góc phải.
- Footer: actions căn phải, Primary bên phải nhất, Secondary bên trái.
- **Confirmation modal** (cho hành động nguy hiểm): icon cảnh báo trái, text mô tả hậu quả rõ ràng, nút Destructive bên phải.

### 5.7. Toast / Notification

- Vị trí: top-right, cách top 16px.
- Width: `360px`.
- Auto-dismiss: 4s (info/success), 6s (warning), **không auto-dismiss** (error).
- Có icon trái + title + description + close button.
- Max 3 toast chồng lên, toast mới đẩy cũ xuống.

### 5.8. Tabs

- Horizontal underline tab (không dùng pill/segmented trừ khi là filter).
- Active: underline gold 2px + text `--text-primary`.
- Inactive: `--text-secondary`, hover `--text-primary`.
- Padding: `12px 16px`.

### 5.9. Sidebar navigation

- Width: 240px expanded, 64px collapsed.
- Item height: 40px, padding 12px.
- Active: bg `--brand-subtle`, text `--brand-primary`, left border 3px gold.
- Icon size: 18px, gap 12px với text.
- Group label: `text-xs uppercase tracking-wide --text-tertiary`, padding 16px 12px 8px.

### 5.10. Tooltip

- Bg `--bg-elevated`, border `--border-default`, text `--text-primary` `text-xs`.
- Padding `6px 10px`, radius `md`.
- Delay: 300ms hover in, 100ms hover out.
- Dùng nhiều trong config bot để giải thích params.

### 5.11. JSON / Code preview

- Bg `--bg-base`, font mono, `text-sm`, line-height `20px`.
- Syntax highlight:
  - key: `#79C0FF` (xanh)
  - string: `#A5D6FF`
  - number: `#F0B90B`
  - boolean: `#FF7B72`
  - null: `--text-tertiary`
- Có nút copy góc phải trên.
- Line number (optional): `--text-disabled`.

### 5.12. Empty state / Loading

- **Empty:** icon 48px `--text-disabled` + tiêu đề + mô tả + CTA chính (nếu có).
- **Loading skeleton:** bg gradient shimmer từ `--bg-surface` → `--bg-hover`.
- **Spinner:** vòng tròn gold 2px, 16/20/24px theo context.

---

## 6. Icon

- Thư viện: **Lucide React** (đi kèm shadcn/ui).
- Size: `14px` inline, `16px` button/input, `18px` sidebar nav, `20px` section header, `24px` empty state.
- Stroke width: 1.75 (mặc định) / 2 (button).
- Color: inherit từ text, không đặt màu cứng.

---

## 7. Motion / Animation

**Nguyên tắc:** tối giản, nhanh. Trading UI không cần bouncy.

| Thuộc tính | Duration | Easing |
|---|---|---|
| Hover, focus | 120ms | `ease-out` |
| Dropdown, popover | 150ms | `ease-out` |
| Modal enter | 200ms | `cubic-bezier(0.16, 1, 0.3, 1)` |
| Toast enter | 180ms | `ease-out` |
| Page transition | 0ms | **không animate** — trader muốn tốc độ |
| Price update flash | 400ms | `ease-out` (bg flash green/red rồi fade về) |

**KHÔNG**: parallax, scale bounce, stagger dài > 300ms, autoplay carousel.

---

## 8. Accessibility (bắt buộc cho production)

- Contrast: text thường ≥ 4.5:1, text lớn ≥ 3:1 (WCAG AA). Kiểm tra bằng DevTools.
- Focus ring visible **luôn** — ring 2px `--brand-primary` + offset 2px.
- Tất cả interactive element phải reachable bằng `Tab`.
- `aria-label` cho icon-only button.
- Modal: trap focus, ESC để close, restore focus về trigger.
- Form error: `aria-invalid` + `aria-describedby` trỏ đến helper text.
- **Không dùng màu là duy nhất** để truyền thông tin (long/short phải có thêm chữ `LONG`/`SHORT` hoặc icon ▲/▼).

---

## 9. Patterns chuyên cho Trading Bot Config

### 9.1. Config form → JSON

Layout 2 cột side-by-side:
```
┌─────────────────────┬──────────────────┐
│  Form Config (60%)  │  JSON Preview    │
│                     │  (40%, sticky)   │
│  [label] [input]    │  { ... }         │
│  [label] [select]   │                  │
│                     │  [Copy] [Send]   │
└─────────────────────┴──────────────────┘
```
- Form thay đổi → JSON update realtime.
- JSON có syntax highlight + nút copy + nút send to server.
- Validate form trước khi enable nút "Send".

### 9.2. Param sections

Chia config thành các **collapsible section**:
1. **General** (bot name, description, enabled)
2. **Market** (exchange, symbol, timeframe)
3. **Strategy** (loại strategy, params)
4. **Risk Management** (position size, leverage, max drawdown, stop-loss, take-profit)
5. **Schedule** (start/end time, active days)
6. **Notifications** (Telegram, email, webhook)

Mỗi section có icon + description + toggle expand.

### 9.3. Số nguy hiểm cần confirm

Các input có risk cao phải có UX bảo vệ:
- **Leverage ≥ 10x:** show warning icon + tooltip cảnh báo.
- **Position size > 50% balance:** required confirm modal.
- **Stop-loss tắt:** banner đỏ "Không có stop-loss — rủi ro mất toàn bộ vốn".

### 9.4. Live value display

Số liệu real-time (price, P&L):
- Flash bg green 400ms khi tăng, red khi giảm.
- Dùng `aria-live="polite"` cho screen reader.
- **Không** polling < 500ms (gây rerender nặng).

### 9.5. Dashboard card priority

| Vị trí | Nội dung |
|---|---|
| Top (full width) | Tổng P&L, equity, open positions count |
| Left column | Bot status cards (mỗi bot 1 card) |
| Right column | Recent activity, alerts |
| Bottom | Orders table, positions table |

---

## 10. Checklist trước khi ship 1 màn hình

- [ ] Chỉ có **1 primary button** (hoặc có lý do rõ nếu nhiều hơn).
- [ ] Tất cả state: default / hover / focus / active / disabled / loading / error / empty.
- [ ] Test keyboard navigation (Tab / Shift+Tab / Enter / ESC).
- [ ] Test màn hình 1280px và 1920px.
- [ ] Số liệu dùng font mono và tabular-nums.
- [ ] Màu tài chính có kèm icon/chữ (không chỉ màu).
- [ ] Hành động nguy hiểm có confirmation.
- [ ] Loading state < 200ms thì không hiện skeleton (tránh nhấp nháy).
- [ ] Error message cụ thể, có action khắc phục.
- [ ] Không có console warning / lỗi accessibility.

---

## 11. File tham chiếu

- **`design-preview.html`** — preview trực quan toàn bộ component. Mở file này trong browser để xem màu và component thật.
- **Token JSON** (để import vào Figma / code): xem section 2.1 của file này.

---

*Mọi thay đổi guideline phải được review và version bump. Khi dev có thắc mắc, quay lại file này trước — đừng tự quyết.*
