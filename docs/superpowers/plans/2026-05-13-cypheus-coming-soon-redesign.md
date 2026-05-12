# Cypheus "Coming Soon" Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the scripted Cypheus chat demo with a one-way "Coming Soon" greeting, relocate "Create new bot" to the header toolbar, re-trigger the bottom dock from manual step opens, and remove the magic-build engine end-to-end (including the template auto-fill animation that shares the same engine).

**Architecture:** Six sequential tasks ordered for compiler safety. Start by removing the larger consumer of the magic-build infrastructure (template animation), then strip the Cypheus panel UI, then drop the now-orphaned pinned/summary drawer modes + store fields, then surface "Create new bot" in the header, retrigger the dock from `openStep`, and finally add the "Coming Soon" pill polish. Each task leaves the codebase compiling, all tests green, and is its own commit.

**Tech Stack:** React 18, TypeScript 5.7, Vite 6, Tailwind 3, Zustand 5, Vitest 2 + Testing Library, pnpm 10.

**Spec:** `docs/superpowers/specs/2026-05-12-cypheus-coming-soon-redesign-design.md`

**Pre-conditions:**
- Working tree should be clean. Either commit / stash the existing uncommitted edits (`src/features/bot-builder/steps/CloseMethodStep.tsx`, `src/features/cypheus/CypheusPanel.tsx`, `public/closemethod-tabs-demo.html`) or run this plan in a fresh worktree.
- Recommended: run from a worktree off `feat/auth-and-submit` (or main if that branch has shipped) so the diff stays reviewable.

---

## File-by-file overview

| File | Action | Task |
|---|---|---|
| `src/templates/apply.ts` | Modify — drop animation branch | 1 |
| `src/templates/animation.ts` | Delete | 1 |
| `src/templates/types.ts` | Modify — drop `TemplateAnimationScript`, `Narration*`, `script?` from `BotTemplate` | 1 |
| `src/templates/catalog/cypheus-default.ts` | Modify — drop `script:` field | 1 |
| `src/templates/catalog/conservative-dca-btc.ts` | Modify — drop `script:` field | 1 |
| `src/templates/catalog/multi-tf-trend-alts.ts` | Modify — drop `script:` field | 1 |
| `src/templates/catalog/scalping-btc-1m.ts` | Modify — drop `script:` field | 1 |
| `src/templates/catalog/macd-momentum-bnb.ts` | Modify — drop `script:` field | 1 |
| `src/templates/catalog/rsi-oversold-eth-1h.ts` | Modify — drop `script:` field | 1 |
| `src/features/cypheus/CypheusPanel.tsx` | Modify — strip nav, input, JSON, button | 2 |
| `src/features/cypheus/CypheusInput.tsx` | Delete | 2 |
| `src/features/cypheus/JsonLiveView.tsx` | Delete | 2 |
| `src/features/cypheus/JsonLiveView.test.tsx` | Delete | 2 |
| `src/features/cypheus/JsonEmptyState.tsx` | Delete | 2 |
| `src/features/cypheus/script/magic-build.script.ts` | Delete | 2 |
| `src/features/cypheus/script/greeting.script.ts` | Modify — 3 bubbles, new copy | 2 |
| `src/i18n/en.ts` | Modify — drop magicBuild/json/tab/input strings, update greeting | 2 |
| `src/features/cypheus/store/cypheus.store.ts` | Modify — slim down | 3 |
| `src/features/cypheus/store/cypheus.store.test.ts` | Modify — update tests | 3 |
| `src/features/bot-builder/components/StepDrawer.tsx` | Modify — drop pinned/summary modes | 3 |
| `src/features/bot-builder/components/StepDrawer.test.tsx` | Modify — drop pinned/summary tests | 3 |
| `src/features/bot-builder/components/CypheusPinnedFooter.tsx` | Delete | 3 |
| `src/features/bot-builder/components/CypheusSummaryView.tsx` | Delete | 3 |
| `src/features/bot-builder/BotBuilderCanvas.tsx` | Modify — drop `cypheusActiveStepId` ref | 3 |
| `src/features/bot-builder/components/StepCard.tsx` | Modify — drop pinned visual variant | 3 |
| `src/features/bot-builder/components/StrategyCard.tsx` | Modify — drop pinned visual variant | 3 |
| `src/features/bot-builder/components/HeaderToolbar.tsx` | Modify — mount Create new bot button | 4 |
| `src/features/cypheus/CreateNewBotButton.tsx` | Modify — restyle for toolbar | 4 |
| `src/pages/BuilderPage.tsx` | Modify — add openStep watcher effect | 5 |
| `src/features/cypheus/CypheusDock.tsx` | Modify — simplify status text | 5 |

---

## Task 1: Strip template auto-fill animation

**Goal:** Click-template-then-animate flow goes away. Templates always snap-apply. After this task, `runTemplateAnimation` no longer exists and the magic-build engine has only the chat-driven path left.

**Files:**
- Modify: `src/templates/apply.ts`
- Delete: `src/templates/animation.ts`
- Modify: `src/templates/types.ts`
- Modify: all 6 files in `src/templates/catalog/` that have a `script:` field (see overview table)

**Test:** `src/templates/__tests__/apply.test.ts` (create if missing — see Step 1)

### Steps

- [ ] **Step 1: Check whether an apply test already exists**

Run:
```bash
find src/templates -name "*.test.*" -o -name "__tests__" -type d
```
Expected: lists existing tests (likely none for `apply.ts` directly). If none, you'll write the test below from scratch at `src/templates/__tests__/apply.test.ts`. If one exists, extend it instead of creating a new file — read the file first to see its conventions.

- [ ] **Step 2: Write the failing test — apply uses snapApply, never the animation engine**

Create or extend `src/templates/__tests__/apply.test.ts`:

```ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { applyTemplate } from '../apply';
import { useBuilderStore } from '@/features/bot-builder/store/builder.store';

// Pick any catalog template — the simplest one without a `script:` field.
import { breakoutBtc15m } from '../catalog/breakout-btc-15m';

describe('applyTemplate', () => {
  beforeEach(() => {
    useBuilderStore.getState().resetAll();
  });

  it('snap-applies the template state synchronously without invoking any animation engine', async () => {
    // Spy on setTimeout to detect any animation that would schedule work.
    const setTimeoutSpy = vi.spyOn(window, 'setTimeout');

    await applyTemplate(breakoutBtc15m, { skipAnimation: false });

    const state = useBuilderStore.getState();
    expect(state.botName).toBe(breakoutBtc15m.state.botName);
    expect(state.botConfig).toEqual(breakoutBtc15m.state.botConfig);
    // No timers should have been scheduled — snap apply is synchronous.
    expect(setTimeoutSpy).not.toHaveBeenCalled();

    setTimeoutSpy.mockRestore();
  });
});
```

- [ ] **Step 3: Run the test, confirm it fails**

Run: `pnpm test src/templates/__tests__/apply.test.ts`

Expected: FAIL. Current `apply.ts` calls `runTemplateAnimation` which schedules timers, so the `setTimeoutSpy.not.toHaveBeenCalled()` assertion fails.

- [ ] **Step 4: Simplify `apply.ts` — always snap-apply**

Open `src/templates/apply.ts`. Remove the import for `runTemplateAnimation` and the `prefersReducedMotion` import. Replace the `skipAnimation` branch with an unconditional `snapApply` call.

Find this block (around lines 78-89):
```ts
const skipAnimation = opts.skipAnimation ?? prefersReducedMotion();

if (skipAnimation) {
  snapApply(template, migrated);
  return;
}

await runTemplateAnimation(template);
```

Replace with:
```ts
snapApply(template, migrated);
```

Then remove the now-unused imports at the top of the file:
- `import { runTemplateAnimation } from './animation';`
- `import { prefersReducedMotion } from '...';` (whatever path it uses)

If `opts.skipAnimation` is no longer referenced anywhere, also drop it from the `ApplyOptions` type (if defined locally in this file).

- [ ] **Step 5: Run the test, confirm it passes**

Run: `pnpm test src/templates/__tests__/apply.test.ts`

Expected: PASS.

- [ ] **Step 6: Delete `src/templates/animation.ts`**

Run: `rm src/templates/animation.ts`

- [ ] **Step 7: Drop narration types from `src/templates/types.ts`**

Open `src/templates/types.ts`. Remove:
- `NarrationLine` type
- `Narration` type
- `TemplateAnimationScript` interface
- `script?: TemplateAnimationScript;` field from `BotTemplate`

Also clean up the file-level comment at the top that mentions `animation.ts` / magic-build.

After cleanup the BotTemplate interface looks like:

```ts
export interface BotTemplate {
  id: string;
  name: string;
  description: string;
  longDescription?: string;
  tags: readonly string[];
  difficulty: TemplateDifficulty;
  riskLevel: TemplateRisk;
  state: TemplateStateSnapshot;
  meta: {
    author: 'Cypheus' | (string & {});
    schemaVersion: number;
    createdAt: string;
    updatedAt?: string;
  };
}
```

- [ ] **Step 8: Drop `script:` field from each catalog file**

For each of these files:
- `src/templates/catalog/cypheus-default.ts`
- `src/templates/catalog/conservative-dca-btc.ts`
- `src/templates/catalog/multi-tf-trend-alts.ts`
- `src/templates/catalog/scalping-btc-1m.ts`
- `src/templates/catalog/macd-momentum-bnb.ts`
- `src/templates/catalog/rsi-oversold-eth-1h.ts`

Open the file, find the `script: { ... }` block, and delete it. Also remove any imports of `TemplateAnimationScript` / `Narration` / `NarrationLine` if present.

- [ ] **Step 9: Run typecheck**

Run: `pnpm typecheck`

Expected: PASS. If errors appear about missing narration types or `runTemplateAnimation` from somewhere unexpected, grep for the symbol and fix the caller.

- [ ] **Step 10: Run lint + full test suite**

Run: `pnpm lint && pnpm test`

Expected: both PASS. Existing tests that loaded catalog entries may need to be updated if they asserted on the `script` field. Update them by dropping the assertion.

- [ ] **Step 11: Commit**

```bash
git add src/templates/
git commit -m "$(cat <<'EOF'
refactor(templates): drop magic-build auto-fill animation — always snap-apply

Templates now apply instantly. The animation engine and per-template
narration scripts go away as part of the broader Cypheus AI cleanup
(see docs/superpowers/specs/2026-05-12-cypheus-coming-soon-redesign-design.md).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Rewrite Cypheus panel + greeting + i18n

**Goal:** Left panel collapses to header + 3 greeting bubbles only. JSON tab, input box, "Create new bot" button, and the magic-build chat script are gone. Greeting copy announces "Coming Soon".

**Files:**
- Modify: `src/features/cypheus/CypheusPanel.tsx`
- Modify: `src/features/cypheus/script/greeting.script.ts`
- Modify: `src/i18n/en.ts`
- Delete: `src/features/cypheus/CypheusInput.tsx`, `src/features/cypheus/JsonLiveView.tsx`, `src/features/cypheus/JsonLiveView.test.tsx`, `src/features/cypheus/JsonEmptyState.tsx`, `src/features/cypheus/script/magic-build.script.ts`

**Test target:** `src/features/cypheus/CypheusPanel.test.tsx` (create — see Step 1)

### Steps

- [ ] **Step 1: Write the failing test — panel renders 3 greeting bubbles, no input, no JSON tab**

Create `src/features/cypheus/CypheusPanel.test.tsx`:

```tsx
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { CypheusPanel } from './CypheusPanel';
import { useCypheusStore } from './store/cypheus.store';
import { useBuilderStore } from '@/features/bot-builder/store/builder.store';

describe('CypheusPanel', () => {
  beforeEach(() => {
    useCypheusStore.getState().resetAll();
    useBuilderStore.getState().resetAll();
  });

  it('renders the greeting bubbles and no input control', async () => {
    render(<CypheusPanel />);

    // Greeting bubbles arrive via typewriter; wait for the "Coming soon"
    // bubble (the last one) to appear.
    await waitFor(
      () => {
        expect(screen.getByText(/Coming soon/i)).toBeInTheDocument();
      },
      { timeout: 4000 },
    );

    // First two bubbles also present.
    expect(screen.getByText(/Hi, I'm Cypheus/i)).toBeInTheDocument();
    expect(screen.getByText(/AI co-pilot/i)).toBeInTheDocument();

    // The chat input must NOT be rendered.
    expect(screen.queryByPlaceholderText(/Tell Cypheus/i)).not.toBeInTheDocument();

    // The JSON section tab must NOT be rendered.
    expect(screen.queryByRole('button', { name: /JSON/i })).not.toBeInTheDocument();

    // The in-panel "Create new bot" button must NOT be rendered.
    expect(screen.queryByRole('button', { name: /Create new bot/i })).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the test, confirm it fails**

Run: `pnpm test src/features/cypheus/CypheusPanel.test.tsx`

Expected: FAIL. The current panel still renders the input, JSON tab, and the in-panel "Create new bot" button. The "Coming soon" copy doesn't exist yet.

- [ ] **Step 3: Update `src/i18n/en.ts` — drop dead keys, update greeting**

Open `src/i18n/en.ts`. Within the `cypheus:` block:

1. **Drop these keys:**
   - `tabLabel`
   - `jsonTabLabel`
   - `inputPlaceholder`
   - `send`
   - `afterDone`
   - The entire `magicBuild: { ... }` sub-object
   - The entire `json: { ... }` sub-object

2. **Update `greeting`:** replace existing two strings with three:
```ts
greeting: {
  hello: "Hi, I'm Cypheus.",
  pitch:
    "I'm your AI co-pilot — soon I'll be able to build trading bots from just a conversation.",
  comingSoon:
    "**Coming soon.** For now, pick a template or build manually with the step cards.",
},
```

(The `**...**` markdown markers carry intent — implementation render decision is in Step 4.)

3. Verify other keys still referenced elsewhere are intact: `panelTitle`, `createNewBot`, `confirmReset`, `progress`.

- [ ] **Step 4: Rewrite `src/features/cypheus/script/greeting.script.ts`**

Replace the whole file with:

```ts
import {
  isCurrent,
  sleep,
  startScript,
  typewriterMessage,
} from './script-runner';
import { strings } from '@/i18n/en';

/**
 * Runs the one-way Cypheus intro on first mount with an empty chat.
 * Three bubbles: hello, pitch, coming-soon. No interaction follows —
 * the panel has no input, the chat is purely informational until real
 * AI ships (see docs/superpowers/specs/2026-05-12-cypheus-coming-soon-redesign-design.md).
 */
export async function runGreeting(): Promise<void> {
  const ctx = startScript();

  await sleep(500, ctx);
  if (!isCurrent(ctx)) return;

  await typewriterMessage(strings.cypheus.greeting.hello, ctx);
  if (!isCurrent(ctx)) return;
  await sleep(400, ctx);

  await typewriterMessage(strings.cypheus.greeting.pitch, ctx);
  if (!isCurrent(ctx)) return;
  await sleep(400, ctx);

  await typewriterMessage(strings.cypheus.greeting.comingSoon, ctx);
}
```

> **Note on inline bold (`**Coming soon.**`):** if `MessageBubble` doesn't already parse Markdown, the asterisks render literally. That's acceptable for now (Tri can iterate). If it bothers you, drop the asterisks from the i18n string in this commit.

- [ ] **Step 5: Rewrite `src/features/cypheus/CypheusPanel.tsx` — strip everything except header + chat**

Replace the file contents with:

```tsx
import { useEffect } from 'react';
import { PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { CypheusChat } from './CypheusChat';
import { useCypheusStore } from './store/cypheus.store';
import { useLayoutPrefsStore } from '@/features/layout-prefs/layout-prefs.store';
import { runGreeting } from './script/greeting.script';
import { strings } from '@/i18n/en';

/**
 * Cypheus left panel — one-way intro surface until real AI ships.
 *
 * - Expanded (~400px): title + collapse toggle + greeting bubbles.
 * - Collapsed (~48px): just the collapse toggle anchored to the left.
 *
 * Width is owned by `--layout-left-panel` (driven by BuilderPage), so
 * the canvas + drawer overlay reflow consistently.
 */
export function CypheusPanel() {
  const collapsed = useLayoutPrefsStore((s) => s.leftPanelCollapsed);
  const toggleCollapse = useLayoutPrefsStore((s) => s.toggleLeftPanel);

  const messages = useCypheusStore((s) => s.messages);

  // Auto-run greeting on first render with empty chat.
  useEffect(() => {
    if (messages.length === 0) {
      void runGreeting();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <TooltipProvider delayDuration={collapsed ? 100 : 250}>
      <aside
        className={cn(
          'card-coin98 flex h-full flex-shrink-0 flex-col',
          'transition-[width] duration-fast ease-out-quick',
        )}
        style={{ width: 'var(--layout-left-panel)' }}
        aria-label="Cypheus assistant panel"
      >
        <header
          className={cn(
            'flex items-center',
            collapsed
              ? 'justify-center px-1.5 py-3'
              : 'justify-between gap-2 px-4 py-3',
          )}
        >
          {!collapsed && (
            <h2 className="truncate text-xs font-semibold uppercase tracking-wider text-fg-muted">
              {strings.cypheus.panelTitle}
            </h2>
          )}
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={toggleCollapse}
                aria-label={
                  collapsed
                    ? strings.layoutToggles.cypheusShowAria
                    : strings.layoutToggles.cypheusHideAria
                }
                aria-expanded={!collapsed}
                className={cn(
                  'inline-flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-fg-muted',
                  'transition-colors duration-fast hover:bg-[#1a1a1f] hover:text-fg',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand',
                )}
              >
                {collapsed ? (
                  <PanelLeftOpen className="h-4 w-4" aria-hidden="true" />
                ) : (
                  <PanelLeftClose className="h-4 w-4" aria-hidden="true" />
                )}
              </button>
            </TooltipTrigger>
            <TooltipContent side="right">
              {collapsed
                ? strings.layoutToggles.cypheusShowTooltip
                : strings.layoutToggles.cypheusHideTooltip}
            </TooltipContent>
          </Tooltip>
        </header>

        {!collapsed && (
          <div className="flex flex-1 flex-col overflow-hidden">
            <CypheusChat />
          </div>
        )}
      </aside>
    </TooltipProvider>
  );
}
```

(The "Coming Soon" pill is Task 6 — keep this file pristine for now.)

- [ ] **Step 6: Delete the now-orphaned files**

Run:
```bash
rm src/features/cypheus/CypheusInput.tsx \
   src/features/cypheus/JsonLiveView.tsx \
   src/features/cypheus/JsonLiveView.test.tsx \
   src/features/cypheus/JsonEmptyState.tsx \
   src/features/cypheus/script/magic-build.script.ts
```

- [ ] **Step 7: Run the test, confirm it passes**

Run: `pnpm test src/features/cypheus/CypheusPanel.test.tsx`

Expected: PASS.

- [ ] **Step 8: Run typecheck**

Run: `pnpm typecheck`

Expected: errors about dangling references to deleted symbols. Likely candidates:
- `CreateNewBotButton.tsx` still imports `abortAllScripts` — that's fine, script-runner stays.
- `CreateNewBotButton.tsx` imports `runGreeting` — that's fine.
- Anything that imported `JsonLiveView`, `CypheusInput`, `magic-build` — should be only the panel, already updated. If grep finds others, fix them.

If `cypheus.store` types reference `LeftPanelTab`, leave the store untouched for now (Task 3 handles the store).

- [ ] **Step 9: Run lint + full test suite**

Run: `pnpm lint && pnpm test`

Expected: typecheck-clean tests pass. **Note:** `cypheus.store.test.ts` and `StepDrawer.test.tsx` may break because the store still has dead surface — that's expected, Task 3 fixes them. If any cypheus-store test fails *unrelated* to pinned/summary modes, investigate.

If only Task-3-area tests fail, proceed. Otherwise fix before committing.

- [ ] **Step 10: Commit**

```bash
git add -A src/features/cypheus/ src/i18n/en.ts
git commit -m "$(cat <<'EOF'
refactor(cypheus): rewrite panel as one-way "coming soon" intro

- Drop 2-tab nav, chat input, in-panel "Create new bot" button, JSON
  live view, magic-build chat script.
- New 3-bubble greeting announces AI is coming soon.
- Spec: docs/superpowers/specs/2026-05-12-cypheus-coming-soon-redesign-design.md

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Drop pinned/summary drawer modes + store fields

**Goal:** No more `cypheus-pinned` / `cypheus-summary` drawer mode. Store loses `panelTab`, `jsonViewedAt`, `drawerMode`, `cypheusActiveStepId`, `state` machine values, `setAvatar`. StepDrawer collapses to single mode (manual vs. closed).

**Files:**
- Modify: `src/features/cypheus/store/cypheus.store.ts`
- Modify: `src/features/cypheus/store/cypheus.store.test.ts`
- Modify: `src/features/bot-builder/components/StepDrawer.tsx`
- Modify: `src/features/bot-builder/components/StepDrawer.test.tsx`
- Modify: `src/features/bot-builder/BotBuilderCanvas.tsx`
- Modify: `src/features/bot-builder/components/StepCard.tsx`
- Modify: `src/features/bot-builder/components/StrategyCard.tsx`
- Delete: `src/features/bot-builder/components/CypheusPinnedFooter.tsx`
- Delete: `src/features/bot-builder/components/CypheusSummaryView.tsx`

### Steps

- [ ] **Step 1: Write the failing test — store no longer exposes pinned/summary fields**

Open `src/features/cypheus/store/cypheus.store.test.ts`. Replace the entire file with:

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { useCypheusStore } from './cypheus.store';

describe('cypheus.store (slim surface)', () => {
  beforeEach(() => {
    useCypheusStore.getState().resetAll();
  });

  it('exposes only the slim surface: phase, messages, resetAll', () => {
    const s = useCypheusStore.getState();
    expect(s.phase).toBe('idle');
    expect(s.messages).toEqual([]);
    expect(typeof s.setPhase).toBe('function');
    expect(typeof s.pushMessage).toBe('function');
    expect(typeof s.clearMessages).toBe('function');
    expect(typeof s.resetAll).toBe('function');
  });

  it('does NOT expose magic-build or panel-tab surface', () => {
    const s = useCypheusStore.getState() as Record<string, unknown>;
    expect(s.panelTab).toBeUndefined();
    expect(s.jsonViewedAt).toBeUndefined();
    expect(s.drawerMode).toBeUndefined();
    expect(s.cypheusActiveStepId).toBeUndefined();
    expect(s.startCypheusDrawer).toBeUndefined();
    expect(s.switchCypheusStep).toBeUndefined();
    expect(s.showCypheusSummary).toBeUndefined();
    expect(s.closeCypheusDrawer).toBeUndefined();
  });

  it('setPhase updates the phase', () => {
    useCypheusStore.getState().setPhase('active');
    expect(useCypheusStore.getState().phase).toBe('active');
    useCypheusStore.getState().setPhase('completed');
    expect(useCypheusStore.getState().phase).toBe('completed');
  });

  it('pushMessage appends a message with a generated id + timestamp', () => {
    const id = useCypheusStore
      .getState()
      .pushMessage({ role: 'cypheus', text: 'hi' });
    const messages = useCypheusStore.getState().messages;
    expect(messages).toHaveLength(1);
    expect(messages[0].id).toBe(id);
    expect(messages[0].text).toBe('hi');
    expect(messages[0].ts).toBeGreaterThan(0);
  });

  it('resetAll clears messages and phase', () => {
    useCypheusStore.getState().pushMessage({ role: 'cypheus', text: 'x' });
    useCypheusStore.getState().setPhase('active');
    useCypheusStore.getState().resetAll();
    expect(useCypheusStore.getState().messages).toEqual([]);
    expect(useCypheusStore.getState().phase).toBe('idle');
  });
});
```

- [ ] **Step 2: Run the test, confirm it fails**

Run: `pnpm test src/features/cypheus/store/cypheus.store.test.ts`

Expected: FAIL. Current store still exposes `panelTab`, `drawerMode`, etc.

- [ ] **Step 3: Rewrite `src/features/cypheus/store/cypheus.store.ts` — slim surface**

Replace the file contents with:

```ts
import { create } from 'zustand';

/**
 * Lifecycle phase used by the floating bottom dock:
 *   idle      – fresh session. Dock hidden.
 *   active    – user has opened at least one step. Dock visible.
 *   completed – all phases configured. Dock auto-dismissed after a delay;
 *               re-opening a step does NOT bring the dock back. Only
 *               `resetAll()` returns the phase to idle.
 */
export type Phase = 'idle' | 'active' | 'completed';

export interface ChatMessage {
  id: string;
  role: 'cypheus' | 'user';
  text: string;
  /** When true the bubble renders with the typewriter animation. */
  typing?: boolean;
  ts: number;
}

interface CypheusStore {
  phase: Phase;
  messages: ChatMessage[];

  setPhase: (phase: Phase) => void;
  pushMessage: (msg: Omit<ChatMessage, 'id' | 'ts'>) => string;
  updateMessage: (id: string, patch: Partial<Omit<ChatMessage, 'id'>>) => void;
  clearMessages: () => void;

  resetAll: () => void;
}

export const useCypheusStore = create<CypheusStore>((set) => ({
  phase: 'idle',
  messages: [],

  setPhase: (phase) => set({ phase }),

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

  resetAll: () =>
    set({
      phase: 'idle',
      messages: [],
    }),
}));
```

- [ ] **Step 4: Run the store test, confirm it passes**

Run: `pnpm test src/features/cypheus/store/cypheus.store.test.ts`

Expected: PASS.

- [ ] **Step 5: Find every caller of removed store fields**

Run:
```bash
grep -rn "drawerMode\|cypheusActiveStepId\|startCypheusDrawer\|switchCypheusStep\|showCypheusSummary\|closeCypheusDrawer\|panelTab\|setPanelTab\|jsonViewedAt\|setAvatar\|\\.setState(" src/ --include="*.ts" --include="*.tsx"
```

Expected: hits in `BotBuilderCanvas.tsx`, `StepCard.tsx`, `StrategyCard.tsx`, `StepDrawer.tsx`, `StepDrawer.test.tsx`, `CreateNewBotButton.tsx` (only if it called `setAvatar`/`setState`). Each must be cleaned.

- [ ] **Step 6: Simplify `StepDrawer.tsx`**

Open `src/features/bot-builder/components/StepDrawer.tsx`. Apply these changes:

1. Remove the import: `import { useCypheusStore } from '@/features/cypheus/store/cypheus.store';`
2. Remove the imports of `CypheusPinnedFooter` and `CypheusSummaryView`.
3. Remove the lines reading `drawerMode` and `cypheusActiveStepId` from the cypheus store.
4. Replace the `effectiveMode` / `activeStepId` derivation block with:
```ts
const activeStepId: StepId | null = openStep;
const isOpen = activeStepId !== null;
const isManual = isOpen;
const isPinned = false; // legacy — kept as local const to minimise diff in JSX
```
   (Setting `isPinned = false` lets you delete the variable in pass 2; doing it as a const first keeps the JSX edits mechanical.)
5. Remove the `isCompositeStrategy` / `isCompositeBotConfig` ternaries that key off `effectiveMode === 'cypheus-summary'` — replace `effectiveMode !== 'cypheus-summary'` checks with `true`.
6. Delete the entire `effectiveMode === 'cypheus-summary'` branch in the JSX (`<CypheusSummaryView ... />`).
7. Delete the `isPinned && <CypheusPinnedFooter />` lines in the composite-strategy and composite-bot-config branches.
8. Delete the `effectiveMode === 'cypheus-pinned'` branch that renders `<CypheusPinnedFooter />` instead of `<SheetFooter>`. Always render the wizard footer (manual).
9. Delete the `isPinned` checks in `<SheetDescription>` (was rendering the "step N of M" pill). The `SheetDescription` element should remain (for a11y) but render an empty children prop or null.
10. Delete the `CloseButton` disabled-while-pinned variant — `<CloseButton onClick={...} />` always enabled, drop the `disabled` prop.
11. Drop the `ConfigureTabTrigger` `pinned` prop. Same for the tab onValueChange `if (isPinned) return;` check.
12. Drop `onEscapeKeyDown={(e) => { if (isPinned) e.preventDefault(); }}` — let escape close normally.

After the JSX simplifies, do pass 2: delete the `isPinned = false` const + every `isPinned` reference.

Final `effectiveMode`-related state should be just: `openStep` derives `activeStepId` and `isOpen`. The drawer has setup/configure tabs (when not composite) or composite content (when composite). Wizard footer always. No cypheus pinned/summary code paths.

If the file gets confusing, a clean rewrite is fine — preserve the StepContentMap props, the tab logic, the composite-content branches, and the wizard footer.

- [ ] **Step 7: Update `StepDrawer.test.tsx`**

Open the file. Delete every test that exercises `cypheus-pinned`, `cypheus-summary`, or the pinned-footer / summary-view rendering. Keep:
- Manual mode open/close
- Tab gating (Configure locked when Setup incomplete)
- Wizard footer button states

If a test mocks `useCypheusStore.getState().drawerMode = 'cypheus-pinned'` to drive a scenario, drop the test entirely.

- [ ] **Step 8: Simplify `BotBuilderCanvas.tsx`**

Open `src/features/bot-builder/BotBuilderCanvas.tsx`. Find lines around 84-93:
```ts
const cypheusActiveStepId = useCypheusStore((s) => s.cypheusActiveStepId);
...
const activeStepId: StepId | null = cypheusActiveStepId ?? openStep;
```
Replace with:
```ts
const activeStepId: StepId | null = openStep;
```
Drop the `useCypheusStore` import if it has no other use in this file.

- [ ] **Step 9: Simplify `StepCard.tsx`**

Open `src/features/bot-builder/components/StepCard.tsx`. Find the block around lines 61-65:
```ts
const cypheusActiveStepId = useCypheusStore((s) => s.cypheusActiveStepId);
...
const isPinned = drawerMode === 'cypheus-pinned';
const isCypheusActive = isPinned && cypheusActiveStepId === stepId;
```
Delete these reads. Find every consumer of `isPinned` / `isCypheusActive` in the JSX (visual "step is being configured by Cypheus" highlight — likely a yellow ring or pulse). Delete those branches; the manual-mode visuals are the new only path.

Drop the `useCypheusStore` import + `CypheusAvatar` import if neither has another use in this file (verify with a quick grep within the file).

- [ ] **Step 10: Simplify `StrategyCard.tsx`**

Open `src/features/bot-builder/components/StrategyCard.tsx`. Find the block around lines 81-86:
```ts
const cypheusActiveStepId = useCypheusStore((s) => s.cypheusActiveStepId);
const isPinned = drawerMode === 'cypheus-pinned';
const isCypheusActive =
  isPinned &&
  cypheusActiveStepId !== null &&
  STRATEGY_SUB_STEPS.includes(cypheusActiveStepId);
```
Same treatment as `StepCard.tsx`. Drop reads + downstream visual branches + the `useCypheusStore` import if unused after.

- [ ] **Step 11: Check `CreateNewBotButton.tsx`**

Open `src/features/cypheus/CreateNewBotButton.tsx`. The current handler may call `abortAllScripts()` and `runGreeting()`. Those are fine (script-runner + greeting both still exist).

If anywhere in the file `setAvatar` or `setState` was called, those are gone — remove the calls (the slim store doesn't have them).

The button styling change is Task 4 — don't touch styling here.

- [ ] **Step 12: Delete the orphan files**

```bash
rm src/features/bot-builder/components/CypheusPinnedFooter.tsx \
   src/features/bot-builder/components/CypheusSummaryView.tsx
```

- [ ] **Step 13: Run typecheck**

Run: `pnpm typecheck`

Expected: PASS. If errors remain about `LeftPanelTab`, `CypheusState`, `AvatarState`, `DrawerMode`, or `CypheusMode` types being imported somewhere, grep the symbol and remove the import.

- [ ] **Step 14: Run lint + full test suite**

Run: `pnpm lint && pnpm test`

Expected: PASS. If a previously-deleted test left a referencing import in `StepDrawer.test.tsx`, clean it up.

- [ ] **Step 15: Commit**

```bash
git add -A src/features/cypheus/store/ src/features/bot-builder/
git commit -m "$(cat <<'EOF'
refactor(drawer): drop cypheus-pinned + cypheus-summary modes

Magic-build engine is gone (Tasks 1+2). The pinned-footer / summary
view + drawer-mode state machine + cypheusActiveStepId field /
panelTab / jsonViewedAt / avatar / state-machine fields they powered
become dead surface. Drawer collapses to single (manual) mode.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Move "Create new bot" to HeaderToolbar

**Goal:** "Create new bot" button lives in the header toolbar between `Export` and `My Bots`. Visual matches the surrounding `<Button variant="secondary" size="sm" className="rounded-full px-3">` pattern.

**Files:**
- Modify: `src/features/cypheus/CreateNewBotButton.tsx`
- Modify: `src/features/bot-builder/components/HeaderToolbar.tsx`

### Steps

- [ ] **Step 1: Write the failing test — HeaderToolbar renders a "Create new bot" trigger**

Either extend an existing HeaderToolbar test or create `src/features/bot-builder/components/HeaderToolbar.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { HeaderToolbar } from './HeaderToolbar';

describe('HeaderToolbar', () => {
  it('renders a "Create new bot" button', () => {
    render(
      <MemoryRouter>
        <HeaderToolbar />
      </MemoryRouter>,
    );

    expect(
      screen.getByRole('button', { name: /Create new bot/i }),
    ).toBeInTheDocument();
  });
});
```

(If `HeaderToolbar` needs extra providers — TooltipProvider, AuthProvider — wrap accordingly. Look at how `StepDrawer.test.tsx` sets up similar contexts.)

- [ ] **Step 2: Run the test, confirm it fails**

Run: `pnpm test src/features/bot-builder/components/HeaderToolbar.test.tsx`

Expected: FAIL.

- [ ] **Step 3: Restyle `CreateNewBotButton.tsx`**

Open `src/features/cypheus/CreateNewBotButton.tsx`. Replace the inline `<button>` element with the design-system `<Button>` so it matches its toolbar siblings:

```tsx
import { useState } from 'react';
import { RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useBuilderStore } from '@/features/bot-builder/store/builder.store';
import { useCypheusStore } from './store/cypheus.store';
import { useTemplateTrackingStore } from '@/templates';
import { abortAllScripts } from './script/script-runner';
import { runGreeting } from './script/greeting.script';
import { strings } from '@/i18n/en';

export function CreateNewBotButton() {
  const [open, setOpen] = useState(false);

  const handleConfirm = () => {
    abortAllScripts();
    useBuilderStore.getState().resetAll();
    useCypheusStore.getState().resetAll();
    useTemplateTrackingStore.getState().clearApplied();
    setOpen(false);
    void runGreeting();
  };

  return (
    <>
      <Button
        variant="secondary"
        size="sm"
        onClick={() => setOpen(true)}
        className="rounded-full px-3"
      >
        <RotateCcw className="h-3.5 w-3.5" />
        {strings.cypheus.createNewBot}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{strings.cypheus.confirmReset.title}</DialogTitle>
            <DialogDescription>
              {strings.cypheus.confirmReset.body}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              {strings.cypheus.confirmReset.cancel}
            </Button>
            <Button variant="destructive" onClick={handleConfirm}>
              {strings.cypheus.confirmReset.confirm}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
```

- [ ] **Step 4: Mount the button in `HeaderToolbar.tsx`**

Open `src/features/bot-builder/components/HeaderToolbar.tsx`. Locate the block between the Export tooltip and the My Bots tooltip (around lines 271-285 — after Export's closing `</Tooltip>` and before My Bots's `<Tooltip>`).

Add the import at the top:
```ts
import { CreateNewBotButton } from '@/features/cypheus/CreateNewBotButton';
```

Insert the component between Export and My Bots:
```tsx
          </Tooltip>
          <CreateNewBotButton />
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setMyBotsOpen(true)}
```

- [ ] **Step 5: Run the test, confirm it passes**

Run: `pnpm test src/features/bot-builder/components/HeaderToolbar.test.tsx`

Expected: PASS.

- [ ] **Step 6: Run typecheck, lint, full test suite**

Run: `pnpm typecheck && pnpm lint && pnpm test`

Expected: all PASS.

- [ ] **Step 7: Commit**

```bash
git add src/features/cypheus/CreateNewBotButton.tsx src/features/bot-builder/components/HeaderToolbar.tsx src/features/bot-builder/components/HeaderToolbar.test.tsx
git commit -m "$(cat <<'EOF'
feat(header): mount Create new bot in toolbar

Moves the reset action out of the Cypheus left panel (which is now
one-way) into the header toolbar between Export and My Bots. Restyled
to match the surrounding secondary buttons.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: Re-trigger the bottom dock from `openStep`

**Goal:** Bottom dock appears the first time the user opens any step in manual mode (was triggered by chat submit, which is gone). Status text simplifies — no more `thinking` / `building` lines.

**Files:**
- Modify: `src/pages/BuilderPage.tsx`
- Modify: `src/features/cypheus/CypheusDock.tsx`

### Steps

- [ ] **Step 1: Write the failing test — opening a step transitions phase idle → active**

Create `src/pages/BuilderPage.test.tsx` (or extend an existing test):

```tsx
import { describe, it, expect, beforeEach } from 'vitest';
import { act, render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { BuilderPage } from './BuilderPage';
import { useBuilderStore } from '@/features/bot-builder/store/builder.store';
import { useCypheusStore } from '@/features/cypheus/store/cypheus.store';

describe('BuilderPage — dock phase trigger', () => {
  beforeEach(() => {
    useBuilderStore.getState().resetAll();
    useCypheusStore.getState().resetAll();
  });

  it('transitions cypheus phase idle → active the first time openStep changes', () => {
    render(
      <MemoryRouter>
        <BuilderPage />
      </MemoryRouter>,
    );

    expect(useCypheusStore.getState().phase).toBe('idle');

    act(() => {
      useBuilderStore.getState().setOpenStep('bot-config');
    });

    expect(useCypheusStore.getState().phase).toBe('active');
  });

  it('does not flip back to active after completed', () => {
    render(
      <MemoryRouter>
        <BuilderPage />
      </MemoryRouter>,
    );

    act(() => {
      useCypheusStore.getState().setPhase('completed');
      useBuilderStore.getState().setOpenStep('bot-config');
    });

    expect(useCypheusStore.getState().phase).toBe('completed');
  });
});
```

- [ ] **Step 2: Run the test, confirm it fails**

Run: `pnpm test src/pages/BuilderPage.test.tsx`

Expected: FAIL. Without the new effect the phase stays `idle` after the step opens.

- [ ] **Step 3: Add the effect to `BuilderPage.tsx`**

Open `src/pages/BuilderPage.tsx`. Near the top of the `BuilderPage` component (where the other store reads / effects live, around the lines that set `--layout-left-panel` CSS variable), add:

```ts
const phase = useCypheusStore((s) => s.phase);
const setPhase = useCypheusStore((s) => s.setPhase);
const openStep = useBuilderStore((s) => s.openStep);

useEffect(() => {
  if (openStep !== null && phase === 'idle') {
    setPhase('active');
  }
}, [openStep, phase, setPhase]);
```

Ensure the file imports `useCypheusStore` (likely already present) and `useEffect` from `react` (likely already present).

- [ ] **Step 4: Run the BuilderPage test, confirm it passes**

Run: `pnpm test src/pages/BuilderPage.test.tsx`

Expected: PASS.

- [ ] **Step 5: Simplify CypheusDock status text**

Open `src/features/cypheus/CypheusDock.tsx`. Apply:

1. Delete the `BUILDING_PHASE_TEXT` constant + import of `stepIdToPhase` / `PhaseId` if only used by it.
2. Replace the `statusText` `useMemo` body with:
```ts
const statusText = useMemo(() => {
  if (allDone) return 'All set – ready to export';
  if (completedPhases === 0) return 'Set up your bot to get started';
  return `${completedPhases} of ${totalPhases} phases configured`;
}, [completedPhases, allDone, totalPhases]);
```
3. Drop `useCypheusStore((s) => s.state)` / `useCypheusStore((s) => s.cypheusActiveStepId)` reads — they no longer exist on the store. Anything that consumed those (active-index calculation) should fall back to `openStep`-only:
```ts
const activeIndex = useMemo(() => {
  if (!openStep) return -1;
  return PHASE_IDS.indexOf(stepIdToPhase(openStep));
}, [openStep]);
```
4. The auto-complete `useEffect` keeps its current shape but drop the `cypheusState === 'thinking' || cypheusState === 'building'` guard — that branch is unreachable now. The simplified effect:
```ts
useEffect(() => {
  if (phase !== 'active') return;
  if (!allDone) return;
  const t = window.setTimeout(() => setPhase('completed'), 3000);
  return () => window.clearTimeout(t);
}, [phase, allDone, setPhase]);
```
5. Drop unused imports.

- [ ] **Step 6: Run typecheck, lint, full test suite**

Run: `pnpm typecheck && pnpm lint && pnpm test`

Expected: all PASS.

- [ ] **Step 7: Manual sanity in the preview**

Open the running preview (`http://127.0.0.1:5174/builder`), click any step card. Verify:
- Dock appears at the bottom with progress dots.
- After completing both phases (use a template or fill manually), dock fades after ~3s.
- "Create new bot" in the header resets and the dock disappears.

- [ ] **Step 8: Commit**

```bash
git add src/pages/BuilderPage.tsx src/pages/BuilderPage.test.tsx src/features/cypheus/CypheusDock.tsx
git commit -m "$(cat <<'EOF'
feat(dock): trigger dock from first openStep, simplify status text

Replaces the dead chat-submit trigger. Bottom dock now appears the
first time the user opens any step in manual mode. Drops the
thinking/building status text branches (no chat flow drives them).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: "Coming Soon" pill in panel header

**Goal:** Small uppercase badge "Coming Soon" sits next to the "CYPHEUS" title in the expanded panel header. Anchors the messaging visually.

**Files:**
- Modify: `src/features/cypheus/CypheusPanel.tsx`
- Modify: `src/i18n/en.ts`

### Steps

- [ ] **Step 1: Write the failing test — header renders the "Coming Soon" pill**

Append to `src/features/cypheus/CypheusPanel.test.tsx`:

```tsx
it('renders a "Coming Soon" pill next to the panel title when expanded', () => {
  render(<CypheusPanel />);

  const pill = screen.getByText(/Coming Soon/i, { selector: '[data-pill="coming-soon"]' });
  expect(pill).toBeInTheDocument();
});
```

- [ ] **Step 2: Run the test, confirm it fails**

Run: `pnpm test src/features/cypheus/CypheusPanel.test.tsx`

Expected: FAIL (only the new test).

- [ ] **Step 3: Add the i18n string**

Open `src/i18n/en.ts`. Inside the `cypheus:` block, add:
```ts
comingSoonPill: 'Coming Soon',
```
Position it near `panelTitle` for readability.

- [ ] **Step 4: Render the pill in the panel header**

Open `src/features/cypheus/CypheusPanel.tsx`. Inside the `<header>` element, replace the title block:

```tsx
{!collapsed && (
  <h2 className="truncate text-xs font-semibold uppercase tracking-wider text-fg-muted">
    {strings.cypheus.panelTitle}
  </h2>
)}
```

with:

```tsx
{!collapsed && (
  <div className="flex items-center gap-2 truncate">
    <h2 className="truncate text-xs font-semibold uppercase tracking-wider text-fg-muted">
      {strings.cypheus.panelTitle}
    </h2>
    <span
      data-pill="coming-soon"
      className="rounded-full bg-brand/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-brand"
    >
      {strings.cypheus.comingSoonPill}
    </span>
  </div>
)}
```

- [ ] **Step 5: Run the test, confirm it passes**

Run: `pnpm test src/features/cypheus/CypheusPanel.test.tsx`

Expected: PASS.

- [ ] **Step 6: Run typecheck, lint, full test suite**

Run: `pnpm typecheck && pnpm lint && pnpm test`

Expected: all PASS.

- [ ] **Step 7: Manual sanity in the preview**

Open `http://127.0.0.1:5174/builder`. Verify:
- "CYPHEUS" title shows with a small yellow "COMING SOON" pill next to it.
- Collapsed panel hides the pill (only the toggle remains).
- Greeting bubbles render: hello → pitch → coming-soon, each typewritered in.

- [ ] **Step 8: Commit**

```bash
git add src/features/cypheus/CypheusPanel.tsx src/features/cypheus/CypheusPanel.test.tsx src/i18n/en.ts
git commit -m "$(cat <<'EOF'
feat(cypheus): add "Coming Soon" pill to panel header

Anchors the redesign messaging — title now reads "CYPHEUS  [COMING SOON]"
when the panel is expanded. Hidden in collapsed mode.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Final verification

After all 6 tasks land:

- [ ] **Step 1: Full grep for ghost references**

Run:
```bash
grep -rn "panelTab\|jsonViewedAt\|cypheus-pinned\|cypheus-summary\|cypheusActiveStepId\|runMagicBuild\|runTemplateAnimation\|CypheusPinnedFooter\|CypheusSummaryView\|JsonLiveView\|JsonEmptyState\|magicBuild" src/ --include="*.ts" --include="*.tsx"
```

Expected: zero hits. If a stray comment slipped through, clean it up.

- [ ] **Step 2: Full typecheck + lint + tests + format**

Run: `pnpm typecheck && pnpm lint && pnpm test && pnpm format`

Expected: all green; `pnpm format` may rewrite whitespace — commit if so.

- [ ] **Step 3: Manual smoke**

In the preview:
1. Reload the builder page with no template applied. Confirm: header has Create new bot; left panel shows 3 greeting bubbles + Coming Soon pill; no input; canvas dock not visible.
2. Click Step 1 (Bot Basics). Confirm: drawer opens; dock appears at the bottom.
3. Configure Bot Basics, save. Configure Strategy. Confirm: dock auto-dismisses ~3s after both phases configured.
4. Click "Create new bot" in the header → confirm dialog → confirm reset. Confirm: state resets, greeting re-runs, dock disappears.
5. Open Templates → pick any template. Confirm: fields fill instantly, no narration, no drawer pin animation. Drawer auto-opens to first step.
6. Hit Export. Confirm: existing dialog still works.

If anything is off, file follow-ups — don't patch within these 6 commits.

- [ ] **Step 4: Optional bonus — prune `setup-progress/` orphan**

The folder `src/features/cypheus/setup-progress/` is only referenced by its own test (pre-existing dead code). If you want a clean diff, delete the folder:
```bash
rm -r src/features/cypheus/setup-progress
```
Then run `pnpm typecheck && pnpm test` to confirm no regression, and commit as a separate `chore(cypheus): prune dead setup-progress folder` commit. Skip if you'd rather keep the diff scoped.
