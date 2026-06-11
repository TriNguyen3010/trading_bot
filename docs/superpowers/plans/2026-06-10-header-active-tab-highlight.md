# Header Active-Tab Highlight Implementation Plan

> ⚠️ **SUPERSEDED (2026-06-11)** bởi `2026-06-11-unified-header.md`. Plan này chỉ
> làm pill tĩnh trên AppHeader hiện tại. Tri đã duyệt phương án lớn hơn: gộp header
> Builder vào AppHeader dùng chung qua layout route → pill slide chạy thật. Dùng
> plan mới. Giữ file làm lịch sử.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tab đang active trong header (Dashboard / Builder) được highlight bằng pill nền sáng — user luôn biết mình đang ở đâu.

**Architecture:** Chỉ sửa 1 component `NavLink` trong `src/pages/AppHeader.tsx`: nhánh active đổi className sang `bg-surface-active text-fg` (pill tĩnh) + thêm `aria-current="page"` làm hook cho cả accessibility lẫn test. Không thêm element, không thêm animation — phương án slide bằng `layoutId` đã bị loại trong self-review vì AppHeader chỉ mount ở `/` và `/dashboard` (xem spec §2), điều hướng sang Builder unmount cả header nên slide không bao giờ chạy được.

**Tech Stack:** React 18, Tailwind token `bg-surface-active` (#2b3139, sẵn có), Vitest + Testing Library.

**Spec:** `docs/superpowers/specs/2026-06-10-header-active-tab-design.md`

**⚠️ Repo caveat (memory/CLAUDE.md):** working tree đang có override local ở `vite.config.ts` + `package.json` KHÔNG ĐƯỢC commit. Mọi bước commit phải `git add` đúng từng file, tuyệt đối không `git add -A` / `git add .`.

---

### Task 0: Branch

**Files:** none

- [ ] **Step 1: Tạo branch off main**

```bash
cd /Users/nguyenminhtri/.gemini/antigravity/scratch/trading_bot
git checkout -b feat/header-active-tab
```

(Không cần `git pull` — repo local-only. Nếu session khác đang chạy cùng checkout, cân nhắc worktree theo memory `project_concurrent_sessions_worktree`.)

---

### Task 1: Active-tab highlight trong AppHeader (TDD)

**Files:**

- Create: `src/pages/__tests__/AppHeader.test.tsx`
- Modify: `src/pages/AppHeader.tsx` (component `NavLink` dòng 113-131)

**Context cho engineer mới:**

- `AppHeader` chỉ được render bởi `LandingPage` (`/`) và `DashboardPage` (`/dashboard`). Trang `/builder` dùng `HeaderToolbar` riêng, `/bots/:id` không render AppHeader — nên test cho 2 route đó là contract-level của hàm `isActive`, không nhìn thấy trên UI hôm nay.
- Nav có 3 item: Dashboard (`/dashboard`), Builder (`/builder`) là `NavLink` (button + navigate); Docs là `<a>` external — không bao giờ active, không đụng.
- Hàm `isActive()` (dòng 35-37) đã đúng — `/bots/:id` tính là Dashboard. Giữ nguyên.
- Hiện tại active chỉ đổi màu chữ → không nhìn ra. Sau task này: active = pill nền `bg-surface-active` + chữ trắng + `aria-current="page"`.
- `Button` variant `ghost` (xem `src/components/ui/button.tsx:15`) có sẵn `hover:bg-surface-hover` — nhánh active phải override bằng `hover:bg-surface-active` để hover giữ nguyên nền pill (không nhạt đi). `cn()` dùng tailwind-merge nên class sau đè class trước.
- Test không cần mock API: `WalletChip` chỉ fetch khi mở modal (gated theo `open`), còn render tĩnh thì chỉ đọc zustand store. Pattern set store + wrap provider lấy từ `src/pages/__tests__/DashboardPage.test.tsx`.

- [ ] **Step 1: Viết failing test**

Tạo `src/pages/__tests__/AppHeader.test.tsx`:

```tsx
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AppHeader } from '../AppHeader';
import { RequireWalletProvider } from '@/features/wallet-auth/RequireWalletProvider';
import { useWalletStore } from '@/features/wallet-auth/wallet.store';

function setWallet() {
  useWalletStore.setState({
    address: '0xabc',
    nonce: 'n',
    signature: 's',
    status: 'ready',
    user: null,
    error: null,
    signingMessage: null,
  });
}

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <RequireWalletProvider>
        <AppHeader />
      </RequireWalletProvider>
    </MemoryRouter>,
  );
}

describe('AppHeader — active tab highlight', () => {
  beforeEach(() => {
    setWallet();
  });

  it('marks Dashboard active at /dashboard', () => {
    renderAt('/dashboard');
    expect(screen.getByRole('button', { name: 'Dashboard' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(screen.getByRole('button', { name: 'Builder' })).not.toHaveAttribute(
      'aria-current',
    );
  });

  // Contract của isActive — AppHeader không thực mount ở /builder hôm nay
  // (BuilderPage dùng HeaderToolbar riêng), nhưng rule phải đúng sẵn nếu
  // sau này các trang dùng chung header.
  it('marks Builder active at /builder', () => {
    renderAt('/builder');
    expect(screen.getByRole('button', { name: 'Builder' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(
      screen.getByRole('button', { name: 'Dashboard' }),
    ).not.toHaveAttribute('aria-current');
  });

  // Tương tự: contract-level cho route detail.
  it('marks Dashboard active on bot detail routes (/bots/:id)', () => {
    renderAt('/bots/123');
    expect(screen.getByRole('button', { name: 'Dashboard' })).toHaveAttribute(
      'aria-current',
      'page',
    );
  });

  it('marks nothing active on the landing page', () => {
    renderAt('/');
    expect(
      screen.getByRole('button', { name: 'Dashboard' }),
    ).not.toHaveAttribute('aria-current');
    expect(screen.getByRole('button', { name: 'Builder' })).not.toHaveAttribute(
      'aria-current',
    );
  });
});
```

- [ ] **Step 2: Chạy test, verify FAIL**

```bash
pnpm vitest run src/pages/__tests__/AppHeader.test.tsx
```

Expected: 3 test FAIL (`/dashboard`, `/builder`, `/bots/123` — thiếu `aria-current`), test landing PASS (hiện cũng không có attr). Nếu fail vì lý do khác (import/render crash) → sửa setup trước khi đi tiếp.

- [ ] **Step 3: Implement NavLink**

Trong `src/pages/AppHeader.tsx`, thay toàn bộ component `NavLink` (dòng 113-131) bằng:

```tsx
function NavLink({ label, active, onClick }: NavLinkProps) {
  return (
    <motion.div variants={dropInItem} className="inline-flex">
      <Button
        variant="ghost"
        size="sm"
        onClick={onClick}
        aria-current={active ? 'page' : undefined}
        className={cn(
          'h-10 rounded-full px-3 text-sm font-medium',
          active
            ? 'bg-surface-active text-fg hover:bg-surface-active'
            : 'text-fg-secondary hover:bg-surface-hover hover:text-fg',
        )}
      >
        {label}
      </Button>
    </motion.div>
  );
}
```

Giải thích các điểm dễ vấp:

- Diff thực chất chỉ là: thêm `aria-current`, nhánh active thêm `bg-surface-active` + `hover:bg-surface-active` (đè hover mặc định của ghost để pill không đổi màu khi hover).
- KHÔNG import gì thêm, KHÔNG sửa hàm `isActive`, KHÔNG sửa Docs anchor.
- Trên landing `/` không tab nào active → không pill nào render (cả 2 NavLink đi nhánh inactive).

- [ ] **Step 4: Chạy test, verify PASS**

```bash
pnpm vitest run src/pages/__tests__/AppHeader.test.tsx
```

Expected: 4/4 PASS.

- [ ] **Step 5: Full gates**

```bash
pnpm typecheck && pnpm lint && pnpm test && pnpm format
```

Expected: tất cả pass, format không đổi gì ngoài 2 file đang sửa (nếu có).

- [ ] **Step 6: Commit (scoped add — KHÔNG `git add -A`)**

```bash
git add src/pages/AppHeader.tsx src/pages/__tests__/AppHeader.test.tsx
git commit -m "feat(header): filled pill highlight for active nav tab"
```

---

### Task 2: Manual verification (Tri tự test UI)

**Files:** none — theo memory `feedback_user_tests_ui`, không tự screenshot; Tri reload browser và confirm.

- [ ] **Step 1: Báo Tri check các điểm sau trên `pnpm dev`:**

1. `/dashboard` → tab Dashboard có pill nền sáng (#2b3139), chữ trắng; Builder/Docs xám.
2. Về landing `/` → không tab nào sáng.
3. Hover tab active → pill giữ nguyên, không đổi gì thêm; hover tab inactive → nền hover nhẹ như cũ.
4. Click Builder → sang trang builder (header riêng của builder, không có nav tabs — ngoài scope task này).

- [ ] **Step 2: Sau khi Tri OK** — dùng skill superpowers:finishing-a-development-branch (merge ff-only vào main theo convention repo).
