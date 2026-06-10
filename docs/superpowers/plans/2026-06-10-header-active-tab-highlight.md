# Header Active-Tab Highlight Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tab đang active trong header (Dashboard / Builder) được highlight bằng pill nền sáng trượt giữa các tab — user luôn biết mình đang ở đâu.

**Architecture:** Chỉ sửa 1 component `NavLink` trong `src/pages/AppHeader.tsx`: khi `active`, render một `motion.span` absolute (nền `bg-surface-active`, bo full) phía sau label, dùng framer-motion `layoutId` chung để pill trượt giữa 2 tab. Thêm `aria-current="page"` làm hook cho cả accessibility lẫn test.

**Tech Stack:** React 18, framer-motion 11 (`layoutId` + `useReducedMotion`), Tailwind token `bg-surface-active` (#2b3139, sẵn có), Vitest + Testing Library.

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
- Modify: `src/pages/AppHeader.tsx` (import dòng 1, component `NavLink` dòng 107-131)

**Context cho engineer mới:**

- `AppHeader` được render bởi `LandingPage` và `DashboardPage`. Nav có 3 item: Dashboard (`/dashboard`), Builder (`/builder`) là `NavLink` (button + navigate); Docs là `<a>` external — không bao giờ active, không đụng.
- Hàm `isActive()` (dòng 35-37) đã đúng — `/bots/:id` tính là Dashboard. Giữ nguyên.
- Hiện tại active chỉ đổi màu chữ → không nhìn ra. Sau task này: active = pill nền `bg-surface-active` + chữ trắng + `aria-current="page"`.
- `Button` variant `ghost` (xem `src/components/ui/button.tsx:15`) có sẵn `hover:bg-surface-hover` — nhánh active phải override bằng `hover:bg-transparent` để hover không đổi gì thêm (pill đã sáng sẵn).
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

Trong `src/pages/AppHeader.tsx`:

**3a.** Sửa import dòng 1:

```tsx
import { motion, useReducedMotion } from 'framer-motion';
```

**3b.** Thay toàn bộ component `NavLink` (dòng 113-131) bằng:

```tsx
function NavLink({ label, active, onClick }: NavLinkProps) {
  const reducedMotion = useReducedMotion();
  return (
    <motion.div variants={dropInItem} className="inline-flex">
      <Button
        variant="ghost"
        size="sm"
        onClick={onClick}
        aria-current={active ? 'page' : undefined}
        className={cn(
          'relative h-10 rounded-full px-3 text-sm font-medium',
          active
            ? 'text-fg hover:bg-transparent'
            : 'text-fg-secondary hover:bg-surface-hover hover:text-fg',
        )}
      >
        {active ? (
          reducedMotion ? (
            <span className="absolute inset-0 rounded-full bg-surface-active" />
          ) : (
            <motion.span
              layoutId="header-nav-active-pill"
              className="absolute inset-0 rounded-full bg-surface-active"
              transition={{ type: 'spring', stiffness: 400, damping: 32 }}
            />
          )
        ) : null}
        <span className="relative z-[1]">{label}</span>
      </Button>
    </motion.div>
  );
}
```

Giải thích các điểm dễ vấp:

- `layoutId` chung giữa 2 NavLink → khi active đổi tab, framer-motion animate pill từ vị trí cũ sang mới (shared layout). Trên landing không tab nào active → pill không render.
- `useReducedMotion()` → user bật reduce-motion thì render `<span>` tĩnh (vẫn có highlight, không trượt). App chưa có `MotionConfig` nên phải tự xử ở đây.
- Span absolute không tham gia flex nên `gap-2` của Button không bị ảnh hưởng.
- Label bọc `relative z-[1]` để chắc chắn nổi trên pill khi pill đang transform giữa chừng animation.
- KHÔNG sửa hàm `isActive`, KHÔNG sửa Docs anchor.

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
git commit -m "feat(header): sliding pill highlight for active nav tab"
```

---

### Task 2: Manual verification (Tri tự test UI)

**Files:** none — theo memory `feedback_user_tests_ui`, không tự screenshot; Tri reload browser và confirm.

- [ ] **Step 1: Báo Tri check các điểm sau trên `pnpm dev`:**

1. `/dashboard` → tab Dashboard có pill nền sáng, chữ trắng; Builder/Docs xám.
2. Click Builder → pill **trượt** mượt từ Dashboard sang Builder.
3. Vào detail bot (`/bots/:id`) → Dashboard vẫn sáng.
4. Về landing `/` → không tab nào sáng.
5. Hover tab active → không đổi thêm gì; hover tab inactive → nền hover nhẹ như cũ.

- [ ] **Step 2: Sau khi Tri OK** — dùng skill superpowers:finishing-a-development-branch (merge ff-only vào main theo convention repo).
