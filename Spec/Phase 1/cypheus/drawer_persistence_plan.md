# Drawer Persistence Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refactor the Cypheus magic-build flow so the right-side drawer slides open exactly once at the start of the build and once at the end, with content cross-fading between Step 1→2→3→4 instead of the current 8 slide-open/slide-close animations.

**Architecture:** Introduce a `drawerMode` state machine (`closed | manual | cypheus-pinned | cypheus-summary`) and a `cypheusActiveStepId` selector in the Cypheus store. Collapse the four per-step `<StepDrawer>` instances in `StepList` down to a single shared `<StepDrawer>` whose visible content is derived from either `builder.openStep` (manual mode) or `cypheus.cypheusActiveStepId` (pinned mode). Wrap the body in `<AnimatePresence mode="wait">` (Framer Motion) keyed on the active step so the inner form cross-fades while the Sheet stays mounted. The magic-build script is rewritten to flip `drawerMode` at the boundaries instead of toggling `openStep` per step.

**Tech Stack:** React 18 · TypeScript · Zustand 5 · Radix Dialog (`shadcn/ui` Sheet) · Framer Motion 11 · Vitest + Testing Library · Tailwind.

---

## File Structure

| File | Status | Responsibility |
|---|---|---|
| `src/features/cypheus/store/cypheus.store.ts` | Modify | Add `drawerMode`, `cypheusActiveStepId`, setters, summary auto-close timer state |
| `src/features/cypheus/store/cypheus.store.test.ts` | Create | Unit tests for new state transitions |
| `src/features/bot-builder/components/StepDrawer.tsx` | Modify | Read `drawerMode`, render footer + body variants, cross-fade content |
| `src/features/bot-builder/components/CypheusPinnedFooter.tsx` | Create | "⚡ Cypheus is configuring..." status footer |
| `src/features/bot-builder/components/CypheusSummaryView.tsx` | Create | Drawer body shown in `cypheus-summary` mode (✓ list + Review JSON / Close) |
| `src/features/bot-builder/StepList.tsx` | Modify | Collapse 4 drawers → 1 shared drawer, derive active step from store |
| `src/features/bot-builder/components/StepCard.tsx` | Modify | Pulse glow when pinned mode targets this step |
| `src/features/cypheus/script/magic-build.script.ts` | Modify | Open drawer once, switch step content, summary, close |
| `src/features/cypheus/CreateNewBotButton.tsx` | Modify | Reset drawer mode + active step on "Create new bot" |
| `src/i18n/en.ts` | Modify | New strings: pinned footer, summary headings, close-disabled tooltip |

All other files remain untouched.

---

## Task 1: Extend the Cypheus store with drawer state

**Files:**
- Modify: `src/features/cypheus/store/cypheus.store.ts`
- Create: `src/features/cypheus/store/cypheus.store.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/features/cypheus/store/cypheus.store.test.ts`:

```typescript
import { describe, expect, it, beforeEach } from 'vitest';
import { useCypheusStore } from './cypheus.store';

describe('cypheus store — drawer state', () => {
  beforeEach(() => {
    useCypheusStore.getState().resetAll();
  });

  it('defaults to closed drawer with no active step', () => {
    const s = useCypheusStore.getState();
    expect(s.drawerMode).toBe('closed');
    expect(s.cypheusActiveStepId).toBeNull();
  });

  it('startCypheusDrawer pins the drawer and sets first step', () => {
    useCypheusStore.getState().startCypheusDrawer('bot-config');
    const s = useCypheusStore.getState();
    expect(s.drawerMode).toBe('cypheus-pinned');
    expect(s.cypheusActiveStepId).toBe('bot-config');
  });

  it('switchCypheusStep updates active step but keeps mode pinned', () => {
    useCypheusStore.getState().startCypheusDrawer('bot-config');
    useCypheusStore.getState().switchCypheusStep('entry-strategy');
    const s = useCypheusStore.getState();
    expect(s.drawerMode).toBe('cypheus-pinned');
    expect(s.cypheusActiveStepId).toBe('entry-strategy');
  });

  it('showCypheusSummary flips mode to summary, keeps last step', () => {
    useCypheusStore.getState().startCypheusDrawer('bot-config');
    useCypheusStore.getState().switchCypheusStep('close-method');
    useCypheusStore.getState().showCypheusSummary();
    const s = useCypheusStore.getState();
    expect(s.drawerMode).toBe('cypheus-summary');
    expect(s.cypheusActiveStepId).toBe('close-method');
  });

  it('closeCypheusDrawer resets drawer and step', () => {
    useCypheusStore.getState().startCypheusDrawer('bot-config');
    useCypheusStore.getState().closeCypheusDrawer();
    const s = useCypheusStore.getState();
    expect(s.drawerMode).toBe('closed');
    expect(s.cypheusActiveStepId).toBeNull();
  });

  it('resetAll clears drawer state', () => {
    useCypheusStore.getState().startCypheusDrawer('bot-config');
    useCypheusStore.getState().resetAll();
    const s = useCypheusStore.getState();
    expect(s.drawerMode).toBe('closed');
    expect(s.cypheusActiveStepId).toBeNull();
  });
});
```

- [ ] **Step 2: Run the test — verify it fails**

Run: `pnpm test -- cypheus.store.test`
Expected: FAIL (`drawerMode` undefined, `startCypheusDrawer` not a function).

- [ ] **Step 3: Update the store with new state + actions**

Edit `src/features/cypheus/store/cypheus.store.ts` — replace the file:

```typescript
import { create } from 'zustand';
import type { StepId } from '@/types/builder.types';

export type CypheusState =
  | 'idle'
  | 'greeting'
  | 'thinking'
  | 'building'
  | 'done';

export type AvatarState = 'idle' | 'thinking' | 'speaking';

export type LeftPanelTab = 'cypheus' | 'json';

export type DrawerMode =
  | 'closed'
  | 'manual'
  | 'cypheus-pinned'
  | 'cypheus-summary';

export interface ChatMessage {
  id: string;
  role: 'cypheus' | 'user';
  text: string;
  typing?: boolean;
  ts: number;
}

interface CypheusStore {
  panelTab: LeftPanelTab;
  state: CypheusState;
  avatar: AvatarState;
  messages: ChatMessage[];
  drawerMode: DrawerMode;
  cypheusActiveStepId: StepId | null;

  setPanelTab: (tab: LeftPanelTab) => void;
  setState: (state: CypheusState) => void;
  setAvatar: (avatar: AvatarState) => void;
  pushMessage: (msg: Omit<ChatMessage, 'id' | 'ts'>) => string;
  updateMessage: (id: string, patch: Partial<Omit<ChatMessage, 'id'>>) => void;
  clearMessages: () => void;

  startCypheusDrawer: (stepId: StepId) => void;
  switchCypheusStep: (stepId: StepId) => void;
  showCypheusSummary: () => void;
  closeCypheusDrawer: () => void;

  resetAll: () => void;
}

export const useCypheusStore = create<CypheusStore>((set) => ({
  panelTab: 'cypheus',
  state: 'idle',
  avatar: 'idle',
  messages: [],
  drawerMode: 'closed',
  cypheusActiveStepId: null,

  setPanelTab: (panelTab) => set({ panelTab }),
  setState: (state) => set({ state }),
  setAvatar: (avatar) => set({ avatar }),

  pushMessage: (msg) => {
    const id = crypto.randomUUID();
    const ts = Date.now();
    set((s) => ({ messages: [...s.messages, { ...msg, id, ts }] }));
    return id;
  },

  updateMessage: (id, patch) =>
    set((s) => ({
      messages: s.messages.map((m) => (m.id === id ? { ...m, ...patch } : m)),
    })),

  clearMessages: () => set({ messages: [] }),

  startCypheusDrawer: (stepId) =>
    set({ drawerMode: 'cypheus-pinned', cypheusActiveStepId: stepId }),

  switchCypheusStep: (stepId) =>
    set({ drawerMode: 'cypheus-pinned', cypheusActiveStepId: stepId }),

  showCypheusSummary: () => set({ drawerMode: 'cypheus-summary' }),

  closeCypheusDrawer: () =>
    set({ drawerMode: 'closed', cypheusActiveStepId: null }),

  resetAll: () =>
    set({
      panelTab: 'cypheus',
      state: 'idle',
      avatar: 'idle',
      messages: [],
      drawerMode: 'closed',
      cypheusActiveStepId: null,
    }),
}));
```

- [ ] **Step 4: Run tests — verify they pass**

Run: `pnpm test -- cypheus.store.test`
Expected: PASS (6 tests).

- [ ] **Step 5: Run typecheck**

Run: `pnpm typecheck`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/features/cypheus/store/cypheus.store.ts src/features/cypheus/store/cypheus.store.test.ts
git commit -m "feat(cypheus): add drawerMode + cypheusActiveStepId to store"
```

---

## Task 2: Add new i18n strings

**Files:**
- Modify: `src/i18n/en.ts:35-95`

- [ ] **Step 1: Add strings**

In `src/i18n/en.ts`, update the `cypheus.magicBuild` block to add 4 step-name entries plus the pinned/summary strings, and update the `drawer` block. Replace the existing `cypheus.magicBuild` and `drawer` blocks with:

```typescript
    magicBuild: {
      ack: 'Got it. Let me build a Bollinger Breakout strategy on BTC-USDC for you.',
      note: 'Note: This is demo content prepared to showcase the AI flow.',
      step1: 'Setting up bot configuration...',
      step1Comment:
        'BTC-USDC offers high liquidity. 5-minute timeframe is ideal for scalping.',
      step2: 'Defining entry conditions...',
      step2Comment:
        'RSI below 30 signals oversold – a classic buy entry.',
      step3: 'Going Long with Market orders for fast fills.',
      step4: 'Setting take-profit and stop-loss.',
      step4Comment:
        '5% take-profit at half position, another 25% at 10% profit. 3% stop-loss.',
      doneA: 'All set.',
      doneB:
        'Review the JSON in the {} JSON tab, then click Export when ready.',
      pinnedFooter: 'Cypheus is configuring...',
      closeDisabledTooltip:
        "Cypheus is building. Click 'Create new bot' to stop.",
      progressLabel: (current: number, total: number) =>
        `Step ${current} of ${total}`,
      summary: {
        title: 'All set ✓',
        reviewJson: 'Review JSON',
        close: 'Close',
      },
    },
```

```typescript
  drawer: {
    setupTab: 'Setup',
    configureTab: 'Configure',
    cancel: 'Cancel',
    save: 'Save',
    saveAndNext: 'Save & Next →',
    close: 'Close',
  },
```

(The `drawer` block is unchanged — leave it as-is.)

- [ ] **Step 2: Verify typecheck**

Run: `pnpm typecheck`
Expected: PASS (no consumers of the new keys yet).

- [ ] **Step 3: Commit**

```bash
git add src/i18n/en.ts
git commit -m "feat(i18n): add cypheus drawer-pinned strings"
```

---

## Task 3: Build the CypheusPinnedFooter component

**Files:**
- Create: `src/features/bot-builder/components/CypheusPinnedFooter.tsx`

- [ ] **Step 1: Write the component**

```tsx
import { Sparkles } from 'lucide-react';
import { strings } from '@/i18n/en';

/**
 * Footer shown inside the StepDrawer while Cypheus is in pinned mode. Replaces
 * the Cancel / Save / Save & Next buttons with a passive status row so the
 * user can't disrupt the running script.
 */
export function CypheusPinnedFooter() {
  return (
    <div className="flex items-center justify-center gap-2 border-t border-border-subtle px-6 py-4 text-sm text-fg-secondary">
      <Sparkles className="h-4 w-4 animate-pulse text-brand" aria-hidden />
      <span>⚡ {strings.cypheus.magicBuild.pinnedFooter}</span>
    </div>
  );
}
```

- [ ] **Step 2: Verify typecheck**

Run: `pnpm typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/features/bot-builder/components/CypheusPinnedFooter.tsx
git commit -m "feat(bot-builder): add CypheusPinnedFooter status row"
```

---

## Task 4: Build the CypheusSummaryView component

**Files:**
- Create: `src/features/bot-builder/components/CypheusSummaryView.tsx`

- [ ] **Step 1: Write the component**

```tsx
import { useEffect } from 'react';
import { Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useBuilderStore } from '@/features/bot-builder/store/builder.store';
import { useCypheusStore } from '@/features/cypheus/store/cypheus.store';
import { strings } from '@/i18n/en';
import type { StepId } from '@/types/builder.types';

const SUMMARY_STEPS: { id: StepId; index: number; title: string }[] = [
  { id: 'bot-config', index: 1, title: strings.steps.botConfig.title },
  { id: 'entry-strategy', index: 2, title: strings.steps.entryStrategy.title },
  { id: 'direction', index: 3, title: strings.steps.direction.title },
  { id: 'close-method', index: 4, title: strings.steps.closeMethod.title },
];

const AUTO_CLOSE_MS = 2000;

interface CypheusSummaryViewProps {
  /** Called when the user (or auto-close timer) wants the drawer dismissed. */
  onDismiss: () => void;
  /** Called when the user clicks "Review JSON". */
  onReviewJson: () => void;
}

/**
 * Final state shown for ~2s after Cypheus finishes the magic build. Lists the
 * four configured steps with brief one-line summaries, then auto-closes.
 */
export function CypheusSummaryView({
  onDismiss,
  onReviewJson,
}: CypheusSummaryViewProps) {
  const builder = useBuilderStore();
  const drawerMode = useCypheusStore((s) => s.drawerMode);

  useEffect(() => {
    if (drawerMode !== 'cypheus-summary') return;
    const t = window.setTimeout(onDismiss, AUTO_CLOSE_MS);
    return () => window.clearTimeout(t);
  }, [drawerMode, onDismiss]);

  const lineFor = (id: StepId): string => {
    switch (id) {
      case 'bot-config':
        return `${builder.botConfig.pair || '—'} · ${builder.botConfig.timeframe} · ${builder.botConfig.leverage}x`;
      case 'entry-strategy': {
        const conds = builder.strategy.entryConditions.conditions;
        if (conds.length === 0) return '—';
        const c = conds[0];
        return `${c.left} ${c.op} ${c.right_number ?? c.right_indicator ?? ''}`;
      }
      case 'direction':
        return `${builder.directionForm.direction === 'long' ? 'Long' : 'Short'} · ${
          builder.directionForm.orderType === 'market' ? 'Market' : 'Limit'
        }`;
      case 'close-method':
        return builder.closeMethod.type === 'tp_sl'
          ? 'TP/SL'
          : builder.closeMethod.type === 'roi_steps'
            ? 'ROI steps'
            : 'Indicator exit';
    }
  };

  return (
    <div className="flex h-full flex-col">
      <ul className="flex-1 space-y-3 px-6 py-5">
        {SUMMARY_STEPS.map((step) => (
          <li
            key={step.id}
            className="flex items-start gap-3 rounded-lg border border-bullish/30 bg-bullish/5 px-3 py-2"
          >
            <Check
              className="mt-0.5 h-4 w-4 flex-shrink-0 text-bullish"
              aria-hidden
            />
            <div className="flex-1">
              <div className="text-sm font-medium text-fg">
                {step.index}. {step.title}
              </div>
              <div className="text-xs text-fg-muted">{lineFor(step.id)}</div>
            </div>
          </li>
        ))}
      </ul>
      <div className="flex items-center justify-end gap-3 border-t border-border-subtle px-6 py-4">
        <Button variant="ghost" onClick={onDismiss}>
          {strings.cypheus.magicBuild.summary.close}
        </Button>
        <Button variant="primary" onClick={onReviewJson}>
          {strings.cypheus.magicBuild.summary.reviewJson}
        </Button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify typecheck**

Run: `pnpm typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/features/bot-builder/components/CypheusSummaryView.tsx
git commit -m "feat(bot-builder): add CypheusSummaryView with auto-close timer"
```

---

## Task 5: Refactor StepDrawer to support Cypheus modes + body cross-fade

**Files:**
- Modify: `src/features/bot-builder/components/StepDrawer.tsx`

This task replaces the file. The new version:
1. Reads `drawerMode` and `cypheusActiveStepId` from the Cypheus store.
2. Wraps the body in `<AnimatePresence mode="wait">` keyed on the active step so internal swaps cross-fade.
3. Renders the manual footer (Cancel/Save/Save & Next), pinned footer, or summary view based on `drawerMode`.
4. Hides the close (×) button while pinned and shows a tooltip when hovered.

- [ ] **Step 1: Replace the file**

```tsx
import { useMemo, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Sheet,
  SheetBody,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useBuilderStore } from '@/features/bot-builder/store/builder.store';
import { useCypheusStore } from '@/features/cypheus/store/cypheus.store';
import { strings } from '@/i18n/en';
import { DrawerResizeHandle } from './DrawerResizeHandle';
import { CypheusPinnedFooter } from './CypheusPinnedFooter';
import { CypheusSummaryView } from './CypheusSummaryView';
import type { DrawerTab, StepId } from '@/types/builder.types';

export interface StepContentMap {
  setup: ReactNode;
  configure: ReactNode;
  title: string;
  description: string;
  index: number;
}

export interface StepDrawerProps {
  /** Step content lookup keyed by stepId. */
  contentByStep: Record<StepId, StepContentMap>;
  /** Called when manual mode user closes the drawer. */
  onManualClose: () => void;
  /** Called when manual mode user clicks Save. */
  onManualSave: () => void;
  /** Called when manual mode user clicks Save & Next. */
  onManualSaveAndNext: () => void;
  /** Hide Save & Next when at last step. */
  hasNext: boolean;
  /** Called when the summary view requests dismiss (Close or auto-close). */
  onSummaryDismiss: () => void;
  /** Called when the summary view's Review JSON button is clicked. */
  onSummaryReviewJson: () => void;
}

const TOTAL_STEPS = 4;

/**
 * Single shared drawer. Visibility and content are derived from two stores:
 * - In `manual` mode the drawer is driven by `builder.openStep`.
 * - In `cypheus-pinned` / `cypheus-summary` mode it is driven by
 *   `cypheus.cypheusActiveStepId` so it stays mounted across step changes.
 */
export function StepDrawer({
  contentByStep,
  onManualClose,
  onManualSave,
  onManualSaveAndNext,
  hasNext,
  onSummaryDismiss,
  onSummaryReviewJson,
}: StepDrawerProps) {
  const openStep = useBuilderStore((s) => s.openStep);
  const drawerTab = useBuilderStore((s) => s.drawerTab);
  const setDrawerTab = useBuilderStore((s) => s.setDrawerTab);
  const drawerWidth = useBuilderStore((s) => s.drawerWidth);
  const setDrawerWidth = useBuilderStore((s) => s.setDrawerWidth);

  const drawerMode = useCypheusStore((s) => s.drawerMode);
  const cypheusActiveStepId = useCypheusStore((s) => s.cypheusActiveStepId);

  // Effective mode: when Cypheus owns the drawer, force its mode. Otherwise
  // the drawer is "manual" iff openStep is set.
  const effectiveMode = drawerMode === 'closed'
    ? (openStep ? 'manual' : 'closed')
    : drawerMode;

  const activeStepId: StepId | null =
    effectiveMode === 'cypheus-pinned' || effectiveMode === 'cypheus-summary'
      ? cypheusActiveStepId
      : openStep;

  const isOpen = effectiveMode !== 'closed' && activeStepId !== null;
  const isPinned =
    effectiveMode === 'cypheus-pinned' || effectiveMode === 'cypheus-summary';

  const content = useMemo(() => {
    if (!activeStepId) return null;
    return contentByStep[activeStepId];
  }, [activeStepId, contentByStep]);

  const indexOfActive = content?.index ?? 1;

  const handleOpenChange = (next: boolean) => {
    if (next) return;
    if (isPinned) return; // ignore close while pinned
    onManualClose();
  };

  return (
    <Sheet open={isOpen} onOpenChange={handleOpenChange} modal={false}>
      <SheetContent
        hideOverlay
        hideCloseButton
        width={drawerWidth}
        onInteractOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => {
          if (isPinned) e.preventDefault();
        }}
        overlayClassName="left-[var(--layout-left-panel)]"
      >
        <DrawerResizeHandle currentWidth={drawerWidth} onResize={setDrawerWidth} />

        <SheetHeader>
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <AnimatePresence mode="wait">
                <motion.div
                  key={activeStepId ?? 'empty'}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.15 }}
                >
                  <SheetTitle>
                    {effectiveMode === 'cypheus-summary'
                      ? strings.cypheus.magicBuild.summary.title
                      : (content?.title ?? '')}
                  </SheetTitle>
                  {effectiveMode !== 'cypheus-summary' && (
                    <SheetDescription>
                      {content?.description ?? ''}
                      {isPinned && (
                        <span className="ml-2 text-fg-muted">
                          ·{' '}
                          {strings.cypheus.magicBuild.progressLabel(
                            indexOfActive,
                            TOTAL_STEPS,
                          )}
                        </span>
                      )}
                    </SheetDescription>
                  )}
                </motion.div>
              </AnimatePresence>
            </div>
            <CloseButton
              disabled={isPinned}
              onClick={() => handleOpenChange(false)}
            />
          </div>
        </SheetHeader>

        {effectiveMode === 'cypheus-summary' ? (
          <CypheusSummaryView
            onDismiss={onSummaryDismiss}
            onReviewJson={onSummaryReviewJson}
          />
        ) : (
          <>
            <Tabs
              value={drawerTab}
              onValueChange={(v) => setDrawerTab(v as DrawerTab)}
              className="flex flex-1 flex-col overflow-hidden"
            >
              <div className="px-6 pt-4">
                <TabsList>
                  <TabsTrigger value="setup" disabled={isPinned}>
                    {strings.drawer.setupTab}
                  </TabsTrigger>
                  <TabsTrigger value="configure" disabled={isPinned}>
                    {strings.drawer.configureTab}
                  </TabsTrigger>
                </TabsList>
              </div>
              <SheetBody>
                <AnimatePresence mode="wait">
                  <motion.div
                    key={`${activeStepId}-${drawerTab}`}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.15 }}
                  >
                    {drawerTab === 'setup' ? (
                      <TabsContent value="setup" forceMount className="space-y-5">
                        {content?.setup ?? null}
                      </TabsContent>
                    ) : (
                      <TabsContent
                        value="configure"
                        forceMount
                        className="space-y-5"
                      >
                        {content?.configure ?? null}
                      </TabsContent>
                    )}
                  </motion.div>
                </AnimatePresence>
              </SheetBody>
            </Tabs>

            {effectiveMode === 'cypheus-pinned' ? (
              <CypheusPinnedFooter />
            ) : (
              <SheetFooter>
                <Button variant="ghost" onClick={onManualClose}>
                  {strings.drawer.cancel}
                </Button>
                <Button variant="secondary" onClick={onManualSave}>
                  {strings.drawer.save}
                </Button>
                {hasNext ? (
                  <Button variant="primary" onClick={onManualSaveAndNext}>
                    {strings.drawer.saveAndNext}
                  </Button>
                ) : null}
              </SheetFooter>
            )}
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

function CloseButton({
  disabled,
  onClick,
}: {
  disabled: boolean;
  onClick: () => void;
}) {
  if (!disabled) {
    return (
      <button
        type="button"
        onClick={onClick}
        aria-label="Close drawer"
        className="inline-flex h-8 w-8 items-center justify-center rounded-md text-fg-secondary transition-colors hover:bg-surface-hover hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
      >
        ×
      </button>
    );
  }
  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            disabled
            aria-label="Close disabled while Cypheus is configuring"
            className="inline-flex h-8 w-8 cursor-not-allowed items-center justify-center rounded-md text-fg-muted opacity-40"
          >
            ×
          </button>
        </TooltipTrigger>
        <TooltipContent side="left" className="max-w-xs">
          {strings.cypheus.magicBuild.closeDisabledTooltip}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
```

- [ ] **Step 2: Verify typecheck**

Run: `pnpm typecheck`
Expected: FAIL — `StepList.tsx` still passes the old props. (Will be fixed in Task 6.) Proceed.

- [ ] **Step 3: Commit**

```bash
git add src/features/bot-builder/components/StepDrawer.tsx
git commit -m "feat(bot-builder): rebuild StepDrawer with cypheus mode + cross-fade"
```

---

## Task 6: Collapse 4 drawers to a single shared drawer in StepList

**Files:**
- Modify: `src/features/bot-builder/StepList.tsx`

- [ ] **Step 1: Replace the file**

```tsx
import {
  Sliders,
  LineChart,
  ArrowUpRight,
  Target,
  type LucideIcon,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { StepCard } from './components/StepCard';
import { StepConnector } from './components/StepConnector';
import { StepDrawer, type StepContentMap } from './components/StepDrawer';
import { AddStrategyButton } from './components/AddStrategyButton';
import {
  BotConfigSetup,
  BotConfigConfigure,
} from './steps/BotConfigStep';
import {
  EntryStrategySetup,
  EntryStrategyConfigure,
} from './steps/EntryStrategyStep';
import { DirectionSetup, DirectionConfigure } from './steps/DirectionStep';
import {
  CloseMethodSetup,
  CloseMethodConfigure,
} from './steps/CloseMethodStep';
import { useBuilderStore } from './store/builder.store';
import { useCypheusStore } from '@/features/cypheus/store/cypheus.store';
import { strings } from '@/i18n/en';
import type { StepId } from '@/types/builder.types';

interface StepDef {
  id: StepId;
  index: number;
  icon: LucideIcon;
  title: string;
  description: string;
  setup: ReactNode;
  configure: ReactNode;
}

const STEP_DEFS: StepDef[] = [
  {
    id: 'bot-config',
    index: 1,
    icon: Sliders,
    title: strings.steps.botConfig.title,
    description: strings.steps.botConfig.description,
    setup: <BotConfigSetup />,
    configure: <BotConfigConfigure />,
  },
  {
    id: 'entry-strategy',
    index: 2,
    icon: LineChart,
    title: strings.steps.entryStrategy.title,
    description: strings.steps.entryStrategy.description,
    setup: <EntryStrategySetup />,
    configure: <EntryStrategyConfigure />,
  },
  {
    id: 'direction',
    index: 3,
    icon: ArrowUpRight,
    title: strings.steps.direction.title,
    description: strings.steps.direction.description,
    setup: <DirectionSetup />,
    configure: <DirectionConfigure />,
  },
  {
    id: 'close-method',
    index: 4,
    icon: Target,
    title: strings.steps.closeMethod.title,
    description: strings.steps.closeMethod.description,
    setup: <CloseMethodSetup />,
    configure: <CloseMethodConfigure />,
  },
];

const CONTENT_BY_STEP: Record<StepId, StepContentMap> = STEP_DEFS.reduce(
  (acc, s) => {
    acc[s.id] = {
      setup: s.setup,
      configure: s.configure,
      title: s.title,
      description: s.description,
      index: s.index,
    };
    return acc;
  },
  {} as Record<StepId, StepContentMap>,
);

export function StepList() {
  const openStep = useBuilderStore((s) => s.openStep);
  const setOpenStep = useBuilderStore((s) => s.setOpenStep);
  const setStepStatus = useBuilderStore((s) => s.setStepStatus);
  const closeCypheusDrawer = useCypheusStore((s) => s.closeCypheusDrawer);
  const setPanelTab = useCypheusStore((s) => s.setPanelTab);

  const closeManualDrawer = () => setOpenStep(null);

  const handleSave = () => {
    if (!openStep) return;
    setStepStatus(openStep, 'configured');
    closeManualDrawer();
  };

  const handleSaveAndNext = () => {
    if (!openStep) return;
    setStepStatus(openStep, 'configured');
    const idx = STEP_DEFS.findIndex((s) => s.id === openStep);
    const next = STEP_DEFS[idx + 1];
    if (next) setOpenStep(next.id);
    else closeManualDrawer();
  };

  const hasNext = openStep
    ? STEP_DEFS.findIndex((s) => s.id === openStep) < STEP_DEFS.length - 1
    : false;

  const handleSummaryDismiss = () => closeCypheusDrawer();
  const handleSummaryReviewJson = () => {
    closeCypheusDrawer();
    setPanelTab('json');
  };

  return (
    <div className="mx-auto flex w-full max-w-[var(--layout-step-list)] flex-col">
      <ol className="space-y-0">
        {STEP_DEFS.map((step, idx) => {
          const next = STEP_DEFS[idx + 1];
          return (
            <li key={step.id} className="group flex flex-col">
              <StepCard
                stepId={step.id}
                index={step.index}
                icon={step.icon}
                title={step.title}
              />
              {next ? (
                <StepConnector fromStep={step.id} toStep={next.id} />
              ) : null}
            </li>
          );
        })}
      </ol>
      <div className="mt-6">
        <AddStrategyButton />
      </div>

      <StepDrawer
        contentByStep={CONTENT_BY_STEP}
        onManualClose={closeManualDrawer}
        onManualSave={handleSave}
        onManualSaveAndNext={handleSaveAndNext}
        hasNext={hasNext}
        onSummaryDismiss={handleSummaryDismiss}
        onSummaryReviewJson={handleSummaryReviewJson}
      />
    </div>
  );
}
```

- [ ] **Step 2: Verify typecheck**

Run: `pnpm typecheck`
Expected: PASS.

- [ ] **Step 3: Run unit tests**

Run: `pnpm test`
Expected: All previous tests still PASS (store + setup-progress).

- [ ] **Step 4: Manual sanity check (browser)**

Run `pnpm dev`, open http://localhost:5173, click each step card. Drawer must still slide in/out with the right title and form. Save / Save & Next / Cancel still work. Close (×) button works.

- [ ] **Step 5: Commit**

```bash
git add src/features/bot-builder/StepList.tsx
git commit -m "refactor(bot-builder): collapse 4 drawers into a single shared StepDrawer"
```

---

## Task 7: Block manual step clicks while Cypheus is pinned

**Files:**
- Modify: `src/features/bot-builder/components/StepCard.tsx`

- [ ] **Step 1: Update click handler and pulse styling**

In `src/features/bot-builder/components/StepCard.tsx`, at the imports add:

```tsx
import { useCypheusStore } from '@/features/cypheus/store/cypheus.store';
```

Inside the component (after `const setOpenStep = ...`) add:

```tsx
  const drawerMode = useCypheusStore((s) => s.drawerMode);
  const cypheusActiveStepId = useCypheusStore((s) => s.cypheusActiveStepId);
  const isPinned = drawerMode === 'cypheus-pinned';
  const isCypheusActive = isPinned && cypheusActiveStepId === stepId;
```

Replace the `onClick` and `className` of the `<button>` so clicks are ignored while pinned and the active card glows:

```tsx
    <button
      type="button"
      onClick={() => {
        if (isPinned) return;
        setOpenStep(stepId);
      }}
      aria-pressed={isOpen}
      aria-disabled={isPinned}
      className={cn(
        'group relative flex w-full flex-col items-stretch overflow-hidden rounded-xl border bg-surface text-left transition-all duration-fast ease-out-quick',
        'hover:bg-surface-hover hover:border-border-strong',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-canvas',
        visualStatus === 'configured' && 'border-bullish/40',
        visualStatus === 'editing' && 'border-brand shadow-glow',
        visualStatus === 'error' && 'border-danger',
        visualStatus === 'pending' && 'border-border',
        isCypheusActive && 'border-brand shadow-glow animate-pulse',
        isPinned && !isCypheusActive && 'cursor-not-allowed opacity-60',
      )}
    >
```

- [ ] **Step 2: Verify typecheck + tests**

Run: `pnpm typecheck && pnpm test`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/features/bot-builder/components/StepCard.tsx
git commit -m "feat(bot-builder): block step card clicks + pulse active step while pinned"
```

---

## Task 8: Rewrite the magic-build script for the new flow

**Files:**
- Modify: `src/features/cypheus/script/magic-build.script.ts`

The new script keeps the per-step typewriter animations and timings but flips drawer state via `startCypheusDrawer` / `switchCypheusStep` / `showCypheusSummary` / `closeCypheusDrawer` instead of toggling `openStep`.

- [ ] **Step 1: Replace the file**

```typescript
import { useBuilderStore } from '@/features/bot-builder/store/builder.store';
import { useCypheusStore } from '../store/cypheus.store';
import { makeIndicator } from '@/features/indicators/indicator-registry';
import {
  isCurrent,
  sleep,
  startScript,
  typewriterMessage,
  typewriterValue,
} from './script-runner';
import { strings } from '@/i18n/en';

/**
 * Hardcoded magic-build demo. The drawer is opened ONCE at the start of step 1
 * and closed ONCE after the summary view dismisses; intermediate steps swap
 * the drawer's content via switchCypheusStep so the Sheet stays mounted.
 *
 * See Spec/Phase 1/cypheus/drawer_persistence_spec.md for the timeline.
 */
export async function runMagicBuild(): Promise<void> {
  const ctx = startScript();
  const cy = () => useCypheusStore.getState();
  const builder = () => useBuilderStore.getState();

  cy().setState('thinking');
  cy().setAvatar('thinking');
  await sleep(1000, ctx);
  if (!isCurrent(ctx)) return;

  cy().setAvatar('speaking');
  cy().setState('building');
  await typewriterMessage(strings.cypheus.magicBuild.ack, ctx);
  if (!isCurrent(ctx)) return;
  await sleep(300, ctx);
  await typewriterMessage(strings.cypheus.magicBuild.note, ctx);
  if (!isCurrent(ctx)) return;
  await sleep(500, ctx);

  /* ────────── Step 1: Bot Config ────────── */
  builder().setBotName('Bollinger Breakout');
  builder().setStepStatus('bot-config', 'editing');
  builder().setDrawerTab('setup');
  cy().startCypheusDrawer('bot-config');
  await sleep(500, ctx);
  if (!isCurrent(ctx)) return;
  await typewriterMessage(strings.cypheus.magicBuild.step1, ctx);
  await typewriterValue(
    (v) => builder().patchBotConfig({ pair: v }),
    'BTC-USDC',
    ctx,
    140,
  );
  if (!isCurrent(ctx)) return;
  await sleep(300, ctx);
  builder().patchBotConfig({ timeframe: '5m' });
  await sleep(300, ctx);
  builder().patchBotConfig({ tradingMode: 'dry-run' });
  await sleep(300, ctx);
  await typewriterValue(
    (v) => {
      const n = Number(v);
      builder().patchBotConfig({ leverage: Number.isFinite(n) ? n : 1 });
    },
    '20',
    ctx,
    160,
  );
  if (!isCurrent(ctx)) return;
  await sleep(400, ctx);
  await typewriterMessage(strings.cypheus.magicBuild.step1Comment, ctx);
  await sleep(800, ctx);
  builder().setStepStatus('bot-config', 'configured');
  if (!isCurrent(ctx)) return;

  /* ────────── Step 2: Entry Strategy ────────── */
  builder().setStepStatus('entry-strategy', 'editing');
  cy().switchCypheusStep('entry-strategy');
  await sleep(500, ctx);
  if (!isCurrent(ctx)) return;
  await typewriterMessage(strings.cypheus.magicBuild.step2, ctx);

  builder().patchStrategy({ candlestick: ['close'] });
  await sleep(300, ctx);
  builder().patchStrategy({ candlestick: ['close', 'volume'] });
  await sleep(400, ctx);

  const rsi = makeIndicator('RSI');
  builder().patchStrategy({ indicators: [rsi] });
  await sleep(400, ctx);

  builder().patchStrategy({
    entryConditions: {
      logic: { type: 'AND', threshold: null },
      conditions: [
        {
          id: crypto.randomUUID(),
          left: 'RSI-14',
          op: '<',
          right_type: 'number',
          right_number: 30,
          right_indicator: null,
          lookback: 0,
        },
      ],
    },
  });
  await sleep(600, ctx);
  if (!isCurrent(ctx)) return;
  await typewriterMessage(strings.cypheus.magicBuild.step2Comment, ctx);
  await sleep(800, ctx);
  builder().setStepStatus('entry-strategy', 'configured');
  if (!isCurrent(ctx)) return;

  /* ────────── Step 3: Direction & Order ────────── */
  builder().setStepStatus('direction', 'editing');
  cy().switchCypheusStep('direction');
  await sleep(500, ctx);
  if (!isCurrent(ctx)) return;
  await typewriterMessage(strings.cypheus.magicBuild.step3, ctx);
  builder().patchDirection({ direction: 'long' });
  await sleep(400, ctx);
  builder().patchDirection({ orderType: 'market' });
  await sleep(800, ctx);
  builder().setStepStatus('direction', 'configured');
  if (!isCurrent(ctx)) return;

  /* ────────── Step 4: Close Method ────────── */
  builder().setStepStatus('close-method', 'editing');
  builder().setDrawerTab('setup');
  cy().switchCypheusStep('close-method');
  await sleep(500, ctx);
  if (!isCurrent(ctx)) return;
  await typewriterMessage(strings.cypheus.magicBuild.step4, ctx);
  builder().patchCloseMethod({ type: 'tp_sl' });
  await sleep(400, ctx);
  builder().setDrawerTab('configure');
  await sleep(400, ctx);
  builder().patchCloseMethod({
    tpEnabled: true,
    tpLevels: [{ profit: 5, amount: 50 }],
  });
  await sleep(800, ctx);
  builder().patchCloseMethod({
    tpLevels: [
      { profit: 5, amount: 50 },
      { profit: 10, amount: 25 },
    ],
  });
  await sleep(800, ctx);
  builder().patchCloseMethod({ slEnabled: true, slValue: -3 });
  await sleep(500, ctx);
  if (!isCurrent(ctx)) return;
  await typewriterMessage(strings.cypheus.magicBuild.step4Comment, ctx);
  await sleep(800, ctx);
  builder().setStepStatus('close-method', 'configured');
  if (!isCurrent(ctx)) return;

  /* ────────── Summary + close ────────── */
  await typewriterMessage(strings.cypheus.magicBuild.doneA, ctx);
  cy().showCypheusSummary();
  await sleep(400, ctx);
  await typewriterMessage(strings.cypheus.magicBuild.doneB, ctx);

  cy().setAvatar('idle');
  cy().setState('done');

  // The summary view auto-closes itself after 2s (CypheusSummaryView). We
  // intentionally do NOT call closeCypheusDrawer here so the user can also
  // dismiss manually via the summary buttons.
}
```

- [ ] **Step 2: Verify typecheck**

Run: `pnpm typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/features/cypheus/script/magic-build.script.ts
git commit -m "refactor(cypheus): rewrite magic build to pin drawer and swap content"
```

---

## Task 9: Reset drawer state when user clicks "Create new bot"

**Files:**
- Modify: `src/features/cypheus/CreateNewBotButton.tsx`

- [ ] **Step 1: Read the file**

Look at the current file:

```bash
cat src/features/cypheus/CreateNewBotButton.tsx
```

- [ ] **Step 2: Confirm reset coverage**

`useCypheusStore.getState().resetAll()` already clears `drawerMode` and `cypheusActiveStepId` (set in Task 1). Verify nothing else needs to change here. Open the file:

```bash
grep -n "resetAll\|setOpenStep\|abortAllScripts" src/features/cypheus/CreateNewBotButton.tsx
```

Expected output should already include `useCypheusStore.getState().resetAll()` and `useBuilderStore.getState().resetAll()` (which sets `openStep` to `null`) plus an `abortAllScripts()` call. If those three calls are present, no change is needed and this task is a no-op — just confirm and skip the commit step.

If any of the three is missing, add it next to the existing `resetAll` calls in the click handler:

```tsx
import { abortAllScripts } from './script/script-runner';
// ...
const handleConfirm = () => {
  abortAllScripts();
  useBuilderStore.getState().resetAll();
  useCypheusStore.getState().resetAll();
  // ...existing dialog close logic
};
```

- [ ] **Step 3: Run tests**

Run: `pnpm test && pnpm typecheck`
Expected: PASS.

- [ ] **Step 4: Commit (only if changes were needed)**

```bash
git add src/features/cypheus/CreateNewBotButton.tsx
git commit -m "fix(cypheus): ensure drawer mode resets on Create new bot"
```

---

## Task 10: Add an integration test for the pinned-drawer flow

**Files:**
- Create: `src/features/bot-builder/components/StepDrawer.test.tsx`

- [ ] **Step 1: Write the test**

```tsx
import { describe, expect, it, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StepDrawer, type StepContentMap } from './StepDrawer';
import { useBuilderStore } from '@/features/bot-builder/store/builder.store';
import { useCypheusStore } from '@/features/cypheus/store/cypheus.store';
import type { StepId } from '@/types/builder.types';

const CONTENT: Record<StepId, StepContentMap> = {
  'bot-config': {
    setup: <div data-testid="bot-config-setup">bot-config setup body</div>,
    configure: <div>cfg</div>,
    title: 'Bot Config',
    description: 'desc',
    index: 1,
  },
  'entry-strategy': {
    setup: <div data-testid="entry-setup">entry setup body</div>,
    configure: <div>cfg</div>,
    title: 'Entry Strategy',
    description: 'desc',
    index: 2,
  },
  direction: {
    setup: <div data-testid="dir-setup">dir setup body</div>,
    configure: <div>cfg</div>,
    title: 'Direction & Order',
    description: 'desc',
    index: 3,
  },
  'close-method': {
    setup: <div data-testid="close-setup">close setup body</div>,
    configure: <div>cfg</div>,
    title: 'Close Method',
    description: 'desc',
    index: 4,
  },
};

const noop = () => {};

describe('StepDrawer integration', () => {
  beforeEach(() => {
    useBuilderStore.getState().resetAll();
    useCypheusStore.getState().resetAll();
  });

  it('renders the manual footer with Cancel/Save when openStep is set', () => {
    useBuilderStore.getState().setOpenStep('bot-config');
    render(
      <StepDrawer
        contentByStep={CONTENT}
        onManualClose={noop}
        onManualSave={noop}
        onManualSaveAndNext={noop}
        hasNext
        onSummaryDismiss={noop}
        onSummaryReviewJson={noop}
      />,
    );
    expect(screen.getByText('Cancel')).toBeInTheDocument();
    expect(screen.getByText('Save')).toBeInTheDocument();
    expect(screen.getByTestId('bot-config-setup')).toBeInTheDocument();
  });

  it('shows the pinned footer and the cypheus active step content', () => {
    useCypheusStore.getState().startCypheusDrawer('entry-strategy');
    render(
      <StepDrawer
        contentByStep={CONTENT}
        onManualClose={noop}
        onManualSave={noop}
        onManualSaveAndNext={noop}
        hasNext
        onSummaryDismiss={noop}
        onSummaryReviewJson={noop}
      />,
    );
    expect(screen.queryByText('Cancel')).not.toBeInTheDocument();
    expect(screen.getByText(/Cypheus is configuring/i)).toBeInTheDocument();
    expect(screen.getByTestId('entry-setup')).toBeInTheDocument();
  });

  it('switches content when cypheusActiveStepId changes', () => {
    useCypheusStore.getState().startCypheusDrawer('bot-config');
    const view = render(
      <StepDrawer
        contentByStep={CONTENT}
        onManualClose={noop}
        onManualSave={noop}
        onManualSaveAndNext={noop}
        hasNext
        onSummaryDismiss={noop}
        onSummaryReviewJson={noop}
      />,
    );
    expect(screen.getByTestId('bot-config-setup')).toBeInTheDocument();

    useCypheusStore.getState().switchCypheusStep('direction');
    view.rerender(
      <StepDrawer
        contentByStep={CONTENT}
        onManualClose={noop}
        onManualSave={noop}
        onManualSaveAndNext={noop}
        hasNext
        onSummaryDismiss={noop}
        onSummaryReviewJson={noop}
      />,
    );
    // Animations are async — query after a microtask flush would be ideal,
    // but AnimatePresence with mode="wait" lands the new node synchronously
    // when initial=animate transitions are short.
    expect(screen.getByTestId('dir-setup')).toBeInTheDocument();
  });

  it('renders the summary view in cypheus-summary mode', () => {
    useCypheusStore.getState().startCypheusDrawer('close-method');
    useCypheusStore.getState().showCypheusSummary();
    render(
      <StepDrawer
        contentByStep={CONTENT}
        onManualClose={noop}
        onManualSave={noop}
        onManualSaveAndNext={noop}
        hasNext={false}
        onSummaryDismiss={noop}
        onSummaryReviewJson={noop}
      />,
    );
    expect(screen.getByText('All set ✓')).toBeInTheDocument();
    expect(screen.getByText('Review JSON')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run tests**

Run: `pnpm test -- StepDrawer.test`
Expected: PASS (4 tests).

- [ ] **Step 3: Run the full suite**

Run: `pnpm test`
Expected: PASS — all suites green.

- [ ] **Step 4: Commit**

```bash
git add src/features/bot-builder/components/StepDrawer.test.tsx
git commit -m "test(bot-builder): cover pinned drawer + summary modes"
```

---

## Task 11: End-to-end verification + final commit

- [ ] **Step 1: Run full validation**

Run: `pnpm typecheck && pnpm test && pnpm build`
Expected: All three PASS.

- [ ] **Step 2: Manual browser verification**

Run: `pnpm dev` (or `bash setup_local.sh`).

Walk the acceptance criteria from `Spec/Phase 1/cypheus/drawer_persistence_spec.md` §10 in order:

1. Type any message in Cypheus input → press send.
2. Confirm: drawer slides IN exactly **once** at the start of step 1.
3. Confirm: header text + body cross-fade between steps; no slide-out animation between steps.
4. Confirm: footer reads "⚡ Cypheus is configuring..." during the build, no Cancel/Save buttons.
5. Confirm: × button is disabled with tooltip while pinned.
6. Confirm: clicking another step card while pinned does nothing.
7. Confirm: after step 4 the drawer shows the "All set ✓" summary view with 4 ticked steps + Review JSON / Close.
8. Confirm: drawer auto-closes ~2 s after summary appears (or immediately if user clicks Close).
9. Confirm: clicking Review JSON closes the drawer and switches the left panel to the JSON tab.
10. Confirm: total magic-build runtime is ≤ 35 s (was ~45 s).
11. Confirm: clicking "Create new bot" mid-build aborts and resets — drawer slides out cleanly.

- [ ] **Step 3: Final commit (if any docs touched)**

If you adjusted the spec or this plan during verification, commit:

```bash
git add Spec/Phase\ 1/cypheus/
git commit -m "docs(cypheus): tweak drawer-persistence spec post-verification"
```

Otherwise nothing to commit — implementation is done.

---

## Self-Review Notes

**Spec coverage:**
- §1–§2 (problem + desired): captured in plan goal + task 8.
- §3 (state machine): task 1 + task 5.
- §4 (content cross-fade): task 5 (AnimatePresence).
- §4.3 (header progress indicator "Step N of 4"): task 5 (`progressLabel` in description).
- §5 (backdrop persistence + step card pulse): the existing `hideOverlay` prop already keeps Cypheus' scoped overlay strategy intact across the build because the Sheet now stays mounted (no extra work). Step card pulse: task 7.
- §6 (timeline): task 8.
- §7 (summary view): task 4.
- §8 (edge cases — disabled close, ignore step clicks, refresh, resize): tasks 5 + 7. Refresh resets the script-driven Cypheus store (no persist) — already true. Window resize keeps drawer width via `drawerWidth` (untouched).
- §9 (implementation notes): tasks 1 + 5.
- §10 (acceptance criteria): task 11 verification checklist.

**Type consistency:** Method names are stable (`startCypheusDrawer`, `switchCypheusStep`, `showCypheusSummary`, `closeCypheusDrawer`) and used the same way across tasks 1, 5, 6, 8, 9, 10.

**Placeholder scan:** None remaining; every step has runnable code or a concrete bash command.
