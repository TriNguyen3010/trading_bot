# Unified Header (Dashboard + Builder + Detail) — Design

**Date:** 2026-06-11
**Owner:** Tri Nguyen
**Status:** Approved qua demo `public/unified-header-demo.html` (Tri duyệt 2026-06-11)
**Supersedes:** `2026-06-10-header-active-tab-design.md` (pill tĩnh — không còn cần)

## 1. Problem

Hai header song song, không nhất quán:

- `AppHeader` (Landing, Dashboard): pill nav `[Dashboard · Builder · Docs]` nhưng
  active tab gần như vô hình (chỉ đổi màu chữ xám→trắng).
- `HeaderToolbar` (Builder): layout khác hẳn — logo trần (không wordmark), WalletChip
  kiểu `ghost`, 1 nút "Dashboard" secondary thay cho nav, cụm action
  `[New · Import]` + `Create bot`.
- `BotMonitoringPage` (`/bots/:id`): **không có header**, chỉ 1 nút "← Dashboard"
  trong content.

Hệ quả: user không biết đang ở tab nào; mỗi trang một kiểu; pill slide animation
không làm được vì mỗi trang mount một header riêng → đổi trang là unmount/remount.

## 2. Decision

**Một header chung qua layout route.** `AppHeader` mount **một lần** ở route cha
(`AppLayout`); Dashboard / Builder / Detail render qua `<Outlet/>` bên dưới. Vì header
không unmount khi đổi trang:

- **Active-tab pill trượt thật** giữa Dashboard ↔ Builder (framer-motion `layoutId`),
  đúng như demo.
- Builder **đẩy** cụm action riêng (`[New · Import] + Create bot`) lên header chung qua
  React context; chỉ hiện khi ở `/builder`, animate in/out.
- WalletChip thống nhất 1 kiểu (`address-chip` xanh) ở mọi trang.
- Logo + wordmark "COIN98 BOT" hiện ở mọi trang.
- `/bots/:id` cũng dùng header chung → tab Dashboard active (rule `isActive` đã có),
  có nav để thoát; nút "← Dashboard" trong content giữ nguyên làm "back to list".

Landing (`/`) **đứng ngoài** layout (public route, hero riêng) — vẫn render `AppHeader`
một mình, không actions, không tab nào active.

Quyết định kiến trúc Tri đã chốt: **layout route** (không phải slot-prop per-page) +
**gộp luôn `/bots/:id`** lần này.

## 3. Architecture

```
routes.tsx
├── /                       → LandingPage          (public, AppHeader riêng, NGOÀI layout)
└── <ProtectedRoute><AppLayout/></ProtectedRoute>  (AppHeader mount 1 lần)
    ├── /dashboard          → DashboardPage   (render qua Outlet)
    ├── /builder            → BuilderPage     (push BuilderHeaderActions lên header)
    └── /bots/:id           → BotMonitoringPage
    *                       → Navigate to /
```

### Units

| File                                                           | Trách nhiệm                                                                                                                                                                                                                                      | Loại        |
| -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------- |
| `src/pages/AppLayout.tsx`                                      | Wrapper `flex h-screen w-screen flex-col bg-black text-fg` + `<AppHeader actions={…}/>` + `<Outlet/>`. Giữ state `actions: ReactNode`, cấp `setActions` xuống qua `HeaderActionsContext`.                                                        | **Tạo mới** |
| `src/pages/header-actions-context.ts`                          | `HeaderActionsContext` + hook `useHeaderActions()` (trả `setActions`). Default no-op để dùng ngoài provider không crash.                                                                                                                         | **Tạo mới** |
| `src/pages/AppHeader.tsx`                                      | Thêm prop `actions?: ReactNode` (render slot trước WalletChip). Nav: sliding pill `layoutId` + `aria-current`. Bỏ phần WalletChip `redirectOnDisconnect` (layout's ProtectedRoute tự lo).                                                        | **Sửa**     |
| `src/features/bot-builder/components/BuilderHeaderActions.tsx` | Tách từ `HeaderToolbar`: cụm `[CreateNewBotButton · Import]` segmented + `Create bot` primary + `ExportDialog` + `ImportDialog` + keyboard Ctrl+E / Ctrl+I. Tự subscribe builder store (`validateBuilder` → `canExport`/issues).                 | **Tạo mới** |
| `src/features/bot-builder/components/HeaderToolbar.tsx`        | Xoá (nội dung đã chuyển).                                                                                                                                                                                                                        | **Xoá**     |
| `src/pages/BuilderPage.tsx`                                    | Bỏ `<HeaderToolbar/>` + wrapper `flex h-screen flex-col` + halo (chuyển lên layout). `useEffect` push `<BuilderHeaderActions/>` vào context (cleanup → null). Giữ CypheusPanel / canvas / dock / DotGrid / TemplatesDialog + các effect CSS-var. | **Sửa**     |
| `src/pages/DashboardPage.tsx`                                  | Bỏ `<AppHeader/>` + wrapper `flex h-screen flex-col`. Giữ halo + DotGrid + main + dialogs (fragment).                                                                                                                                            | **Sửa**     |
| `src/features/bot-monitoring/BotMonitoringPage.tsx`            | Bỏ wrapper `flex min-h-screen flex-col`. Early-return loading đổi thành chiếm vùng main (bỏ `h-screen w-screen bg-black`). Giữ halo + DotGrid + main + dialogs.                                                                                  | **Sửa**     |
| `src/routes.tsx`                                               | Layout route: `<ProtectedRoute><AppLayout/></ProtectedRoute>` bọc 3 con; `/` giữ riêng.                                                                                                                                                          | **Sửa**     |
| `src/pages/LandingPage.tsx`                                    | **Không đổi** (đứng ngoài layout). `AppHeader` không truyền actions → slot rỗng.                                                                                                                                                                 | Giữ nguyên  |

### Vì sao gom được / không gom

- **Gom AppHeader lên layout:** header không unmount khi đổi route → `layoutId` slide
  chạy thật. Đây là điểm cốt lõi.
- **KHÔNG gom background (halo + DotGrid) lên layout:** mỗi trang config khác nhau —
  builder DotGrid `dimmed={drawerVisible}` + `right: var(--drawer-width)` (động), còn lại
  tĩnh. Halo thì giống nhau nhưng để tránh đụng nhiều, giữ per-page lần này (DRY
  `BrandHalo` để PR sau nếu muốn). Page chỉ bỏ wrapper + header, giữ background/main.
- **flex tip:** sau khi bỏ wrapper, page trả về fragment `[halo, DotGrid, main flex-1,
dialogs]`. Layout là `flex flex-col` nên `main flex-1` chiếm phần còn lại sau header
  spacer; halo/DotGrid `fixed` out-of-flow; dialogs portal. Không cần wrapper riêng.

### Builder đẩy action lên header (vòng đời)

`BuilderHeaderActions` tự chứa store-subscribe + 2 dialog + keyboard listener. BuilderPage:

```tsx
const setActions = useHeaderActions();
useEffect(() => {
  setActions(<BuilderHeaderActions />);
  return () => setActions(null);
}, [setActions]);
```

Khi rời `/builder`, BuilderPage unmount → cleanup `setActions(null)` → `BuilderHeaderActions`
unmount → ExportDialog/ImportDialog/keyboard listener tự gỡ. (StrictMode double-invoke an
toàn vì set node / set null / set node là idempotent.)

## 4. Active-tab pill (slide)

- Nav container `relative`. Mỗi `NavLink` khi active render
  `<motion.span layoutId="header-nav-pill" className="absolute inset-0 rounded-full bg-surface-active"/>`
  sau label (`<span className="relative z-[1]">`).
- 2 NavLink (Dashboard, Builder) chung `layoutId` → đổi tab, framer-motion trượt pill.
- `useReducedMotion()`: reduced → render `<span>` tĩnh (không `layoutId`/animation), highlight
  vẫn hiện.
- `aria-current="page"` ở button active (hook a11y + test).
- Docs là `<a>` external — không bao giờ active, không pill.
- Active rule giữ nguyên `isActive`: `/dashboard` & `/bots/:id*` → Dashboard; `/builder` →
  Builder; `/` → none.

## 5. Behavior matrix

| Route         | Tab active | Builder actions | Header                   |
| ------------- | ---------- | --------------- | ------------------------ |
| `/` (landing) | none       | ẩn              | AppHeader (ngoài layout) |
| `/dashboard`  | Dashboard  | ẩn              | AppHeader (layout)       |
| `/builder`    | Builder    | hiện (slide in) | AppHeader (layout)       |
| `/bots/:id`   | Dashboard  | ẩn              | AppHeader (layout)       |

- Đổi `/dashboard` ↔ `/builder`: pill trượt + cụm builder slide in/out. (Demo đã verify.)
- Hover tab active: pill giữ nguyên; hover inactive: nền hover nhẹ như cũ.
- Disconnect ở bất kỳ trang protected nào → ProtectedRoute thấy `!auth` → `Navigate to "/"`.

## 6. Testing

- **`AppHeader.test.tsx`** (mới): `aria-current` theo route (`/dashboard`, `/builder`,
  `/bots/:id`, `/` → none); render `actions` prop khi truyền.
- **`AppLayout.test.tsx`** (mới): header luôn hiện ở cả 3 route con; `<Outlet/>` render page;
  context `setActions` đẩy node vào header.
- **`BuilderHeaderActions.test.tsx`** (mới): render trong DOM; `Create bot` disabled khi
  builder invalid + badge số issue; Ctrl+E mở ExportDialog khi valid, Ctrl+I mở ImportDialog.
- **Regression:** chạy lại `DashboardPage.test.tsx` (đụng cấu trúc render) — vẫn pass; nếu
  test cũ render `<DashboardPage/>` trực tiếp mà giờ thiếu header thì cập nhật wrapper test
  bọc `AppLayout` hoặc bỏ assert liên quan header (không có).
- Manual (Tri tự test): pill trượt Dashboard↔Builder; builder action slide in/out; Ctrl+E/I;
  `/bots/:id` có header + tab Dashboard sáng; landing không tab nào sáng; disconnect redirect.

## 7. Out of scope

- Responsive header màn hẹp (<1200px): giữ desktop-first như hiện tại; ẩn wordmark / thu
  "Create bot" thành icon để PR sau. App là internal tool, builder vốn desktop-only.
- Tách `BrandHalo` dùng chung (DRY halo) — PR sau, không bắt buộc.
- Đổi route path / thêm route mới.
- Đụng nội dung Cypheus / canvas / dashboard cards / detail panels.

## 8. Risks

- **R1 — Layout/flex vỡ:** bỏ wrapper `h-screen` mỗi page có thể làm main không full-height
  hoặc builder drawer/dock lệch. Mitigation: layout giữ đúng `flex h-screen flex-col`; test
  từng page bằng screenshot thủ công (Tri) + giữ `flex-1`/`overflow` y như cũ.
- **R2 — Builder action vòng đời:** keyboard listener / dialog rò khi rời builder. Mitigation:
  cleanup `setActions(null)`; test mount/unmount.
- **R3 — DashboardPage.test.tsx** render `<DashboardPage/>` đơn lẻ có thể vỡ nếu nó từng dựa
  vào AppHeader. Kiểm tra: test hiện KHÔNG assert gì về header → an toàn; vẫn chạy regression.
