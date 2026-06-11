# Unified Header Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Gộp `HeaderToolbar` (Builder) + `AppHeader` (Dashboard/Detail) thành một header chung mount-một-lần qua layout route, để active-tab pill trượt thật và mọi trang nhất quán.

**Architecture:** Tạo `AppLayout` (route cha, wrap trong `ProtectedRoute`) chứa `AppHeader` + `<Outlet/>`. `AppHeader` nhận prop `actions?: ReactNode` + sliding pill (`layoutId`) + `aria-current`. Builder tách action thành `BuilderHeaderActions`, đẩy lên header qua `HeaderActionsContext`. Dashboard/Builder/Detail bỏ wrapper + header riêng, render fragment dưới Outlet. Landing đứng ngoài layout.

**Tech Stack:** React 18, React Router 7 (`createBrowserRouter` layout route + `Outlet`), framer-motion 11 (`layoutId` + `useReducedMotion`), Tailwind token `bg-surface-active`, Vitest + Testing Library.

**Spec:** `docs/superpowers/specs/2026-06-11-unified-header-design.md`

**⚠️ Repo caveat (memory/CLAUDE.md):** working tree có override local ở `vite.config.ts` + `package.json` **KHÔNG commit**. Mọi commit phải `git add` đúng từng file — tuyệt đối không `git add -A` / `git add .`.

**Thứ tự task giữ typecheck xanh giữa các commit:** AppHeader (prop) → context+AppLayout → BuilderHeaderActions → flip routes+strip pages (xoá HeaderToolbar ở bước này, sau khi BuilderPage hết import nó).

---

### Task 0: Branch

**Files:** none

- [ ] **Step 1: Tạo branch off main**

```bash
cd /Users/nguyenminhtri/.gemini/antigravity/scratch/trading_bot
git checkout -b feat/unified-header
```

(Repo local-only, không cần `git pull`. Nếu có session khác cùng checkout → cân nhắc worktree theo memory `project_concurrent_sessions_worktree`.)

---

### Task 1: AppHeader — actions prop + sliding pill + aria-current (TDD)

**Files:**

- Create: `src/pages/__tests__/AppHeader.test.tsx`
- Modify: `src/pages/AppHeader.tsx`

**Context:**

- `AppHeader` hiện render nav `[Dashboard · Builder · Docs]` + WalletChip. `isActive()` (dòng 35-37) đã đúng: `/dashboard` & `/bots/*` → Dashboard, `/builder` → Builder. Giữ nguyên.
- Test render `<AppHeader/>` trực tiếp trong `MemoryRouter` + `RequireWalletProvider`; set wallet store = connected (WalletChip render tĩnh, không fetch). Pattern lấy từ `DashboardPage.test.tsx`.

- [ ] **Step 1: Viết failing test**

Tạo `src/pages/__tests__/AppHeader.test.tsx`:

```tsx
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { ReactNode } from 'react';
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

function renderAt(path: string, actions?: ReactNode) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <RequireWalletProvider>
        <AppHeader actions={actions} />
      </RequireWalletProvider>
    </MemoryRouter>,
  );
}

describe('AppHeader', () => {
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

  it('renders actions passed via the actions prop', () => {
    renderAt('/dashboard', <span>MY_ACTIONS</span>);
    expect(screen.getByText('MY_ACTIONS')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Chạy test, verify FAIL**

```bash
pnpm vitest run src/pages/__tests__/AppHeader.test.tsx
```

Expected: FAIL — `aria-current` chưa có (3 case) + `MY_ACTIONS` không render (chưa có prop). Landing case có thể pass sẵn.

- [ ] **Step 3: Sửa AppHeader.tsx**

**3a.** Đổi import dòng 1:

```tsx
import { motion, useReducedMotion } from 'framer-motion';
```

**3b.** Thêm import `ReactNode` (cùng cụm import React types — nếu file chưa import React types thì thêm dòng):

```tsx
import type { ReactNode } from 'react';
```

**3c.** Đổi signature + thêm prop. Dòng 21 `export function AppHeader() {` →

```tsx
export function AppHeader({ actions }: { actions?: ReactNode } = {}) {
```

**3d.** Render actions trong right cluster. Thay block dòng 93-96:

```tsx
{
  /* Right cluster — wallet */
}
<motion.div variants={dropInItem} className="flex items-center pr-1">
  <WalletChip />
</motion.div>;
```

bằng:

```tsx
{
  /* Right cluster — builder actions (when provided) + wallet */
}
<motion.div variants={dropInItem} className="flex items-center gap-2 pr-1">
  {actions}
  <WalletChip />
</motion.div>;
```

**3e.** Thay component `NavLink` (dòng 113-131) bằng bản có sliding pill:

```tsx
function NavLink({ label, active, onClick }: NavLinkProps) {
  const reduceMotion = useReducedMotion();
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
          reduceMotion ? (
            <span className="absolute inset-0 rounded-full bg-surface-active" />
          ) : (
            <motion.span
              layoutId="header-nav-pill"
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

Lưu ý:

- `layoutId="header-nav-pill"` chung 2 NavLink → khi header mount-một-lần (Task 2-4) và active đổi, pill trượt. Khi AppHeader bị unmount (như hiện tại trên landing) thì chỉ fade — chấp nhận, landing không đổi tab.
- `useReducedMotion` → render span tĩnh, highlight vẫn hiện.
- Label bọc `relative z-[1]` để nổi trên pill khi đang animate.
- KHÔNG sửa `isActive`, KHÔNG sửa Docs anchor (dòng 81-89).

- [ ] **Step 4: Chạy test, verify PASS**

```bash
pnpm vitest run src/pages/__tests__/AppHeader.test.tsx
```

Expected: 5/5 PASS.

- [ ] **Step 5: typecheck (AppHeader vẫn dùng được bởi Landing/Dashboard — prop optional)**

```bash
pnpm typecheck
```

Expected: 0 lỗi.

- [ ] **Step 6: Commit (scoped)**

```bash
git add src/pages/AppHeader.tsx src/pages/__tests__/AppHeader.test.tsx
git commit -m "feat(header): AppHeader gains actions slot + sliding active-tab pill"
```

---

### Task 2: HeaderActionsContext + AppLayout (TDD)

**Files:**

- Create: `src/pages/header-actions-context.ts`
- Create: `src/pages/AppLayout.tsx`
- Create: `src/pages/__tests__/AppLayout.test.tsx`

- [ ] **Step 1: Tạo context**

Tạo `src/pages/header-actions-context.ts`:

```ts
import { createContext, useContext, type ReactNode } from 'react';

type SetHeaderActions = (actions: ReactNode) => void;

// Default no-op so a component that calls useHeaderActions() outside AppLayout
// (e.g. on the public Landing page) renders without crashing.
const HeaderActionsContext = createContext<SetHeaderActions>(() => {});

export const HeaderActionsProvider = HeaderActionsContext.Provider;

export function useHeaderActions(): SetHeaderActions {
  return useContext(HeaderActionsContext);
}
```

- [ ] **Step 2: Tạo AppLayout**

Tạo `src/pages/AppLayout.tsx`:

```tsx
import { useState, type ReactNode } from 'react';
import { Outlet } from 'react-router-dom';
import { AppHeader } from './AppHeader';
import { HeaderActionsProvider } from './header-actions-context';

// =============================================================================
// AppLayout · shared chrome for the authed app (Dashboard / Builder / Detail).
//
// AppHeader mounts ONCE here; child routes render through <Outlet/>. Because the
// header never unmounts between these routes, the active-tab pill can slide
// (framer-motion layoutId) and the Builder can push its action cluster into the
// header via HeaderActionsContext.
// =============================================================================
export function AppLayout() {
  const [actions, setActions] = useState<ReactNode>(null);
  return (
    <HeaderActionsProvider value={setActions}>
      <div className="flex h-screen w-screen flex-col bg-black text-fg">
        <AppHeader actions={actions} />
        <Outlet />
      </div>
    </HeaderActionsProvider>
  );
}
```

- [ ] **Step 3: Viết failing test**

Tạo `src/pages/__tests__/AppLayout.test.tsx`:

```tsx
import { describe, it, expect, beforeEach } from 'vitest';
import { useEffect } from 'react';
import { render, screen } from '@testing-library/react';
import {
  createMemoryRouter,
  RouterProvider,
  type RouteObject,
} from 'react-router-dom';
import { AppLayout } from '../AppLayout';
import { useHeaderActions } from '../header-actions-context';
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

function renderRouter(initial: string, children: RouteObject[]) {
  const router = createMemoryRouter([{ element: <AppLayout />, children }], {
    initialEntries: [initial],
  });
  return render(
    <RequireWalletProvider>
      <RouterProvider router={router} />
    </RequireWalletProvider>,
  );
}

describe('AppLayout', () => {
  beforeEach(() => {
    setWallet();
  });

  it('renders the shared header above the routed page', () => {
    renderRouter('/x', [{ path: '/x', element: <div>PAGE_X</div> }]);
    expect(screen.getByText('COIN98 BOT')).toBeInTheDocument();
    expect(screen.getByText('PAGE_X')).toBeInTheDocument();
  });

  it('lets a routed page push actions into the header via context', () => {
    function Pusher() {
      const setActions = useHeaderActions();
      useEffect(() => {
        setActions(<span>PUSHED_ACTION</span>);
        return () => setActions(null);
      }, [setActions]);
      return <div>PAGE</div>;
    }
    renderRouter('/x', [{ path: '/x', element: <Pusher /> }]);
    expect(screen.getByText('PUSHED_ACTION')).toBeInTheDocument();
  });
});
```

- [ ] **Step 4: Chạy test, verify PASS** (code đã có sẵn ở Step 1-2 — đây là TDD "viết test xác nhận đơn vị mới")

```bash
pnpm vitest run src/pages/__tests__/AppLayout.test.tsx
```

Expected: 2/2 PASS. Nếu FAIL vì context/Outlet → sửa cho xanh.

- [ ] **Step 5: typecheck**

```bash
pnpm typecheck
```

Expected: 0 lỗi (AppLayout chưa được wire vào routes — chưa ai dùng, nhưng compile sạch).

- [ ] **Step 6: Commit (scoped)**

```bash
git add src/pages/header-actions-context.ts src/pages/AppLayout.tsx src/pages/__tests__/AppLayout.test.tsx
git commit -m "feat(header): AppLayout shell + HeaderActionsContext"
```

---

### Task 3: BuilderHeaderActions tách từ HeaderToolbar (TDD)

**Files:**

- Create: `src/features/bot-builder/components/BuilderHeaderActions.tsx`
- Create: `src/features/bot-builder/components/__tests__/BuilderHeaderActions.test.tsx`

(KHÔNG xoá `HeaderToolbar.tsx` ở task này — BuilderPage vẫn import nó tới Task 4.)

**Context:**

- `BuilderHeaderActions` = cụm phải của `HeaderToolbar` (segmented `[New · Import]` + `Create bot`) + `ExportDialog` + `ImportDialog` + keyboard Ctrl+E/I. KHÔNG gồm logo / wallet / nút Dashboard (đã có ở AppHeader).
- Tự subscribe builder store: `validateBuilder(state)` → `canExport`. Builder rỗng (sau `resetAll`) là invalid → `Create bot` disabled + badge số issue.
- `strings.header.createBot` = 'Create bot'; `strings.cypheus.createNewBot` = 'New'.

- [ ] **Step 1: Tạo BuilderHeaderActions**

Tạo `src/features/bot-builder/components/BuilderHeaderActions.tsx`:

```tsx
import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Rocket, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useBuilderStore } from '@/features/bot-builder/store/builder.store';
import { CreateNewBotButton } from '@/features/cypheus/CreateNewBotButton';
import { ExportDialog } from '@/features/export-import/ExportDialog';
import { useExportDialogStore } from '@/features/export-import/export-dialog.store';
import { ImportDialog } from '@/features/export-import/ImportDialog';
import { validateBuilder } from '@/lib/validator';
import { strings } from '@/i18n/en';

// =============================================================================
// BuilderHeaderActions · the Builder-only action cluster, rendered into the
// shared AppHeader's actions slot (BuilderPage pushes it via HeaderActionsContext).
//
// Self-contained: subscribes the builder store, owns the Export/Import dialogs,
// and binds the Ctrl/Cmd+E (Create bot) / Ctrl/Cmd+I (Import) shortcuts. Mounts
// when the user is on /builder and unmounts (with its dialogs + listener) when
// they leave — see BuilderPage's useEffect cleanup.
// =============================================================================
export function BuilderHeaderActions() {
  const state = useBuilderStore();

  const exportOpen = useExportDialogStore((s) => s.open);
  const setExportOpen = useExportDialogStore((s) => s.setOpen);
  const [importOpen, setImportOpen] = useState(false);

  const issues = useMemo(() => validateBuilder(state), [state]);
  const canExport = issues.length === 0;

  // Ctrl/Cmd + E → Create bot, Ctrl/Cmd + I → Import.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      const target = e.target as HTMLElement | null;
      const isTyping =
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable);
      if (isTyping) return;
      const key = e.key.toLowerCase();
      if (key === 'e' && canExport) {
        e.preventDefault();
        setExportOpen(true);
      } else if (key === 'i') {
        e.preventDefault();
        setImportOpen(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [canExport, setExportOpen]);

  return (
    <TooltipProvider delayDuration={300}>
      <motion.div
        className="flex items-center gap-2"
        initial={{ opacity: 0, y: -4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
      >
        {/* Secondary segmented group: New (reset) · Import */}
        <div className="flex items-center gap-0.5 rounded-full border border-border bg-surface p-0.5">
          <CreateNewBotButton
            variant="ghost"
            className="h-9 rounded-full px-3"
          />
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setImportOpen(true)}
                className="h-9 rounded-full px-3"
                aria-label="Import bundle"
              >
                <Upload className="h-3.5 w-3.5" />
                Import
              </Button>
            </TooltipTrigger>
            <TooltipContent>Import a bundle JSON (Ctrl+I)</TooltipContent>
          </Tooltip>
        </div>

        {/* Primary terminal action: Create bot (opens the review/confirm dialog) */}
        <Tooltip>
          <TooltipTrigger asChild>
            <span>
              <Button
                variant="primary"
                size="sm"
                disabled={!canExport}
                onClick={() => setExportOpen(true)}
                className="h-10 rounded-full px-4 shadow-[0_0_16px_rgba(240,185,11,0.35)]"
              >
                <Rocket className="h-3.5 w-3.5" />
                {strings.header.createBot}
                {!canExport ? (
                  <span className="ml-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-fg-inverse/20 px-1 text-2xs">
                    {issues.length}
                  </span>
                ) : null}
              </Button>
            </span>
          </TooltipTrigger>
          <TooltipContent>
            {canExport
              ? 'Review setup and create the bot (Ctrl+E)'
              : `${issues.length} issue${issues.length === 1 ? '' : 's'} to fix.`}
          </TooltipContent>
        </Tooltip>
      </motion.div>

      <ExportDialog open={exportOpen} onOpenChange={setExportOpen} />
      <ImportDialog open={importOpen} onOpenChange={setImportOpen} />
    </TooltipProvider>
  );
}
```

- [ ] **Step 2: Viết test**

Tạo `src/features/bot-builder/components/__tests__/BuilderHeaderActions.test.tsx`:

```tsx
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { BuilderHeaderActions } from '../BuilderHeaderActions';
import { useBuilderStore } from '@/features/bot-builder/store/builder.store';
import { useExportDialogStore } from '@/features/export-import/export-dialog.store';

// The dialogs have their own tests; stub them so this test isolates the action
// cluster's logic (disabled state, issue badge, keyboard wiring).
vi.mock('@/features/export-import/ExportDialog', () => ({
  ExportDialog: ({ open }: { open: boolean }) => (
    <div data-testid="export-dialog">
      {open ? 'EXPORT_OPEN' : 'EXPORT_CLOSED'}
    </div>
  ),
}));
vi.mock('@/features/export-import/ImportDialog', () => ({
  ImportDialog: ({ open }: { open: boolean }) => (
    <div data-testid="import-dialog">
      {open ? 'IMPORT_OPEN' : 'IMPORT_CLOSED'}
    </div>
  ),
}));

function renderActions() {
  return render(
    <MemoryRouter>
      <BuilderHeaderActions />
    </MemoryRouter>,
  );
}

describe('BuilderHeaderActions', () => {
  beforeEach(() => {
    useBuilderStore.getState().resetAll();
    useExportDialogStore.setState({ open: false });
  });

  it('renders the "New" reset button', () => {
    renderActions();
    expect(screen.getByRole('button', { name: /^New$/i })).toBeInTheDocument();
  });

  it('disables Create bot while the builder is invalid', () => {
    renderActions();
    expect(screen.getByRole('button', { name: /create bot/i })).toBeDisabled();
  });

  it('opens the Import dialog on Ctrl+I', () => {
    renderActions();
    expect(screen.getByTestId('import-dialog')).toHaveTextContent(
      'IMPORT_CLOSED',
    );
    fireEvent.keyDown(window, { key: 'i', ctrlKey: true });
    expect(screen.getByTestId('import-dialog')).toHaveTextContent(
      'IMPORT_OPEN',
    );
  });

  it('does not open Export on Ctrl+E while the builder is invalid', () => {
    renderActions();
    fireEvent.keyDown(window, { key: 'e', ctrlKey: true });
    expect(screen.getByTestId('export-dialog')).toHaveTextContent(
      'EXPORT_CLOSED',
    );
  });
});
```

- [ ] **Step 3: Chạy test, verify PASS**

```bash
pnpm vitest run src/features/bot-builder/components/__tests__/BuilderHeaderActions.test.tsx
```

Expected: 4/4 PASS. Nếu "disabled" FAIL → builder default đang valid (bất ngờ); kiểm tra `validateBuilder` + `resetAll`.

- [ ] **Step 4: typecheck**

```bash
pnpm typecheck
```

Expected: 0 lỗi.

- [ ] **Step 5: Commit (scoped)**

```bash
git add src/features/bot-builder/components/BuilderHeaderActions.tsx src/features/bot-builder/components/__tests__/BuilderHeaderActions.test.tsx
git commit -m "feat(builder): extract BuilderHeaderActions (header action cluster + dialogs + shortcuts)"
```

---

### Task 4: Flip — wire layout route + strip 3 pages + delete HeaderToolbar

> Đây là commit "flip": app phải nhất quán sau commit này. Làm tuần tự các step rồi mới commit một lần ở cuối. KHÔNG commit giữa chừng (giữa chừng sẽ double-header hoặc thiếu header).

**Files:**

- Modify: `src/routes.tsx`
- Modify: `src/pages/DashboardPage.tsx`
- Modify: `src/features/bot-monitoring/BotMonitoringPage.tsx`
- Modify: `src/pages/BuilderPage.tsx`
- Delete: `src/features/bot-builder/components/HeaderToolbar.tsx`
- Delete: `src/features/bot-builder/components/HeaderToolbar.test.tsx`

- [ ] **Step 1: routes.tsx — layout route**

Thay toàn bộ `src/routes.tsx` bằng:

```tsx
import { createBrowserRouter, Navigate } from 'react-router-dom';
import { BuilderPage } from './pages/BuilderPage';
import { DashboardPage } from './pages/DashboardPage';
import { LandingPage } from './pages/LandingPage';
import { AppLayout } from './pages/AppLayout';
import { BotMonitoringPage } from './features/bot-monitoring/BotMonitoringPage';
import { ProtectedRoute } from './features/wallet-auth/ProtectedRoute';

export const router = createBrowserRouter([
  {
    path: '/',
    element: <LandingPage />,
  },
  {
    // Shared-chrome layout: AppHeader mounts once, child routes render in Outlet.
    element: (
      <ProtectedRoute>
        <AppLayout />
      </ProtectedRoute>
    ),
    children: [
      { path: '/dashboard', element: <DashboardPage /> },
      { path: '/builder', element: <BuilderPage /> },
      { path: '/bots/:id', element: <BotMonitoringPage /> },
    ],
  },
  {
    path: '*',
    element: <Navigate to="/" replace />,
  },
]);
```

- [ ] **Step 2: DashboardPage — bỏ wrapper + AppHeader**

Trong `src/pages/DashboardPage.tsx`:

**2a.** Xoá import AppHeader (dòng 35): `import { AppHeader } from './AppHeader';`

**2b.** Đổi mở wrapper. Thay dòng 233:

```tsx
    <div className="flex h-screen w-screen flex-col bg-black text-fg">
```

bằng:

```tsx
    <>
```

**2c.** Xoá dòng `<AppHeader />` (dòng 248).

**2d.** Đổi đóng wrapper. Thay `</div>` cuối cùng (dòng 491, ngay trước `);`) bằng:

```tsx
    </>
```

(`main` giữ `className="relative z-10 flex-1 overflow-y-auto"` — flex-1 nay nằm dưới AppLayout flex-col. halo + DotGrid `fixed`. Dialogs portal.)

- [ ] **Step 3: BotMonitoringPage — bỏ wrapper + sửa loading early-return**

Trong `src/features/bot-monitoring/BotMonitoringPage.tsx`:

**3a.** Loading early-return (dòng 234-240). Thay:

```tsx
if (notLoaded) {
  return (
    <div className="flex h-screen w-screen items-center justify-center bg-black text-fg-muted">
      <span className="text-sm">Loading bot…</span>
    </div>
  );
}
```

bằng (chiếm vùng main, header từ layout vẫn hiện):

```tsx
if (notLoaded) {
  return (
    <main className="relative z-10 flex flex-1 items-center justify-center text-fg-muted">
      <span className="text-sm">Loading bot…</span>
    </main>
  );
}
```

**3b.** Mở wrapper chính (dòng 243). Thay:

```tsx
    <div className="flex min-h-screen w-screen flex-col bg-black text-fg">
```

bằng:

```tsx
    <>
```

**3c.** Đóng wrapper chính (dòng 365, `</div>` ngay trước `);`). Thay bằng:

```tsx
    </>
```

(halo + DotGrid giữ trong fragment. `main className="relative z-10 flex-1 overflow-y-auto"` giữ nguyên. Nút "← Dashboard" trong content giữ nguyên làm back-to-list.)

- [ ] **Step 4: BuilderPage — bỏ wrapper + HeaderToolbar, push BuilderHeaderActions**

Trong `src/pages/BuilderPage.tsx`:

**4a.** Đổi import. Xoá dòng 6:

```tsx
import { HeaderToolbar } from '@/features/bot-builder/components/HeaderToolbar';
```

Thêm (cạnh các import khác):

```tsx
import { useHeaderActions } from './header-actions-context';
import { BuilderHeaderActions } from '@/features/bot-builder/components/BuilderHeaderActions';
```

**4b.** Thêm push-actions effect. Ngay sau `useKeyboardShortcuts();` (dòng 23) thêm:

```tsx
const setHeaderActions = useHeaderActions();
useEffect(() => {
  setHeaderActions(<BuilderHeaderActions />);
  return () => setHeaderActions(null);
}, [setHeaderActions]);
```

(`useEffect` đã được import sẵn ở dòng 1.)

**4c.** Mở wrapper (dòng 70). Thay:

```tsx
    <div className="flex h-screen w-screen flex-col bg-black text-fg">
```

bằng:

```tsx
    <>
```

**4d.** Xoá dòng `<HeaderToolbar />` (dòng 80).

**4e.** Đóng wrapper (dòng 146, `</div>` ngay trước `);`). Thay bằng:

```tsx
    </>
```

(`<div className="flex flex-1 overflow-hidden">` giữ nguyên — nay là con của AppLayout flex-col nên flex-1 fill chiều dọc dưới header. halo fixed. TemplatesDialog portal.)

- [ ] **Step 5: Xoá HeaderToolbar + test cũ** (giờ không còn ai import)

```bash
git rm src/features/bot-builder/components/HeaderToolbar.tsx src/features/bot-builder/components/HeaderToolbar.test.tsx
```

- [ ] **Step 6: typecheck — bắt mọi import lỗi của flip**

```bash
pnpm typecheck
```

Expected: 0 lỗi. Nếu báo "HeaderToolbar not found" → còn chỗ import sót; "Cannot find ./header-actions-context" → sai path.

- [ ] **Step 7: Chạy regression các test đụng tới**

```bash
pnpm vitest run src/pages/__tests__/DashboardPage.test.tsx src/features/bot-monitoring/__tests__/BotMonitoringPage.test.tsx src/pages/__tests__/AppHeader.test.tsx src/pages/__tests__/AppLayout.test.tsx src/features/bot-builder/components/__tests__/BuilderHeaderActions.test.tsx
```

Expected: tất cả PASS. `DashboardPage` + `BotMonitoringPage` giờ trả fragment (không header) nhưng test chỉ assert nội dung → vẫn pass. Nếu một test cũ assert wrapper/header (không kỳ vọng) → cập nhật test cho khớp cấu trúc mới (bỏ assert header — header nay ở layout).

- [ ] **Step 8: Full gates**

```bash
pnpm typecheck && pnpm lint && pnpm test && pnpm format
```

Expected: tất cả PASS. `pnpm test` chạy toàn bộ suite (đã xoá HeaderToolbar.test, thêm 3 test mới).

- [ ] **Step 9: Commit (scoped — liệt kê từng file, KHÔNG `git add -A`)**

```bash
git add src/routes.tsx \
  src/pages/DashboardPage.tsx \
  src/features/bot-monitoring/BotMonitoringPage.tsx \
  src/pages/BuilderPage.tsx
git commit -m "feat(header): wire AppLayout route, unify header across Dashboard/Builder/Detail

- routes: /dashboard, /builder, /bots/:id render under AppLayout (AppHeader once)
- pages drop their own wrapper + header; render as fragments under Outlet
- BuilderPage pushes BuilderHeaderActions into the header via context
- delete HeaderToolbar (superseded by AppHeader + BuilderHeaderActions)"
```

(`git rm` ở Step 5 đã stage 2 file xoá — commit này gộp luôn. Kiểm tra `git status` trước commit: chỉ 4 file modify + 2 file delete, KHÔNG có `vite.config.ts`/`package.json`.)

---

### Task 5: Manual verification (Tri tự test UI)

**Files:** none — theo memory `feedback_user_tests_ui`, không tự headless-screenshot; Tri reload browser, confirm.

- [ ] **Step 1: Báo Tri check trên `pnpm dev`:**

1. `/dashboard`: header chung, tab Dashboard pill sáng; Builder/Docs xám.
2. Click **Builder** → pill **trượt** Dashboard→Builder; cụm `[New · Import] + Create bot` **slide in** bên trái wallet.
3. Trong Builder: Ctrl+E mở Create-bot dialog (khi form hợp lệ), Ctrl+I mở Import; drawer/canvas/dock layout không lệch.
4. Click **Dashboard** → cụm builder biến mất, pill trượt về Dashboard.
5. Mở 1 bot (`/bots/:id`): có header chung, tab Dashboard sáng, nút "← Dashboard" trong content vẫn chạy; loading lúc đầu vẫn thấy header.
6. Về landing `/`: header hiện, không tab nào sáng (AppHeader đứng ngoài layout).
7. Disconnect wallet ở bất kỳ trang protected nào → về `/`.
8. Bật OS reduce-motion → pill vẫn highlight (tĩnh, không trượt).

- [ ] **Step 2: Sau khi Tri OK** — dùng skill superpowers:finishing-a-development-branch (merge ff-only vào main theo convention repo).

---

## Self-review notes (đã kiểm trước khi giao)

- **Spec coverage:** AppLayout/context (Task 2) ✓; AppHeader actions+pill+aria-current (Task 1) ✓; BuilderHeaderActions (Task 3) ✓; routes layout + 3 page strip + delete HeaderToolbar (Task 4) ✓; Landing giữ nguyên ✓; testing (Task 1-3 + regression Task 4 Step 7) ✓; out-of-scope (responsive/BrandHalo) không làm ✓.
- **Type consistency:** `useHeaderActions(): (actions: ReactNode) => void` — dùng đồng nhất ở AppLayout (provider value=`setActions`) và BuilderPage (`setHeaderActions(<BuilderHeaderActions/>)` / `setHeaderActions(null)`). AppHeader prop `{ actions?: ReactNode }` khớp `actions={actions}` ở AppLayout và `actions={actions}` test. `layoutId="header-nav-pill"` đồng nhất.
- **Spec inconsistency đã sửa:** spec §3 từng ghi BotMonitoring "bỏ halo" còn Dashboard "giữ halo" — plan thống nhất: **cả 3 page giữ halo + DotGrid**, chỉ bỏ wrapper + header. (BrandHalo DRY để sau.)
- **Không placeholder:** mọi step có code/lệnh cụ thể + expected output.
