# CYPHEUS – AI Strategy Assistant Spec

> Cypheus là **AI assistant scripted (mock)** trong Phase 1, đặt ở left panel của tool. Demo cho sếp với kịch bản pre-built. Không dùng LLM thật, không có backend, mọi behavior chạy client-side qua state machine.

- **Ngày:** 2026-04-25
- **Mode MVP:** A – Magic build only (user gõ gì cũng → auto-build kịch bản có sẵn)
- **Status:** spec hoàn thiện, chờ avatar asset + script copy review

---

## 1. Identity

| Item | Giá trị |
|---|---|
| **Tên** | Cypheus |
| **Tagline** | *"Your strategy oracle"* hoặc *"Decoding markets, building bots"* (chốt sau) |
| **Cá tính** | Knowledgeable, friendly, brief – **không emoji**, không lê thê |
| **Giọng văn (voice)** | Tự tin nhưng không khoa trương, giải thích ngắn gọn, biết khi nào im lặng |
| **Phát âm** | /sai-fee-əs/ – Cy-phe-us |
| **Inspired by** | Cypher (mã hoá / decoder) + Morpheus (oracle dẫn dắt trong Matrix) |

### Voice examples (do/don't)

| ✅ Do | ❌ Don't |
|---|---|
| "RSI below 30 signals oversold – a classic buy entry." | "RSI is awesome! 🔥 You'll love this!" |
| "BTC-USDC offers high liquidity and tight spreads." | "BTC-USDC is the BEST pair you can choose!!!" |
| "Setting up your entry conditions now." | "Hold on, let me think about this for a moment hmm..." |
| "Done. Review the JSON and export when ready." | "Yay! 🎉 Everything is ready! Hope you enjoyed!" |

---

## 2. Visual identity

### 2.1 Avatar

**Format chấp nhận (chọn 1):**

| Format | File extension | Use case |
|---|---|---|
| **Lottie** ⭐ khuyến nghị | `.json` | Avatar animated nhiều state (idle/thinking/speaking) |
| **SVG static** | `.svg` | Avatar tĩnh, dùng CSS animate glow + pulse |
| **PNG static** | `.png` (≥ 256×256, transparent) | Đơn giản nhất, fallback |
| **WebM với alpha** | `.webm` | Motion graphic phức tạp (nếu thực sự cần) |

**Vị trí trong UI:** góc trên-trái panel Cypheus, kích thước 32×32 (header) / 48×48 (greeting card).

**Yêu cầu visual:**
- Màu chính: **yellow `--brand-primary`** (đồng nhất brand) – không tím/cyan như đề xuất ban đầu vì user muốn yellow.
- Hình dạng: gợi ý hình lục giác / diamond minimal / neuron node – tránh "robot mặt cười" sến súa.
- Glow nhẹ xung quanh khi `speaking` state.

### 2.2 State của avatar

3 state cần có (qua Lottie hoặc CSS animate):

| State | Behavior | Khi nào |
|---|---|---|
| **idle** | Pulse nhẹ, glow yếu | Mặc định |
| **thinking** | Xoay/dao động, glow tăng | Sau khi user submit, trước khi reply |
| **speaking** | Glow mạnh hơn, pulse đồng bộ với typing animation | Khi message đang stream ra |

→ Nếu chỉ có ảnh tĩnh, dùng CSS `@keyframes pulse` + `box-shadow` để fake.

---

## 3. Layout & UI

### 3.1 Vị trí trong app

```
┌─ 400px Left Panel ───────────┬─ 720px Step List ──┬─ 720px Drawer ──┐
│  ╭── ◆ Cypheus ── {} JSON ╮  │  4 step card       │ Setup/Configure │
│  │ active            inactive│  │                   │ (overlay)       │
│  ╰─────────────────────────╯  │                   │                 │
│                               │                   │                 │
│  [Cypheus avatar]             │                   │                 │
│  Hi, I'm Cypheus...           │                   │                 │
│                               │                   │                 │
│  [User message bubble]        │                   │                 │
│  [Cypheus message bubble]     │                   │                 │
│  ...                          │                   │                 │
│                               │                   │                 │
│  ────────────────────────     │                   │                 │
│  [Type a message...]    [→]   │                   │                 │
│  [+ Create new bot]            │                   │                 │
└───────────────────────────────┴───────────────────┴─────────────────┘
```

### 3.2 Tab toggle

- **Cypheus tab** (default): chat thread + input box dưới cùng + nút "Create new bot"
- **JSON tab**: live JSON view (xem section 4)

Toggle bằng:
- Click tab header
- Phím tắt: `Ctrl+/` (Cypheus), `Ctrl+J` (JSON)

### 3.3 Message bubble style

**Cypheus message:**
- Background: `--color-bg-surface` (tối hơn nền panel)
- Border-left: 2px `--brand-primary`
- Avatar nhỏ 24×24 ở góc trái-trên
- Text: `--text-sm`, `--color-text-primary`
- Timestamp nhỏ phía dưới (optional)
- Animation: typing effect 30ms/char khi stream ra

**User message:**
- Background: `--color-bg-input`
- Align right
- Border-left không có
- Text màu thường

### 3.4 Input box

- Multi-line autoresize (max 4 dòng).
- Placeholder: "Tell Cypheus what you're building..."
- Submit: Enter (Shift+Enter để xuống dòng).
- Nút send icon chỉ enable khi có text.
- **KHÔNG** có icon microphone (đã chốt bỏ voice).

### 3.5 Nút "Create new bot"

- Vị trí: dưới input box, full width, dashed border style.
- Click → reset toàn bộ state:
  - Clear chat thread.
  - Clear toàn bộ BuilderState (4 step về pending).
  - Clear localStorage.
  - Cypheus chào lại từ đầu (greeting flow).
- Confirm dialog: *"Start a new bot? Your current configuration will be cleared."* trước khi reset.

---

## 4. Live JSON view (tab thứ 2 trong panel)

### 4.1 Layout

```
┌─ ◆ Cypheus ── {} JSON ───────┐
│              active           │
│  ╭ bot.json  strategy.json ╮  │  ← sub-tabs (2 file output)
│  │ active                   │  │
│  ╰──────────────────────────╯  │
│                                │
│  {                             │
│    "bot_name": "Bollinger      │
│      Breakout",                │
│    "pair": "BTC/USDT:USDT",   │← line vừa change flash xanh 1s
│    ...                         │
│  }                             │
│                                │
│  ─────────────────────────────│
│  [Copy]  [Download .json]      │
│  Updated 2s ago                │
└────────────────────────────────┘
```

### 4.2 Behavior

- Realtime update khi:
  - User config qua right drawer → JSON cập nhật ngay khi save.
  - Cypheus magic build → JSON cập nhật từng bước theo timing script.
- Line vừa thay đổi **flash background xanh** `--accent-success/20` trong 1 giây rồi fade.
- Syntax highlight bằng `prism-react-renderer` theme dark.
- Sub-tab `bot.json` / `strategy.json` để tách 2 file.
- Copy → toast "Copied to clipboard".
- Download → tải file riêng từng cái.

### 4.3 Empty state JSON

Khi tất cả step còn pending:
```
{
  "bot_name": "",
  "pair": "...",
  // Cypheus is building this for you
}
```

→ Cho user thấy structure trước, đỡ "trống lốc".

---

## 5. Magic Build Script (Mode A) – kịch bản chi tiết

User gõ bất cứ gì → Cypheus chạy script này không thay đổi nội dung.

> ⚠️ **Cập nhật 2026-04-25:** Timeline bên dưới (5.2) là **bản cũ với drawer slide open/close mỗi step**. Bản mới giữ drawer **luôn mở** xuyên suốt – xem [`drawer_persistence_spec.md`](./drawer_persistence_spec.md) để có timeline đã fix. Tổng thời lượng giảm từ 45s xuống ~32s, không bị "giật" giữa các step.

### 5.1 Phase 1 – Greeting (auto khi load page)

```
[T+0.0s]  Page load. Left panel hiện sẵn, tab Cypheus active.
[T+0.5s]  Avatar fade in (state: idle), glow pulse 2 lần.
[T+1.0s]  Message 1 typing: "Hi, I'm Cypheus."
[T+2.5s]  Message 2 typing: "I'll help you build your first trading bot.
                              Tell me what you have in mind."
[T+4.0s]  Input box highlight nhẹ (focus glow).
          → Wait for user submit (any text).
```

### 5.2 Phase 2 – Magic build (sau khi user submit)

```
[T+0.0s]  User clicks send. User message bubble appears.
[T+0.3s]  Avatar → state: thinking. 3 dots animation hiện 1s.
[T+1.3s]  Avatar → state: speaking.
[T+1.5s]  Cypheus typing message 1:
            "Got it. Let me build a Bollinger Breakout strategy
             on BTC-USDC for you."
[T+3.5s]  Cypheus typing message 2 (note quan trọng):
            "Note: This is demo content prepared to showcase
             the AI flow."
[T+5.0s]  Pause 0.5s. JSON tab highlight nhẹ (báo "JSON đang được build").

═══ Step 1: Bot Config ═══════════════════════════
[T+5.5s]  Step 1 card pulse glow vàng.
[T+6.0s]  Right drawer mở (Setup tab active), step 1 form.
[T+6.5s]  Cypheus typing: "Setting up bot configuration..."
[T+7.5s]  Trường Pair: typing animation "B-T-C---U-S-D-C" (200ms/char)
[T+9.0s]  Trường Timeframe: dropdown chọn "5m" (animation slide)
[T+9.5s]  Trường Trading mode: chọn "Dry-run" (toggle slide)
[T+10.0s] Trường Leverage: typing "2-0"
[T+10.5s] Cypheus typing: "BTC-USDC offers high liquidity.
                          5-minute timeframe is ideal for scalping."
[T+12.5s] Drawer auto-saves và đóng (slide right).
[T+13.0s] Step 1 card: pending (⚪) → configured (✓ xanh) với pulse 1 lần.

═══ Step 2: Entry Strategy ═══════════════════════
[T+13.5s] Step 2 card pulse glow.
[T+14.0s] Drawer mở step 2.
[T+14.5s] Cypheus typing: "Defining entry conditions..."
[T+15.0s] Candlestick chips: "Close" toggle on (highlight 0.3s)
[T+15.3s] Candlestick chips: "Volume" toggle on
[T+16.0s] Click "Add indicator" → picker dropdown mở
[T+16.5s] Picker chọn "RSI"
[T+17.0s] Param popover: timeperiod typing "1-4"
[T+17.5s] Indicator chip "RSI • 14" hiện.
[T+18.0s] Click "Add condition" → row mới
[T+18.3s] Condition: left=RSI-14, op="<", right=30 (typing 30)
[T+19.0s] Cypheus typing: "RSI below 30 signals oversold –
                          a classic buy entry."
[T+21.0s] Drawer save + close.
[T+21.5s] Step 2: ✓

═══ Step 3: Direction & Order ════════════════════
[T+22.0s] Step 3 card pulse.
[T+22.5s] Drawer mở.
[T+23.0s] Cypheus typing: "Going Long with Market orders for fast fills."
[T+24.0s] Direction toggle: Long
[T+24.3s] Order type: Market
[T+25.5s] Drawer save + close.
[T+26.0s] Step 3: ✓

═══ Step 4: Close Method ═════════════════════════
[T+26.5s] Step 4 card pulse.
[T+27.0s] Drawer mở.
[T+27.5s] Cypheus typing: "Setting take-profit and stop-loss."
[T+28.5s] Method tab: chọn "TP/SL"
[T+29.0s] Take profit toggle on, level 1: profit=5, close=50
[T+30.5s] +Add level: level 2: profit=10, close=25
[T+32.0s] Stop loss toggle on, value=-3
[T+33.0s] Cypheus typing: "5% take-profit at half position,
                          another 25% at 10% profit. 3% stop-loss."
[T+35.0s] Drawer save + close.
[T+35.5s] Step 4: ✓

═══ Phase 3: Closing ═════════════════════════════
[T+36.0s] Cypheus typing: "All set."
[T+37.0s] Cypheus typing: "Review the JSON in the {} JSON tab,
                          then click Export when ready."
[T+39.0s] Avatar → state: idle.
          → End of script.
```

**Tổng thời lượng: ~39 giây.** Đủ ngắn cho demo, đủ dài để sếp xem từng bước.

### 5.3 Speed control (cho demo)

- Thêm setting toggle (ẩn, dev-only): `?demo-speed=2x` → script chạy nhanh gấp 2.
- Helpful khi sếp đã coi rồi và bạn muốn tua nhanh.

---

## 6. State machine

```
┌─────────────┐
│   IDLE      │ ← Cypheus chào, chờ user
└──────┬──────┘
       │ user submit input
       ▼
┌─────────────┐
│ THINKING    │ (1s placeholder)
└──────┬──────┘
       │
       ▼
┌─────────────┐
│ MAGIC_BUILD │ ← Chạy script 5.2 (39 giây)
└──────┬──────┘
       │ script complete
       ▼
┌─────────────┐
│ DONE        │ ← Avatar idle, không phản hồi thêm
└──────┬──────┘
       │ user clicks "Create new bot"
       ▼
       └─→ reset → IDLE
```

**Không có state nhận user chat sau MAGIC_BUILD** trong Mode A. Nếu user gõ thêm sau khi build xong, Cypheus có thể reply 1 câu generic: *"Demo complete. Click Create new bot to start over, or explore the configuration manually."*

---

## 7. Off-script handling

**Đã chốt: cứ đẩy về magic flow + thêm note.**

Cách hiểu: bất kể user gõ gì (kể cả tiếng Việt, tiếng Anh, từ tục, ký tự ngẫu nhiên...), Cypheus phản hồi giống nhau:

```
Cypheus: "Got it. Let me build a Bollinger Breakout strategy on BTC-USDC for you."
Cypheus: "Note: This is demo content prepared to showcase the AI flow."
[chạy magic build script]
```

→ **Không cần keyword matching, không cần NLP** – đơn giản tối đa.

### Edge case xử lý

- **User submit empty**: input button disable, không trigger.
- **User submit lần 2 trong khi đang build**: ignore, không restart (tránh chồng chéo).
- **User refresh giữa demo**: chưa save state Cypheus → load lại = greeting từ đầu, BuilderState giữ (đã save localStorage).

---

## 8. Asset checklist (designer cung cấp)

| Item | Format | Spec |
|---|---|---|
| Cypheus avatar idle | Lottie / SVG / PNG | 256×256 source, color: yellow brand |
| Cypheus avatar thinking | Lottie state hoặc CSS animate | xoay/dao động nhẹ |
| Cypheus avatar speaking | Lottie state hoặc CSS animate | glow tăng + pulse |
| Welcome glow effect | CSS hoặc Lottie | Khi greeting |
| Send icon | SVG (Lucide có sẵn) | 16×16 stroke 1.5 |
| Tab icons (`◆` Cypheus, `{}` JSON) | SVG (custom) | 16×16 |
| Empty state illustration | SVG | Khi chưa có user message |

---

## 9. Tech implementation

### 9.1 Folder structure

```
src/features/cypheus/
├── CypheusPanel.tsx           # Container chính (tabs + chat + JSON view)
├── CypheusChat.tsx            # Chat thread component
├── CypheusInput.tsx           # Input box
├── CypheusAvatar.tsx          # Avatar với state idle/thinking/speaking
├── MessageBubble.tsx          # Cypheus + User bubble
├── JsonLiveView.tsx           # JSON tab content
├── CreateNewBotButton.tsx     # Reset button
│
├── script/
│   ├── greeting.script.ts     # Phase 1 greeting
│   ├── magic-build.script.ts  # Phase 2 build (39s)
│   └── script-runner.ts       # State machine engine
│
└── store/
    └── cypheus.store.ts       # Zustand: messages[], state, currentStep
```

### 9.2 Script runner pattern

```ts
// script/script-runner.ts
type ScriptStep =
  | { type: 'message'; text: string; delay: number }
  | { type: 'highlight-step'; stepId: number; delay: number }
  | { type: 'open-drawer'; stepId: number; delay: number }
  | { type: 'set-field'; path: string; value: any; animate?: 'typing' | 'select' | 'toggle'; delay: number }
  | { type: 'close-drawer'; delay: number }
  | { type: 'mark-step-done'; stepId: number; delay: number }
  | { type: 'avatar-state'; state: 'idle' | 'thinking' | 'speaking' }

async function runScript(steps: ScriptStep[]) {
  for (const step of steps) {
    await sleep(step.delay)
    executeStep(step)  // dispatch to Zustand store
  }
}
```

### 9.3 Animation primitives

- **Typing animation cho text fields:** dùng Framer Motion `useAnimate` hoặc custom hook `useTypewriter`.
- **Drawer slide:** đã có shadcn Sheet.
- **Card pulse:** CSS `@keyframes` + className toggle.
- **Avatar state:** Lottie ref để play segment, hoặc CSS class swap.

### 9.4 Library cần thêm

| Lib | Lý do | Size |
|---|---|---|
| `lottie-react` | Render Lottie avatar | ~50KB |
| `react-syntax-highlighter` hoặc `prism-react-renderer` | JSON syntax highlight (đã có trong stack) | – |

→ Nếu user gửi PNG/SVG static, **bỏ Lottie** dùng CSS animate.

---

## 10. Definition of Done (Cypheus)

1. ✅ Avatar Cypheus hiển thị đúng asset từ designer, có 3 state visual.
2. ✅ Greeting tự động chạy khi load page, ≤ 4 giây.
3. ✅ User submit bất cứ text gì → magic build script chạy đúng 39s ± 2s.
4. ✅ Tất cả 4 step được auto-fill đúng JSON mẫu (Bollinger Breakout).
5. ✅ JSON tab live update song song với drawer changes.
6. ✅ Line vừa change trong JSON flash xanh đúng 1 giây.
7. ✅ "Create new bot" reset toàn bộ state, hiện confirm dialog trước.
8. ✅ Sau khi script done, user vẫn config được manually qua right drawer.
9. ✅ Speed control `?demo-speed=2x` hoạt động (dev-only).
10. ✅ Refresh page giữa demo không crash, greeting chạy lại.

---

## 11. Effort breakdown

| Task | Ngày |
|---|---|
| Layout left panel 400px + tab Cypheus/JSON | 1 |
| Cypheus avatar component + 3 state | 0.5 (CSS) hoặc 1 (Lottie) |
| Message bubble + chat thread + input | 1 |
| Script runner state machine | 1 |
| Magic build script content (39s) | 1.5 |
| JSON live view + flash highlight | 1.5 |
| Create new bot + reset flow | 0.5 |
| Polish + timing tuning | 1 |
| **Tổng** | **~8 ngày = 1 sprint nhỏ** |

→ Thêm vào Sprint 2 hoặc tạo Sprint 2.5 dành riêng cho Cypheus.

---

## 12. Open items

1. ⏳ **Avatar asset** – chờ user gửi (Lottie/SVG/PNG).
2. ⏳ **Tagline chính thức** – chọn 1 trong 2: "Your strategy oracle" hoặc "Decoding markets, building bots".
3. ⏳ **Welcome message wording** – có thể tinh chỉnh sau khi designer review tone.
4. ⏳ **Demo language**: tiếng Anh (đã chốt) – có cần tiếng Việt option cho demo nội bộ không?

---

*End of Cypheus spec.*
