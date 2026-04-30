# 2-PHASE UI REDESIGN — Phase 1 MVP

> **UI-only redesign** — gộp 4 step card thành 2 phase visually. Toàn bộ
> data layer (state types, store, validator, serializer, schemas, Step 1+2+3
> API integration) **giữ nguyên 100%**.
>
> Reframe: "User chỉ thấy 2 bước, internally vẫn 4 stepStatus."
>
> **Status**: ✅ **Implemented** (2026-04-30). Decisions D1–D3 confirmed.
> Branch `feat/2-phase-ui` (4 PRs sequential):
> - **PR-1** `8c2d3e6` — phase-helpers foundation + 22 tests
> - **PR-2** `89edf3c` — UI components (BotBuilderCanvas, StrategyCard, StrategyDrawer*)
> - **PR-3** `362c5bc` — phase-aware widgets + 2-nhịp magic build
> - **PR-4** `[this commit]` — cleanup (StepList delete, Pill rename, dead-code audit)

---

## 1 · Reframe: presentation-only

**Approach trước (đã reject)**: refactor full state model (`strategies: Strategy[]`,
persist v2 migration, validator/serializer rewrite). 3–5 ngày, risk cao.

**Approach mới (chosen)**:
- **Data layer 0% touch** — `botConfig`, `strategy`, `directionForm`, `closeMethod`
  state vẫn 4 form types như cũ. `stepStatus` Record vẫn 4 ID.
- **UI layer regroup** — 4 step card → 2 phase card. Phase 2 = composite
  aggregating 3 sub-steps (entry + direction + close).
- Khi save Phase 2 drawer, FE gọi `setStepStatus()` 3 lần cho 3 sub-step cùng lúc.

**Lợi ích**:

| Metric | UI-only | Full refactor |
|---|---|---|
| Effort | ~1.5 ngày | 3–5 ngày |
| Files modify | ~12 | 30+ |
| Persist migration | 0 | HIGH risk (mất data) |
| Validator/serializer regression | 0 | Medium |
| Step 1+2+3 API work intact | ✅ | Phải migrate |
| Reversibility | Cheap (revert UI) | Đắt |

---

## 2 · Mapping data → presentation

```
DATA LAYER (KHÔNG ĐỔI)            UI LAYER (ĐỔI)
──────────────────────             ─────────────────────
state.botConfig         ────────→  Phase 1: Bot Basics
state.stepStatus['bot-config']                ↓ connector
                                              ↓
state.strategy          ──┐
state.directionForm     ──┼─────→  Phase 2: Strategy
state.closeMethod       ──┘        (composite)
state.stepStatus['entry-strategy']
state.stepStatus['direction']
state.stepStatus['close-method']
```

**Save Phase 2 drawer** → set 3 stepStatus cùng lúc:
```ts
setStepStatus('entry-strategy', 'configured');
setStepStatus('direction', 'configured');
setStepStatus('close-method', 'configured');
```

**Validator** (existing) vẫn báo issue per stepId. UI Phase 2 card aggregate
issue: nếu bất kỳ trong 3 sub-step có issue → Phase 2 = error.

**Serializer / schemas / Cypheus magic build** → adapt động lực 4 → 2 nhịp,
nhưng output `UnifiedBotStrategyCreate` không đổi.

---

## 3 · Acceptance criteria

| # | Yêu cầu |
|---|---|
| G1 | Canvas thay 4 step card bằng 1 **BotBasicsCard** + 1 **StrategyCard** |
| G2 | StrategyCard derived status từ 3 sub-stepStatus (configured/error/editing/pending) |
| G3 | StrategyDrawer = 1 form scroll dài, **không tabs**, accordion sections (Entry / Action / Advanced) |
| G4 | BotBasicsDrawer giữ existing UX (có tab Setup + Configure) |
| G5 | Save StrategyDrawer = 1 click → set 3 stepStatus = configured cùng lúc |
| G6 | Cypheus magic build animate 2 phase (~5s) thay 4 step (~10s) |
| G7 | SetupProgress widget show 2 dot (Bot/Strategy) thay 4 dot |
| G8 | Cypheus pinned mode: pin sub-step → Phase 2 card highlight |
| G9 | Add Strategy button placeholder (disabled) — Phase 2 multi-strategy |
| G10 | Existing tests 100% pass — data layer untouched |
| G11 | Visual smoke: 4 status × 2 phase render correctly |

---

## 4 · Components — new / modified / deleted

### New files

| File | Purpose |
|---|---|
| `src/lib/phase-helpers.ts` | `derivePhaseStatus()`, `isPhaseSetupComplete()`, `stepIdToPhase()`, `STRATEGY_SUB_STEPS`, `PhaseId` type |
| `src/lib/phase-helpers.test.ts` | Unit tests cho 4 helper |
| `src/features/bot-builder/components/StrategyCard.tsx` | Composite card cho Phase 2 |
| `src/features/bot-builder/components/StrategyDrawer.tsx` | Composite drawer (Entry + Action + Advanced sections) |
| `src/features/bot-builder/components/StrategySection.tsx` | Reusable accordion section wrapper |
| `src/features/bot-builder/BotBuilderCanvas.tsx` | Replace `StepList.tsx` |

### Modified files

| File | Change |
|---|---|
| `src/pages/BuilderPage.tsx` | Render `BotBuilderCanvas` thay `StepList` |
| `src/features/cypheus/setup-progress/progress.types.ts` | `PROGRESS_STEPS` 4 entries → 2 entries (bot-basics + strategy) |
| `src/features/cypheus/setup-progress/SetupProgress.tsx` | Adapt 2 dot, derive từ phase-helpers |
| `src/features/cypheus/setup-progress/StepProgressPill.tsx` | 2 pill |
| `src/features/cypheus/script/magic-build.script.ts` | Animate 2 phase, group 3 sub-step thành 1 nhịp |
| `src/features/bot-builder/components/StepCard.tsx` | (giữ) — wrap thành `BotBasicsCard` qua composition |
| `src/features/bot-builder/components/StepDrawer.tsx` | (giữ cho Bot Basics) — chỉ wire qua phase routing |
| `src/i18n/en.ts` | Strings cho phase: "Bot Basics", "Strategy", drawer headings |

### Deleted

| File | Lý do |
|---|---|
| `src/features/bot-builder/StepList.tsx` | Thay bằng `BotBuilderCanvas.tsx` |

### Unchanged (toàn bộ data layer)

- `src/types/builder.types.ts` ✅
- `src/features/bot-builder/store/builder.store.ts` ✅
- `src/lib/validator.ts` ✅
- `src/lib/serializer.ts` ✅
- `src/schemas/*.ts` ✅
- `src/features/bot-builder/steps/*.tsx` (BotConfigSetup, EntryStrategySetup, DirectionSetup, CloseMethodSetup — re-render trong drawer mới) ✅
- All existing tests ✅

---

## 5 · Phase-helpers API spec

```ts
// src/lib/phase-helpers.ts

import type { BuilderState, StepId, StepStatus } from '@/types/builder.types';
import { isStepSetupComplete } from './validator';

export type PhaseId = 'bot-basics' | 'strategy';

/** Sub-steps that fold into the visual "Strategy" phase. The data layer
 * still tracks 4 separate stepStatus IDs; this constant just reflects the
 * presentation grouping. */
export const STRATEGY_SUB_STEPS: StepId[] = [
  'entry-strategy',
  'direction',
  'close-method',
];

/** Map a legacy stepId to the phase it visually belongs to. Used when
 * Cypheus pins a sub-step and we need to highlight the parent phase card. */
export function stepIdToPhase(stepId: StepId): PhaseId {
  return stepId === 'bot-config' ? 'bot-basics' : 'strategy';
}

/** Aggregate status for a phase, derived from underlying stepStatus.
 *
 * Bot-basics: 1:1 passthrough from `bot-config` stepStatus.
 *
 * Strategy: composite rules (priority high → low):
 *   1. ANY sub-step has 'error'    → 'error'
 *   2. ANY sub-step is 'editing'   → 'editing'
 *   3. ALL sub-steps 'configured'  → 'configured'
 *   4. else                        → 'pending'
 */
export function derivePhaseStatus(state: BuilderState, phase: PhaseId): StepStatus {
  if (phase === 'bot-basics') {
    return state.stepStatus['bot-config'];
  }
  const sub = STRATEGY_SUB_STEPS.map((id) => state.stepStatus[id]);
  if (sub.some((s) => s === 'error')) return 'error';
  if (sub.some((s) => s === 'editing')) return 'editing';
  if (sub.every((s) => s === 'configured')) return 'configured';
  return 'pending';
}

/** Phase-level setup gate — true when all sub-step setup gates pass.
 * Used to enable/disable the StrategyDrawer Save button. */
export function isPhaseSetupComplete(
  state: BuilderState,
  phase: PhaseId,
): boolean {
  if (phase === 'bot-basics') {
    return isStepSetupComplete('bot-config', state);
  }
  return STRATEGY_SUB_STEPS.every((id) => isStepSetupComplete(id, state));
}

/** Convenience for SetupProgress widget — count of phases configured (0–2). */
export function configuredPhaseCount(state: BuilderState): number {
  let n = 0;
  if (derivePhaseStatus(state, 'bot-basics') === 'configured') n++;
  if (derivePhaseStatus(state, 'strategy') === 'configured') n++;
  return n;
}
```

### Test coverage

| Case | Expected |
|---|---|
| `bot-basics` passthrough mọi status | 4 case (pending/editing/configured/error) |
| Strategy = `configured` chỉ khi all 3 sub-step configured | 2 case (partial vs all) |
| Strategy = `error` nếu bất kỳ sub-step error (priority 1) | 1 case |
| Strategy = `editing` nếu sub editing và không error (priority 2) | 1 case |
| Strategy = `pending` nếu mix configured + pending, không editing/error | 1 case |
| `stepIdToPhase` mapping 4 stepId | 4 case |
| `isPhaseSetupComplete` strategy = AND của 3 sub-gate | 3 case |
| `configuredPhaseCount` 0 / 1 / 2 | 3 case |

→ ~15 test cases. ~100 lines.

---

## 6 · UI architecture chi tiết

### 6.1. BotBuilderCanvas layout

```tsx
function BotBuilderCanvas() {
  return (
    <div className="...layout">
      <BotBasicsCard />                     {/* Phase 1 */}
      <PhaseConnector />                    {/* Dashed line */}
      <StrategyCard />                      {/* Phase 2 */}
      <AddStrategyButton disabled />        {/* MVP placeholder */}
      
      <StepDrawer ... />                    {/* Existing — for bot-config */}
      <StrategyDrawer ... />                {/* New — for strategy phase */}
    </div>
  );
}
```

### 6.2. BotBasicsCard

Wrap existing `StepCard` với `stepId='bot-config'`. **Không code mới**, chỉ rename
+ adjust props (title "Bot Basics" thay "Bot Config").

### 6.3. StrategyCard

```tsx
function StrategyCard() {
  const state = useBuilderStore();
  const phaseStatus = derivePhaseStatus(state, 'strategy');
  const drawerMode = useCypheusStore((s) => s.drawerMode);
  const cypheusActiveStepId = useCypheusStore((s) => s.cypheusActiveStepId);
  const isCypheusActive =
    drawerMode === 'cypheus-pinned' &&
    cypheusActiveStepId &&
    STRATEGY_SUB_STEPS.includes(cypheusActiveStepId);   // D3
  
  // Aggregated issue tooltip
  const issues = useMemo(() => {
    return validateBuilder(state).filter(i => 
      STRATEGY_SUB_STEPS.includes(i.stepId)
    );
  }, [state]);
  const firstIssue = issues[0];
  
  // Click → open StrategyDrawer
  // Render: title, description, status icon, summary preview (Entry → Action → Close)
}
```

Visual tone: same yellow palette per `card_yellow_stages_plan.md`.

### 6.4. StrategyDrawer

```tsx
function StrategyDrawer() {
  // Shown when openStep ∈ STRATEGY_SUB_STEPS (auto-route from any sub click)
  // Or explicitly opened via StrategyCard click
  
  return (
    <Sheet>
      <SheetHeader>Strategy</SheetHeader>
      
      <SheetBody>
        <Section title="Entry conditions" defaultOpen>
          <EntryStrategySetup />        {/* Existing component, unchanged */}
        </Section>
        
        <Section title="Action" defaultOpen>
          <DirectionSetup />            {/* Existing */}
          <CloseMethodSetup />          {/* Existing */}
          <CloseMethodConfigure />      {/* TpSlForm / RoiStepsForm / IndicatorExitForm */}
        </Section>
        
        <Section title="Advanced" defaultOpen={false}>
          <DirectionConfigure />        {/* slippage, limit offset (when limit) */}
          <EntryStrategyConfigure />    {/* startupCandleCount, informativeTimeframes */}
        </Section>
      </SheetBody>
      
      <SheetFooter>
        <Cancel /> <SaveButton onSave={handleSaveAll} />
      </SheetFooter>
    </Sheet>
  );
  
  function handleSaveAll() {
    setStepStatus('entry-strategy', 'configured');
    setStepStatus('direction', 'configured');
    setStepStatus('close-method', 'configured');
    onClose();
  }
}
```

Save gate: `isPhaseSetupComplete(state, 'strategy')`.

### 6.5. SetupProgress widget update

```ts
// progress.types.ts
export const PROGRESS_PHASES: { id: PhaseId; shortLabel: string }[] = [
  { id: 'bot-basics', shortLabel: 'Bot' },
  { id: 'strategy',   shortLabel: 'Strategy' },
];
```

Component logic adapt:
- 2 dot thay 4
- `configuredCount` = `configuredPhaseCount(state)` (0–2)
- Mode: `empty` (count=0), `in_progress` (1<count<2), `ready` (count=2 + 0 issues)
- Pills row: 2 pill click open phase drawer

### 6.6. Cypheus magic build refactor

Hiện tại 4 nhịp:
```
1. Pin bot-config → animate fields → mark configured
2. Pin entry-strategy → animate → mark configured
3. Pin direction → animate → mark configured
4. Pin close-method → animate → mark configured
```

Mới 2 nhịp:
```
1. Pin bot-config → animate fields → mark configured  (~2.5s)
2. Pin entry-strategy → animate ALL 3 sub-step's data → mark all 3 configured  (~3s)
```

Total ~5–6s thay 10s. Cypheus narration:
- "Setting up bot..." (Phase 1 intro)
- "Defining strategy: entry, direction, close..." (Phase 2 intro, gộp)
- "Done!" (outro)

Pinned highlight: khi pin `entry-strategy` thì StrategyCard highlight (D3 mapping).

---

## 7 · Implementation phases

### PR-1 · Phase-helpers + tests (FOUNDATION) ✅ `8c2d3e6`
- `src/lib/phase-helpers.ts` (5 helpers: stepIdToPhase, derivePhaseStatus,
  isPhaseSetupComplete, configuredPhaseCount, PROGRESS_PHASES export)
- `src/lib/phase-helpers.test.ts` (22 cases)
- **No UI change**, foundation only.

### PR-2 · UI components new (CORE) ✅ `89edf3c`
- `BotBuilderCanvas.tsx` — replaces StepList
- `StrategyCard.tsx` — composite Phase 2 card
- `StrategyDrawerContent.tsx` — 3 accordion sections + composite save
- `StrategySection.tsx` — small accordion wrapper
- `StepDrawer.tsx` — added `strategyCompositeContent` + `strategyHeader`
  props for composite-mode dispatch
- `BuilderPage.tsx` — swap `StepList` → `BotBuilderCanvas`
- i18n: `strings.phase.*` + `strings.strategyDrawer.*`

### PR-3 · SetupProgress + Cypheus animation ✅ `362c5bc`
- `progress.types.ts`: PROGRESS_STEPS (4) → PROGRESS_PHASES (2)
- `ProgressDots.tsx`: 2 dot, indexed by PhaseId
- `SetupProgress.tsx`: phase-aware with configured-issue override
- `CypheusDock.tsx`: 2 dot, per-phase BUILDING_TEXT, configuredPhaseCount
- `magic-build.script.ts`: 2-nhịp animation (Phase 1 pin tabs drawer once,
  Phase 2 pin composite drawer once for all 3 sub-step fills)
- i18n: `progress.configured` "X / 2 phases configured"

### PR-4 · Cleanup ✅ `[this commit]`
- Delete `src/features/bot-builder/StepList.tsx` (orphaned after PR-2)
- Rename `StepProgressPill.tsx` → `PhaseProgressPill.tsx` (file + export)
- Remove `void STRATEGY_SUB_STEPS;` placeholder import noise from
  `BotBuilderCanvas.tsx`
- Plan doc updated with PR commit hashes + status

**Tổng thực tế**: ~9h focused work (PR-1 2h, PR-2 5h, PR-3 1.5h thực tế
nhờ reuse, PR-4 30min).

---

## 8 · Edge cases

| Tình huống | Behavior |
|---|---|
| User reset → empty state | 2 card pending. Widget 2 dot empty. |
| User click Phase 1 card | Mở `StepDrawer` với `stepId='bot-config'` (existing) — wizard Setup/Configure tabs nguyên. |
| User click Phase 2 card | Mở `StrategyDrawer` (composite mới). |
| Cypheus pin `direction` (sub-step) | Phase 2 card highlight border-brand + glow (D3). Phase 1 không highlight. |
| Save Phase 2 drawer khi Setup gate fail (vd. entry conditions trống) | Save button disabled + tooltip "Complete required fields in Strategy". |
| User mở Phase 2, edit, Cancel | State revert (drawer rolls back like existing pattern). 3 stepStatus về `pending` nếu chưa save before. |
| Existing user persist v1 (4-step UI từng dùng) | State shape giữ nguyên — UI render mới ngay. **Không cần migrate**. |
| Validator báo issue ở `direction` | StrategyCard show issue tooltip "Limit offset required..." + click route vào Phase 2 drawer mở Action section. |
| Reduce-motion | StrategyDrawer animation skip. Cypheus 2-nhịp animation skip delays. |

---

## 9 · Risk + mitigation

| Risk | Severity | Mitigation |
|---|---|---|
| Click Phase 2 card → mở StrategyDrawer, nhưng Cypheus magic build vẫn pin sub-step → 2 drawer xung đột | Medium | StrategyDrawer mount theo `openSection` derived: nếu Cypheus pinned → composite drawer hiển thị, sub StepDrawer skip |
| Existing test reference `StepList` text → fail | Low | Update assertions trong PR-4 |
| Validator issue path = `entry-strategy` nhưng UI gộp → user confused vị trí | Medium | StrategyCard tooltip include sub-step name: "Issue in **Action**: Limit offset required" |
| Cypheus pin `close-method` mà Phase 2 drawer chưa scroll tới Action section → user không thấy | Low | StrategyDrawer auto-scroll tới section tương ứng nếu Cypheus active |
| Edit performance: StrategyDrawer render 3 step components cùng lúc → re-render stress | Low | Existing components đã dùng store selectors hẹp, không cần memo extra |

---

## 10 · Out of scope

- **State refactor** thành `Strategy` type (defer — chờ multi-strategy thực sự cần).
- **Multi-strategy UX** (Add/Remove/Reorder) — placeholder disabled.
- **Phase 3 explicit Review/Export** — giữ HeaderToolbar.
- **Mobile/narrow viewport polish**.
- **Strategy templates** — plan riêng sau.
- **Drawer transition animations** giữa Phase 1 ↔ Phase 2.

---

## 11 · Cross-link với plan khác

- **API spec integration** (Step 1+2+3, đã merged main): không đụng — UI-only.
- **Drawer sequential progression** (`drawer_sequential_progression_plan.md`):
  vẫn apply cho Phase 1 (BotBasicsDrawer giữ tabs Setup/Configure). **Không apply** cho Phase 2 (StrategyDrawer drop tabs).
- **Card yellow stages** (`card_yellow_stages_plan.md`): apply cho cả 2 card mới (BotBasicsCard reuse StepCard, StrategyCard mới).
- **Setup progress** (`setup_progress_plan.md`): widget refactor 4→2 dot trong PR-3.
- **Bot template** (sẽ viết sau): build trên top redesign này. Template snapshot vẫn dùng existing state shape (botConfig + strategy + directionForm + closeMethod).

---

## 12 · Decisions confirmed (2026-04-30)

- **D1**: ✅ Drop tabs trong StrategyDrawer, dùng accordion sections vertical.
- **D2**: ✅ Naming "Bot Basics" + "Strategy" (singular).
- **D3**: ✅ Map `cypheusActiveStepId ∈ {entry, direction, close}` → highlight Phase 2 card.

---

*End of plan.*
