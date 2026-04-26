# UX DESIGN SPEC – Strategy Builder Tool

> Tài liệu tập trung vào **UI/UX** cho công cụ setup strategy → xuất JSON. Đây là "sườn cảm xúc" mà dev và designer cùng bám vào khi build. Bổ sung cho `trading_bot_spec.md` (feature) và `implementation_plan.md` (tech).

- **Ngày:** 2026-04-24
- **Scope:** MVP (single strategy, export JSON)
- **Đối tượng người đọc:** Designer, FE developer, PM

---

## 1. North Star

> "Người dùng phải **thấy chiến lược của mình** trên màn hình – không chỉ điền form. Mỗi node là một ý tưởng giao dịch, mỗi đường nối là một quyết định. Khi bấm Export, họ **tin** rằng JSON đó chính là chiến lược họ hình dung."

Ba giá trị cốt lõi:
1. **Visual-first** – builder trực quan, không phải wizard form dài lê thê.
2. **Confidence** – mỗi hành động có feedback rõ; JSON preview luôn sẵn để verify.
3. **Forgiveness** – sai là sửa được (undo), xóa là có xác nhận, không mất data khi refresh.

---

## 2. Persona & Context

| Persona | Background | Nhu cầu chính | Pain hiện tại |
|---|---|---|---|
| **Quant tự học** (chính) | Biết indicator, đọc được JSON, lười code | Cấu hình nhanh chiến lược, export JSON gửi bot | Viết JSON tay sai syntax, khó debug |
| **Trader chuyên nghiệp** | Không code, mạnh về setup | Diễn đạt idea dưới dạng điều kiện rõ ràng | Tool hiện tại quá dev-oriented |
| **Dev backend** (phụ) | Code bot | Cần JSON schema đúng để test API | Dev thủ công JSON mỗi lần test |

**Tần suất dùng:** 1–5 lần/tuần, mỗi session 10–30 phút. Không phải tool dùng hàng ngày → UX phải **dễ nhớ lại** sau 1 tuần không đụng.

**Thiết bị:** desktop là chính (95%), mobile để xem lại (5%). MVP desktop-only ≥ 1280px width.

---

## 3. Design Principles (6 nguyên tắc xuyên suốt)

### 3.1 Show, don't tell
Trạng thái phải **nhìn thấy được**, không ẩn trong toast/alert. Node hợp lệ = viền xanh, thiếu = viền xám, lỗi = viền đỏ. User chỉ cần nhìn canvas là biết cần sửa gì.

### 3.2 Progressive disclosure
Node ở trạng thái **collapsed** hiển thị tóm tắt (vd `BTC-USDC • 5m • 20x`). Click để expand xem form chi tiết. Không dồn mọi field vào 1 chỗ.

### 3.3 Direct manipulation
- Kéo node để sắp xếp, không cần menu.
- Click **tag** indicator để chỉnh param, không mở modal.
- Drag **chip** candlestick để reorder nếu cần.
- Nối strategy bằng drag handle, không dùng dropdown "chọn strategy".

### 3.4 Reversibility
Mọi hành động đều **undo được** (Ctrl+Z). Xóa node, xóa condition, đổi direction – tất cả vào history stack.

### 3.5 JSON là nguồn chân lý sống
Người dùng có thể **xem JSON realtime** bên cạnh canvas (split view hoặc drawer). Khi họ edit UI, JSON cập nhật ngay. Khi họ paste JSON (import), canvas render ngay. Hai chiều luôn đồng bộ.

### 3.6 Ít chữ, nhiều icon có nghĩa
Trader nhìn nhanh, không đọc. Dùng icon nhận diện: nến cho candlestick, sóng cho indicator, mũi tên ↑↓ cho direction. Chữ chỉ xuất hiện khi cần label rõ.

---

## 4. Information Architecture (3-column layout với Cypheus AI)

> **Cập nhật 2026-04-25:** Thêm left panel 400px chứa Cypheus AI assistant + JSON live view. Bỏ JSON drawer riêng (đã merge vào left panel). Chi tiết Cypheus tại [`cypheus/cypheus_spec.md`](./cypheus/cypheus_spec.md).

```
┌────────────────────────────────────────────────────────────────────────────┐
│  HEADER                                                                    │
│  ┌Logo┐ Strategy Name 🖉  Saved 2s ago  [Backtest][Export]                │
├────────────┬───────────────────────────────┬──────────────────────────────┤
│            │                               │                              │
│ LEFT PANEL │  STEP LIST (centered 720px)   │  RIGHT DRAWER (overlay)      │
│  400px     │                               │  720px – chỉ hiện khi click  │
│            │   ╔═══════════════════════╗   │  step card                   │
│ ┌◆Cyph.┐{} │   ║ ⚡ 1. Bot Config   ✓ ║   │                              │
│ │JSON  │  │   ║   BTC-USDC · 5m · 20x ║   │  Setup / Configure tabs      │
│ └──────┘   │   ╚═══════════════════════╝   │                              │
│            │              +                │                              │
│ [Avatar]   │   ╔═══════════════════════╗   │                              │
│ Hi, I'm    │   ║ 📊 2. Entry Strategy! ║   │                              │
│ Cypheus.   │   ╚═══════════════════════╝   │                              │
│            │              +                │                              │
│ [User msg] │   ╔═══════════════════════╗   │                              │
│ [Cyph msg] │   ║ ↗ 3. Direction & ⚪  ║   │                              │
│            │   ╚═══════════════════════╝   │                              │
│ ─────────  │              +                │                              │
│ [Type a    │   ╔═══════════════════════╗   │                              │
│  message…]→│   ║ 🎯 4. Close Method ⚪║   │                              │
│ [+ Create  │   ╚═══════════════════════╝   │                              │
│  new bot]  │                               │                              │
│            │   ┌─➕ Add strategy ─────┐    │                              │
│            │   └─ MVP: Coming soon ──┘    │                              │
└────────────┴───────────────────────────────┴──────────────────────────────┘
   Min viewport: ~1840px (desktop only MVP)
```

**Quy tắc layout chính:**

**Left Panel (400px – luôn hiện):**
- 2 tab: `[◆ Cypheus]` (default active) | `[{} JSON]`
- Cypheus tab: Avatar + chat thread + input box + "Create new bot" button
- JSON tab: Sub-tabs `bot.json` / `strategy.json`, live update, line flash xanh khi change

**Step List (720px – căn giữa):**
- 4 step card collapsed, click → mở right drawer (không inline expand)
- `Add strategy` button cuối list → "Coming soon" dialog (MVP)

**Right Drawer (720px – chỉ khi edit step):**
- Overlay style, canvas dim 50%
- 2 tab: Setup + Configure (KHÔNG có Test)
- KHÔNG có JSON view drawer riêng (đã merge vào Left Panel)

**Background effect:**
- Particle/spotlight chỉ ở vùng giữa (canvas trống quanh step list)
- Giảm density 30% khi right drawer mở

**Step card chi tiết:**

```
   ╔══════════════════════════╗  State badge góc phải:
   ║ ⚡ 1. Bot Config       ✓ ║    ⚪ pending
   ║   BTC-USDC · 5m · 20x    ║    ✓ configured
   ║   Live · $100,000        ║    ! error
   ╚══════════════════════════╝
              +                    ← Phase 2: insert step
                                     MVP: click → toast "Coming soon"
```

**Right Drawer khi mở (overlay style):**

```
┌──────────────┬──────────────────────────┬───────────────────────────────┐
│  Left Panel  │  Step list (dim 50%)     │  Right Drawer 720px           │
│  (vẫn hiện)  │  ╔═══════════════╗       ├───────────────────────────────┤
│              │  ║ ⚡ Bot Config ║       │  1. Bot Config         [×]    │
│  ◆ Cypheus   │  ║   (dimmed)   ║       │                               │
│              │  ╚═══════════════╝       │  ┌ [Setup] ── [Configure] ┐  │
│  Magic build │  ╔═══════════════╗       │  └────────────────────────┘  │
│  in progress │  ║ Entry Strategy║       │                               │
│  ...         │  ╚═══════════════╝       │  Pair *                       │
│              │  ...                      │  [🪙 BTC-USDC          ▾]    │
│              │                           │                               │
│              │                           │  Timeframe *                  │
│              │                           │  [5m                   ▾]    │
│              │                           │                               │
│              │                           │  ...                          │
│              │                           │                               │
│              │                           │  ┌──────┐ ┌────────────────┐ │
│              │                           │  │Cancel│ │ Save & Next →  │ │
│              │                           │  └──────┘ └────────────────┘ │
└──────────────┴──────────────────────────┴───────────────────────────────┘
```

**Lưu ý:** Left panel **luôn hiện** ngay cả khi right drawer mở – user vẫn theo dõi được Cypheus chat hoặc JSON live update song song với việc edit step.

---

## 5. Visual Design Tokens

### 5.1 Color (dark theme, khớp Ref_screen)

| Token | Hex | Dùng cho |
|---|---|---|
| `--bg-canvas` | `#0A0A0B` | Nền canvas (gần đen, hơi ấm) |
| `--bg-node` | `#17171A` | Nền node |
| `--bg-node-hover` | `#1F1F23` | Hover node |
| `--border-default` | `#2A2A2E` | Viền node chưa config |
| `--border-valid` | `#10B981` | Viền node đã config đúng (xanh) |
| `--border-error` | `#EF4444` | Viền lỗi validation (đỏ) |
| `--border-active` | `#FBBF24` | Viền node đang edit (vàng) |
| `--accent-primary` | `#FACC15` | CTA button, active edge vàng |
| `--accent-success` | `#10B981` | Long, take profit, valid |
| `--accent-danger` | `#EF4444` | Short, stop loss, error |
| `--text-primary` | `#FAFAFA` | Text chính |
| `--text-secondary` | `#A1A1AA` | Label, hint |
| `--text-muted` | `#52525B` | Placeholder |
| `--edge-default` | `#3F3F46` | Đường nối chưa active |
| `--edge-flow-long` | `#10B981` | Long flow (xanh) |
| `--edge-flow-short` | `#EF4444` | Short flow (đỏ) |

### 5.2 Typography

- Font: **Inter** hoặc **Geist** (khớp cảm giác Ref_screen).
- Size: 11px (caption), 13px (body), 15px (heading node), 20px (bot name).
- Weight: 400 (body), 500 (label), 600 (heading), 700 (number emphasis như `20x`, `$100,000`).
- Number font nên **tabular-nums** (`font-variant-numeric: tabular-nums`) để cột giá/leverage không nhảy.

### 5.3 Spacing

- Scale: 4, 8, 12, 16, 24, 32 px.
- Node padding: 16px.
- Gap giữa node trên canvas: 80px ngang, 40px dọc.
- Form field gap: 12px.

### 5.4 Motion

| Tương tác | Timing | Easing |
|---|---|---|
| Node hover | 150ms | `ease-out` |
| Node expand/collapse | 200ms | `ease-in-out` |
| Edge flow animation (đường đứt di chuyển) | 2s loop | `linear` |
| Drawer slide in/out | 250ms | `ease-out` |
| Validation feedback shake (lỗi) | 300ms | `ease` |
| Toast slide | 200ms | `ease-out` |

**Prefers-reduced-motion:** tắt animation edge + shake, giữ transition opacity/fade.

---

## 6. Step Card + Drawer Interaction Patterns

### 6.1 Step card state machine

```
     ┌── pending ──┐
     │  (gray ⚪)  │
click │             │ fill required fields trong drawer
     ▼             │
  drawer-open      │
  (purple ring)    │
     │             │
     │ close drawer│
     ▼             ▼
  configured ← validated
  (green ✓)
     │
     │ invalid change
     ▼
   error
   (red ! + tooltip)
```

Trạng thái hiển thị **icon góc phải** card:
- `pending`: vòng tròn xám `⚪`
- `drawer-open` (đang edit): viền brand-primary glow nhẹ
- `configured`: dấu `✓` xanh
- `error`: `!` đỏ + tooltip khi hover

### 6.2 Ví dụ: Bot Config step card

**Card collapsed (mặc định luôn collapsed, không có expanded inline):**
```
┌────────────────────────────────────────┐ ✓
│ ⚡ 1. Bot Config                        │
│   BTC-USDC · 5m · 20x · Live · $100k   │
└────────────────────────────────────────┘
```

**Click vào card → drawer 720px mở từ bên phải:**

```
┌─────────────────────────────────────────┐
│ ⚡ Bot Config                       [×] │
├─────────────────────────────────────────┤
│                                         │
│  ┌─ Setup ──┐ ┌─ Configure ──┐          │
│  │ active   │ │              │          │
│  └──────────┘ └──────────────┘          │
│                                         │
│  Pair *                                 │
│  [🪙 BTC-USDC                       ▾] │
│                                         │
│  Timeframe *                            │
│  [5m                                ▾] │
│                                         │
│  Trading mode *                         │
│  ( ) Live    (●) Dry-run                │
│                                         │
│  Dry-run wallet                         │
│  [$ 100,000                          ] │
│                                         │
├─────────────────────────────────────────┤
│  [Cancel]              [Save & Next →] │
└─────────────────────────────────────────┘
```

**Drawer 2 tab:**
- **Setup** – field **bắt buộc** để step pass validation.
- **Configure** – field **advanced/optional**, hardcode default nếu user không đụng.

**Quy tắc drawer:**
- Auto-focus vào field đầu tiên chưa điền của tab đang active.
- Tab order top → bottom, Tab nhảy giữa Setup/Configure được.
- Esc đóng drawer (kèm confirm nếu có thay đổi chưa save).
- Pair search typeahead (gõ "btc" → show "BTC-USDC, BTC-USDT…").
- Toggle Live/Dry-run: **Dry-run = default**, switch Live hiện confirm dialog đỏ.
- Nút **Save & Next** = save + tự động chuyển drawer sang step kế tiếp.
- Nút **Cancel** = revert thay đổi chưa save và đóng drawer.

### 6.3 Drawer phân chia Setup vs Configure cho từng step

| Step | Setup (bắt buộc) | Configure (advanced) |
|---|---|---|
| **Bot Config** | Pair, Timeframe, Trading mode (Live/Dry-run), Leverage | Exchange, Spot/Futures, Margin mode, Max open trades, API key, Telegram |
| **Entry Strategy** | Candlestick chips, Indicator(s), Conditions | Custom indicator timeframes, Lookback default, Group threshold |
| **Direction & Order** | Direction (Long/Short), Order type (Market/Limit) | Limit offset %, Slippage tolerance |
| **Close Method** | Method type (Manual/TP-SL/Indicator/ROI), basic params | ROI steps, Trailing stop options, Exit profit only, Custom exit |

### 6.4 Particle effect khi drawer mở

- Particle vẫn chạy ở canvas background (vùng bên trái drawer).
- Density giảm 30% khi drawer mở (tránh phân tán attention).
- Khu vực drawer (720px bên phải) **không** có particle.

### 6.5 Ví dụ: EntryStrategy step – Candlestick chips (trong drawer)

```
Candlestick price data:
[ Open ] [ Close ✓ ] [ High ] [ Low ] [ Volume ✓ ]
```
- Chip chưa chọn: nền `--bg-node-hover`, border `--border-default`.
- Chip đã chọn: nền `--accent-primary/20`, border `--accent-primary`, icon ✓ bên cạnh label.
- Click để toggle, Shift+Click để chọn dãy.
- Keyboard: Space để toggle chip đang focus.

### 6.4 Ví dụ: Indicator chip

```
┌────────────────┐
│ RSI • 14      ⚙│
└────────────────┘
```
- Click cog icon (⚙) → inline popover nhỏ chỉnh `timeperiod`.
- Click chữ `RSI` → mở lại picker để đổi loại.
- Click × → xóa (có undo).
- Drag để reorder trong list.

### 6.5 Ví dụ: Condition Builder

Layout quan trọng vì đây là phần phức tạp nhất:

```
┌─ Entry conditions ────────────────────────────┐
│                                               │
│  ┏━ IF ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓   │
│  ┃ 1. candle.close   >   RSI-14            ┃   │
│  ┃         AND                             ┃   │
│  ┃ 2. RSI-14         <   30                ┃   │
│  ┃         AND                             ┃   │
│  ┃ 3. candle.volume  is going up  +20%     ┃   │
│  ┃                                         ┃   │
│  ┃ [ + Add condition ] [ + Add group ]     ┃   │
│  ┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛   │
└───────────────────────────────────────────────┘
```

- **AND/OR** là pill ở bên trái (click để toggle).
- Group có nền hơi khác (`--bg-node-hover`) để nhóm thị giác rõ.
- Drag handle trái mỗi row để reorder.
- Row lỗi (chưa điền right value) highlight đỏ + placeholder rõ.

### 6.6 Ví dụ: TP/SL form (multi-level)

```
Take profit ●─── (toggle)
┌─────────────────────┐
│ Level 1             │
│ Profit:  20  %      │
│ Close:   50  %      │
├─────────────────────┤
│ Level 2             │
│ Profit:  50  %      │
│ Close:   25  %      │
└─────────────────────┘
[ + Add level ]

Stop loss ●─── (toggle)
Trailing: ○ off / ● on
Positive: 1.0 %
Offset:   1.5 %
```

- Summary hiện tổng % close: nếu > 100 → warning vàng.
- Level ≥ 2 có thể drag reorder theo profit asc.
- Delete level: icon × hover-only, có confirm nếu level đó đã có data.

### 6.7 Connection giữa các step card

Vì layout là vertical list, không có "edge" như canvas. Thay vào đó:

- Giữa 2 step có **vertical line** đứt nét + nút `+` ở giữa (Phase 2 dùng để insert step).
- **Line màu** thay đổi theo trạng thái:
  - Cả 2 step `pending` → đứt nét xám
  - Step trên `configured` + dưới `pending` → đứt nét vàng (báo "tiếp tục step này")
  - Cả 2 `configured` → liền nét xanh nhạt
- Hover vào line `+` → button hiện rõ, nhưng MVP click vào → toast "Inserting step coming in Phase 2".

### 6.8 Add strategy button (cuối list)

- Button `+ Add strategy` ở dưới step cuối cùng, full width (giống step card).
- Style: dashed border, text muted, hover sáng lên.
- **MVP click → dialog "Coming soon"** với illustration + text "Multi-strategy support is on the way. For now, you can configure one strategy per bot."
- Phase 2 thay thành dialog chọn strategy template hoặc tạo mới.

---

## 7. User Journey – Cypheus Magic Build (demo cho sếp)

> **Cập nhật 2026-04-25:** Thay vì tự build manual, MVP demo flow chính là **Cypheus auto-build** sau khi user gõ bất cứ gì. User journey "manual build" vẫn có (sau khi magic build xong), nhưng demo chính là magic.

### 7.1 Magic Build Flow (kịch bản chính – ~45 giây từ landing đến export)

```
[T+0s]    User landing → /builder
            ↓
          Layout 3-cột render: Left panel Cypheus active, step list 4 card pending,
          right drawer chưa mở. Particle/spotlight effect chạy nền giữa.

[T+1s]    Cypheus avatar fade in, glow pulse 2 lần.
          Cypheus typing message 1: "Hi, I'm Cypheus."
          Cypheus typing message 2: "I'll help you build your first trading bot.
                                     Tell me what you have in mind."
          Input box highlight focus.

[T+5s]    User gõ bất cứ gì (vd "trade BTC", "build me a bot", random text...) → Send.
            ↓
          User message bubble appears. Avatar → state thinking (3 dots 1s).

[T+6s]    Avatar → state speaking.
          Cypheus typing: "Got it. Let me build a Bollinger Breakout strategy
                          on BTC-USDC for you."
          Cypheus typing (note): "Note: This is demo content prepared to
                                 showcase the AI flow."

[T+11s]   ═══ STEP 1: Bot Config ═══════════════════════════
          Step 1 card pulse glow vàng.
          Right drawer mở (canvas + step list dim 50%, left panel vẫn active).
          Cypheus: "Setting up bot configuration..."

[T+13s]   Pair field typing animation: "BTC-USDC"
          Timeframe dropdown: "5m"
          Trading mode toggle: "Dry-run"
          Leverage typing: "20"
          Cypheus: "BTC-USDC offers high liquidity. 5-minute timeframe is
                   ideal for scalping."

[T+18s]   Drawer auto-save + close.
          Step 1 card: ⚪ → ✓ (pulse 1 lần).
          JSON tab (left panel) update line vừa change, flash xanh.

[T+19s]   ═══ STEP 2: Entry Strategy ═══════════════════════
          Step 2 pulse, drawer mở.
          Cypheus: "Defining entry conditions..."
          Candlestick chips toggle Close + Volume.
          Add indicator → RSI(14).
          Add condition → RSI-14 < 30.
          Cypheus: "RSI below 30 signals oversold – a classic buy entry."
          Drawer save + close. Step 2 ✓.

[T+27s]   ═══ STEP 3: Direction & Order ════════════════════
          Step 3 pulse, drawer mở.
          Direction: Long. Order type: Market.
          Cypheus: "Going Long with Market orders for fast fills."
          Save + close. Step 3 ✓.

[T+32s]   ═══ STEP 4: Close Method ═════════════════════════
          Step 4 pulse, drawer mở.
          Method tab: TP/SL.
          TP level 1: 5% profit, close 50%.
          TP level 2: 10% profit, close 25%.
          SL: -3%.
          Cypheus: "5% take-profit at half position, another 25% at 10% profit.
                   3% stop-loss."
          Save + close. Step 4 ✓.

[T+44s]   ═══ DONE ═════════════════════════════════════════
          Cypheus: "All set."
          Cypheus: "Review the JSON in the {} JSON tab, then click Export
                   when ready."
          Avatar → idle.

[T+45s+]  User toggle JSON tab → xem 2 file JSON đầy đủ → Click Export
          → Drawer Export mở (hoặc download trực tiếp), file `.json` tải về.
```

**Tổng thời lượng demo: ~45 giây.** Đủ ngắn để show sếp 1 lần đủ ấn tượng, đủ dài để thấy chi tiết từng step.

### 7.2 Manual build flow (sau magic, hoặc click "Create new bot")

User vẫn có thể build/edit thủ công sau khi Cypheus xong:
- Click step card → drawer mở để edit.
- Click "Create new bot" → confirm → reset toàn bộ → Cypheus chào lại từ đầu.

### 7.3 Đo lường

- **Time-to-first-export:** ≤ 60s với Cypheus magic flow.
- **Time-to-first-export manual:** ≤ 5 phút (sau khi Cypheus tắt).
- Track sự kiện: `cypheus_greeted`, `cypheus_user_submitted`, `cypheus_build_complete`, `step_opened_manually`, `step_configured`, `export_clicked`, `create_new_bot_clicked`.

---

## 8. Empty, Loading, Error states

### 8.1 Empty state (canvas rỗng lần đầu)
- 4 step card đặt sẵn theo flow với state `pending` (⚪) → user biết "đây là chỗ cần điền".
- Arrow + text ở step đầu: "Start here ↓".
- 3 template suggestion card ở **trên** step list: "Bollinger Breakout", "RSI Mean Reversion", "MACD Cross" – click để load template (fill 4 step luôn).
- Illustration SVG nhỏ phía trên (theo `design_guideline.md` mục 7).

### 8.2 Loading state
- Chỉ có khi Import file lớn: skeleton canvas 300ms.
- Auto-save: indicator nhỏ dạng `Saving...` → `Saved 2s ago` ở header, không block UI.

### 8.3 Error states

| Error | Vị trí hiển thị | Hành động khuyến nghị |
|---|---|---|
| Field required thiếu | Inline dưới input + border đỏ | Focus vào field lỗi đầu tiên khi bấm Export |
| Value out of range (vd leverage 999) | Inline + clamp tự động + tooltip | Clamp về max và show hint |
| Condition thiếu right value | Border row đỏ + icon ⚠ | Click icon → expand show "Right value missing" |
| JSON import không hợp lệ | Dialog đỏ với message cụ thể | Show diff / pointer dòng lỗi |
| Canvas render lỗi (bug) | Error boundary full-screen | Nút "Reset to last saved" |

### 8.4 Validation timing
- **On blur** cho field: không show lỗi khi user đang gõ.
- **On submit (Export)**: highlight tất cả lỗi đồng thời + scroll/focus lỗi đầu tiên.
- **Live check cho logic**: nếu TP levels cộng > 100% → warning vàng ngay, không chặn.

---

## 9. Microinteractions

Những chi tiết nhỏ tạo cảm giác "tool xịn":

1. **Edge animation dọc đường đứt** di chuyển slow – báo hiệu "data đang flow".
2. **Node khi configured** có pulse xanh 1 lần (400ms) rồi dừng.
3. **Candlestick chip** khi chọn có animate nhẹ scale 1 → 1.05 → 1.
4. **Export button** khi ready chuyển từ gray → yellow với glow nhẹ.
5. **JSON drawer** khi mở, JSON fade-in line by line (stagger 20ms mỗi line) cho đẹp.
6. **Undo action** hiện toast nhỏ "Undone" với progress bar 3s (click để redo).
7. **Confirm delete** có shake nhẹ nút Delete nếu user hover > 1s mà chưa click (gợi ý "bấm đi").
8. **Drag feedback**: node nhấc lên có shadow mờ rộng, edge được kéo theo smooth.

Giữ liều lượng – **dưới 300ms** và **tắt được** cho user muốn speedrun.

---

## 10. Accessibility (WCAG AA tối thiểu)

- **Contrast:** tất cả text ≥ 4.5:1 (đặc biệt label `--text-secondary` trên node).
- **Focus visible:** ring 2px `--accent-primary` quanh element đang focus.
- **Keyboard navigation:**
  - `Tab` qua các node theo thứ tự flow.
  - `Enter` để expand node, `Esc` để collapse.
  - `Space` toggle chip/checkbox.
  - `Del` xóa element focus (có undo).
  - `Ctrl+Z` / `Ctrl+Y` undo/redo.
  - `Ctrl+E` export, `Ctrl+I` import, `J` toggle JSON drawer.
- **Screen reader:** node có `aria-label` dạng "Entry Strategy 1, configured, 2 indicators, click to edit". Canvas có `role="application"`.
- **Color-blind friendly:** đừng chỉ dùng màu để báo trạng thái – luôn kèm icon (✓, ⚠, ×).
- **Reduced motion:** respect `prefers-reduced-motion: reduce`.

---

## 11. UX anti-patterns cần tránh

1. ❌ **Modal chồng modal** – một popover đủ; không "click button → mở modal → lại click button → modal khác".
2. ❌ **Toast là channel feedback duy nhất** – toast dễ bỏ lỡ. Dùng inline + toast bổ trợ.
3. ❌ **Validate khi đang gõ** – annoying, dùng on-blur.
4. ❌ **Disable button không giải thích vì sao** – luôn kèm tooltip lý do.
5. ❌ **Reset toàn bộ khi import sai** – parse lenient, giữ state cũ, chỉ báo field không parse được.
6. ❌ **Hard-coded English** – dù MVP tiếng Anh, tách string vào 1 file để dịch VI sau.
7. ❌ **Số decimal quá nhiều** – Leverage `20x` không phải `20.00x`; % không cần 4 chữ số thập phân.

---

## 12. UX Checklist – dán trên tường team

**Trước khi merge mỗi PR feature:**

- [ ] Có empty state không?
- [ ] Có loading state không?
- [ ] Error message **cụ thể** (không phải "Something went wrong")?
- [ ] Keyboard-only flow chạy được không?
- [ ] Focus ring có hiện không?
- [ ] Dark contrast ≥ 4.5:1?
- [ ] Undo được không?
- [ ] Test với `prefers-reduced-motion: reduce`?
- [ ] Hover state rõ ràng?
- [ ] Mobile (≥ 768px) có vỡ không? (optional MVP)
- [ ] JSON preview update đúng sau thay đổi?

---

## 13. Validation plan (đo UX, không chỉ đoán)

### 13.1 Usability testing – làm trước sprint 3 polish
- 5 user (3 trader, 2 dev) thử flow "build Bollinger Breakout và export".
- Đo: time-to-complete, số lần bấm sai, số lần cần hỏi.
- Target: ≥ 4/5 hoàn thành ≤ 10 phút **không hướng dẫn**.

### 13.2 Heuristic evaluation
- Dùng Nielsen's 10 heuristics review cuối sprint 2.
- Designer + FE lead chấm 1–5 cho từng heuristic.

### 13.3 Analytics (sau MVP ra)
Track funnel: `landed` → `first_node_opened` → `first_indicator_added` → `first_condition_created` → `exported`.
Drop-off cao ở đâu → focus UX cải thiện.

---

## 14. Design deliverables cần có trước sprint 1

- [ ] Figma file: 4 node ở state pending/editing/configured/error
- [ ] Figma file: ConditionBuilder layout với 1 group + nested group
- [ ] Figma file: Export drawer + JSON preview style
- [ ] Design tokens export JSON (Figma plugin → Tailwind config)
- [ ] Animation specs (Framer / Lottie nếu cần)
- [ ] Empty state + error state illustration
- [ ] Icon set (Lucide subset hoặc custom cho candlestick/indicator)

Không có Figma đầy đủ thì FE dựng tạm theo screenshot, nhưng **Sprint 2 phải có Figma đã chốt** – nếu không sẽ rework.

---

## 15. Quyết định đã chốt (cập nhật 2026-04-24)

| Câu hỏi | Quyết định | Ghi chú |
|---|---|---|
| Design system nội bộ? | **Không** – build trên shadcn + tokens | Chi tiết: `design_guideline.md` |
| Font chính | **Inter** | Có thể swap nếu brand yêu cầu khác |
| Logo + brand color | **Có, user cung cấp sau** | MVP dùng placeholder neutral (yellow accent), tokens đã semantic hoá để swap dễ |
| Empty state illustration | **Có illustration riêng** | 3–4 scene SVG, style minimal line-art mono + accent (`design_guideline.md` mục 7) |
| Onboarding tour | **Có, làm ngay MVP** | Xem mục 16 bên dưới |
| Ngôn ngữ | **English only** | Tách string vào file `i18n/en.ts` để dễ thêm VI sau |
| Theme | **Dark only** | Tokens semantic hoá để thêm light ở Phase 2 |

---

## 16. Onboarding Tour (mới – bắt buộc cho MVP)

Mục tiêu: user mới vào tool phải **không bối rối 10 giây đầu**. Tour tương tác guide qua flow build strategy đầu tiên.

### 16.1 Thư viện đề xuất

| Option | Pros | Cons |
|---|---|---|
| **Shepherd.js** | Flexible, headless, tự style theo brand được | Cần code nhiều hơn |
| **driver.js** | Nhẹ (5kb), đơn giản, modern API | Ít tuỳ biến |
| **intro.js** | Phổ biến, dễ dùng | Style khó match dark theme |
| **Reactour** | React-native binding | Ít maintain gần đây |

**Khuyến nghị: `driver.js` v1+** – nhẹ, modern, animation mượt, dễ style dark, có keyboard support built-in.

### 16.2 Kịch bản tour (5 step, ≤ 60 giây)

```
Step 1: Welcome overlay (center, không anchor)
  Title: "Let's build your first strategy"
  Body:  "We'll walk you through in 60 seconds."
  CTA:   [Skip] [Let's go →]

Step 2: Highlight step card "Bot Config"
  Anchor: card #1
  Title:  "Step 1 — Configure your bot"
  Body:   "Click any card to open the setup drawer. Start with pair, timeframe, leverage."
  CTA:    [Got it]

Step 3: Highlight step card "Entry Strategy"
  Anchor: card #2
  Title:  "Step 2 — Define when to enter"
  Body:   "Add indicators like RSI or MA, then set entry conditions."
  CTA:    [Got it]

Step 4: Highlight step cards Direction + Close Method
  Anchor: cards #3 + #4 (group highlight)
  Title:  "Step 3 — Pick direction & exit"
  Body:   "Long or Short? Take profit, stop loss, or exit on signal."

Step 5: Highlight Export button trên header
  Anchor: Header Export button
  Title:  "Step 4 — Export to JSON"
  Body:   "When ready, export and feed the JSON to your bot server."
  CTA:    [Start building]
```

→ Tour vẫn 5 step (4 step config + 1 export) – phù hợp với 4 step card trong vertical list.

### 16.3 Rules

- Tour **chỉ hiện lần đầu** – flag `hasCompletedTour` lưu `localStorage`.
- Nút **"Replay tour"** trong help menu (`?`) cho user muốn xem lại.
- Nếu user **skip** ở step 1, không hiện lại trong session; lần vào sau mới hỏi lại 1 lần nữa, từ đó tôn trọng.
- **Không ép** tour – cho phép dismiss bất kỳ lúc nào (Esc hoặc click outside).
- Skip được track analytics để đo % user hoàn thành.

### 16.4 Style

- Popover match `design_guideline.md` tokens: bg `--color-bg-surface`, border `--color-border-strong`, radius `--radius-lg`.
- Arrow pointer đơn giản (tam giác 8×8).
- Backdrop dim 60% (`--color-bg-overlay`).
- Highlight ring quanh target: 2px `--brand-primary` + glow `--shadow-glow-brand`.
- Animation: fade + scale(0.95 → 1) 200ms ease-out khi chuyển step.

### 16.5 Accessibility

- Trap focus trong popover khi active.
- `aria-describedby` link body text.
- Keyboard: Enter = next, Esc = dismiss, arrows để nav.
- Respect `prefers-reduced-motion` (tắt scale animation, giữ fade).

### 16.6 Checklist

- [ ] Tour không chặn user tương tác canvas (non-modal backdrop, có thể scroll).
- [ ] Highlight target scroll-into-view nếu ngoài viewport.
- [ ] Tour chạy đúng cả khi user đã có data cũ từ session trước.
- [ ] Skip button luôn visible ở mọi step.

---

## 17. Cursor Particle Effect (mới – inspired by Google Stitch)

User yêu cầu hiệu ứng particle **bám theo con trỏ chuột**, giống trang **stitch.withgoogle.com**. Đây là chi tiết signature mang lại cảm giác "premium, playful, hi-tech".

### 17.1 Behavior mô tả

Khi user di chuột trên canvas:
- Các hạt **particle nhỏ** (dot 2–4px) spawn tại vị trí cursor.
- Hạt có **velocity ban đầu nhẹ** theo hướng di chuyển của chuột.
- Hạt **fade out dần** trong 600–1000ms rồi biến mất.
- Khi chuột đứng yên → hạt ngừng spawn (không spam).
- Khi chuột di nhanh → spawn nhiều hơn (density theo speed).
- Màu hạt: gradient từ `--brand-primary` → `--brand-secondary` (placeholder: yellow → violet) với alpha giảm dần.

Tham khảo chính xác: https://stitch.withgoogle.com – hiệu ứng tinh tế, không chen lấn UI.

### 17.2 Tech approach

**Không dùng library nặng** như particles.js – overkill. Viết custom bằng **Canvas 2D API**:

```ts
// hooks/useCursorParticles.ts (pseudo)
type Particle = { x, y, vx, vy, life, maxLife, color }

function useCursorParticles(canvasRef) {
  const particles: Particle[] = []

  // spawn theo mousemove
  onMouseMove((e) => {
    const speed = Math.hypot(e.movementX, e.movementY)
    const count = Math.min(3, Math.ceil(speed / 8))
    for (let i = 0; i < count; i++) {
      particles.push({
        x: e.x, y: e.y,
        vx: e.movementX * 0.05 + (Math.random() - 0.5),
        vy: e.movementY * 0.05 + (Math.random() - 0.5),
        life: 0, maxLife: 600 + Math.random() * 400,
        color: lerpColor(brandPrimary, brandSecondary, Math.random())
      })
    }
  })

  // render loop via requestAnimationFrame
  function frame(dt) {
    ctx.clearRect(0, 0, w, h)
    particles.forEach(p => {
      p.life += dt
      p.x += p.vx; p.y += p.vy
      p.vx *= 0.95; p.vy *= 0.95   // damping
      const alpha = 1 - p.life / p.maxLife
      ctx.fillStyle = withAlpha(p.color, alpha)
      ctx.beginPath()
      ctx.arc(p.x, p.y, 2 + alpha * 2, 0, Math.PI * 2)
      ctx.fill()
    })
    // cleanup dead particles
  }
}
```

### 17.3 Vị trí canvas đặt particle

- Một **`<canvas>` full-screen** absolute, `pointer-events: none` (không chặn click).
- `z-index` thấp hơn popover/tour, cao hơn background gradient.
- Mount trong `App.tsx` hoặc layout wrapper – active trên mọi page.

### 17.4 Performance budget

| Metric | Ngưỡng |
|---|---|
| Max particle cùng lúc | 120 |
| Spawn rate max | 30 particle/s |
| FPS tối thiểu | 60 FPS (dù đang drag node) |
| CPU idle | < 3% |
| Battery impact mobile | tắt hoàn toàn trên mobile (UX spec mục 2) |

Optimization:
- Dùng `requestAnimationFrame` duy nhất cho cả canvas.
- Particle pool (reuse object, không GC).
- `ctx.globalCompositeOperation = 'lighter'` cho hiệu ứng glow cộng màu.
- Throttle mousemove bằng `rAF` wrap, không listen raw event.

### 17.5 Tương tác với UI khác

- **Khi tour đang active:** particle vẫn chạy nhưng giảm opacity 50% để không phân tán attention.
- **Khi drag node:** particle spawn density giảm 50% (user đang focus).
- **Khi drawer JSON mở:** particle chỉ active trong vùng canvas, không trong drawer.
- **Khi hover node:** spawn thêm 1 halo particle tại node handle (tín hiệu "click được") – optional polish.

### 17.6 Toggle

- Settings menu có option **"Cursor trail: On / Off / Auto"**.
- `Auto` = bật trừ khi `prefers-reduced-motion: reduce` hoặc thiết bị low-end (`navigator.hardwareConcurrency ≤ 4`).
- Lưu preference vào `localStorage`.
- Respect `prefers-reduced-motion: reduce` mặc định tắt.

### 17.7 Accessibility

- Particle **không mang thông tin** (chỉ decorative) → không cần screen-reader announce.
- Không làm user phân tâm khi đang gõ (optional: freeze khi `document.activeElement` là input).
- Màu particle không được tạo vệt lớn đủ gây seizure (tuân WCAG 2.3.1 – flashing < 3Hz).

### 17.8 Alternatives để cân nhắc

Nếu custom canvas quá tốn effort:
- **tsparticles** – `particles.js` kế nhiệm, có React binding, preset "mouse-follow" sẵn. Bundle ~50kb.
- **cursor-effects** (npm) – hàng nhẹ nhưng style legacy.

**Khuyến nghị:** custom trước. Fallback `tsparticles` nếu sprint không đủ thời gian polish.

### 17.9 Effort ước tính

- Basic implementation (spawn, fade, damping): **1.5 ngày**.
- Polish (color gradient, halo hover, perf tuning): **1 ngày**.
- Settings toggle + accessibility: **0.5 ngày**.
- **Tổng:** ~3 ngày trong Sprint 2 hoặc Sprint 3.

---

*End of UX spec.*
