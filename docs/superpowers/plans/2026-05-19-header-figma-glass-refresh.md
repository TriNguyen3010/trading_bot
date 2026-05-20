# HeaderToolbar Figma Glass Refresh — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace HeaderToolbar outer wrapper styling — gradient dark (`card-coin98`) → glassmorphism per Figma spec. Only the outer `<div>` `className` changes; all children/behavior unchanged.

**Architecture:** Inline Tailwind arbitrary values (Approach A from spec). No new utility classes, no token additions, no `tailwind.config.ts` changes. Single file modify (`HeaderToolbar.tsx`), plus 1 test addition guarding the visual decision.

**Tech Stack:** React 18 + Tailwind 3 + Vitest + Testing Library. No new dependencies.

**Reference spec:** [docs/superpowers/specs/2026-05-19-header-figma-glass-refresh-design.md](../specs/2026-05-19-header-figma-glass-refresh-design.md)

---

## File Structure

### Files modified

| File | Change |
|------|--------|
| `src/features/bot-builder/components/HeaderToolbar.tsx` | Line 96 — outer `<div>` `className` (8 token swap, see Task 2) |
| `src/features/bot-builder/components/HeaderToolbar.test.tsx` | Add 1 test case verifying outer container has glass classes (NOT `card-coin98`) |

### Files created

None.

### Files deleted

None.

---

## Task 0: Prerequisites & branch verify

**Files:** None (git ops only)

- [ ] **Step 1: Verify current branch is off main and spec is committed**

Run:
```bash
git log --oneline -5
git status --short
```
Expected:
- Top commit visible: `docs(header): spec for HeaderToolbar Figma glass refresh` (or commit hash containing the spec)
- `git status` clean (no uncommitted changes) OR only this plan file untracked.

If spec commit not found → STOP. Spec must exist on this branch first.

- [ ] **Step 2: Verify HeaderToolbar.tsx baseline**

Run:
```bash
grep -n "max-w-\[1400px\]" src/features/bot-builder/components/HeaderToolbar.tsx
```
Expected: 1 match on line ~96 — confirms file is at baseline (before refresh).

If 0 matches → file already modified OR moved. Investigate before continuing.

- [ ] **Step 3: Verify dependencies installed**

Run:
```bash
pnpm install --frozen-lockfile
```
Expected: PASS (no install actions if `node_modules` up to date).

---

## Task 1: Write the failing test (regression guard)

**Files:**
- Modify: `src/features/bot-builder/components/HeaderToolbar.test.tsx`

**Why:** Existing test only checks "Create new bot" button renders. With the styling change, we want a guard that the outer container is using the new glass class signature (not `card-coin98`). The test is shallow (className substring check) but documents the design intent and catches accidental regression to `card-coin98`.

- [ ] **Step 1: Add failing test for glass styling**

Open `src/features/bot-builder/components/HeaderToolbar.test.tsx` and append a new test inside the existing `describe('HeaderToolbar', ...)` block.

Full file content after edit:

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

  // Regression guard for Figma glass refresh (2026-05-19).
  // Spec: docs/superpowers/specs/2026-05-19-header-figma-glass-refresh-design.md
  // The outer pill container MUST drop `card-coin98` (solid gradient) and adopt
  // glass utilities. We assert a few signature classes — full string match is too
  // brittle, full snapshot too noisy, this is the middle ground.
  it('outer pill uses glass styling (no card-coin98)', () => {
    const { container } = render(
      <MemoryRouter>
        <HeaderToolbar />
      </MemoryRouter>,
    );

    const pill = container.querySelector('header > div');
    expect(pill).not.toBeNull();
    const className = pill?.className ?? '';

    // Removed
    expect(className).not.toMatch(/card-coin98/);

    // Added — glass signature
    expect(className).toMatch(/bg-white\/\[0\.05\]/);
    expect(className).toMatch(/border-white\/\[0\.08\]/);
    expect(className).toMatch(/backdrop-blur-\[100px\]/);
    expect(className).toMatch(/max-w-\[1200px\]/);
  });
});
```

- [ ] **Step 2: Run test to verify it FAILS**

Run:
```bash
pnpm vitest run src/features/bot-builder/components/HeaderToolbar.test.tsx
```
Expected: 1 PASS (`renders a "Create new bot" button`) + 1 FAIL (`outer pill uses glass styling`).

Fail messages should mention `card-coin98` still present, OR `bg-white/[0.05]` not found.

If both tests pass → STOP. Either HeaderToolbar already updated, or the selector `header > div` is wrong. Investigate.

- [ ] **Step 3: Commit failing test**

Run:
```bash
git add src/features/bot-builder/components/HeaderToolbar.test.tsx
git commit -m "test(header): add glass styling regression guard (red)"
```

---

## Task 2: Apply the className change (make test pass)

**Files:**
- Modify: `src/features/bot-builder/components/HeaderToolbar.tsx` (line ~96)

- [ ] **Step 1: Update outer wrapper className**

In `src/features/bot-builder/components/HeaderToolbar.tsx`, find the `<div>` directly inside `<TooltipProvider>` (~line 96). Replace its `className`.

**Before:**

```tsx
<div className="mx-auto flex w-full max-w-[1400px] items-center justify-between gap-3 rounded-full card-coin98 px-3 py-1.5 shadow-[0_4px_24px_rgba(0,0,0,0.45)]">
```

**After:**

```tsx
<div className="mx-auto flex w-full max-w-[1200px] items-center justify-between gap-3 rounded-full border border-white/[0.08] bg-white/[0.05] py-3 pr-3 pl-4 shadow-[0_8px_24px_rgba(0,0,0,0.15)] backdrop-blur-[100px]">
```

**Why each token (cross-ref spec §3):**

| Token | Replaces | Figma source |
|---|---|---|
| `max-w-[1200px]` | `max-w-[1400px]` | `max-width: 1200px` |
| `border border-white/[0.08]` | (none — was missing) | `border: 1px solid rgba(255,255,255,0.08)` |
| `bg-white/[0.05]` | (none — was via `card-coin98`) | `background: rgba(255,255,255,0.05)` |
| `py-3 pr-3 pl-4` | `px-3 py-1.5` | `padding: 12px 12px 12px 16px` (T=12, R=12, B=12, L=16) |
| `shadow-[0_8px_24px_rgba(0,0,0,0.15)]` | `shadow-[0_4px_24px_rgba(0,0,0,0.45)]` | `box-shadow: 0 8px 24px rgba(0,0,0,0.15)` |
| `backdrop-blur-[100px]` | (none) | `backdrop-filter: blur(calc(200px / 2))` = 100px |
| `rounded-full` | (kept) | `border-radius: 98px` — `rounded-full` (9999px) visually identical for pill height |
| `card-coin98` | REMOVED | not Figma — gradient dark, not glass |

- [ ] **Step 2: Run test to verify it PASSES**

Run:
```bash
pnpm vitest run src/features/bot-builder/components/HeaderToolbar.test.tsx
```
Expected: 2 PASS.

If still failing → check the exact `className` string matches the "After" snippet character-for-character (Tailwind arbitrary values must use square brackets exactly).

---

## Task 3: Full check suite

**Files:** None (verification only)

- [ ] **Step 1: Typecheck**

Run:
```bash
pnpm typecheck
```
Expected: PASS (no errors). If errors mention `HeaderToolbar.tsx` → revisit Task 2 edit.

- [ ] **Step 2: Lint**

Run:
```bash
pnpm lint
```
Expected: PASS.

Common lint hit: Tailwind class order. If `prettier-plugin-tailwindcss` is configured, run `pnpm format` to auto-sort:
```bash
pnpm format
git diff src/features/bot-builder/components/HeaderToolbar.tsx
```
Verify the diff still represents the same className tokens (order may change but tokens stay).

- [ ] **Step 3: Full test run**

Run:
```bash
pnpm test
```
Expected: All tests pass. Specifically:
- `HeaderToolbar.test.tsx` — 2/2
- Any other test that imports HeaderToolbar — unchanged

If anything else fails → investigate. Behavior didn't change, only outer className.

---

## Task 4: Visual smoke test (manual)

**Files:** None (manual verification).

- [ ] **Step 1: Start dev server**

Run:
```bash
pnpm dev
```
Wait until Vite prints `Local: http://127.0.0.1:5173/`.

- [ ] **Step 2: Open `/builder` and visually verify**

In browser, navigate to `http://127.0.0.1:5173/builder`.

Verify the following (checkboxes for self-check):

| Aspect | Expected |
|---|---|
| Header pill shape | `rounded-full` capsule, narrower than before (1200px max) |
| Background | Translucent — you can see canvas dot-grid pattern through it (faintly blurred) |
| Border | Thin white outline (~1px) visible against dark canvas |
| Shadow | Soft drop shadow below header — lighter than before |
| Content layout | Logo + saved time + User + Create new bot + My Bots // Backtest + Import + Export — order unchanged |
| All buttons | Still clickable, tooltips still work |

If header looks "too light" or blends too much with canvas → spec §4.1 caveat applies. **Do not adjust** in this task; document observation for follow-up.

- [ ] **Step 3: Performance smoke (CPU throttle)**

Open Chrome DevTools → Performance tab → CPU dropdown → set to "4x slowdown".

In `/builder`:
1. Scroll canvas content up/down (drag).
2. Hover/click each header button.
3. Open the User popover, then close.

Expected: no visible jank or frame drops. Header re-rendering smooth.

If you see jank specifically when scrolling content behind the header → spec §4.2 caveat applies. **Do not adjust** in this task; flag as follow-up.

- [ ] **Step 4: Stop dev server**

Press `Ctrl+C` in the dev server terminal.

---

## Task 5: Commit & push

**Files:** Stage all from Task 2 + Task 3 (if format-applied).

- [ ] **Step 1: Verify final diff**

Run:
```bash
git diff src/features/bot-builder/components/HeaderToolbar.tsx
```
Expected: Single-line className diff (per Task 2 "Before"/"After"). No other changes.

If `pnpm format` reordered the className tokens, confirm the token *set* still matches "After".

- [ ] **Step 2: Stage and commit**

Run:
```bash
git add src/features/bot-builder/components/HeaderToolbar.tsx
git commit -m "style(header): apply Figma glass refresh per spec

- max-width 1400 → 1200
- Drop card-coin98 (solid gradient); add bg-white/[0.05] + border-white/[0.08]
- Asymmetric padding py-3 pr-3 pl-4 (Figma: 12px 12px 12px 16px)
- Lighter shadow (0.15 alpha vs 0.45)
- Add backdrop-blur-[100px] for frosted glass

Spec: docs/superpowers/specs/2026-05-19-header-figma-glass-refresh-design.md
Test: outer pill className regression guard in HeaderToolbar.test.tsx"
```

- [ ] **Step 3: Push to remote**

Run:
```bash
git push
```
If upstream not set:
```bash
git push -u origin HEAD
```

Expected: push succeeds. PR (if applicable) can now be opened.

---

## Definition of Done

- [ ] `HeaderToolbar.tsx` outer `<div>` className matches Task 2 "After" snippet (token set; order may differ post-format)
- [ ] `HeaderToolbar.test.tsx` has 2 passing tests including the regression guard
- [ ] `pnpm typecheck` PASS
- [ ] `pnpm lint` PASS
- [ ] `pnpm test` PASS
- [ ] Visual smoke (`/builder`) shows glass pill with translucent background
- [ ] CPU throttle 4x → no scroll/interaction jank
- [ ] 2 commits pushed: red test (Task 1) + impl (Task 5)
- [ ] No other file modified outside the 2 listed in "File Structure"
