# My Bots Dialog Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace `/bots` page + hard-coded Monitor header button with a "My Bots" dialog (Templates-style popup) that fetches the logged-in user's real bots from BE and routes to the existing `/bots/:id` monitor page on card click.

**Architecture:** Zustand store toggles a Radix Dialog mounted in the builder `HeaderToolbar`. Dialog fetches `GET /bot/list` once on open, then enriches each row with `GET /bot/{id}/config` in parallel to extract pair/timeframe/dry_run. Fields BE does not yet expose (PnL, win rate, trades, uptime) render as `—` placeholders so layout stays stable when BE ships those endpoints. `formatBackendError` is extracted to `src/lib/format-error.ts` and shared with `ExportDialog`.

**Tech Stack:** React 18, TypeScript 5.7, Vite 6, Zustand 5, React Router 7, Radix Dialog (via shadcn pattern), Tailwind 3, Vitest 2 + @testing-library/react, Sonner toasts.

**Reference spec:** [docs/superpowers/specs/2026-05-11-my-bots-dialog-design.md](../specs/2026-05-11-my-bots-dialog-design.md)

---

## File Structure

**New files (7):**
| Path | Purpose |
|---|---|
| `src/lib/format-error.ts` | Pure function `formatBackendError(err): string` (moved from ExportDialog). |
| `src/lib/format-error.test.ts` | Tests for the pure function. |
| `src/features/bot-monitoring/my-bots-dialog.store.ts` | Zustand store `{open, setOpen}`. |
| `src/features/bot-monitoring/my-bots-dialog.store.test.ts` | Store toggle tests. |
| `src/features/bot-monitoring/bot.api.ts` | Thin wrappers around `/bot/list` and `/bot/{id}/config`. |
| `src/features/bot-monitoring/MyBotsDialog.tsx` | Dialog component (the meat). |
| `src/features/bot-monitoring/MyBotsDialog.test.tsx` | Component tests (skeleton, list, empty, error, click → navigate). |

**Modified files (4):**
| Path | Change |
|---|---|
| `src/lib/http.ts` | Add `'/bot/'` to `SILENT_TOAST_PREFIXES`. |
| `src/lib/http.test.ts` | Add test: `/bot/list` does not toast on 5xx. |
| `src/features/export-import/ExportDialog.tsx` | Replace inline `formatBackendError` with import from `@/lib/format-error`. |
| `src/features/bot-builder/components/HeaderToolbar.tsx` | Remove hard-coded Monitor button (line ~276), add "My Bots" button + mount `<MyBotsDialog />`. |
| `src/routes.tsx` | Remove `/bots` route + `BotsListPage` import. |

**Deleted files (1):**
| Path | Reason |
|---|---|
| `src/features/bot-monitoring/BotsListPage.tsx` | No longer reachable after route removal. |

Test file count delta: +3 new test files, +1 test added to existing, +0 deleted (BotsListPage has no tests).

---

## Task 1: Extract `formatBackendError` to `src/lib/format-error.ts`

Pure refactor. No behavior change. Lands first so subsequent tasks can import from a clean path.

**Files:**
- Create: `src/lib/format-error.ts`
- Create: `src/lib/format-error.test.ts`
- Modify: `src/features/export-import/ExportDialog.tsx`

- [ ] **Step 1: Write the failing tests**

Create `src/lib/format-error.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { formatBackendError } from './format-error';
import { HttpError, ValidationError } from './http';

describe('formatBackendError', () => {
  it('formats ValidationError as field.path: msg per line', () => {
    const err = new ValidationError([
      { loc: ['body', 'bot_name'], msg: 'Field required', type: 'missing' },
      { loc: ['body', 'stake_amount'], msg: 'must be > 0', type: 'value_error' },
    ]);
    expect(formatBackendError(err)).toBe(
      'body.bot_name: Field required\nbody.stake_amount: must be > 0',
    );
  });

  it('uses "(root)" when ValidationError loc is empty', () => {
    const err = new ValidationError([
      { loc: [], msg: 'boom', type: 'unknown' },
    ]);
    expect(formatBackendError(err)).toBe('(root): boom');
  });

  it('parses HttpError JSON body and shows {status}: {detail}', () => {
    const err = new HttpError(400, '{"detail":"Strategy name already exists"}');
    expect(formatBackendError(err)).toBe('400: Strategy name already exists');
  });

  it('joins array detail in HttpError JSON body', () => {
    const err = new HttpError(400, '{"detail":["x","y"]}');
    expect(formatBackendError(err)).toBe('400:\nx\ny');
  });

  it('falls back to raw body when HttpError body is not JSON', () => {
    const err = new HttpError(500, 'Internal Server Error');
    expect(formatBackendError(err)).toBe('500: Internal Server Error');
  });

  it('falls back to status when HttpError body is empty', () => {
    const err = new HttpError(502, '');
    expect(formatBackendError(err)).toBe('502: HTTP 502');
  });

  it('returns localized message for Network error', () => {
    expect(formatBackendError(new Error('Network error'))).toBe(
      'Không thể kết nối server',
    );
  });

  it('falls back to message for generic Error', () => {
    expect(formatBackendError(new Error('something broke'))).toBe(
      'something broke',
    );
  });

  it('stringifies non-Error values', () => {
    expect(formatBackendError('boom')).toBe('boom');
    expect(formatBackendError(null)).toBe('null');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail (module not found)**

Run: `pnpm test -- --run src/lib/format-error.test.ts`
Expected: FAIL with "Cannot find module './format-error'" or similar.

- [ ] **Step 3: Create the module**

Create `src/lib/format-error.ts`:

```ts
import { HttpError, ValidationError } from './http';

export function formatBackendError(err: unknown): string {
  if (err instanceof ValidationError) {
    return err.detail
      .map((d) => `${d.loc.join('.') || '(root)'}: ${d.msg}`)
      .join('\n');
  }
  if (err instanceof HttpError) {
    // Body từ BE thường là JSON `{detail: "..."}` hoặc text. Cố parse JSON trước.
    try {
      const parsed = JSON.parse(err.body) as { detail?: unknown };
      if (typeof parsed.detail === 'string') return `${err.status}: ${parsed.detail}`;
      if (Array.isArray(parsed.detail))
        return `${err.status}:\n${parsed.detail.map(String).join('\n')}`;
      return `${err.status}: ${err.body || err.message}`;
    } catch {
      return `${err.status}: ${err.body || err.message}`;
    }
  }
  if (err instanceof Error && err.message === 'Network error') {
    return 'Không thể kết nối server';
  }
  return err instanceof Error ? err.message : String(err);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test -- --run src/lib/format-error.test.ts`
Expected: 9 tests PASS.

- [ ] **Step 5: Update ExportDialog to use the extracted function**

In `src/features/export-import/ExportDialog.tsx`:

Replace the import block (around line 24) and remove the inline function (lines 27-49).

Find:
```ts
import { HttpError, ValidationError } from '@/lib/http';
import type { CreatePayload } from '@/types/api-helpers';

function formatBackendError(err: unknown): string {
  if (err instanceof ValidationError) {
    return err.detail
      .map((d) => `${d.loc.join('.') || '(root)'}: ${d.msg}`)
      .join('\n');
  }
  if (err instanceof HttpError) {
    // Body từ BE thường là JSON `{detail: "..."}` hoặc text. Cố parse JSON trước.
    try {
      const parsed = JSON.parse(err.body) as { detail?: unknown };
      if (typeof parsed.detail === 'string') return `${err.status}: ${parsed.detail}`;
      if (Array.isArray(parsed.detail))
        return `${err.status}:\n${parsed.detail.map(String).join('\n')}`;
      return `${err.status}: ${err.body || err.message}`;
    } catch {
      return `${err.status}: ${err.body || err.message}`;
    }
  }
  if (err instanceof Error && err.message === 'Network error') {
    return 'Không thể kết nối server';
  }
  return err instanceof Error ? err.message : String(err);
}
```

Replace with:
```ts
import { ValidationError } from '@/lib/http';
import type { CreatePayload } from '@/types/api-helpers';
import { formatBackendError } from '@/lib/format-error';
```

Note: `HttpError` import is removed because it's no longer used inside ExportDialog.tsx — `formatBackendError` handles it.

- [ ] **Step 6: Run typecheck and full test suite**

Run: `pnpm typecheck && pnpm test`
Expected: typecheck clean (no errors), all tests pass (count increased by 9).

- [ ] **Step 7: Commit**

```bash
git add src/lib/format-error.ts src/lib/format-error.test.ts src/features/export-import/ExportDialog.tsx
git commit -m "$(cat <<'EOF'
refactor: extract formatBackendError to src/lib/format-error

Pure function moved out of ExportDialog so MyBotsDialog (next commit)
can reuse it. Behavior unchanged in ExportDialog. First-time unit
coverage for the error-formatting logic (9 tests).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Add `/bot/` to `SILENT_TOAST_PREFIXES`

Stops `http.ts` from firing a global error toast for `/bot/list` and `/bot/{id}/config` failures. The dialog renders error UX locally.

**Files:**
- Modify: `src/lib/http.ts:68` (the `SILENT_TOAST_PREFIXES` constant)
- Modify: `src/lib/http.test.ts` (add one test)

- [ ] **Step 1: Write the failing test**

Add to `src/lib/http.test.ts` inside the existing `describe('http wrapper', ...)`, after the `'does NOT toast on 5xx for /user/login'` test:

```ts
  it('does NOT toast on 5xx for /bot/* paths (MyBotsDialog handles it)', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
      text: async () => 'boom',
    });

    try {
      await http('GET', '/bot/list');
      expect.unreachable('should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(HttpError);
      expect((err as HttpError).status).toBe(500);
    }
    expect(toast.error).not.toHaveBeenCalled();
  });
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm test -- --run src/lib/http.test.ts -t "does NOT toast on 5xx for /bot/"`
Expected: FAIL — `toast.error` IS called because `/bot/list` is not in `SILENT_TOAST_PREFIXES` yet.

- [ ] **Step 3: Add the prefix**

In `src/lib/http.ts`, find:
```ts
const SILENT_TOAST_PREFIXES = ['/bot-strategy/'];
```

Replace with:
```ts
const SILENT_TOAST_PREFIXES = ['/bot-strategy/', '/bot/'];
```

- [ ] **Step 4: Run http.test.ts to verify both pass**

Run: `pnpm test -- --run src/lib/http.test.ts`
Expected: all tests pass (previous count + 1).

- [ ] **Step 5: Run the full suite to make sure nothing else broke**

Run: `pnpm test`
Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/lib/http.ts src/lib/http.test.ts
git commit -m "$(cat <<'EOF'
chore(http): silence global toast for /bot/* paths

MyBotsDialog (next commit) renders its own inline error UX for
/bot/list and /bot/{id}/config failures. Prevents double display
that previously hit ExportDialog before /bot-strategy/ was silenced.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Create `bot.api.ts`

Thin wrapper around two HTTP endpoints. No dedicated unit tests — `http()` is already tested, this file is just a type-safe call site.

**Files:**
- Create: `src/features/bot-monitoring/bot.api.ts`

- [ ] **Step 1: Create the file**

Create `src/features/bot-monitoring/bot.api.ts`:

```ts
import { http } from '@/lib/http';
import type { components } from '@/types/api';

export type BotOut = components['schemas']['BotOut'];
export type BotConfigOut = components['schemas']['BotConfigOut'];

export const botApi = {
  list: () => http<BotOut[]>('GET', '/bot/list'),
  getConfig: (id: number) =>
    http<BotConfigOut>('GET', `/bot/${id}/config`),
};
```

- [ ] **Step 2: Run typecheck**

Run: `pnpm typecheck`
Expected: clean. If `components['schemas']['BotOut']` is not found, the OpenAPI types file may need regeneration — but `Data/openapi.json` already contains the schema, so types should already be in `src/types/api.d.ts`. Verify by running `grep -c 'BotOut\|BotConfigOut' src/types/api.d.ts` — both must appear.

- [ ] **Step 3: Commit**

```bash
git add src/features/bot-monitoring/bot.api.ts
git commit -m "$(cat <<'EOF'
feat(bot-monitoring): add bot.api with list + getConfig wrappers

Thin typed wrappers around GET /bot/list and GET /bot/{id}/config,
following the same pattern as auth.api and bot-strategy.api.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Create `my-bots-dialog.store.ts`

Zustand store that toggles the dialog. Mirrors `useExportDialogStore`.

**Files:**
- Create: `src/features/bot-monitoring/my-bots-dialog.store.ts`
- Create: `src/features/bot-monitoring/my-bots-dialog.store.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/features/bot-monitoring/my-bots-dialog.store.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { useMyBotsDialogStore } from './my-bots-dialog.store';

describe('useMyBotsDialogStore', () => {
  beforeEach(() => {
    useMyBotsDialogStore.setState({ open: false });
  });

  it('starts closed', () => {
    expect(useMyBotsDialogStore.getState().open).toBe(false);
  });

  it('setOpen(true) opens the dialog', () => {
    useMyBotsDialogStore.getState().setOpen(true);
    expect(useMyBotsDialogStore.getState().open).toBe(true);
  });

  it('setOpen(false) closes the dialog', () => {
    useMyBotsDialogStore.setState({ open: true });
    useMyBotsDialogStore.getState().setOpen(false);
    expect(useMyBotsDialogStore.getState().open).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail (module not found)**

Run: `pnpm test -- --run src/features/bot-monitoring/my-bots-dialog.store.test.ts`
Expected: FAIL with module-not-found.

- [ ] **Step 3: Create the store**

Create `src/features/bot-monitoring/my-bots-dialog.store.ts`:

```ts
import { create } from 'zustand';

interface MyBotsDialogStore {
  open: boolean;
  setOpen: (open: boolean) => void;
}

export const useMyBotsDialogStore = create<MyBotsDialogStore>((set) => ({
  open: false,
  setOpen: (open) => set({ open }),
}));
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test -- --run src/features/bot-monitoring/my-bots-dialog.store.test.ts`
Expected: 3 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/bot-monitoring/my-bots-dialog.store.ts src/features/bot-monitoring/my-bots-dialog.store.test.ts
git commit -m "$(cat <<'EOF'
feat(bot-monitoring): add my-bots-dialog Zustand store

Open/close toggle, same shape as export-dialog.store. Used by
MyBotsDialog and the header trigger button.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: Create `MyBotsDialog.tsx` (main component)

The biggest task. Implements: fetch on open, skeleton, list, empty, error states, per-card config enrichment, click-to-navigate.

**Files:**
- Create: `src/features/bot-monitoring/MyBotsDialog.tsx`
- Create: `src/features/bot-monitoring/MyBotsDialog.test.tsx`

- [ ] **Step 1: Write the failing tests**

Create `src/features/bot-monitoring/MyBotsDialog.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { MyBotsDialog } from './MyBotsDialog';
import { useMyBotsDialogStore } from './my-bots-dialog.store';

vi.mock('./bot.api', () => ({
  botApi: {
    list: vi.fn(),
    getConfig: vi.fn(),
  },
}));

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>(
    'react-router-dom',
  );
  return { ...actual, useNavigate: () => mockNavigate };
});

import { botApi } from './bot.api';

const mockList = vi.mocked(botApi.list);
const mockGetConfig = vi.mocked(botApi.getConfig);

function openDialog() {
  useMyBotsDialogStore.getState().setOpen(true);
}

function renderDialog() {
  return render(
    <MemoryRouter>
      <MyBotsDialog />
    </MemoryRouter>,
  );
}

describe('MyBotsDialog', () => {
  beforeEach(() => {
    useMyBotsDialogStore.setState({ open: false });
    mockList.mockReset();
    mockGetConfig.mockReset();
    mockNavigate.mockReset();
  });

  afterEach(() => {
    cleanup();
  });

  it('renders nothing when dialog is closed', () => {
    renderDialog();
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('shows skeleton while loading list', () => {
    mockList.mockImplementation(() => new Promise(() => {})); // never resolves
    openDialog();
    renderDialog();
    expect(screen.getAllByTestId('my-bots-skeleton').length).toBeGreaterThan(0);
  });

  it('renders bot cards when list resolves', async () => {
    mockList.mockResolvedValueOnce([
      { id: 80, bot_name: 'Tribot', status: 'stopped', strategy_name: 'TriStrategy', desired_status: null, error_message: null },
    ]);
    mockGetConfig.mockResolvedValueOnce({
      config: { dry_run: true, timeframe: '5m', exchange: { pair_whitelist: ['BTC/USDT:USDT'] } },
    });

    openDialog();
    renderDialog();

    expect(await screen.findByText('Tribot')).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByText('BTC-USDT')).toBeInTheDocument();
    });
    expect(screen.getByText('5m')).toBeInTheDocument();
    expect(screen.getByText('DRY-RUN')).toBeInTheDocument();
  });

  it('renders em-dash placeholders for fields BE does not expose', async () => {
    mockList.mockResolvedValueOnce([
      { id: 1, bot_name: 'X', status: 'stopped', strategy_name: 'S', desired_status: null, error_message: null },
    ]);
    mockGetConfig.mockResolvedValueOnce({
      config: { dry_run: true, timeframe: '5m', exchange: { pair_whitelist: ['BTC/USDT:USDT'] } },
    });

    openDialog();
    renderDialog();

    await screen.findByText('X');
    // 3 stats placeholders (TODAY/WIN/TRADES) + 1 uptime
    const dashes = screen.getAllByText('—');
    expect(dashes.length).toBeGreaterThanOrEqual(4);
  });

  it('renders empty state when list is empty', async () => {
    mockList.mockResolvedValueOnce([]);
    openDialog();
    renderDialog();
    expect(await screen.findByText(/no bots yet/i)).toBeInTheDocument();
  });

  it('navigates to /bots/{id} when a card is clicked', async () => {
    mockList.mockResolvedValueOnce([
      { id: 80, bot_name: 'Tribot', status: 'stopped', strategy_name: 'S', desired_status: null, error_message: null },
    ]);
    mockGetConfig.mockResolvedValueOnce({
      config: { dry_run: true, timeframe: '5m', exchange: { pair_whitelist: ['BTC/USDT:USDT'] } },
    });

    openDialog();
    renderDialog();

    const card = await screen.findByRole('link', { name: /tribot/i });
    fireEvent.click(card);
    expect(mockNavigate).toHaveBeenCalledWith('/bots/80');
    // Closing the dialog on navigation is handled by setOpen(false)
    expect(useMyBotsDialogStore.getState().open).toBe(false);
  });

  it('renders error state + retry button when list fetch fails', async () => {
    const { HttpError } = await import('@/lib/http');
    mockList.mockRejectedValueOnce(new HttpError(500, 'boom'));

    openDialog();
    renderDialog();

    expect(await screen.findByText(/500: boom/i)).toBeInTheDocument();

    // Now make the retry succeed
    mockList.mockResolvedValueOnce([]);
    fireEvent.click(screen.getByRole('button', { name: /retry/i }));

    expect(await screen.findByText(/no bots yet/i)).toBeInTheDocument();
  });

  it('keeps showing the card when per-bot config fetch fails', async () => {
    mockList.mockResolvedValueOnce([
      { id: 80, bot_name: 'Tribot', status: 'stopped', strategy_name: 'S', desired_status: null, error_message: null },
    ]);
    mockGetConfig.mockRejectedValueOnce(new Error('config down'));

    openDialog();
    renderDialog();

    expect(await screen.findByText('Tribot')).toBeInTheDocument();
    // pair/timeframe should fall back to '?' (small grey)
    await waitFor(() => {
      expect(screen.getAllByText('?').length).toBeGreaterThan(0);
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail (component not found)**

Run: `pnpm test -- --run src/features/bot-monitoring/MyBotsDialog.test.tsx`
Expected: FAIL with module-not-found.

- [ ] **Step 3: Implement the component**

Create `src/features/bot-monitoring/MyBotsDialog.tsx`:

```tsx
import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BarChart2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { formatBackendError } from '@/lib/format-error';
import { jsonPairToUi } from '@/lib/pair-format';
import { botApi, type BotOut } from './bot.api';
import { useMyBotsDialogStore } from './my-bots-dialog.store';

interface FreqtradeConfig {
  bot_name?: string;
  dry_run?: boolean;
  timeframe?: string;
  exchange?: { pair_whitelist?: string[] };
}

interface BotRow {
  meta: BotOut;
  config: FreqtradeConfig | null;
  configError: boolean;
}

function StatusBadge({ row }: { row: BotRow }) {
  const errored = !!row.meta.error_message;
  const running = row.meta.status === 'running';
  const label = errored ? 'ERROR' : row.meta.status.toUpperCase();
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold uppercase tracking-wide',
        errored
          ? 'bg-bearish/15 text-bearish'
          : running
            ? 'bg-bullish/15 text-bullish'
            : 'bg-fg-muted/15 text-fg-muted',
      )}
    >
      {label}
    </span>
  );
}

function ModeBadge({ config }: { config: FreqtradeConfig | null }) {
  if (config == null) {
    return <span className="inline-block h-4 w-14 animate-pulse rounded-full bg-fg-muted/15" />;
  }
  const live = config.dry_run === false;
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold uppercase tracking-wide',
        live ? 'bg-bullish/15 text-bullish' : 'bg-brand/15 text-brand',
      )}
    >
      {live ? 'LIVE' : 'DRY-RUN'}
    </span>
  );
}

function Placeholder() {
  return <span className="text-sm font-semibold tabular-nums text-fg-muted">—</span>;
}

function BotCard({ row, onClick }: { row: BotRow; onClick: () => void }) {
  const pairRaw = row.config?.exchange?.pair_whitelist?.[0];
  const pair = pairRaw ? jsonPairToUi(pairRaw) : row.configError ? '?' : null;
  const timeframe = row.config?.timeframe ?? (row.configError ? '?' : null);
  const name = row.meta.bot_name ?? `Bot #${row.meta.id}`;

  return (
    <div
      role="link"
      tabIndex={0}
      aria-label={name}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick();
        }
      }}
      className={cn(
        'flex flex-col gap-3 rounded-xl border border-border-subtle bg-surface p-4 cursor-pointer',
        'transition-all hover:border-border-default hover:bg-surface-hover',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand',
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className="flex-shrink-0 rounded-lg bg-brand/10 p-1.5">
            <BarChart2 className="h-4 w-4 text-brand" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-fg truncate">{name}</p>
            <p className="text-xs text-fg-muted">
              {pair == null ? (
                <span className="inline-block h-3 w-16 animate-pulse rounded bg-fg-muted/15" />
              ) : (
                <code className="text-fg-secondary">{pair}</code>
              )}
              <span className="mx-1.5 text-border-strong">·</span>
              {timeframe == null ? (
                <span className="inline-block h-3 w-8 animate-pulse rounded bg-fg-muted/15" />
              ) : (
                timeframe
              )}
            </p>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1">
          <ModeBadge config={row.config} />
          <StatusBadge row={row} />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 rounded-lg border border-border-subtle bg-canvas px-3 py-2">
        <div className="flex flex-col gap-0.5">
          <span className="text-2xs uppercase tracking-wider text-fg-muted">Today</span>
          <Placeholder />
        </div>
        <div className="flex flex-col gap-0.5">
          <span className="text-2xs uppercase tracking-wider text-fg-muted">Win</span>
          <Placeholder />
        </div>
        <div className="flex flex-col gap-0.5">
          <span className="text-2xs uppercase tracking-wider text-fg-muted">Trades</span>
          <Placeholder />
        </div>
      </div>

      <div className="flex items-center justify-between">
        <span className="text-xs text-fg-muted">—</span>
        <span className="text-xs font-semibold text-brand">Monitor →</span>
      </div>
    </div>
  );
}

function Skeleton() {
  return (
    <div
      data-testid="my-bots-skeleton"
      className="h-44 animate-pulse rounded-xl border border-border-subtle bg-surface"
    />
  );
}

function EmptyState({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate();
  return (
    <div className="flex items-center justify-center py-10">
      <div className="rounded-xl border border-border-subtle bg-surface p-10 flex flex-col items-center gap-4 text-center max-w-sm">
        <div className="rounded-full bg-brand/10 p-4">
          <BarChart2 className="h-8 w-8 text-brand" />
        </div>
        <div>
          <p className="text-base font-semibold text-fg">No bots yet</p>
          <p className="mt-1 text-sm text-fg-muted">
            Build your first strategy to start automating your trades.
          </p>
        </div>
        <Button
          onClick={() => {
            onClose();
            navigate('/builder');
          }}
        >
          Build your first strategy →
        </Button>
      </div>
    </div>
  );
}

export function MyBotsDialog() {
  const open = useMyBotsDialogStore((s) => s.open);
  const setOpen = useMyBotsDialogStore((s) => s.setOpen);
  const navigate = useNavigate();
  const [rows, setRows] = useState<BotRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchBots = useCallback(async () => {
    setRows(null);
    setError(null);
    try {
      const bots = await botApi.list();
      const seeded: BotRow[] = bots.map((b) => ({
        meta: b,
        config: null,
        configError: false,
      }));
      setRows(seeded);
      const enriched = await Promise.all(
        bots.map(async (b): Promise<BotRow> => {
          try {
            const res = await botApi.getConfig(b.id);
            return { meta: b, config: res.config as FreqtradeConfig, configError: false };
          } catch {
            return { meta: b, config: null, configError: true };
          }
        }),
      );
      setRows(enriched);
    } catch (err) {
      setError(formatBackendError(err));
      setRows(null);
    }
  }, []);

  useEffect(() => {
    if (open) fetchBots();
  }, [open, fetchBots]);

  function handleCardClick(id: number) {
    setOpen(false);
    navigate(`/bots/${id}`);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>My Bots</DialogTitle>
          <DialogDescription>
            All bots in your account. Click a card to open its monitor.
          </DialogDescription>
        </DialogHeader>

        {error ? (
          <div className="flex flex-col gap-3 rounded-lg border border-danger/40 bg-bearish-subtle p-4">
            <pre className="whitespace-pre-wrap font-mono text-xs text-bearish">{error}</pre>
            <Button variant="secondary" onClick={fetchBots} className="self-start">
              Retry
            </Button>
          </div>
        ) : rows == null ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <EmptyState onClose={() => setOpen(false)} />
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 max-h-[60vh] overflow-y-auto">
            {rows.map((r) => (
              <BotCard key={r.meta.id} row={r} onClick={() => handleCardClick(r.meta.id)} />
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 4: Run tests**

Run: `pnpm test -- --run src/features/bot-monitoring/MyBotsDialog.test.tsx`
Expected: 8 tests PASS. If any fail, read the diff carefully — common causes: text matchers (`/no bots yet/i` requires the literal text "No bots yet"), waitFor timeouts, missing `aria-label`.

- [ ] **Step 5: Run typecheck**

Run: `pnpm typecheck`
Expected: clean.

- [ ] **Step 6: Commit**

```bash
git add src/features/bot-monitoring/MyBotsDialog.tsx src/features/bot-monitoring/MyBotsDialog.test.tsx
git commit -m "$(cat <<'EOF'
feat(bot-monitoring): add MyBotsDialog component

Dialog that fetches /bot/list + per-bot /bot/{id}/config, renders
real fields (name, pair, timeframe, mode, status) and em-dash
placeholders for fields BE doesn't expose yet (PnL, win rate,
trades, uptime). Click → navigate /bots/{id}. Per-spec rev 2.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: Wire `MyBotsDialog` into HeaderToolbar

Replace the hard-coded Monitor button with a "My Bots" button that opens the new dialog. Mount the dialog at the toolbar's render root.

**Files:**
- Modify: `src/features/bot-builder/components/HeaderToolbar.tsx`

- [ ] **Step 1: Read the current Monitor button block + dialog mount points**

Run: `grep -n "bots/bot-1\|setExportOpen\|ExportDialog\|TemplatesDialog" src/features/bot-builder/components/HeaderToolbar.tsx`
Expected output includes:
- Line ~276: `onClick={() => navigate('/bots/bot-1')}` (Monitor button)
- Line ~336: `<ExportDialog open={exportOpen} onOpenChange={setExportOpen} />`

These two locations bracket the changes.

- [ ] **Step 2: Add imports**

Open `src/features/bot-builder/components/HeaderToolbar.tsx`. Find the `ExportDialog` import line (around line 24):

```ts
import { ExportDialog } from '@/features/export-import/ExportDialog';
import { useExportDialogStore } from '@/features/export-import/export-dialog.store';
```

Add immediately after:
```ts
import { MyBotsDialog } from '@/features/bot-monitoring/MyBotsDialog';
import { useMyBotsDialogStore } from '@/features/bot-monitoring/my-bots-dialog.store';
```

- [ ] **Step 3: Wire the store accessor**

Find the `useExportDialogStore` usage block (around line 56-57):
```ts
const exportOpen = useExportDialogStore((s) => s.open);
const setExportOpen = useExportDialogStore((s) => s.setOpen);
```

Add immediately after:
```ts
const setMyBotsOpen = useMyBotsDialogStore((s) => s.setOpen);
```

- [ ] **Step 4: Replace the Monitor button block with My Bots button block**

In `src/features/bot-builder/components/HeaderToolbar.tsx`, find lines 269-289 — the full Tooltip wrapping the Monitor button:

```tsx
          <Tooltip>
            <TooltipTrigger asChild>
              <span>
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={!canExport}
                  onClick={() => navigate('/bots/bot-1')}
                  className="rounded-full px-3"
                >
                  <Activity className="h-3.5 w-3.5" />
                  Monitor
                </Button>
              </span>
            </TooltipTrigger>
            <TooltipContent>
              {canExport
                ? 'View live monitoring dashboard'
                : 'Fix issues before monitoring'}
            </TooltipContent>
          </Tooltip>
```

Replace verbatim with:

```tsx
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setMyBotsOpen(true)}
                className="rounded-full px-3"
              >
                <List className="h-3.5 w-3.5" />
                My Bots
              </Button>
            </TooltipTrigger>
            <TooltipContent>Browse and monitor all your bots.</TooltipContent>
          </Tooltip>
```

Notes on intentional differences from the old block:
- No `disabled={!canExport}` — listing bots in your account is independent of the builder's validity.
- No wrapping `<span>` — the span was a Radix workaround for disabled `<Button>` inside `<TooltipTrigger>`. Not needed without `disabled`.

- [ ] **Step 4b: Update lucide-react imports**

Find the import block at the top of the file:
```ts
import {
  Activity,
  BookOpen,
  Download,
  Eye,
  EyeOff,
  FlaskConical,
  LogOut,
  Pencil,
  Upload,
  User,
} from 'lucide-react';
```

Remove `Activity` (no other usage in this file — verify with `grep -n "Activity" src/features/bot-builder/components/HeaderToolbar.tsx`; if the grep finds another use, keep `Activity`). Add `List` alphabetically:

```ts
import {
  BookOpen,
  Download,
  Eye,
  EyeOff,
  FlaskConical,
  List,
  LogOut,
  Pencil,
  Upload,
  User,
} from 'lucide-react';
```

- [ ] **Step 5: Mount the dialog next to ExportDialog**

At line ~336-337 the file currently has:
```tsx
      <ExportDialog open={exportOpen} onOpenChange={setExportOpen} />
      <ImportDialog open={importOpen} onOpenChange={setImportOpen} />
    </header>
```

Add `<MyBotsDialog />` right after the two existing dialogs:
```tsx
      <ExportDialog open={exportOpen} onOpenChange={setExportOpen} />
      <ImportDialog open={importOpen} onOpenChange={setImportOpen} />
      <MyBotsDialog />
    </header>
```

(MyBotsDialog reads its `open` from its own Zustand store — no props needed.)

- [ ] **Step 6: Run typecheck + lint**

Run: `pnpm typecheck && pnpm lint`
Expected: clean (only the pre-existing `button.tsx` warning).

- [ ] **Step 7: Smoke-check in browser preview**

Run the dev server:
```bash
pnpm dev
```
Open http://127.0.0.1:5173/login, log in with `trinm@coin98.finance / Coin98@123`, then on `/builder`:
1. The old "Monitor" button is gone.
2. A new "My Bots" button is visible in the toolbar.
3. Click it → dialog opens → after ~1s, shows the bots (Tribottestaaa appears with status "stopped").
4. Click a card → dialog closes, URL changes to `/bots/<id>`, monitor page renders.

Expected: all 4 work. Note any visual issues to address in Task 8 if needed.

- [ ] **Step 8: Run full test suite (some existing HeaderToolbar tests may need updates)**

Run: `pnpm test`
Expected: all tests pass. If HeaderToolbar has a test that asserts the Monitor button text or its `/bots/bot-1` navigation, update that test to assert the My Bots button instead. Check by running: `grep -l "bots/bot-1\|Monitor" src/features/bot-builder/components/*.test.*` — if any matches, update.

- [ ] **Step 9: Commit**

```bash
git add src/features/bot-builder/components/HeaderToolbar.tsx
git commit -m "$(cat <<'EOF'
feat(builder): replace hard-coded Monitor button with My Bots dialog

Removes the placeholder /bots/bot-1 nav. Adds a real entry point
that opens MyBotsDialog from the Zustand store.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: Remove `/bots` route and delete `BotsListPage`

The page is no longer reachable. Clean up.

**Files:**
- Modify: `src/routes.tsx`
- Delete: `src/features/bot-monitoring/BotsListPage.tsx`

- [ ] **Step 1: Verify nothing else imports `BotsListPage`**

Run: `grep -rn "BotsListPage" src/ --exclude-dir=node_modules`
Expected: matches in only `src/routes.tsx` (import + JSX). If anything else references it, stop and investigate.

- [ ] **Step 2: Remove the route**

Open `src/routes.tsx`. Find:
```ts
import { BotsListPage } from './features/bot-monitoring/BotsListPage';
```
Delete that line.

Then find the `/bots` route block:
```ts
{
  path: '/bots',
  element: (
    <ProtectedRoute>
      <BotsListPage />
    </ProtectedRoute>
  ),
},
```
Delete the entire object (including the trailing comma).

Keep `/bots/:id` route untouched.

- [ ] **Step 3: Delete the page file**

```bash
git rm src/features/bot-monitoring/BotsListPage.tsx
```

- [ ] **Step 4: Run typecheck + tests**

Run: `pnpm typecheck && pnpm test`
Expected: clean. If anything broke, it's a forgotten reference — `grep` again.

- [ ] **Step 5: Commit**

```bash
git add src/routes.tsx
git commit -m "$(cat <<'EOF'
chore(routes): remove /bots route and BotsListPage

Replaced by MyBotsDialog. The standalone page is no longer
reachable and gets deleted in this commit.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 8: End-to-end browser verification

Final smoke test against real BE to confirm the dialog renders real data.

**Files:** none modified unless an issue is found.

- [ ] **Step 1: Start dev server**

Run: `pnpm dev`

- [ ] **Step 2: Manual flow (or scripted via preview tools if executing in an agent)**

1. Navigate to http://127.0.0.1:5173/login
2. Log in: `trinm@coin98.finance` / `Coin98@123`
3. Land on `/builder`
4. Confirm: "Monitor" button is GONE, "My Bots" button is present.
5. Click "My Bots".
6. Confirm: skeleton appears, then 2 cards (assuming bots 79 + 80 still exist from earlier testing — adjust expectation if Tri's account has different bots).
7. Each card shows real values for: name, pair (e.g. `BTC-USDC`), timeframe, mode badge, status badge.
8. Each card shows `—` for: TODAY, WIN, TRADES, uptime.
9. Click a card → dialog closes, URL becomes `/bots/<id>`, monitor page renders (it will still be mock data, that's expected).
10. Back-navigate, re-open My Bots. Confirm fetch refires (skeleton shows again briefly).

- [ ] **Step 3: Verify Network tab**

In DevTools → Network → Fetch/XHR:
- 1× `GET /api/bot/list` → 200, list of bots.
- N× `GET /api/bot/{id}/config` → 200 each (where N = number of bots).
- No 4xx/5xx unless a bot config truly fails (in which case the card shows `?` for pair/timeframe).

- [ ] **Step 4: Toast check**

If any `/bot/*` request fails (force it by stopping BE or hand-editing a request), confirm:
- NO global toast fires.
- The dialog shows an inline error region (for list fail) OR keeps the card with `?` (for config fail).

- [ ] **Step 5: If everything passes, no commit needed (Tasks 1-7 already committed).**

If a tweak was required during smoke test, commit that tweak with a descriptive message.

---

## Follow-up actions after this plan ships

After the last task is committed, Tri (or the implementer) should file these as BE tickets to Tuấn (tracked in CLAUDE.md §12 contacts):

1. **Enrich `GET /bot/list`** response with `pair` (raw), `timeframe`, `dry_run`, `created_at`. Removes the N+1 config fetch from FE.
2. **Add `GET /bot/{id}/performance`** returning `{ today_pnl, total_pnl, total_trades, wins, losses, win_rate }`. Powers the TODAY/WIN/TRADES placeholders.
3. **Expose `created_at`** on `BotOut` (covered by #1 if Tuấn agrees). Powers the "Running 12d 4h" uptime placeholder.

When each ticket ships, FE work is:
- (#1) Drop the `Promise.all(getConfig)` block in `MyBotsDialog.tsx`. Read pair/timeframe/dry_run directly from the list response.
- (#2 + #3) Plug values into the existing card placeholders. Remove the `Placeholder` component.

---

## Out of scope (do NOT do in this plan)

These appear tempting but belong to future iterations:
- Wire `BotMonitoringPage` to real BE data.
- Add Start/Stop buttons to bot cards.
- Add `DELETE /bot/{id}` from the dialog.
- Auto-refresh the list on a timer / WebSocket.
- Deep-link via URL hash (`/builder#my-bots`).
- Show `error_message` text on cards (only the status badge color changes for now).

If the implementer notices an unrelated bug while in these files, file a separate task via the mcp `spawn_task` mechanism rather than bundling.
