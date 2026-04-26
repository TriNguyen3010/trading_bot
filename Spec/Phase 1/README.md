# Phase 1 – MVP Specs

> Tất cả tài liệu liên quan đến **Phase 1 (MVP – Strategy Builder Tool + Cypheus AI Demo + JSON Export)**. Đọc theo thứ tự đề xuất để có context đầy đủ.

- **Scope:** Single strategy, 3-cột layout (Cypheus chat + JSON live view + step list + edit drawer), Cypheus scripted magic build cho demo sếp, export JSON file. Không backend, không multi-strategy, không wallet, không LLM thật.
- **Effort:** ~7-8 tuần (1 Sprint 0 design + 3 Sprint dev × 2 tuần, +1-2 ngày Cypheus polish)
- **Trạng thái:** Spec hoàn thiện, chờ Figma + Cypheus avatar asset + chốt câu hỏi BE.

---

## 📁 Cấu trúc folder

```
Phase 1/
├── README.md                      ← Bạn đang đọc file này
│
├── 📄 Spec & plan
│   ├── ux_design_spec.md          ← UX (3-cột, Cypheus chat, JSON view, drawer)
│   ├── design_guideline.md        ← Design system architecture
│   ├── DESIGN_GUIDELINES.md       ← Visual design tokens (color, typography)
│   ├── implementation_plan.md     ← Tech stack + folder + sprint roadmap
│   └── ui_json_gap_analysis.md    ← Đối chiếu UI ↔ JSON
│
├── 🎨 Design assets
│   └── design-preview.html        ← Static HTML preview
│
├── 🤖 Cypheus AI ⭐ NEW
│   └── cypheus/
│       └── cypheus_spec.md        ← Identity + visual + magic build script 45s
│
└── 🧩 Effect specs (sub-folder)
    ├── dot-grid-spotlight/        ← Hover spotlight grid effect
    │   ├── brief.md
    │   └── demo.html
    └── connection-lines/          ← Connection line animation
        ├── spec.md
        └── demo.html
```

---

## 📚 Thứ tự đọc tài liệu

### 1. Bắt đầu từ vision & feature
👉 [`../trading_bot_spec.md`](../trading_bot_spec.md) *(ở thư mục `Spec/`)*

Bản spec gốc – mô tả toàn bộ tính năng dạng node/canvas (vision dài hạn).

### 2. UX Design Spec ⭐ *(quan trọng nhất)*
👉 [`ux_design_spec.md`](./ux_design_spec.md)

- 3-cột layout (Left panel 400px Cypheus + Step list 720px + Right drawer 720px)
- Step card + Drawer interaction (state machine, 2 tab Setup/Configure)
- User journey "Cypheus magic build 45s" + manual fallback
- Empty/loading/error states
- Microinteractions, Accessibility (WCAG AA)
- **Cursor particle effect** (mục 17)

### 3. Cypheus AI Spec ⭐ *(mới – quan trọng cho demo)*
👉 [`cypheus/cypheus_spec.md`](./cypheus/cypheus_spec.md)

- Identity: tên, tagline, tone, voice example do/don't
- Visual: avatar 3 state, color yellow brand
- Layout: left panel 400px với 2 tab Cypheus / JSON live view
- **Magic build script 45 giây** – kịch bản chi tiết từng giây
- State machine + off-script fallback handling
- Asset checklist (designer cần cung cấp gì)
- Tech implementation (folder, script runner, libs)

### 4. Design Guidelines (2 file – complementary)

#### 4a. Design system architecture
👉 [`design_guideline.md`](./design_guideline.md)

Triết lý design system, component foundation (đã update với Cypheus components).

#### 4b. Visual design tokens (concrete)
👉 [`DESIGN_GUIDELINES.md`](./DESIGN_GUIDELINES.md)

Color, typography, spacing, patterns cụ thể.

### 5. Static HTML preview
👉 [`design-preview.html`](./design-preview.html)

### 6. Implementation Plan
👉 [`implementation_plan.md`](./implementation_plan.md)

- Tech stack đã update với Cypheus (lottie-react, custom script runner, không cần backend)
- Folder structure + `features/cypheus/` mới
- Sprint 1-3 đã update với Cypheus tasks
- Phase 2 + Phase 3 ở cuối – tham khảo

### 7. UI ↔ JSON Gap Analysis
👉 [`ui_json_gap_analysis.md`](./ui_json_gap_analysis.md)

### 8. Effect specs

#### 8a. Dot Grid Spotlight
👉 [`dot-grid-spotlight/brief.md`](./dot-grid-spotlight/brief.md) + [`demo.html`](./dot-grid-spotlight/demo.html)

#### 8b. Connection Lines
👉 [`connection-lines/spec.md`](./connection-lines/spec.md) + [`demo.html`](./connection-lines/demo.html)

> ⚠️ Cần review lại sau pivot 3-cột.

---

## ✅ Quyết định đã chốt cho Phase 1

| Lĩnh vực | Quyết định |
|---|---|
| **Layout** | **3-cột** – Left panel 400px + Step list 720px center + Right drawer 720px overlay |
| **Left Panel** | 2 tab: `[◆ Cypheus]` (default) / `[{} JSON]`, luôn hiện kể cả khi drawer mở |
| **JSON viewing** | **Live view trong Left Panel tab JSON** – bỏ drawer JSON riêng |
| **Editing** | Right drawer 720px overlay (canvas dim 50%, left panel vẫn active) |
| **Drawer tabs** | 2 tab: Setup + Configure (không Test) |
| **Multi-strategy** | "Add strategy" có sẵn → Coming soon dialog |
| **Nested condition group** | Không hỗ trợ MVP (flat AND/OR) |
| **Theme** | Dark only |
| **Ngôn ngữ** | English only |
| **Cypheus AI** | Scripted (mock), Mode A magic build only, ~45s kịch bản |
| **Cypheus avatar** | Yellow brand color, 3 state (idle/thinking/speaking), Lottie/SVG/PNG đều OK |
| **Cypheus tone** | Friendly, không emoji |
| **Cypheus greeting** | Tự động khi load page |
| **Off-script handler** | Bất cứ user gõ gì → trigger magic build với note "demo content" |
| **Reset button** | "Create new bot" thay cho "Replay tour" – reset toàn bộ state + chat |
| **Onboarding tour** | ~~driver.js~~ → bỏ, Cypheus thay thế |
| **Voice input** | Bỏ |
| **Background effect** | Particle hoặc dot-grid spotlight (chốt sau) |
| **Empty state** | Có illustration SVG (3-4 scene) |
| **Brand** | Placeholder yellow, swap khi có asset |
| **Backend / LLM API** | KHÔNG cần (Cypheus là mock, JSON export client-side) |

---

## ❓ Câu hỏi còn lại cần chốt trước Sprint 1

### Backend / data
1. **Schema BE 3 field mới:** `order_type`, `limit_price`, `close_method_type` → BE chấp nhận thêm vào schema không?
2. **`$100,000` UI = stake_amount hay dry_run_wallet?**
3. **Pair format convention:** UI `BTC-USDC` ↔ JSON `BTC/USDT:USDT` – converter rule.
4. **Format export:** 2 file rời (`bot.json` + `strategy.json`) hay 1 bundle?

### Design / asset
5. **Logo + brand color** chính thức.
6. **Cypheus avatar asset** – format Lottie / SVG / PNG (cung cấp khi nào)?
7. **Cypheus tagline** – "Your strategy oracle" hay "Decoding markets, building bots"?
8. **Background effect:** Cursor Particle hay Dot-Grid Spotlight?
9. **Template preset MVP:** ship sẵn 2-3 template không? Nếu có → đặt ở đâu (empty state card hay Cypheus chat suggest)?
10. **2 file design guideline trùng chủ đề:** giữ cả 2 với phân vai khác nhau hay merge?

### Cypheus demo
11. **Demo language:** English (đã chốt) – có cần option Vietnamese không?
12. **Replay demo:** "Create new bot" đủ rồi, hay cần thêm nút "Replay" riêng?

---

## 🎯 Demo flow tóm tắt

Sếp xem demo:
1. Mở tool → thấy 3-cột layout dark đẹp.
2. Cypheus avatar fade in, chào: "Hi, I'm Cypheus..."
3. Sếp gõ random → Cypheus build strategy đầy đủ trong **45 giây** với animation từng step.
4. JSON live update bên trái cho sếp thấy file đang được build.
5. Click Export → tải file JSON.
6. Click "Create new bot" → reset, chạy lại từ đầu nếu sếp muốn coi lại.

Total: chuẩn bị cho sếp coi 1-2 phút là đủ ấn tượng.

---

*Last updated: 2026-04-25 – Cypheus AI added*
