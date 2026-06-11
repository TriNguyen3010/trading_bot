# Header active-tab highlight — Design

> ⚠️ **SUPERSEDED (2026-06-11)** bởi `2026-06-11-unified-header-design.md`. Tri
> duyệt phương án gộp header Builder + Dashboard dùng chung (layout route) qua
> demo `public/unified-header-demo.html` → slide animation giờ chạy thật được,
> không còn bị giới hạn "pill tĩnh" như spec này. Giữ file làm lịch sử.

**Date:** 2026-06-10
**Owner:** Tri Nguyen
**Status:** Approved approach — filled pill (option A, picked by Tri). Phần "slide"
bị loại trong self-review — xem §2.
**Component:** `src/pages/AppHeader.tsx`

## 1. Problem

Trong header (`AppHeader`), tab đang active (Dashboard / Builder) chỉ đổi màu chữ
`text-fg-secondary` → `text-fg` (xám → trắng). Trên nền pill tối của header, khác biệt
này gần như không nhìn thấy — user không biết mình đang ở tab nào.

## 2. Decision

**Filled pill** (segmented-control style, static):

- Tab active có nền pill `bg-surface-active` (#2b3139, token sẵn có) bo `rounded-full`,
  chữ `text-fg` (trắng).
- Không thêm màu mới — giữ header sạch, không cạnh tranh với WalletChip.

Hai phương án bị loại (đã đưa Tri chọn): chữ vàng brand + dot, và pill vàng nhạt —
đều thêm mảng vàng cạnh WalletChip xanh, nhiều màu hơn cần thiết.

**Slide animation bị loại (self-review finding):** phương án ban đầu có pill trượt
giữa các tab bằng framer-motion `layoutId`. Nhưng AppHeader chỉ được mount ở `/`
(landing) và `/dashboard` — trang `/builder` dùng `HeaderToolbar` riêng
(`src/pages/BuilderPage.tsx:80`), `/bots/:id` không render AppHeader. Điều hướng
Dashboard ↔ Builder unmount toàn bộ AppHeader nên shared-layout animation không bao
giờ chạy được → YAGNI, bỏ. Nếu sau này các trang dùng chung AppHeader (layout route),
có thể thêm `layoutId` lại — diff nhỏ.

## 3. Behavior

| Route                | Tab active                           |
| -------------------- | ------------------------------------ |
| `/dashboard`         | Dashboard                            |
| `/bots/:id` (detail) | Dashboard (rule hiện có, giữ nguyên) |
| `/builder`           | Builder                              |
| `/` (landing)        | Không tab nào — không render pill    |
| Docs (external link) | Không bao giờ active                 |

Lưu ý thực tế: AppHeader hiện chỉ mount ở `/` và `/dashboard`, nên 2 dòng
`/bots/:id` và `/builder` là contract của hàm `isActive` (future-proofing nếu sau
này các trang dùng chung header) — vẫn test ở mức unit, nhưng không nhìn thấy được
trên UI hôm nay.

- **Hover inactive:** giữ nguyên hiện tại (`hover:bg-surface-hover hover:text-fg`).
- **Hover active:** giữ nguyên nền pill, hover không đổi gì thêm (override
  `hover:bg-surface-active` để đè hover mặc định của Button ghost).

## 4. Implementation sketch

Chỉ sửa `src/pages/AppHeader.tsx` (component `NavLink`) — diff thuần className + attr:

- Nhánh active của Button đổi thành
  `bg-surface-active text-fg hover:bg-surface-active` (pill tĩnh, hover không đổi).
- A11y: button active thêm `aria-current="page"` — đồng thời là hook cho test.
- Không cần framer-motion mới, không cần span absolute (đã bỏ slide — xem §2).
- Docs anchor: không đổi behavior, chỉ đảm bảo style hover đồng nhất (hiện đã khớp).

## 5. Testing

File mới `src/pages/__tests__/AppHeader.test.tsx` (Vitest + Testing Library,
MemoryRouter + mock wallet store/RequireWalletProvider theo pattern test hiện có):

1. Tại `/dashboard` → button Dashboard có `aria-current="page"`, Builder không có.
2. Tại `/builder` → Builder active (contract `isActive` — AppHeader không thực mount
   ở route này hôm nay).
3. Tại `/bots/123` → Dashboard active (tương tự, contract-level).
4. Tại `/` → không button nào có `aria-current`.

## 6. Out of scope

- Không đổi route, không thêm token màu, không đổi behavior Docs link.
- Không đụng WalletChip / logo cluster.
