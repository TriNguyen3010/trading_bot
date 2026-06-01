# Launchpad + Dry-run Launch Implementation Plan (Phase 2a)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

> **⚠️ Phase 2 SPLIT (2026-05-28):** Plan này gốc bao cả Live path, nhưng Live trên Hyperliquid cần **agent wallet flow** (POST `/agent/create` → EIP-712 sign → POST `/agent/confirm`) — đây là requirement mới khi openapi 2026-05-28 thêm 15 endpoint `/agent/*`. Live + agent flow đã tách ra **Phase 2b** (`docs/superpowers/plans/2026-05-28-phase-2b-launchpad-live-agent.md`). Plan **này (2a)** chỉ build Launchpad hub + dry-run launch + backtest bridge + post-create UX. Card Live trong Modal render **disabled** với label "Live (Phase 2b)" cho tới khi 2b ship.

**Goal:** Cho user "phóng" 1 bot đã tạo từ một **Launchpad hub** (modal 3-mode): Backtest / Dry-run / Live — Backtest mở `BacktestDialog`, Dry-run chạy thẳng (PATCH `dry_run=true` + `botApi.start`), Live disabled defer Phase 2b. Sau khi tạo bot xong, mở thẳng Launchpad thay vì nhảy vào trang monitor.

**Architecture:** Feature mới `src/features/launchpad/` gồm: `launch-actions.ts` (orchestrate PATCH `dry_run=true` + `botApi.start` cho dry-run path) và `LaunchpadModal.tsx` (modal 2-step: `modes` → `live-confirm` placeholder). Launchpad mở từ Dashboard khi click bot **chưa chạy** (PAUSED/ERROR) — bot đang chạy (LIVE/DRY-RUN) vẫn vào monitor như cũ. Card Backtest cầu nối sang `BacktestDialog` (Phase 3). Dry-run launch xong → điều hướng `/bots/:id`. Live card → defer (Phase 2b). **Lean scope:** monitor giàu dữ liệu và tier/paywall **không** thuộc plan này (Phase 4 / Phase 5).

**Tech Stack:** React 18, TypeScript 5.7, Radix Dialog, Tailwind 3, Sonner, React Router 7 (`useNavigate`/`useLocation`), Vitest + @testing-library/react. API qua `src/lib/http.ts`.

**Prerequisites (build order 1 → 3 → 2):**

- **Phase 1** (`docs/superpowers/plans/2026-05-21-bot-lifecycle.md`): cần `botApi.start(id)`, `botApi.sync(id)` → `BotStatusOut`, export từ `src/features/bot-monitoring/bot.api.ts`.
- **Phase 3** (`docs/superpowers/plans/2026-05-27-backtest.md`): cần `BacktestDialog` + `BacktestBot`, và field `DashboardBot.strategyName` (thêm ở Phase 3 Task 6).

**Scope / Non-goals:**

- ✅ In: Launchpad hub (3-card layout), dry-run launch (PATCH dry_run=true + start), backtest bridge → `BacktestDialog`, error-bot Sync button, post-create → Launchpad UX rework.
- ❌ Out: **Live launch path** + **agent wallet flow** → Phase 2b. Live card render **disabled** với label "Live — Phase 2b" và disable click. Live-confirm step skip viết trong Phase 2a (Phase 2b sẽ thêm).
- ❌ Out: tier caps / paywall / billing (Phase 5); rich dry-run/live monitor data (Phase 4 — sau launch chỉ vào `/bots/:id` hiện có); "Edit recipe / Duplicate / Delete" trong Launchpad footer (chỉ render disabled/ẩn).

---

## Background — cơ chế dry-run vs live (đã verify)

- Dry-run vs Live **không** phải 2 flow riêng ở BE — chỉ là cờ boolean `dry_run` trong config + `start/stop`.
- `UnifiedBotStrategyUpdate` cho phép PATCH **partial** (mọi field optional) → gửi `{ dry_run: false }` là hợp lệ. Endpoint: `PATCH /bot-strategy/{bot_id}` → `BotStrategyOut`.
- Launch logic: **PATCH `dry_run` cho khớp mode → rồi `POST /bot/{id}/start`** (PATCH idempotent, an toàn kể cả khi cờ đã đúng).
- Bot mới tạo có `status` không-`running` → `deriveMode` trả `PAUSED` → đủ điều kiện mở Launchpad.

**Reference:** `src/features/export-import/ExportDialog.tsx` (pattern Radix dialog + toast + `formatBackendError`), `src/features/bot-builder/bot-strategy.api.ts`, `src/features/bot-monitoring/bot.api.ts` (Phase 1), `src/features/backtest/BacktestDialog.tsx` (Phase 3).

---

## File Structure

**New files (4):**

| Path                                             | Responsibility                                   |
| ------------------------------------------------ | ------------------------------------------------ |
| `src/features/launchpad/launch-actions.ts`       | `launchBot(botId, mode)` — PATCH dry_run + start |
| `src/features/launchpad/launch-actions.test.ts`  | Unit test (mock both apis)                       |
| `src/features/launchpad/LaunchpadModal.tsx`      | Modal hub: modes → live-confirm                  |
| `src/features/launchpad/LaunchpadModal.test.tsx` | Component test                                   |

**Modified files (4):**

| Path                                                     | Change                                                                                                      |
| -------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `src/features/bot-builder/bot-strategy.api.ts`           | Add `update(botId, payload)` → PATCH `/bot-strategy/{id}`                                                   |
| `src/pages/DashboardPage.tsx`                            | Route non-running cards + **Start button** → Launchpad; mount `LaunchpadModal`; consume `launchpadBotId`    |
| `src/features/export-import/ExportDialog.tsx`            | Post-create: navigate `/dashboard` + `state.launchpadBotId` thay vì `/bots/:id`                             |
| `src/features/bot-monitoring/BotMonitoringPage.tsx`      | **Stopped Start handler** routes through Dashboard Launchpad (close direct-`botApi.start` bypass — Task 5b) |
| `src/features/bot-monitoring/BotMonitoringPage.test.tsx` | New regression test: stopped Start does NOT call `botApi.start` directly (Task 5b)                          |

---

## Task 1: `botStrategyApi.update` (PATCH dry_run)

**Files:**

- Modify: `src/features/bot-builder/bot-strategy.api.ts`
- Test: `src/features/bot-builder/bot-strategy.api.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/features/bot-builder/bot-strategy.api.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { http } from '@/lib/http';
import { botStrategyApi } from './bot-strategy.api';

vi.mock('@/lib/http', () => ({ http: vi.fn() }));
const mockHttp = vi.mocked(http);
beforeEach(() => mockHttp.mockReset());

describe('botStrategyApi.update', () => {
  it('PATCHes /bot-strategy/:id with the partial payload', async () => {
    mockHttp.mockResolvedValue({ bot: { id: 42 }, strategy: {} });
    await botStrategyApi.update(42, { dry_run: false });
    expect(mockHttp).toHaveBeenCalledWith('PATCH', '/bot-strategy/42', {
      dry_run: false,
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test bot-strategy.api`
Expected: FAIL — `botStrategyApi.update is not a function`.

- [ ] **Step 3: Add the method**

Edit `src/features/bot-builder/bot-strategy.api.ts` to:

```ts
import type {
  CreatePayload,
  UpdatePayload,
  BotStrategyResponse,
} from '@/types/api-helpers';
import { http } from '@/lib/http';

export const botStrategyApi = {
  create: (payload: CreatePayload) =>
    http<BotStrategyResponse>('POST', '/bot-strategy/create', payload),

  /** Partial update — used by Launchpad to flip `dry_run` before start. */
  update: (botId: number, payload: UpdatePayload) =>
    http<BotStrategyResponse>('PATCH', `/bot-strategy/${botId}`, payload),
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test bot-strategy.api`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/bot-builder/bot-strategy.api.ts src/features/bot-builder/bot-strategy.api.test.ts
git commit -m "feat(launchpad): botStrategyApi.update for dry_run flip"
```

---

## Task 2: `launch-actions.ts` — launchBot orchestration

**Files:**

- Create: `src/features/launchpad/launch-actions.ts`
- Test: `src/features/launchpad/launch-actions.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/features/launchpad/launch-actions.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { botStrategyApi } from '@/features/bot-builder/bot-strategy.api';
import { botApi } from '@/features/bot-monitoring/bot.api';
import { launchBot } from './launch-actions';

vi.mock('@/features/bot-builder/bot-strategy.api', () => ({
  botStrategyApi: { update: vi.fn() },
}));
vi.mock('@/features/bot-monitoring/bot.api', () => ({
  botApi: { start: vi.fn() },
}));
const mockUpdate = vi.mocked(botStrategyApi.update);
const mockStart = vi.mocked(botApi.start);

beforeEach(() => {
  mockUpdate
    .mockReset()
    .mockResolvedValue({ bot: { id: 42 }, strategy: {} } as never);
  mockStart.mockReset().mockResolvedValue({
    id: 42,
    status: 'starting',
    is_process_running: false,
  } as never);
});

describe('launchBot', () => {
  it('dry-run → PATCH dry_run=true then start', async () => {
    await launchBot(42, 'dry-run');
    expect(mockUpdate).toHaveBeenCalledWith(42, { dry_run: true });
    expect(mockStart).toHaveBeenCalledWith(42);
  });

  it('live → PATCH dry_run=false then start', async () => {
    await launchBot(42, 'live');
    expect(mockUpdate).toHaveBeenCalledWith(42, { dry_run: false });
    expect(mockStart).toHaveBeenCalledWith(42);
  });

  it('does not start if the dry_run patch fails', async () => {
    mockUpdate.mockRejectedValueOnce(new Error('patch failed'));
    await expect(launchBot(42, 'live')).rejects.toThrow('patch failed');
    expect(mockStart).not.toHaveBeenCalled();
  });

  it('returns the BotStatusOut from start', async () => {
    const res = await launchBot(42, 'dry-run');
    expect(res.status).toBe('starting');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test launch-actions`
Expected: FAIL — module not found.

- [ ] **Step 3: Write minimal implementation**

Create `src/features/launchpad/launch-actions.ts`:

```ts
import { botStrategyApi } from '@/features/bot-builder/bot-strategy.api';
import { botApi, type BotStatusOut } from '@/features/bot-monitoring/bot.api';

export type LaunchMode = 'dry-run' | 'live';

/** Align the bot's `dry_run` flag with the desired mode, then start it.
 * dry-run → dry_run=true, live → dry_run=false. PATCH is idempotent, so this
 * is safe even when the flag is already correct. Start only runs if PATCH
 * succeeds. */
export async function launchBot(
  botId: number,
  mode: LaunchMode,
): Promise<BotStatusOut> {
  await botStrategyApi.update(botId, { dry_run: mode === 'dry-run' });
  return botApi.start(botId);
}
```

> Note: `BotStatusOut` is exported by `bot.api.ts` in Phase 1. If typecheck reports it missing, Phase 1 Task 1 hasn't been merged — that is the documented prerequisite.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test launch-actions`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/features/launchpad/launch-actions.ts src/features/launchpad/launch-actions.test.ts
git commit -m "feat(launchpad): launchBot (patch dry_run + start)"
```

---

## Task 3: `LaunchpadModal` component

**Files:**

- Create: `src/features/launchpad/LaunchpadModal.tsx`
- Test: `src/features/launchpad/LaunchpadModal.test.tsx`

**Component contract:**

```ts
export interface LaunchpadBot {
  id: number;
  name: string;
  strategyName: string | null;
  pair: string;
  timeframe: string;
  mode: 'LIVE' | 'DRY-RUN' | 'PAUSED' | 'ERROR';
  errorMsg: string | null;
}
export interface LaunchpadModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bot: LaunchpadBot | null;
  onBacktest: () => void; // close launchpad, open BacktestDialog (Dashboard owns it)
  onLaunched: () => void; // launch succeeded → Dashboard navigates to /bots/:id
}
```

- [ ] **Step 1: Write the failing test**

Create `src/features/launchpad/LaunchpadModal.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { LaunchpadModal, type LaunchpadBot } from './LaunchpadModal';
import { launchBot } from './launch-actions';

vi.mock('./launch-actions', () => ({ launchBot: vi.fn() }));
vi.mock('@/features/bot-monitoring/bot.api', () => ({
  botApi: { sync: vi.fn() },
}));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const mockLaunch = vi.mocked(launchBot);

const bot: LaunchpadBot = {
  id: 42,
  name: 'Bollinger breakout',
  strategyName: 'BollingerBreakout',
  pair: 'BTC/USDT',
  timeframe: '5m',
  mode: 'PAUSED',
  errorMsg: null,
};

beforeEach(() => {
  mockLaunch
    .mockReset()
    .mockResolvedValue({ id: 42, status: 'starting' } as never);
});

describe('LaunchpadModal', () => {
  it('renders 3 mode cards + bot name', () => {
    render(
      <LaunchpadModal
        open
        bot={bot}
        onOpenChange={() => {}}
        onBacktest={() => {}}
        onLaunched={() => {}}
      />,
    );
    expect(screen.getByText('Bollinger breakout')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /run backtest/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /start dry-run/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /go live/i }),
    ).toBeInTheDocument();
  });

  it('dry-run launches immediately and calls onLaunched', async () => {
    const onLaunched = vi.fn();
    render(
      <LaunchpadModal
        open
        bot={bot}
        onOpenChange={() => {}}
        onBacktest={() => {}}
        onLaunched={onLaunched}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /start dry-run/i }));
    await waitFor(() => expect(mockLaunch).toHaveBeenCalledWith(42, 'dry-run'));
    await waitFor(() => expect(onLaunched).toHaveBeenCalled());
  });

  it('live goes through a confirm step before launching', async () => {
    const onLaunched = vi.fn();
    render(
      <LaunchpadModal
        open
        bot={bot}
        onOpenChange={() => {}}
        onBacktest={() => {}}
        onLaunched={onLaunched}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /go live/i }));
    // confirm step shown, not launched yet
    expect(mockLaunch).not.toHaveBeenCalled();
    expect(screen.getByText(/real money/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /yes, deploy live/i }));
    await waitFor(() => expect(mockLaunch).toHaveBeenCalledWith(42, 'live'));
    await waitFor(() => expect(onLaunched).toHaveBeenCalled());
  });

  it('backtest card delegates to onBacktest', () => {
    const onBacktest = vi.fn();
    render(
      <LaunchpadModal
        open
        bot={bot}
        onOpenChange={() => {}}
        onBacktest={onBacktest}
        onLaunched={() => {}}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /run backtest/i }));
    expect(onBacktest).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test LaunchpadModal`
Expected: FAIL — module not found.

- [ ] **Step 3: Write minimal implementation**

Create `src/features/launchpad/LaunchpadModal.tsx`:

```tsx
import { useEffect, useState } from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import {
  AlertTriangle,
  ArrowLeft,
  ChartLine,
  Loader2,
  Play,
  Rocket,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { formatBackendError } from '@/lib/format-error';
import { botApi } from '@/features/bot-monitoring/bot.api';
import { launchBot, type LaunchMode } from './launch-actions';

export interface LaunchpadBot {
  id: number;
  name: string;
  strategyName: string | null;
  pair: string;
  timeframe: string;
  mode: 'LIVE' | 'DRY-RUN' | 'PAUSED' | 'ERROR';
  errorMsg: string | null;
}

export interface LaunchpadModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bot: LaunchpadBot | null;
  onBacktest: () => void;
  onLaunched: () => void;
}

type Step = 'modes' | 'live-confirm';

export function LaunchpadModal({
  open,
  onOpenChange,
  bot,
  onBacktest,
  onLaunched,
}: LaunchpadModalProps) {
  const [step, setStep] = useState<Step>('modes');
  const [busy, setBusy] = useState<LaunchMode | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setStep('modes');
      setBusy(null);
      setError(null);
    }
  }, [open]);

  if (!bot) return null;

  const doLaunch = async (mode: LaunchMode) => {
    setBusy(mode);
    setError(null);
    try {
      await launchBot(bot.id, mode);
      toast.success(
        `Bot #${bot.id} "${bot.name}" đang khởi động (${mode === 'live' ? 'LIVE' : 'dry-run'})`,
      );
      onOpenChange(false);
      onLaunched();
    } catch (err) {
      setError(formatBackendError(err));
    } finally {
      setBusy(null);
    }
  };

  const doSync = async () => {
    try {
      await botApi.sync(bot.id);
      toast.success('Đã đồng bộ trạng thái bot.');
      onOpenChange(false);
    } catch (err) {
      setError(formatBackendError(err));
    }
  };

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-40 bg-black/60 backdrop-blur-md data-[state=open]:animate-fade-in" />
        <DialogPrimitive.Content
          aria-describedby={undefined}
          className="fixed left-1/2 top-1/2 z-50 w-[920px] max-w-[calc(100vw-32px)] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-3xl border border-border bg-surface-elevated shadow-lg data-[state=open]:animate-fade-in"
        >
          {/* Top bar */}
          <div className="flex items-center justify-between border-b border-border-subtle px-6 py-3">
            {step === 'live-confirm' ? (
              <button
                type="button"
                onClick={() => setStep('modes')}
                className="inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-xs text-fg-muted hover:bg-surface-hover hover:text-fg"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Back to modes
              </button>
            ) : (
              <div />
            )}
            <DialogPrimitive.Close
              className="inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-xs text-fg-muted hover:bg-surface-hover hover:text-fg"
              aria-label="Back to dashboard"
            >
              <X className="h-3.5 w-3.5" />
              Back to dashboard
            </DialogPrimitive.Close>
          </div>

          <div className="px-7 py-6">
            {error && (
              <div className="mb-5 rounded-lg border border-bearish/40 bg-bearish-subtle p-3 text-xs text-bearish">
                {error}
              </div>
            )}

            {step === 'modes' && (
              <>
                {bot.mode === 'ERROR' && bot.errorMsg && (
                  <div className="mb-6 flex items-center gap-3 rounded-2xl border border-bearish/40 bg-bearish-subtle px-5 py-3">
                    <AlertTriangle className="h-4 w-4 flex-shrink-0 text-bearish" />
                    <div className="flex-1 text-sm">
                      <span className="font-semibold text-bearish">
                        Last run failed.
                      </span>{' '}
                      <span className="text-fg-secondary">{bot.errorMsg}</span>
                    </div>
                    <Button variant="secondary" size="sm" onClick={doSync}>
                      Sync
                    </Button>
                  </div>
                )}

                <div className="mb-7">
                  <div className="mb-1.5 font-mono text-2xs uppercase tracking-wider text-fg-muted">
                    Bot #{bot.id} · {bot.pair} · {bot.timeframe}
                  </div>
                  <DialogPrimitive.Title className="text-2xl font-bold leading-tight text-fg">
                    Launch <span className="text-brand">{bot.name}</span>
                  </DialogPrimitive.Title>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <ModeCard
                    icon={<ChartLine className="h-5 w-5" />}
                    title="Backtest"
                    desc="Test on past data · no risk"
                    cta="Run backtest"
                    onClick={() => {
                      onOpenChange(false);
                      onBacktest();
                    }}
                  />
                  <ModeCard
                    icon={<Play className="h-5 w-5" />}
                    title="Dry-run"
                    desc="Paper trade live market · sim wallet"
                    cta="Start dry-run"
                    tone="recommended"
                    busy={busy === 'dry-run'}
                    onClick={() => doLaunch('dry-run')}
                  />
                  <ModeCard
                    icon={<Rocket className="h-5 w-5" />}
                    title="Live"
                    desc="Real money on Hyperliquid"
                    cta="Go live"
                    tone="danger"
                    onClick={() => setStep('live-confirm')}
                  />
                </div>
              </>
            )}

            {step === 'live-confirm' && (
              <div>
                <div className="mb-6">
                  <div className="mb-2 text-2xs font-semibold uppercase tracking-wider text-bearish">
                    Confirm live deployment
                  </div>
                  <h2 className="max-w-[640px] text-2xl font-bold leading-tight text-fg">
                    Deploy <span className="text-brand">{bot.name}</span> với{' '}
                    <span className="text-bearish">real money</span>?
                  </h2>
                  <p className="mt-2 max-w-[560px] text-sm text-fg-secondary">
                    Bot sẽ đặt lệnh thật trên Hyperliquid. Lỗ có thể vượt vốn.
                    Hãy chắc bạn đã backtest &amp; dry-run kỹ.
                  </p>
                </div>
                <div className="flex items-center justify-end gap-2 border-t border-border-subtle pt-5">
                  <Button
                    variant="ghost"
                    size="md"
                    onClick={() => setStep('modes')}
                  >
                    <ArrowLeft className="h-3.5 w-3.5" />
                    Back
                  </Button>
                  <Button
                    variant="destructive"
                    size="md"
                    disabled={busy === 'live'}
                    onClick={() => doLaunch('live')}
                  >
                    {busy === 'live' ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Rocket className="h-4 w-4" />
                    )}
                    Yes, deploy live
                  </Button>
                </div>
              </div>
            )}
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

function ModeCard({
  icon,
  title,
  desc,
  cta,
  onClick,
  tone = 'neutral',
  busy = false,
}: {
  icon: React.ReactNode;
  title: string;
  desc: string;
  cta: string;
  onClick: () => void;
  tone?: 'neutral' | 'recommended' | 'danger';
  busy?: boolean;
}) {
  const ring =
    tone === 'recommended'
      ? 'border-brand/50'
      : tone === 'danger'
        ? 'border-bearish/40'
        : 'border-border';
  return (
    <div
      className={`flex flex-col rounded-2xl border ${ring} bg-surface/40 p-5`}
    >
      <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-brand-subtle text-brand">
        {icon}
      </div>
      <h3 className="text-base font-semibold text-fg">{title}</h3>
      <p className="mt-1 flex-1 text-xs text-fg-secondary">{desc}</p>
      <Button
        variant={tone === 'danger' ? 'destructive' : 'primary'}
        size="sm"
        className="mt-4"
        disabled={busy}
        onClick={onClick}
      >
        {busy && <Loader2 className="h-4 w-4 animate-spin" />}
        {cta}
      </Button>
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test LaunchpadModal`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/features/launchpad/LaunchpadModal.tsx src/features/launchpad/LaunchpadModal.test.tsx
git commit -m "feat(launchpad): LaunchpadModal hub (modes + live-confirm)"
```

---

## Task 4: Wire Launchpad entry on Dashboard

**Files:**

- Modify: `src/pages/DashboardPage.tsx`

> Assumes Phase 3 Task 6 is merged: `DashboardPage` already imports `BacktestDialog`, has `backtestBot` state + the `BacktestDialog` mount, and `DashboardBot.strategyName` exists.

- [ ] **Step 1: Add imports + state**

At the top of `src/pages/DashboardPage.tsx`, add:

```tsx
import {
  LaunchpadModal,
  type LaunchpadBot,
} from '@/features/launchpad/LaunchpadModal';
```

Inside `DashboardPage()` with the other `useState`s:

```tsx
const [launchBotTarget, setLaunchBotTarget] = useState<LaunchpadBot | null>(
  null,
);
```

Add a mapper helper above the component (after the `MockBot` type):

```tsx
/** Map a loaded real bot to the minimal shape LaunchpadModal needs. */
function toLaunchpadBot(b: DashboardBot): LaunchpadBot {
  return {
    id: b.id,
    name: b.name,
    strategyName: b.strategyName,
    pair: b.pair,
    timeframe: b.timeframe,
    mode: b.mode,
    errorMsg: b.errorMsg,
  };
}
```

- [ ] **Step 2: Route non-running cards + Start button to Launchpad (Critical — close direct-start bypass)**

⚠️ **Safety context (Devin round 5):** Phase 1's `BotCard` exposes a Start button that, for PAUSED bots, calls `doStart(bot.id)` → `botApi.start(id)` **directly**. This **bypasses Launchpad's Live-disabled gate** — a bot with `dry_run=false` in config (previously Live, now stopped) re-starts in LIVE mode without going through Phase 2b's agent EIP-712 confirmation. Fix: route BOTH the card click AND the Start button through Launchpad for non-running bots.

Replace the `onClick` AND `onStart` expressions on the `<BotCard>` in the grid `.map`:

```tsx
                      onClick={
                        bot.isDemo
                          ? () => requireWalletThen(() => navigate('/builder'))
                          : bot.mode === 'LIVE' || bot.mode === 'DRY-RUN'
                            ? () => navigate(`/bots/${bot.id}`)
                            : () => setLaunchBotTarget(toLaunchpadBot(bot))
                      }
                      onStart={
                        bot.isDemo
                          ? undefined
                          : () => setLaunchBotTarget(toLaunchpadBot(bot))
                      }
```

The Start button still renders for PAUSED bots (familiar UX), but its click now opens Launchpad — user explicitly picks mode (Backtest / Dry-run; Live card disabled in 2a) before bot actually starts. Phase 2b will enable Live card after agent flow.

> `toLaunchpadBot` only receives real `DashboardBot`s — the `bot.isDemo` branch returns first, so `MockBot` (which lacks real fields) never reaches the mapper.

> **Regression test required (Step 4 below):** Phase 1 T6 test asserts "Start button calls botApi.start with bot id". Phase 2a **MUST** update that test to: "Start button opens Launchpad (`launchBotTarget !== null` after click); `botApi.start` NOT called". Plus add new test pinning the safety: stopped bot + `dry_run=false` config → Start click → `botApi.start` NOT called directly.

- [ ] **Step 3: Mount the Launchpad modal**

Next to the existing `<BacktestDialog ... />` mount, add:

```tsx
<LaunchpadModal
  open={launchBotTarget !== null}
  onOpenChange={(o) => {
    if (!o) setLaunchBotTarget(null);
  }}
  bot={launchBotTarget}
  onBacktest={() => {
    if (launchBotTarget) {
      setBacktestBot({
        id: launchBotTarget.id,
        name: launchBotTarget.name,
        strategyName: launchBotTarget.strategyName,
        pair: launchBotTarget.pair,
        timeframe: launchBotTarget.timeframe,
      });
    }
    setLaunchBotTarget(null);
  }}
  onLaunched={() => {
    const id = launchBotTarget?.id;
    setLaunchBotTarget(null);
    if (id != null) navigate(`/bots/${id}`);
  }}
/>
```

- [ ] **Step 4: Verify typecheck + tests**

Run: `pnpm typecheck && pnpm test DashboardPage`
Expected: PASS (no type errors; existing dashboard tests still green).

- [ ] **Step 5: Commit**

```bash
git add src/pages/DashboardPage.tsx
git commit -m "feat(launchpad): open Launchpad from stopped/error bot cards"
```

---

## Task 5: Post-create → open Launchpad

**Files:**

- Modify: `src/features/export-import/ExportDialog.tsx`
- Modify: `src/pages/DashboardPage.tsx`

- [ ] **Step 1: Change post-create navigation in ExportDialog**

In `src/features/export-import/ExportDialog.tsx`, `handleSubmit`, replace the success navigation block:

```tsx
onOpenChange(false);
setTimeout(() => {
  navigate('/dashboard', {
    state: { launchpadBotId: response.bot.id },
  });
}, 150);
```

(Replaces the previous `navigate(`/bots/${response.bot.id}`)`.)

- [ ] **Step 2: Consume `launchpadBotId` on the Dashboard**

In `src/pages/DashboardPage.tsx`, add the import + a one-shot consume effect.

Add to the router imports:

```tsx
import { useLocation, useNavigate } from 'react-router-dom';
```

Inside `DashboardPage()`:

```tsx
const location = useLocation();
const consumedLaunchRef = useRef(false);
```

(Add `useRef` to the existing `react` import.)

After `realBots` is defined, add:

```tsx
// After bot creation, ExportDialog routes here with state.launchpadBotId.
// Open the Launchpad for that freshly-created bot once it appears in the
// refetched list. Consume once so a manual refresh doesn't re-open it.
useEffect(() => {
  const targetId = (location.state as { launchpadBotId?: number } | null)
    ?.launchpadBotId;
  if (targetId == null || consumedLaunchRef.current || !realBots) return;
  const found = realBots.find((b) => b.id === targetId);
  if (found) {
    consumedLaunchRef.current = true;
    setLaunchBotTarget(toLaunchpadBot(found));
    // Clear the history state so back/refresh won't re-trigger.
    navigate('/dashboard', { replace: true, state: {} });
  }
}, [location.state, realBots, navigate]);
```

- [ ] **Step 3: Verify typecheck + full suite**

Run: `pnpm typecheck && pnpm test`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/features/export-import/ExportDialog.tsx src/pages/DashboardPage.tsx
git commit -m "feat(launchpad): open Launchpad after bot creation"
```

---

## Task 5b: Close direct-Start bypass on BotMonitoringPage (Critical — Devin round 5)

**Files:**

- Modify: `src/features/bot-monitoring/BotMonitoringPage.tsx`
- Modify (or create): `src/features/bot-monitoring/BotMonitoringPage.test.tsx`

⚠️ Phase 1 BotMonitoringPage header renders a Start button when `!isRunning && !isError && !isTransition` (= stopped). Its `onClick` → `doStart` → `botApi.start(id)` **directly** — **same bypass as Dashboard Task 4 Step 2 closes**. Route this Start through Launchpad too. Stop + Sync stay unchanged (Stop never escalates trust; Sync is read-only).

- [ ] **Step 1: Replace the stopped Start handler**

In `src/features/bot-monitoring/BotMonitoringPage.tsx`, find:

- `doStart` definition (around line 3861)
- The header `onStart={doStart}` prop wiring (around line 3927)

Add a navigation-based handler that routes through Dashboard Launchpad (reusing Task 5's `launchpadBotId` consume effect):

```tsx
// Near the existing useNavigate import + safeBotId (Phase 1's parsed number id):
const handleStartClick = useCallback(() => {
  // Route stopped-bot Start through Launchpad on Dashboard.
  // Direct botApi.start would bypass Phase 2b's agent EIP-712 gate when the
  // bot's stored config has dry_run=false (previously Live, now stopped).
  navigate('/dashboard', { state: { launchpadBotId: safeBotId } });
}, [navigate, safeBotId]);
```

Then wire the header: `onStart={handleStartClick}` (replacing the previous `onStart={doStart}`). `doStop` and `doSync` keep their existing wiring.

> Use `safeBotId`, NOT `meta.id` (Devin SF-1): `meta` is `null` during loading so `meta.id` crashes at hook-eval time, and `BotMeta.id` is a `string` while the Dashboard consume effect compares `b.id === targetId` strictly against a `number` (string ≠ number → Launchpad silently never opens). `safeBotId` is the parsed number from `useParams<{ id: string }>` — same pattern `doStart`/`doStop`/`doSync` already use.

- [ ] **Step 2: Regression test**

In `src/features/bot-monitoring/BotMonitoringPage.test.tsx` (create if absent, or extend existing):

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { BotMonitoringPage } from './BotMonitoringPage';
import { botApi } from './bot.api';

vi.mock('./bot.api', () => ({
  botApi: {
    getStatus: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
    sync: vi.fn(),
  },
}));

describe('BotMonitoringPage — Start bypass closed', () => {
  beforeEach(() => {
    vi.mocked(botApi.getStatus).mockResolvedValue({
      id: 7,
      bot_name: 'Test',
      status: 'stopped',
      desired_status: null,
      is_process_running: false,
      error_message: null,
    });
    vi.mocked(botApi.start).mockReset();
  });

  it('stopped Start does NOT call botApi.start (routes through Dashboard Launchpad)', async () => {
    render(
      <MemoryRouter initialEntries={['/bots/7']}>
        <Routes>
          <Route path="/bots/:id" element={<BotMonitoringPage />} />
          <Route path="/dashboard" element={<div>dashboard</div>} />
        </Routes>
      </MemoryRouter>,
    );
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: /start/i }),
      ).toBeInTheDocument(),
    );
    fireEvent.click(screen.getByRole('button', { name: /start/i }));
    // Critical assertion: bot.api.start MUST NOT be called.
    expect(botApi.start).not.toHaveBeenCalled();
    // And navigation to dashboard should have happened (page text changes).
    await waitFor(() =>
      expect(screen.getByText('dashboard')).toBeInTheDocument(),
    );
  });
});
```

> Test setup may need adjustment for `BotMonitoringPage`'s heavy mock dependencies (`useBotMeta`, `hlApi`, etc.). If isolation is too complex, mark with `// TODO(phase-4): expand` and defer to Phase 4 overhaul — but the assertion that `botApi.start` is NOT called is the safety contract; that part is non-negotiable.

- [ ] **Step 3: Verify**

Run: `pnpm typecheck && pnpm test BotMonitoringPage`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/features/bot-monitoring/BotMonitoringPage.tsx \
        src/features/bot-monitoring/BotMonitoringPage.test.tsx
git commit -m "fix(launchpad): route BotMonitoringPage stopped Start through Dashboard Launchpad"
```

---

## Task 6: Manual smoke + final sweep + PR

**Files:** none (verification only)

- [ ] **Step 1: Lint + format + typecheck + test**

Run: `pnpm typecheck && pnpm lint && pnpm test && pnpm format`
Expected: all PASS / no diffs.

- [ ] **Step 2: Manual smoke against real BE** (Tri verifies — see [feedback_user_tests_ui])

Checklist (`pnpm dev`, wallet connected, BE up; needs Phase 1 + Phase 3 merged):

- Create a bot (builder → Deploy) → lands on Dashboard with Launchpad open on the new bot.
- Launchpad shows 3 cards: **Backtest** (active), **Dry-run** (active), **Live (Phase 2b)** disabled with placeholder label.
- **Run backtest** → Launchpad closes, BacktestDialog opens for the same bot.
- **Start dry-run** → PATCH `/bot-strategy/{id}` (`dry_run:true`) + POST `/bot/{id}/start` fire → navigates to `/bots/:id`.
- **Live card** → click does NOT fire (disabled); label shows "Live (Phase 2b)".
- Dashboard: clicking a LIVE/DRY-RUN card goes to monitor; clicking a PAUSED/ERROR card opens Launchpad.
- ERROR bot Launchpad shows the error banner + **Sync** → POST `/bot/{id}/sync`.
- **🔒 Critical bypass check (Devin R5):**
  - Create a bot with `dry_run:false` in config (or PATCH an existing bot), STOP it manually. Dashboard now shows it as PAUSED.
  - Click the **Start button on the Dashboard card** → must open Launchpad (NOT immediately call `botApi.start`). Verify Network tab: NO `POST /bot/{id}/start` until user picks a mode in Launchpad.
  - On `/bots/{id}` Monitor page for the same stopped bot → click **Start** in header → must navigate back to `/dashboard` and auto-open Launchpad. Network tab: NO direct `POST /bot/{id}/start`.
  - If either path fires `botApi.start` directly without going through Launchpad → Phase 2a is NOT shipped correctly.

- [ ] **Step 3: Open PR**

```bash
git push -u origin feat/bot-lifecycle
gh pr create --title "feat(launchpad): launch bots via dry-run/live hub" --body "$(cat <<'EOF'
## Summary
- New `src/features/launchpad/`: `launchBot` (PATCH dry_run + start) + `LaunchpadModal` hub (modes → live-confirm).
- Dashboard opens Launchpad for stopped/error bots; running bots still go to monitor.
- After bot creation, route to Dashboard and auto-open the Launchpad on the new bot.
- Backtest card bridges to the Phase 3 BacktestDialog.

## Test plan
- [ ] `pnpm typecheck && pnpm lint && pnpm test` green
- [ ] Manual: create → Launchpad opens; dry-run + live launch hit PATCH + start
- [ ] Manual: live path requires the confirm step
- [ ] Manual: running cards → monitor; stopped/error cards → Launchpad

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

## Self-Review

**1. Spec coverage** (prototype `LaunchpadModal` / `ModesStep` / `LiveConfirmStep`):

- Launchpad hub with 3 modes → Task 3. ✅
- Dry-run launch (paper) → Task 2 + 3 (`launchBot('dry-run')`). ✅
- Live launch with confirm → Task 3 (`live-confirm` step). ✅
- Backtest mode → bridges to Phase 3 `BacktestDialog` via `onBacktest` (Task 3 + 4). ✅
- Error bot → banner + Sync (`botApi.sync`, Phase 1) → Task 3. ✅
- Entry from dashboard (idle/error opens modal; running → monitor) → Task 4. ✅
- Post-create → dashboard + Launchpad auto-open → Task 5. ✅
- Tier gating / paywall / "$1,000 sim wallet" metric / auto-stop → **out of scope (Phase 5)**, intentionally omitted. ✅
- Footer "Edit recipe / Duplicate / Delete" → out of scope (omitted). ✅

**2. Placeholder scan:** No "TBD"/"handle errors"/"similar to". Every code step shows full code; every command has expected output. ✅

**3. Type consistency:**

- `launchBot(botId: number, mode: LaunchMode)` → `Promise<BotStatusOut>` — same signature in Task 2 def, Task 3 calls, tests. ✅
- `LaunchMode = 'dry-run' | 'live'` — used in `launchBot`, `ModeCard` `doLaunch`, tests. ✅
- `LaunchpadBot` (`id,name,strategyName,pair,timeframe,mode,errorMsg`) — defined Task 3, produced by `toLaunchpadBot` Task 4 (maps from `DashboardBot`, which has all these fields incl. `strategyName` from Phase 3). ✅
- `botStrategyApi.update(botId, payload: UpdatePayload)` — Task 1 def, called by `launchBot` Task 2. `{ dry_run: boolean }` is a valid partial `UnifiedBotStrategyUpdate`. ✅
- `LaunchpadModalProps` (`open,onOpenChange,bot,onBacktest,onLaunched`) — Task 3 def, mounted identically Task 4. ✅
- `BacktestBot` shape passed in `onBacktest` (Task 4) matches Phase 3's `BacktestBot` (`id,name,strategyName,pair,timeframe`). ✅

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-05-27-launchpad-dry-live.md`. Two execution options:

1. **Subagent-Driven (recommended)** — dispatch a fresh subagent per task, review between tasks, fast iteration.
2. **Inline Execution** — execute tasks in this session using executing-plans, batch with checkpoints.

Which approach?
