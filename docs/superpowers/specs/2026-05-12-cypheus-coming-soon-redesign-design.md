# Cypheus "Coming Soon" Redesign — Design Spec

**Status:** Approved by Tri 2026-05-12 (one-way chat, no input, JSON tab removed, "Create new bot" → header, dock re-triggered by openStep, full magic-build cleanup incl. template animation)
**Owner:** FE (Tri Nguyen)
**Scope:** Cypheus left panel + bottom dock + header toolbar + templates auto-fill flow. No BE change.

---

## 1. Goal

The Cypheus chat demo (scripted "AI build hộ user") has served its purpose for the boss demo. Real AI is not ready yet — we want to:

1. Strip the fake AI flow from the UI (input, magic-build script, JSON tab) and replace the greeting with a "Coming Soon" message so users know AI is on the roadmap.
2. Keep the Cypheus left panel as a one-way intro surface (no interaction) — preserves brand presence without misleading anyone into typing.
3. Move the still-useful "Create new bot" action to the header toolbar where global actions live.
4. Re-trigger the bottom progress dock from manual flow (opening a step) so users still get the satisfying "Cypheus is watching your build" feel without needing the now-gone chat input.
5. Remove the now-orphaned magic-build infrastructure from the codebase (incl. the template auto-fill animation, which shares the same engine) — templates fall back to instant `snapApply`.

## 2. Non-goals

- BE changes. Nothing on the BE depends on this.
- Real AI integration. Out of scope; this is a placeholder until BE/AI ships.
- Persisting "waitlist" emails. We don't collect anything — the message is purely informational.
- Redesigning the Templates dialog itself. Only the post-pick animation goes away; the picker UX stays.
- Refactoring the broader Cypheus visual treatment beyond removing now-unused pieces.

## 3. Final state — UI

### 3.1 Left panel

Before: header → 2-tab nav (Cypheus | JSON) → chat body OR JSON view → input → "Create new bot" button.

After: header → chat body. That's it.

- Header keeps title "CYPHEUS" + collapse toggle.
- Optional small pill "Coming Soon" right of the title (small uppercase badge in muted yellow). Decision: **include the pill** — anchors the messaging visually.
- Chat body renders 3 greeting bubbles (typewritered in via existing `script-runner` infra) and stays static after that.
- No nav rail, no input, no bottom button.
- `card-coin98` background treatment stays (shipped earlier today).

### 3.2 Greeting copy (replaces existing 2-bubble greeting)

```
1. Hi, I'm Cypheus.
2. I'm your AI co-pilot — soon I'll be able to build trading bots from just a conversation.
3. Coming soon. For now, pick a template or build manually with the step cards.
```

Bubble 3 has "Coming soon" bolded (use the existing `<MessageBubble>` formatting — if it doesn't support inline bold, render via Markdown-lite or wrap in `<strong>`).

Avatar state stays `hello` throughout (no `coding`/`thinking` since there's no flow). The auto-loop happy avatar keeps Cypheus feeling alive.

### 3.3 Header toolbar — "Create new bot" button

Insert a new toolbar item between `Export` and `My Bots`. Reuse the existing confirm-dialog logic from `CreateNewBotButton.tsx` (start-over confirmation). Visual: matches the other header items (icon + label in the pill toolbar), not the rounded card-coin98 pill it used to be in the left panel — so it needs a restyle when relocated.

Icon: `RotateCcw` (Lucide) — matches the existing "start over" semantics.

### 3.4 Bottom dock — re-trigger from manual flow

Dock UI stays unchanged (`CypheusDock.tsx` rendering of progress dots + status pill + avatar). What changes is the trigger:

- Current: dock activates when user submits chat (`handleUserSubmit` → `setPhase('active')`).
- New: dock activates when user first opens any step in manual mode.

Implementation: in `BuilderPage`, add a `useEffect` watching `openStep` from the builder store. When it transitions from `null` to non-null AND cypheus `phase === 'idle'`, call `setPhase('active')`. The existing auto-complete-after-3s logic stays untouched — once all phases are configured, dock fades out as before.

Status-text simplification: since there's no `thinking`/`building` state, the dock's status text reduces to:
- `Set up your bot to get started` (idle — won't show because dock only mounts when active)
- `N of 2 phases configured` (partial)
- `All set – ready to export` (allDone)

Drop the `Configuring bot…` / `Building your strategy…` lines (they were tied to the magic-build phase transitions).

### 3.5 Templates — fallback to snap-apply

Click a template → instant `snapApply` (the existing fallback for `prefers-reduced-motion`). No drawer pinning, no narration, no summary view. User sees fields populated, drawer auto-opens to step 1 if needed (same behavior `snapApply` already implements).

This is a small regression vs. the current animated experience, but acceptable given F1a sign-off — the magic-build engine isn't worth preserving once the chat-driven flow is gone, since real AI integration will have entirely different mechanics (streaming from BE, not setTimeout scripts).

## 4. State & store changes — `cypheus.store.ts`

**Drop fields:**
- `panelTab` / `setPanelTab` — only one section now.
- `jsonViewedAt` / `markJsonViewed` — JSON tab gone.
- `drawerMode` modes `cypheus-pinned` / `cypheus-summary` — magic-build gone. Drawer is now `closed` or `manual` only. Simplest: drop the `drawerMode` field entirely and derive everything from `builder.openStep`.
- `cypheusActiveStepId` / setters (`startCypheusDrawer`, `switchCypheusStep`, `showCypheusSummary`) — these drove pinned mode.
- `state` machine values `thinking` / `building` / `done` — no flow drives them. Reduce to `idle` only (or drop `state` entirely; check if `MessageBubble` cares about it).
- `setAvatar('coding')` callsites — avatar stays at `hello`.

**Keep fields:**
- `phase` ('idle' | 'active' | 'completed') — drives dock visibility.
- `setPhase` — called by the new BuilderPage effect.
- `messages`, `pushMessage`, `clearMessages` — for greeting bubbles.
- `resetAll` — used by "Create new bot" confirmation.

**Test updates:** `cypheus.store.test.ts` references removed fields; rewrite to cover only the kept surface.

## 5. Component changes — bot-builder

### 5.1 `StepDrawer.tsx`

Drop the `cypheus-pinned` / `cypheus-summary` mode branches. Remaining modes: `closed` or `manual` (derived from `openStep`). The `effectiveMode` computation collapses:

```ts
const isOpen = openStep !== null;
const isManual = isOpen; // there is no other mode
```

All `isPinned` checks become irrelevant — drop:
- `CloseButton` disabled-while-pinned variant + tooltip
- `ConfigureTabTrigger` `disabled={pinned}` flag
- `handleTabChange` early-return when pinned
- `onEscapeKeyDown` early-return when pinned
- Strategy-composite / Bot-config-composite handling of pinned mode (just keep the manual path)
- Footer branching `if pinned: CypheusPinnedFooter else: ManualWizardFooter`

The drawer simplifies significantly. After cleanup, it's a single-mode drawer.

### 5.2 `BotBuilderCanvas.tsx`

Find and drop references to `cypheusActiveStepId` and `drawerMode === 'cypheus-pinned'`. Composite strategy-content handling stays (it's used in manual mode too).

### 5.3 `StepCard.tsx` / `StrategyCard.tsx`

Audit for references to pinned mode / cypheus state. Most likely just visual state ("step is being configured by Cypheus" highlight) — drop the pinned-mode visual variant.

### 5.4 Files to delete

- `src/features/bot-builder/components/CypheusPinnedFooter.tsx`
- `src/features/bot-builder/components/CypheusSummaryView.tsx`

## 6. Component changes — cypheus feature

### 6.1 `CypheusPanel.tsx`

Strip everything except header + chat:

```tsx
<aside className="card-coin98 flex h-full flex-shrink-0 flex-col ...">
  <header>
    title "CYPHEUS" + optional "Coming Soon" pill + collapse toggle
  </header>
  <CypheusChat />  {/* and only this */}
</aside>
```

- Drop the `<nav>` rail (SectionItem list).
- Drop `CypheusSectionBody` wrapper (input + create-new-bot).
- Drop imports: `Braces`, `Sparkles`, `SectionItem`, `CypheusInput`, `CreateNewBotButton`, `JsonLiveView`, `runMagicBuild`, `useBuilderStore` (only needed for `lastSavedAt` → JSON tab badge, which is gone).
- Drop the `handleUserSubmit` handler entirely.
- Keep the auto-run-greeting `useEffect`.

### 6.2 `script/greeting.script.ts`

Update to emit 3 bubbles (replaces current 2). Replace `cy.setState('greeting')` and `setAvatar('hello')` with whatever survives in the simplified store — likely just `pushMessage` calls + `typewriterMessage`.

### 6.3 Files to delete (cypheus folder)

- `src/features/cypheus/CypheusInput.tsx`
- `src/features/cypheus/JsonLiveView.tsx`
- `src/features/cypheus/JsonLiveView.test.tsx`
- `src/features/cypheus/JsonEmptyState.tsx`
- `src/features/cypheus/script/magic-build.script.ts`
- (bonus, already-dead code) `src/features/cypheus/setup-progress/` — orphan folder, only referenced by its own test. Verify with grep before deleting.

### 6.4 `CreateNewBotButton.tsx`

Restyle for header-toolbar context. The component logic (confirmation dialog → `useBuilderStore.resetAll()` + `useCypheusStore.resetAll()`) stays. Visual: drop the rounded-full card-coin98 pill, match the existing HeaderToolbar item style (icon + label, transparent bg with hover).

Recommended: keep the file at its current location, change its className, mount it from `HeaderToolbar.tsx` instead of `CypheusPanel.tsx`.

### 6.5 `CypheusDock.tsx`

- Drop the `cypheusState === 'thinking' / 'building'` branches in `statusText`.
- Drop `BUILDING_PHASE_TEXT` map.
- Avatar stays as a single visual; no animation switching.

## 7. Component changes — pages/header

### 7.1 `BuilderPage.tsx`

Add a `useEffect` that watches `openStep`:

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

### 7.2 `HeaderToolbar.tsx`

Insert `<CreateNewBotButton />` between `Export` and `My Bots`. Likely wraps in the same `<ToolbarItem>` / `<button>` pattern the toolbar uses for its other items.

## 8. Template flow changes

### 8.1 `src/templates/apply.ts`

Replace the branch:

```ts
if (skipAnimation) {
  snapApply(template, migrated);
  return;
}
await runTemplateAnimation(template);
```

With:

```ts
snapApply(template, migrated);
```

Drop the `runTemplateAnimation` import and the `prefersReducedMotion()` import if only used here.

### 8.2 `src/templates/animation.ts`

Delete the file. It owned the entire magic-build engine.

### 8.3 `src/templates/types.ts`

Drop narration / animation script fields from `BotTemplate` type (`script.intro`, `script.phaseNarration`, `script.outro`). Keep the `state` / `meta` core. This is a breaking change for the catalog files — they currently include narration. Two options:

- **Option a (preferred):** strip narration from catalog files too. Cleaner.
- **Option b:** make narration fields optional (`?:`), leave them in catalog. Lives forever as unused.

Pick (a) — full cleanup per F1a sign-off.

### 8.4 `src/templates/catalog/*.ts`

Remove narration fields (`intro`, `phaseNarration`, `outro`) from each template export. Keep `state` + `meta`.

## 9. i18n changes — `src/i18n/en.ts`

**Drop keys:**
- `cypheus.tabLabel`, `cypheus.jsonTabLabel`
- `cypheus.inputPlaceholder`, `cypheus.send`
- `cypheus.afterDone`
- `cypheus.magicBuild.*` (entire sub-tree)
- `cypheus.json.*` (entire sub-tree)

**Update keys:**
- `cypheus.greeting.hello` — keep ("Hi, I'm Cypheus.")
- `cypheus.greeting.pitch` — replace with: `"I'm your AI co-pilot — soon I'll be able to build trading bots from just a conversation."`
- **Add** `cypheus.greeting.comingSoon`: `"Coming soon. For now, pick a template or build manually with the step cards."`

**Keep:**
- `cypheus.panelTitle`, `cypheus.createNewBot`, `cypheus.confirmReset`
- `cypheus.progress.*` (used by dock + summary widget)

## 10. Out-of-scope cleanup notes

- `src/features/cypheus/setup-progress/` is already orphaned (only used by its own test). Suggested to delete as a bonus during this work since it's adjacent — flag in PR description, but not a blocker if the cleanup grows.
- `src/lib/constants.ts` may have magic-build-specific constants in comments; sweep but don't make it a forcing function.

## 11. Risks & mitigations

| Risk | Mitigation |
|---|---|
| Template auto-fill animation removal disappoints stakeholders who saw the boss demo | Pre-announce: this is intentional cleanup until real AI ships; instant fill is faster anyway. |
| `cypheus-pinned` mode removal breaks some unforeseen integration in `StepDrawer.test.tsx` or `drawer-scroll.ts` | Plan: run `pnpm test` after each phase of the implementation. If a test references pinned mode, decide case-by-case: update or delete. |
| `setPhase` loop in `BuilderPage` useEffect | The condition `phase === 'idle'` gates it — once active, won't re-fire. After `completed`, also won't re-fire. Safe. |
| Greeting bubble 3 inline bold rendering | If `MessageBubble` doesn't support inline bold, ship without bold or wrap text manually in `<strong>` inside the message string. Confirm at implementation time. |
| Cypheus store test churn | Expected. Rewrite tests for the slimmed surface; don't try to preserve old test shapes. |

## 12. Done definition

- Left panel renders header + 3 greeting bubbles only. No nav, no input, no bottom button.
- Header toolbar has "Create new bot" with working confirmation dialog.
- Clicking any step card transitions phase `idle → active`; bottom dock appears with progress dots.
- After both phases configured, dock auto-completes after 3s as before.
- Picking a template fills fields instantly. No drawer pinning, no narration, no summary view.
- `pnpm typecheck`, `pnpm lint`, `pnpm test` all green.
- Deleted files: `CypheusInput.tsx`, `JsonLiveView.tsx`, `JsonLiveView.test.tsx`, `JsonEmptyState.tsx`, `magic-build.script.ts`, `CypheusPinnedFooter.tsx`, `CypheusSummaryView.tsx`, `templates/animation.ts`.
- No remaining references to: `panelTab`, `jsonViewedAt`, `cypheus-pinned`, `cypheus-summary`, `cypheusActiveStepId`, `runMagicBuild`, `runTemplateAnimation`, `CypheusPinnedFooter`, `CypheusSummaryView`.
