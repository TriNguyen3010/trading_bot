# Header active-tab highlight — Design

**Date:** 2026-06-10
**Owner:** Tri Nguyen
**Status:** Approved approach — sliding filled pill (option A, picked by Tri)
**Component:** `src/pages/AppHeader.tsx`

## 1. Problem

Trong header (`AppHeader`), tab đang active (Dashboard / Builder) chỉ đổi màu chữ
`text-fg-secondary` → `text-fg` (xám → trắng). Trên nền pill tối của header, khác biệt
này gần như không nhìn thấy — user không biết mình đang ở tab nào.

## 2. Decision

**Sliding filled pill** (segmented-control style):

- Tab active có nền pill `bg-surface-active` (#2b3139, token sẵn có) bo `rounded-full`,
  chữ `text-fg` (trắng).
- Pill **trượt** giữa các tab khi điều hướng, dùng framer-motion shared layout
  (`layoutId="header-nav-active-pill"`).
- Không thêm màu mới — giữ header sạch, không cạnh tranh với WalletChip.

Hai phương án bị loại (đã đưa Tri chọn): chữ vàng brand + dot, và pill vàng nhạt —
đều thêm mảng vàng cạnh WalletChip xanh, nhiều màu hơn cần thiết.

## 3. Behavior

| Route                | Tab active                           |
| -------------------- | ------------------------------------ |
| `/dashboard`         | Dashboard                            |
| `/bots/:id` (detail) | Dashboard (rule hiện có, giữ nguyên) |
| `/builder`           | Builder                              |
| `/` (landing)        | Không tab nào — không render pill    |
| Docs (external link) | Không bao giờ active                 |

- **Hover inactive:** giữ nguyên hiện tại (`hover:bg-surface-hover hover:text-fg`).
- **Hover active:** pill đã sáng sẵn, không stack thêm lớp hover bg (bỏ
  `hover:bg-surface-hover` ở nhánh active để tránh double-layer).
- **Chuyển từ landing vào dashboard:** pill xuất hiện (mount) — framer-motion xử lý
  initial mount mặc định, không cần animation đặc biệt.

## 4. Implementation sketch

Chỉ sửa `src/pages/AppHeader.tsx` (component `NavLink`):

- Button thêm `relative`; khi `active`, render
  `<motion.span layoutId="header-nav-active-pill" className="absolute inset-0 rounded-full bg-surface-active" />`
  phía sau label; label bọc trong `<span className="relative z-[1]">`.
- Hai `NavLink` (Dashboard, Builder) dùng chung `layoutId` → khi active đổi, framer-motion
  animate pill trượt từ tab cũ sang tab mới.
- `useReducedMotion()` từ framer-motion: nếu user bật reduce-motion, render pill tĩnh
  (bỏ `layoutId`) — highlight vẫn hiện, chỉ không trượt.
- A11y: button active thêm `aria-current="page"`.
- Docs anchor: không đổi behavior, chỉ đảm bảo style hover đồng nhất (hiện đã khớp).

## 5. Testing

File mới `src/pages/__tests__/AppHeader.test.tsx` (Vitest + Testing Library,
MemoryRouter + mock wallet store/RequireWalletProvider theo pattern test hiện có):

1. Tại `/dashboard` → button Dashboard có `aria-current="page"`, Builder không có.
2. Tại `/builder` → Builder active.
3. Tại `/bots/123` → Dashboard active.
4. Tại `/` → không button nào có `aria-current`.

## 6. Out of scope

- Không đổi route, không thêm token màu, không đổi behavior Docs link.
- Không đụng WalletChip / logo cluster.
