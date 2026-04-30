# BOT TEMPLATES MVP — Phase 1

> Plan: cho user **chọn 1 trong N template** (ý đồ trade pre-built), và
> Cypheus **animate setup giúp** giống magic build hiện tại — nhưng với
> data của template được chọn thay vì hard-coded "Bollinger Breakout BTC".
>
> Sau animation xong → JSON đã chuẩn → user chỉ việc Export.
>
> **Status**: Plan, chưa code. Confirm 4 decision ở §11 trước khi bắt đầu.
>
> **Prerequisite**: ✅ 2-phase UI redesign (`feat/2-phase-ui`) merged.
> Template snapshot dùng existing state shape (`botConfig + strategy +
> directionForm + closeMethod`), không cần đụng data layer.

---

## 1 · Reframe: Cypheus magic build + Templates = một feature

Hiện tại:
```
[Cypheus magic build]   = animate Bollinger Breakout BTC hard-code (1 template duy nhất)
```

Sau plan này:
```
[Templates gallery]     = catalog 8 template với metadata (name, tags, risk, difficulty)
        ↓ user pick
[Cypheus animate]       = chạy template-build engine với data của template đã chọn
        ↓ ~6s sau
[JSON ready to export]  = Bot configured đầy đủ, user click Export ship
```

**Hard-coded magic build trở thành 1 trong các template** với id `cypheus-default`.
Engine generic, không phải special case.

---

## 2 · Acceptance criteria

| # | Yêu cầu |
|---|---|
| G1 | App empty state có **CTA "Browse templates"** prominent + "Start blank" secondary |
| G2 | HeaderToolbar có button "Templates" (next to Import/Export) — luôn accessible |
| G3 | Templates gallery modal: 8 template cards với name, description, tags, difficulty, risk |
| G4 | Filter chips theo tag (scalping / btc / breakout / momentum / ...) + difficulty + risk |
| G5 | Click card → detail modal preview (full description + sample params) + "Use template" CTA |
| G6 | "Use template" → confirm dialog (nếu state dirty) → reset state → Cypheus animate |
| G7 | Animation: Cypheus pin Phase 1 + fill data → Phase 2 composite drawer + fill all 3 sub-step |
| G8 | Mỗi template optional có custom narration ("BTC offers high liquidity, 5m for scalping...") |
| G9 | Sau animation: applied-template badge ở header ("Based on 'Bollinger Breakout' · Diverged after edits") |
| G10 | Built-in templates ship trong bundle, không cần BE/network |
| G11 | CI test: every built-in template parse pass `validateBuilder` (no shipped broken templates) |
| G12 | Reduce-motion: skip Cypheus animation → instant apply, single chat message "Loaded ${name}" |

---

## 3 · Data model

### 3.1. `BotTemplate` type

```ts
// src/templates/types.ts
import type { BuilderState } from '@/types/builder.types';

export type TemplateDifficulty = 'beginner' | 'intermediate' | 'advanced';
export type TemplateRisk = 'conservative' | 'balanced' | 'aggressive';

/** Subset of BuilderState that templates ship — UI state (openStep, drawerTab,
 * isDirty, lastSavedAt) is excluded since it's transient. */
export type TemplateStateSnapshot = Pick<
  BuilderState,
  'botName' | 'botConfig' | 'strategy' | 'directionForm' | 'closeMethod'
>;

export interface TemplateAnimationScript {
  /** Greeting message before animation starts. Defaults derived from
   * template metadata if absent. */
  intro?: string;
  /** Per-phase narration. Optional; defaults work fine. */
  phaseNarration?: {
    botBasics?: { pre?: string; post?: string };
    strategy?: { pre?: string; post?: string };
  };
  /** Done message. Defaults derived from template description. */
  outro?: string;
}

export interface BotTemplate {
  /** Stable ID, used for tracking + URL deeplinks. e.g. 'bollinger-breakout-btc'. */
  id: string;

  /** Human-readable name. */
  name: string;

  /** 1-2 sentence description shown on the card + chat narration. */
  description: string;

  /** Optional markdown-like long form for the detail modal. */
  longDescription?: string;

  /** Free-form tags for filtering. */
  tags: string[];

  difficulty: TemplateDifficulty;
  riskLevel: TemplateRisk;

  /** Snapshot of BuilderState that gets applied. */
  state: TemplateStateSnapshot;

  /** Optional override for animation narration. If absent the engine
   * derives default messages from `name` + `description`. */
  script?: TemplateAnimationScript;

  meta: {
    /** Source: built-in catalog, or future user-saved / community. */
    author: 'Cypheus' | string;
    /** State schema version this template was authored against — bumped
     * if BuilderState shape ever changes (currently version 2 per
     * builder.store persist version). */
    schemaVersion: number;
    createdAt: string; // ISO date
    updatedAt?: string;
  };
}
```

### 3.2. Folder structure

```
src/templates/
├── index.ts                          # BUILT_IN_TEMPLATES registry export
├── types.ts                          # BotTemplate + sub-types
├── apply.ts                          # applyTemplate() helper + confirm flow
├── animation.ts                      # runTemplateAnimation() — engine, generic
├── catalog/
│   ├── cypheus-default.ts            # = current hard-coded Bollinger Breakout BTC
│   ├── rsi-oversold-eth-1h.ts        # Beginner / Conservative / mean-reversion
│   ├── breakout-btc-15m.ts           # Intermediate / Balanced / breakout
│   ├── grid-stable-usdt-pairs.ts     # Beginner / Conservative / grid
│   ├── multi-tf-trend-alts.ts        # Advanced / Balanced / multi-timeframe
│   ├── macd-momentum-bnb.ts          # Intermediate / Aggressive / momentum
│   ├── conservative-dca-btc.ts       # Beginner / Conservative / DCA
│   └── scalping-btc-1m.ts            # Advanced / Aggressive / scalping
└── __tests__/
    └── validate-all-templates.test.ts  # CI gate: every template parses ok
```

### 3.3. Registry

```ts
// src/templates/index.ts
import type { BotTemplate } from './types';
import { cypheusDefault } from './catalog/cypheus-default';
import { rsiOversoldEth1h } from './catalog/rsi-oversold-eth-1h';
// ... 6 more imports

export const BUILT_IN_TEMPLATES: readonly BotTemplate[] = [
  cypheusDefault,
  rsiOversoldEth1h,
  // ... 6 more
] as const;

export function getTemplateById(id: string): BotTemplate | undefined {
  return BUILT_IN_TEMPLATES.find((t) => t.id === id);
}

export type { BotTemplate, TemplateDifficulty, TemplateRisk } from './types';
```

---

## 4 · Animation engine — `runTemplateAnimation()`

Refactor `magic-build.script.ts` thành generic engine. Hard-coded
"Bollinger Breakout BTC" trở thành template `cypheus-default`.

### 4.1. Engine signature

```ts
// src/templates/animation.ts

export async function runTemplateAnimation(
  template: BotTemplate,
): Promise<void> {
  const ctx = startScript();
  const cy = () => useCypheusStore.getState();
  const builder = () => useBuilderStore.getState();
  const script = template.script ?? {};

  // 1. Reset state + pin Phase 1
  builder().resetAll();
  cy().setState('thinking');
  cy().setAvatar('coding');
  await sleep(800, ctx);
  if (!isCurrent(ctx)) return;
  cy().setState('building');

  // 2. Intro narration
  await typewriterMessage(
    script.intro ?? `Setting up "${template.name}" for you...`,
    ctx,
  );
  await sleep(400, ctx);

  // 3. Phase 1: Bot Basics
  builder().setBotName(template.state.botName);
  builder().setStepStatus('bot-config', 'editing');
  builder().setDrawerTab('setup');
  cy().startCypheusDrawer('bot-config');
  await sleep(500, ctx);
  if (!isCurrent(ctx)) return;

  if (script.phaseNarration?.botBasics?.pre) {
    await typewriterMessage(script.phaseNarration.botBasics.pre, ctx);
  } else {
    await typewriterMessage('Configuring bot basics…', ctx);
  }

  // Apply botConfig fields field-by-field with delays for the
  // type-out feel. See applyBotConfigAnimated() below.
  await applyBotConfigAnimated(template.state.botConfig, ctx);

  if (script.phaseNarration?.botBasics?.post) {
    await typewriterMessage(script.phaseNarration.botBasics.post, ctx);
  }
  await sleep(500, ctx);
  builder().setStepStatus('bot-config', 'configured');
  if (!isCurrent(ctx)) return;

  // 4. Phase 2: Strategy composite
  builder().setStepStatus('entry-strategy', 'editing');
  builder().setStepStatus('direction', 'editing');
  builder().setStepStatus('close-method', 'editing');
  cy().switchCypheusStep('entry-strategy'); // composite drawer
  await sleep(500, ctx);
  if (!isCurrent(ctx)) return;

  if (script.phaseNarration?.strategy?.pre) {
    await typewriterMessage(script.phaseNarration.strategy.pre, ctx);
  } else {
    await typewriterMessage('Building your strategy…', ctx);
  }

  // Apply strategy + direction + closeMethod in one composite session.
  await applyStrategyAnimated(template.state.strategy, ctx);
  await applyDirectionAnimated(template.state.directionForm, ctx);
  await applyCloseMethodAnimated(template.state.closeMethod, ctx);

  if (script.phaseNarration?.strategy?.post) {
    await typewriterMessage(script.phaseNarration.strategy.post, ctx);
  }
  await sleep(500, ctx);
  builder().setStepStatus('entry-strategy', 'configured');
  builder().setStepStatus('direction', 'configured');
  builder().setStepStatus('close-method', 'configured');
  if (!isCurrent(ctx)) return;

  // 5. Outro + summary
  await typewriterMessage(
    script.outro ?? `Done! ${template.description}`,
    ctx,
  );
  cy().showCypheusSummary();
  cy().setAvatar('idle');
  cy().setState('done');

  // 6. Track origin so HeaderToolbar can show "Based on ..." badge
  useTemplateTrackingStore.getState().setApplied(template.id);
}
```

### 4.2. Apply helpers (small private functions)

```ts
async function applyBotConfigAnimated(c: BotConfigForm, ctx: ScriptCtx) {
  // Type out the pair char-by-char for visual drama
  await typewriterValue(
    (v) => useBuilderStore.getState().patchBotConfig({ pair: v }),
    c.pair,
    ctx,
    140,
  );
  await sleep(200, ctx);
  // Other fields: snap-set with mild delay (no type-out for select fields)
  useBuilderStore.getState().patchBotConfig({
    timeframe: c.timeframe,
    tradingMode: c.tradingMode,
    leverage: c.leverage,
    exchange: c.exchange,
    marketType: c.marketType,
    marginMode: c.marginMode,
    maxOpenTrades: c.maxOpenTrades,
    stakeCurrency: c.stakeCurrency,
    stakeAmount: c.stakeAmount,
    dryRunWallet: c.dryRunWallet,
  });
  await sleep(400, ctx);
}

// Similar for applyStrategyAnimated, applyDirectionAnimated, applyCloseMethodAnimated
```

### 4.3. Magic build = template

```ts
// src/features/cypheus/script/magic-build.script.ts
import { runTemplateAnimation } from '@/templates/animation';
import { getTemplateById } from '@/templates';

/** @deprecated — use runTemplateAnimation(template) directly. Preserved
 * for back-compat with the `Tell Cypheus what you're building` input. */
export async function runMagicBuild(): Promise<void> {
  const cypheusDefault = getTemplateById('cypheus-default')!;
  return runTemplateAnimation(cypheusDefault);
}
```

→ Existing input flow continues to work, just routes through generic engine.

---

## 5 · UI components

### 5.1. Empty state (canvas pristine)

Modify `BuilderPage.tsx` empty-state block:

```
┌────────────────────────────────────────────┐
│         🤖 Build your first trading bot     │
│                                              │
│  Pick a template to skip setup, or start    │
│  blank and build manually.                   │
│                                              │
│      [📚 Browse templates]   ← primary CTA   │
│                                              │
│      [Start blank]           ← ghost CTA     │
└────────────────────────────────────────────┘
```

Click "Browse templates" → mở `<TemplatesDialog />`.

### 5.2. HeaderToolbar entry point

Thêm 1 button bên trái Import:
```
[📚 Templates] [↑ Import] [🧪 Backtest] [↓ Export]
```
Always accessible — user có thể swap template anytime.

### 5.3. `<TemplatesDialog />` — gallery modal

```tsx
// src/features/templates/TemplatesDialog.tsx

function TemplatesDialog({ open, onOpenChange }) {
  const [filter, setFilter] = useState<{
    difficulty?: TemplateDifficulty;
    risk?: TemplateRisk;
    tag?: string;
  }>({});
  
  const visible = useMemo(() => 
    BUILT_IN_TEMPLATES.filter(t => 
      (!filter.difficulty || t.difficulty === filter.difficulty) &&
      (!filter.risk || t.riskLevel === filter.risk) &&
      (!filter.tag || t.tags.includes(filter.tag))
    ),
    [filter]
  );
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>Bot Templates</DialogTitle>
          <DialogDescription>
            Pick a starter bot. Cypheus will set it up for you.
          </DialogDescription>
        </DialogHeader>
        
        {/* Filter chips */}
        <FilterChips filter={filter} onChange={setFilter} />
        
        {/* Grid 2 cols on desktop */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {visible.map(t => (
            <TemplateCard
              key={t.id}
              template={t}
              onSelect={() => handleUse(t)}
              onPreview={() => setPreview(t)}
            />
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
```

### 5.4. `<TemplateCard />`

```
┌─────────────────────────────────┐
│ 🟢 BEGINNER · Conservative       │
│ Bollinger Breakout — BTC/USDT 5m │
│                                  │
│ Catches breakouts with 2σ        │
│ Bollinger bands and RSI filter.  │
│                                  │
│ [#breakout #btc #futures]        │
│                                  │
│           [Preview] [Use →]      │
└─────────────────────────────────┘
```

Difficulty badge color: 🟢 beginner / 🟡 intermediate / 🟠 advanced.
Risk badge color: same palette per yellow-stages plan (brand-only, varying opacity).

### 5.5. `<TemplateDetailModal />`

Click card → detail modal:
- Full `longDescription` (markdown)
- Sample params highlighted (pair, timeframe, indicator, exit method)
- "Cypheus says..." preview — first sentence of intro narration
- 2 CTAs: `[Use this template]` primary + `[Cancel]` ghost
- Skip animation: hold Shift while clicking → instant apply (advanced UX)

### 5.6. Applied template badge

Sau khi apply, header (next to bot name):
```
🟢 Based on "Bollinger Breakout" · Diverged after edits
```
- "Based on" link → reopen detail modal of source template
- "Diverged" badge appears when current state ≠ template snapshot (deep-equal)
- "Reset to template" mini-action → reapply original snapshot (skip animation)

Tracked via small `useTemplateTrackingStore` (zustand, not persisted —
purely current-session metadata).

---

## 6 · Apply logic

```ts
// src/templates/apply.ts

export class TemplateConflictError extends Error {}

export interface ApplyOptions {
  /** Skip animation, snap-apply state. Default: false (animate). */
  skipAnimation?: boolean;
  /** Skip the dirty-state confirm dialog. Default: false. */
  force?: boolean;
}

export async function applyTemplate(
  template: BotTemplate,
  opts: ApplyOptions = {},
): Promise<void> {
  const state = useBuilderStore.getState();

  // Confirm if dirty + not forced
  if (state.isDirty && !opts.force) {
    throw new TemplateConflictError('State is dirty — confirm replace');
  }

  // Migrate snapshot if shipped against older schemaVersion (rare, but
  // future-proofs against state shape changes).
  const migrated = migrateTemplateSnapshot(
    template.state,
    template.meta.schemaVersion,
  );

  if (opts.skipAnimation) {
    // Fast path: snap-apply state, skip Cypheus animation
    useBuilderStore.setState({
      ...migrated,
      stepStatus: {
        'bot-config': 'configured',
        'entry-strategy': 'configured',
        direction: 'configured',
        'close-method': 'configured',
      },
      isDirty: false,
      lastSavedAt: Date.now(),
    });
    useCypheusStore.getState().pushMessage({
      role: 'cypheus',
      text: `Loaded "${template.name}". Ready to export.`,
    });
    useTemplateTrackingStore.getState().setApplied(template.id);
    toast.success(`Applied "${template.name}"`);
    return;
  }

  // Animated path: delegate to Cypheus engine
  await runTemplateAnimation(template);
}

function migrateTemplateSnapshot(
  snap: TemplateStateSnapshot,
  fromVersion: number,
): TemplateStateSnapshot {
  // No-op for v2 (current). Future: map old field names → new shape.
  if (fromVersion === 2) return snap;
  throw new Error(
    `Template schemaVersion ${fromVersion} not supported — please update template`,
  );
}
```

UX flow:
```
User click "Use" on TemplateCard
      ↓
applyTemplate(t)
      ↓
state.isDirty?
      Y → show confirm dialog
            "This will replace your current bot. Continue?"
            [Cancel] [Replace + animate]
      N → skip dialog
      ↓
[Cancel] returns; [Replace] calls applyTemplate(t, { force: true })
      ↓
runTemplateAnimation(t)  → ~6s
      ↓
Done. Tracking store records appliedTemplateId.
```

---

## 7 · Templates catalog (8 starter — short specs)

> Mỗi template ~50 dòng TS file: type-checked, validator-pass, ship trong bundle.

| # | ID | Name | Difficulty | Risk | Style |
|---|---|---|---|---|---|
| 1 | `cypheus-default` | Bollinger Breakout — BTC/USDT 5m | Intermediate | Balanced | Breakout (existing magic build) |
| 2 | `rsi-oversold-eth-1h` | RSI Oversold — ETH/USDT 1h | Beginner | Conservative | Mean-reversion |
| 3 | `breakout-btc-15m` | Channel Breakout — BTC/USDT 15m | Intermediate | Balanced | Breakout |
| 4 | `grid-stable-usdt-pairs` | Grid Trading — USDT pairs | Beginner | Conservative | Grid (uses ROI tiers) |
| 5 | `multi-tf-trend-alts` | Multi-TF Trend — Alts 4h | Advanced | Balanced | Trend-following |
| 6 | `macd-momentum-bnb` | MACD Momentum — BNB/USDT 30m | Intermediate | Aggressive | Momentum |
| 7 | `conservative-dca-btc` | Steady DCA — BTC/USDT 1h | Beginner | Conservative | DCA |
| 8 | `scalping-btc-1m` | High-Freq Scalping — BTC 1m | Advanced | Aggressive | Scalping |

→ Mỗi template có:
- 4 tags trung bình (cho filter)
- Custom narration ~3 messages (intro + per-phase + outro) cho 4 cái nổi bật,
  default narration cho 4 còn lại

---

## 8 · CI gate — every template must validate

```ts
// src/templates/__tests__/validate-all-templates.test.ts
import { describe, expect, it } from 'vitest';
import { BUILT_IN_TEMPLATES } from '@/templates';
import { validateBuilder } from '@/lib/validator';
import { useBuilderStore } from '@/features/bot-builder/store/builder.store';
import { buildUnifiedPayload } from '@/lib/serializer';
import { unifiedBotStrategyCreateSchema } from '@/schemas/unified-bot-strategy.schema';

describe('built-in templates', () => {
  it.each(BUILT_IN_TEMPLATES.map((t) => [t.id, t]))(
    'template %s passes validateBuilder (no shipped broken templates)',
    (_id, template) => {
      // Apply snapshot to a fresh store + mark all configured
      useBuilderStore.setState({
        ...useBuilderStore.getState(),
        ...template.state,
        stepStatus: {
          'bot-config': 'configured',
          'entry-strategy': 'configured',
          direction: 'configured',
          'close-method': 'configured',
        },
      });
      const issues = validateBuilder(useBuilderStore.getState());
      expect(issues).toEqual([]);
    },
  );

  it.each(BUILT_IN_TEMPLATES.map((t) => [t.id, t]))(
    'template %s serializes to valid UnifiedBotStrategyCreate',
    (_id, template) => {
      useBuilderStore.setState({
        ...useBuilderStore.getState(),
        ...template.state,
      });
      const payload = buildUnifiedPayload(useBuilderStore.getState());
      const result = unifiedBotStrategyCreateSchema.safeParse(payload);
      expect(result.success).toBe(true);
    },
  );

  it('template ids are unique', () => {
    const ids = BUILT_IN_TEMPLATES.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('every template has at least one tag', () => {
    for (const t of BUILT_IN_TEMPLATES) {
      expect(t.tags.length).toBeGreaterThan(0);
    }
  });
});
```

→ Không bao giờ ship template lỗi. PR fail nếu:
- Validator báo issue
- Schema reject payload
- Trùng id
- Thiếu metadata

---

## 9 · Files affected

### New

| File | Purpose |
|---|---|
| `src/templates/types.ts` | BotTemplate type + helpers |
| `src/templates/index.ts` | BUILT_IN_TEMPLATES registry |
| `src/templates/animation.ts` | `runTemplateAnimation()` engine |
| `src/templates/apply.ts` | `applyTemplate()` + confirm flow |
| `src/templates/store.ts` | `useTemplateTrackingStore` (appliedTemplateId tracking) |
| `src/templates/catalog/cypheus-default.ts` | Migrate magic-build hard-code into template |
| `src/templates/catalog/{7-other-templates}.ts` | New starter templates |
| `src/templates/__tests__/validate-all-templates.test.ts` | CI gate |
| `src/features/templates/TemplatesDialog.tsx` | Gallery modal |
| `src/features/templates/TemplateCard.tsx` | Card grid item |
| `src/features/templates/TemplateDetailModal.tsx` | Detail preview before apply |
| `src/features/templates/AppliedTemplateBadge.tsx` | Header badge "Based on …" |
| `src/features/templates/FilterChips.tsx` | Difficulty/risk/tag filters |

### Modified

| File | Change |
|---|---|
| `src/features/cypheus/script/magic-build.script.ts` | Delegate to `runTemplateAnimation(cypheusDefault)` — back-compat shim |
| `src/pages/BuilderPage.tsx` | Empty state: "Browse templates" CTA + button |
| `src/features/bot-builder/components/HeaderToolbar.tsx` | Templates button (next to Import) + AppliedTemplateBadge |
| `src/i18n/en.ts` | `strings.templates.*` |

### Unchanged
- All data layer (state types, store, validator, serializer, schemas)
- 2-phase UI redesign (templates build on top)

---

## 10 · Implementation phases (PRs)

### PR-T1 · Engine refactor (foundation, no UI)
- Create `src/templates/{types,animation,apply,store,index}.ts`
- Extract magic-build hard-code into `catalog/cypheus-default.ts`
- Refactor `magic-build.script.ts` → delegate to engine
- Existing flow ("Tell Cypheus what you're building") still works
- Tests: validate-all-templates with just 1 template
- **Effort**: 4-5h

### PR-T2 · Catalog (data only, 7 templates)
- 7 template files with full snapshots + narration
- Update `index.ts` registry
- Tests pass for all 8 (cypheus-default + 7 new)
- **Effort**: 4-6h (careful tuning của params + narration cho mỗi cái)

### PR-T3 · Gallery UI
- `<TemplatesDialog />` + `<TemplateCard />` + `<FilterChips />`
- HeaderToolbar button entry point
- Empty state CTA
- Confirm dialog flow + apply integration
- **Effort**: 5-6h

### PR-T4 · Detail modal + applied badge
- `<TemplateDetailModal />` (preview before apply)
- `<AppliedTemplateBadge />` (header indicator)
- "Diverged" detection (deep-equal vs template snapshot)
- "Reset to template" mini-action
- **Effort**: 3-4h

### PR-T5 · Polish + i18n
- i18n strings
- Reduce-motion variant (skipAnimation default)
- Keyboard nav (Tab through cards, Enter = Use)
- Final visual smoke
- **Effort**: 2h

**Tổng**: ~18-23h, ~3 ngày focused work.

---

## 11 · Decisions cần USER confirm

### D1. Số lượng templates MVP — 8 hay nhiều hơn?
- **Đề xuất: 8** (cover scalping/swing/DCA/grid/momentum/breakout/mean-reversion/multi-tf).
- Ít hơn: catalog mỏng, "thiếu lựa chọn".
- Nhiều hơn: dilute quality, users overwhelmed, từng template bị shallow.

### D2. Animation default ON, có option skip?
- **Đề xuất: ON, Shift+click "Use" → instant apply**. Power user nhanh, beginner xem màn diễn.
- Alternative: instant always, animation chỉ cho magic-build cũ.

### D3. Ngày từ lúc applied → khi nào gỡ "Based on" badge?
- **Đề xuất: Không tự gỡ.** Badge persist tới khi user click "Reset" hoặc "Create new bot".
- "Diverged" sub-text bật khi state đã thay đổi vs template — useful info, not noise.
- Alternative: gỡ badge sau khi user đã save 1 lần manually (state đã "owned").

### D4. Templates personal save (Phase 2)?
- **Đề xuất: defer.** MVP chỉ built-in. Personal save (user → "Save as template") là Phase 2 sau khi có flow ổn định.
- Phase 3: community templates (cần BE + auth — thuộc wallet integration plan).

---

## 12 · Out of scope

- **Personal templates** (user → save current bot as template) — Phase 2.
- **Community catalog** (BE-served templates, user submissions) — Phase 3.
- **Template forking** (derive from existing template + tweak + save) — Phase 2.
- **Template marketplace UI** (popular / featured / trending) — Phase 3.
- **AI-generated templates** ("Describe your bot, Cypheus designs"). Magic
  build hiện tại đã làm 1 hard-coded template — nâng lên AI thực sự là
  Phase 3 với Claude API integration.
- **Strategy-only templates** (chỉ swap strategy logic, giữ bot init) —
  defer cho đến khi multi-strategy UX có (BE confirm).
- **Template versioning** (template A v1.0 vs v1.1) — defer.
- **Mobile / narrow viewport** polish — defer.
- **Template deeplink URLs** (`/?template=bollinger-breakout`) — Phase 2.

---

## 13 · Risk + mitigation

| Risk | Severity | Mitigation |
|---|---|---|
| Template shipped broken (missing field, validator fail) | High | CI gate §8 — every PR must pass `validate-all-templates.test.ts` |
| State shape change breaks built-in templates | Medium | `migrateTemplateSnapshot()` + `schemaVersion` bump path; CI catches at compile |
| Animation timing feels too long for power users | Low | Shift+click skip animation (D2 default) |
| Template gallery dilutes Cypheus's identity ("just another tool, not a friend") | Low | Keep narration warm; Cypheus chat shows during animate; "Cypheus's pick" featured shelf in dialog |
| User picks template + edits → JSON invalid (validator regression) | Medium | Existing validator guards Export. Applied badge shows "Diverged" so user knows source vs current |
| Confirm dialog spam if user picks/swaps templates rapidly | Low | Only show dialog when state.isDirty=true; if same as freshly-applied template, skip |
| Bundle size growth from 8 templates inline | Low | ~10KB total (mostly snapshot JSON-ish); no concern. If grows: lazy-load via dynamic import. |

---

## 14 · Cross-link với plan khác

- **2-phase UI redesign** (`two_phase_ui_plan.md`): ✅ merged. Templates
  build on top — snapshot dùng existing `BuilderState` shape.
- **API spec integration** (`Data/IMPLEMENTATION_PLAN.md` Step 1+2+3):
  ✅ merged. Templates pass through existing schema + serializer.
- **Wallet integration** (`wallet_integration_plan.md`, chưa viết): độc
  lập. Phase 3 community templates sẽ cần auth → wallet, nhưng MVP không
  đụng.

---

## 15 · Sau khi confirm

Tôi sẽ:
1. **Mở branch** `feat/bot-templates` (worktree độc lập với main).
2. **PR-T1 đầu tiên**: refactor magic-build → engine + 1 template (cypheus-default).
   Existing demo "Tell Cypheus what you're building" chạy y như cũ. Risk thấp.
3. **PR-T2**: 7 templates còn lại.
4. **PR-T3**: Gallery UI + entry points.
5. **PR-T4**: Detail modal + applied badge.
6. **PR-T5**: Polish + i18n.

Mỗi PR ~3-5h, reviewable độc lập. Không big-bang merge.

---

*End of plan.*

> **Action item**: bạn confirm D1–D4 ở §11. Sau khi confirm, tôi mở branch
> + bắt đầu PR-T1 (~4-5h, có thể ship ngay session sau).
