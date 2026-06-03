# Builder — Remove "Trading Mode" Toggle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the build-time "Dry-run / Live" trading-mode toggle from the wizard; hardcode `dry_run: true` in the serializer; strip the `tradingMode` field from every layer of the FE stack so that trading mode is exclusively a launch-time decision (handled by the Launchpad).

**Architecture:** `tradingMode` currently lives in `BotConfigForm`, flows into the serializer's `buildBotPayload` (`dry_run = tradingMode === 'dry-run'`), appears in summaries, translators, templates, i18n, and validation — but `launch-actions.ts:14` overwrites `dry_run` unconditionally at launch time, making the build-time field moot. After this change: `buildBotPayload` hardcodes `dry_run: true`; the deserialisers drop the `tradingMode` mapping (preserve `dry_run_wallet` and other real params); `BotConfigForm` loses `tradingMode` (store version bumps to 4 to migrate persisted state); the Dry-run wallet field is always visible (not gated on `tradingMode === 'dry-run'`); Launchpad remains the single source of truth for mode.

**Tech Stack:** React 18, TypeScript 5.7, Zustand 5 (persist), Vitest + @testing-library/react.

**Spec:** `docs/superpowers/specs/2026-06-03-remaining-fe-work-design.md` (WS2)

**Branch:** `refactor/builder-remove-trading-mode` (off main)

---

## File Structure

| File | Change |
|---|---|
| `src/lib/serializer.ts` | `buildBotPayload`: replace `c.tradingMode === 'dry-run'` with literal `true`; `deserializeBundle` (line 280): drop `tradingMode: bot.dry_run ? …` mapping; `deserializeUnifiedPayload` (line 562): drop `tradingMode: payload.dry_run ? …` mapping |
| `src/lib/serializer.test.ts` | Remove `tradingMode: 'dry-run'` from `applyBollingerLong`; assert `payload.dry_run === true` always; remove the round-trip assertion `restored.botConfig.tradingMode` |
| `src/types/builder.types.ts` | Remove `TradingMode` type export; remove `tradingMode: TradingMode` from `BotConfigForm` |
| `src/features/bot-builder/store/builder.store.ts` | Remove `tradingMode: 'dry-run'` from `defaultBotConfig`; bump persist `version` from `3` to `4` and add a `v3→v4` migrate branch that deletes `botConfig.tradingMode` from persisted state |
| `src/features/bot-builder/steps/BotConfigStep.tsx` | Remove `handleTradingMode`, `pendingLive` state, the Trading mode `<FormField>` block, the confirm `<Dialog>`, and the `{config.tradingMode === 'dry-run' ? … : null}` guard around Dry-run wallet (always render it); remove `TradingMode` import |
| `src/features/bot-builder/steps/BotConfigStep.test.tsx` | No trading-mode tests exist there; add a test asserting the Dry-run wallet field is always visible after this change |
| `src/features/bot-builder/components/summaries/BotConfigSummary.tsx` | Remove `tradingMode` from destructure; remove `isLive` variable; remove the Live/Dry-run chip and the colour-conditional prose in both `narrative` and `visual` branches |
| `src/features/bot-builder/components/summaries/__tests__/summary-modes.test.tsx` | Remove `tradingMode: 'dry-run'` from `seedBotConfig`; remove assertions that look for `/dry-run/i` or `/live/i` mode text in the summary |
| `src/features/export-import/deploy-summary.ts` | Replace `dryRun: c.tradingMode === 'dry-run'` with `dryRun: true`; remove `tradingMode` reference |
| `src/features/bot-summary/translators/risk.ts` | Remove the `if (c.tradingMode === 'live')` live-trading line (lines 27-36); remove the inner `if (c.tradingMode === 'live') warning = …` block (line 67-69); remove `tradingMode` from function body |
| `src/features/bot-summary/__tests__/summarize.test.ts` | Remove `tradingMode: 'dry-run'` from the pristine state object (line 71); remove the test "high leverage on live mode → warning on risk block" (lines 129-137) or repurpose it to check high-leverage warning without a mode check |
| `src/features/templates/TemplateDetailModal.tsx` | In `ParamHighlights`, change the Mode row: drop `c.tradingMode === 'dry-run' ? 'Dry-run' : 'Live'`; replace with just `${c.marketType}${c.leverage > 1 ? \` · ${c.leverage}x\` : ''}` |
| `src/lib/validateSetup.ts` | Remove `tradingMode: z.enum(['dry-run', 'live'])` from `botConfigSetupSchema`; update the comment |
| `src/i18n/en.ts` | Remove the `tradingMode` key from `helpText.botConfig`; update `botConfigDrawer.description` to remove "trading mode"; update `steps.botConfig.description`; update `phase.botBasics.description` |
| `src/templates/catalog/*.ts` (8 files) | Remove `tradingMode: 'dry-run'` from each catalog entry's `botConfig` |
| `src/templates/types.ts` | Bump `TEMPLATE_SCHEMA_VERSION` from `2` to `3` |
| `src/templates/apply.ts` | Add a `fromVersion === 2` migration branch that deletes `snap.botConfig.tradingMode` |

---

## Task 1 — Serializer: hardcode `dry_run: true`, drop `tradingMode` import maps

**Files:**
- Modify: `src/lib/serializer.test.ts`
- Modify: `src/lib/serializer.ts`

This task leads with test changes. The existing tests call `patchBotConfig({ tradingMode: 'dry-run' })` and then assert `restored.botConfig.tradingMode === 'dry-run'`. After this change those calls become no-ops (the field doesn't exist), and the round-trip test should no longer look for `tradingMode` on the deserialized output. We must also confirm `dry_run` is always `true`.

- [ ] **Step 1: Update `serializer.test.ts` — remove `tradingMode` from `applyBollingerLong` and add the `dry_run: true` assertion**

Open `src/lib/serializer.test.ts`. In the `applyBollingerLong` helper, remove the line `tradingMode: 'dry-run',` from the `patchBotConfig` call. Then add a new test:

```ts
it('buildUnifiedPayload always sends dry_run: true regardless of store state', () => {
  applyBollingerLong();
  // Even if somehow tradingMode appeared in persisted state, serializer must ignore it.
  const payload = buildUnifiedPayload(useBuilderStore.getState());
  expect(payload.dry_run).toBe(true);
});
```

Also in the test `'round-trips a unified payload through deserializeUnifiedPayload'` (line 176), remove this assertion:
```ts
expect(restored.botConfig.tradingMode).toBe('dry-run');
```

- [ ] **Step 2: Run the affected tests to confirm they fail (tradingMode field still exists)**

```bash
cd /Users/nguyenminhtri/.gemini/antigravity/scratch/trading_bot
pnpm test -- --reporter=verbose src/lib/serializer.test.ts
```

Expected: The new `dry_run: true` test should PASS immediately (field already derives from `tradingMode`). The round-trip test should PASS (assertion removed). The `applyBollingerLong` call with `tradingMode` removed will still work because `patchBotConfig` just ignores unknown keys — but this step is about staging test intent.

> Note: The real compile failure and test failures happen after Step 3 below, once `tradingMode` is removed from the type. Run Step 2 here as a baseline.

- [ ] **Step 3: Update `serializer.ts` — hardcode `dry_run: true`; drop `tradingMode` mapping in both deserialisers**

In `buildBotPayload` (around line 103), change:
```ts
// BEFORE
const dryRun = c.tradingMode === 'dry-run';
// ...
dry_run: dryRun,
```
to:
```ts
// AFTER (line ~106 removed; dry_run hardcoded)
return {
  bot_name: state.botName,
  exchange_name: c.exchange,
  strategy_name: toPythonClassName(state.strategy.name || state.botName),
  dry_run: true,  // always true on create — mode is set at launch time by Launchpad
  // ... rest unchanged
```

In `deserializeBundle` (around line 276-289), change:
```ts
// BEFORE
botConfig: {
  pair: jsonPairToUi(bot.pair),
  timeframe: bot.timeframe,
  tradingMode: bot.dry_run ? 'dry-run' : 'live',
  leverage: bot.leverage,
```
to:
```ts
// AFTER — drop tradingMode; keep all other fields
botConfig: {
  pair: jsonPairToUi(bot.pair),
  timeframe: bot.timeframe,
  leverage: bot.leverage,
```

In `deserializeUnifiedPayload` (around line 558-573), change:
```ts
// BEFORE
botConfig: {
  pair: jsonPairToUi(payload.pair),
  timeframe: payload.timeframe as BotConfigForm['timeframe'],
  tradingMode: payload.dry_run ? 'dry-run' : 'live',
  leverage: payload.leverage ?? 1,
```
to:
```ts
// AFTER
botConfig: {
  pair: jsonPairToUi(payload.pair),
  timeframe: payload.timeframe as BotConfigForm['timeframe'],
  leverage: payload.leverage ?? 1,
```

- [ ] **Step 4: Run tests to verify serializer tests pass**

```bash
cd /Users/nguyenminhtri/.gemini/antigravity/scratch/trading_bot
pnpm test -- --reporter=verbose src/lib/serializer.test.ts
```

Expected: All tests PASS. TypeScript errors from downstream files are fine at this step; we're running Vitest only.

- [ ] **Step 5: Commit**

```bash
cd /Users/nguyenminhtri/.gemini/antigravity/scratch/trading_bot
git add src/lib/serializer.ts src/lib/serializer.test.ts
git commit -m "refactor(serializer): hardcode dry_run=true on create; drop tradingMode import maps"
```

---

## Task 2 — Types + Store: remove `TradingMode` and `tradingMode` field; bump persist version

**Files:**
- Modify: `src/types/builder.types.ts`
- Modify: `src/features/bot-builder/store/builder.store.ts`

- [ ] **Step 1: Update `builder.types.ts` — remove `TradingMode` export and `tradingMode` from `BotConfigForm`**

In `src/types/builder.types.ts`:

Remove this line (line 21):
```ts
export type TradingMode = 'live' | 'dry-run';
```

Remove `tradingMode: TradingMode;` from `BotConfigForm` (line 123 in the current file):
```ts
// BEFORE
export interface BotConfigForm {
  pair: string;
  timeframe: string;
  tradingMode: TradingMode;
  leverage: number;
```
```ts
// AFTER
export interface BotConfigForm {
  pair: string;
  timeframe: string;
  leverage: number;
```

- [ ] **Step 2: Update `builder.store.ts` — remove `tradingMode` default; bump persist version; add v3→v4 migration**

In `src/features/bot-builder/store/builder.store.ts`:

Change `defaultBotConfig` (lines 23-35):
```ts
// BEFORE
const defaultBotConfig: BotConfigForm = {
  pair: '',
  timeframe: '5m',
  tradingMode: 'dry-run',
  leverage: 1,
```
```ts
// AFTER
const defaultBotConfig: BotConfigForm = {
  pair: '',
  timeframe: '5m',
  leverage: 1,
```

Change `persist` version from `3` to `4` and add a migration branch (around line 170):
```ts
// BEFORE
{
  name: 'trading-bot-builder',
  version: 3,
  // ...
  migrate: (persisted: unknown, fromVersion: number) => {
    if (!persisted || typeof persisted !== 'object') return persisted;
    if (fromVersion >= 3) return persisted;
    const s = persisted as { ... };
    // ... v2→v3 migration ...
    return s;
  },
}
```
```ts
// AFTER
{
  name: 'trading-bot-builder',
  version: 4,
  // ...
  migrate: (persisted: unknown, fromVersion: number) => {
    if (!persisted || typeof persisted !== 'object') return persisted;
    const s = persisted as {
      strategy?: { entryConditions?: unknown };
      closeMethod?: { exitConditions?: unknown };
      botConfig?: Record<string, unknown>;
    };
    // v2 → v3: flat ConditionGroup → ConditionTree
    if (fromVersion < 3) {
      if (
        s.strategy?.entryConditions &&
        'conditions' in (s.strategy.entryConditions as object) &&
        !('groups' in (s.strategy.entryConditions as object))
      ) {
        s.strategy.entryConditions = migrateLegacyGroup(
          s.strategy.entryConditions as Parameters<typeof migrateLegacyGroup>[0],
        );
      }
      if (
        s.closeMethod?.exitConditions &&
        'conditions' in (s.closeMethod.exitConditions as object) &&
        !('groups' in (s.closeMethod.exitConditions as object))
      ) {
        s.closeMethod.exitConditions = migrateLegacyGroup(
          s.closeMethod.exitConditions as Parameters<typeof migrateLegacyGroup>[0],
        );
      }
    }
    // v3 → v4: drop tradingMode (now a launch-time-only concern)
    if (fromVersion < 4 && s.botConfig) {
      delete s.botConfig['tradingMode'];
    }
    return s;
  },
}
```

- [ ] **Step 3: Run typecheck to see which downstream files now break (expected)**

```bash
cd /Users/nguyenminhtri/.gemini/antigravity/scratch/trading_bot
pnpm typecheck 2>&1 | grep "tradingMode" | head -40
```

Expected: TS errors in `BotConfigStep.tsx`, `BotConfigSummary.tsx`, `risk.ts`, `deploy-summary.ts`, `TemplateDetailModal.tsx`, `validateSetup.ts`, `i18n/en.ts`, all 8 catalog files. These are fixed in Tasks 3-6.

- [ ] **Step 4: Run the store test to confirm it passes (or no test references tradingMode)**

```bash
cd /Users/nguyenminhtri/.gemini/antigravity/scratch/trading_bot
pnpm test -- --reporter=verbose src/features/bot-builder/store/builder.store.test.ts
```

Expected: PASS (no tradingMode assertions in builder.store.test.ts).

- [ ] **Step 5: Commit**

```bash
cd /Users/nguyenminhtri/.gemini/antigravity/scratch/trading_bot
git add src/types/builder.types.ts src/features/bot-builder/store/builder.store.ts
git commit -m "refactor(types,store): remove tradingMode from BotConfigForm; bump persist to v4"
```

---

## Task 3 — `BotConfigStep.tsx`: remove the toggle and simplify `BotConfigConfigure`

**Files:**
- Modify: `src/features/bot-builder/steps/BotConfigStep.tsx`
- Modify: `src/features/bot-builder/steps/BotConfigStep.test.tsx`

- [ ] **Step 1: Update `BotConfigStep.test.tsx` — add a test that Dry-run wallet is always visible**

In `src/features/bot-builder/steps/BotConfigStep.test.tsx`, add a new describe block after the existing ones:

```ts
describe('BotConfigConfigure — dry-run wallet always visible', () => {
  beforeEach(() => {
    useBuilderStore.getState().resetAll();
  });

  it('renders the Dry-run wallet field regardless of any mode state', () => {
    // Import BotConfigConfigure from same file
    render(<BotConfigConfigure />);
    // The label "Dry-run wallet" must always appear now that the mode toggle is gone
    expect(screen.getByText(/dry-run wallet/i)).toBeInTheDocument();
  });
});
```

Also update the import at the top of the test file to add `BotConfigConfigure`:
```ts
import { BotConfigSetup, BotConfigConfigure } from './BotConfigStep';
```

- [ ] **Step 2: Run the new test to confirm it fails (field is currently conditional)**

```bash
cd /Users/nguyenminhtri/.gemini/antigravity/scratch/trading_bot
pnpm test -- --reporter=verbose src/features/bot-builder/steps/BotConfigStep.test.tsx
```

Expected: FAIL — `TestingLibraryElementError: Unable to find an element with the text: /dry-run wallet/i` because the store defaults to `tradingMode: 'dry-run'` still... Actually at this point `tradingMode` was removed from the type, so the component compile error may block the test. That is fine — the TypeScript error confirms we need to change the component.

- [ ] **Step 3: Update `BotConfigStep.tsx` — remove the toggle, the confirm dialog, the `handleTradingMode` handler, and unconditionally show Dry-run wallet**

Replace the entire content of `BotConfigStep.tsx`. The key changes:

1. On line 28, remove only the `TradingMode` specifier from the import — `MarginMode` is still used. Change `import type { TradingMode, MarginMode } from '@/types/builder.types';` to `import type { MarginMode } from '@/types/builder.types';`.
2. Remove `useState` for `pendingLive`.
3. Remove `handleTradingMode` function.
4. Remove the `<FormField label="Trading mode" ...>` block (lines 110-121) entirely.
5. Remove the confirm `<Dialog open={pendingLive} ...>` block (lines 150-177) entirely.
6. In `BotConfigConfigure`, change the conditional `{config.tradingMode === 'dry-run' ? (...) : null}` to always render the Dry-run wallet field:

```tsx
// BEFORE (lines 274-286 in BotConfigConfigure)
{config.tradingMode === 'dry-run' ? (
  <FormField label="Dry-run wallet" help={HELP.dryRunWallet}>
    <NumberInput
      value={config.dryRunWallet}
      onValueChange={(v) => patch({ dryRunWallet: Math.max(0, v ?? 0) })}
      min={0}
      step={100}
      suffix={config.stakeCurrency}
    />
  </FormField>
) : null}
```
```tsx
// AFTER — always show (mode is set at launch time, not build time)
<FormField label="Dry-run wallet" help={HELP.dryRunWallet}>
  <NumberInput
    value={config.dryRunWallet}
    onValueChange={(v) => patch({ dryRunWallet: Math.max(0, v ?? 0) })}
    min={0}
    step={100}
    suffix={config.stakeCurrency}
  />
</FormField>
```

The `BotConfigSetup` component after the change should be:
```tsx
export function BotConfigSetup() {
  const config = useBuilderStore((s) => s.botConfig);
  const patch = useBuilderStore((s) => s.patchBotConfig);
  const botName = useBuilderStore((s) => s.botName);
  const setBotName = useBuilderStore((s) => s.setBotName);

  return (
    <>
      <FormField label="Bot name" required help={HELP.botName}>
        <Input
          value={botName}
          onChange={(e) => setBotName(e.target.value)}
          placeholder="My RSI Bot"
        />
      </FormField>

      <div className="grid grid-cols-2 gap-4">
        <div data-cy-anchor="bot-config:pair">
          <FormField label="Pair" required help={HELP.pair}>
            <Input
              list="pair-suggestions"
              placeholder="BTC-USDC"
              value={config.pair}
              onChange={(e) => {
                const pair = e.target.value.toUpperCase();
                patch({
                  pair,
                  stakeCurrency: deriveStakeCurrency(
                    pair,
                    config.stakeCurrency,
                  ),
                });
              }}
              autoFocus
            />
            <datalist id="pair-suggestions">
              {PAIR_SUGGESTIONS.map((p) => (
                <option key={p} value={p} />
              ))}
            </datalist>
          </FormField>
        </div>

        <FormField label="Timeframe" required help={HELP.timeframe}>
          <Select
            value={config.timeframe}
            onChange={(e) => patch({ timeframe: e.target.value })}
          >
            {TIMEFRAMES.map((tf) => (
              <option key={tf.value} value={tf.value}>
                {tf.label}
              </option>
            ))}
          </Select>
        </FormField>
      </div>

      <div data-cy-anchor="bot-config:leverage">
        <FormField label="Leverage" help={HELP.leverage}>
          <div className="flex items-center gap-3">
            <Slider
              className="min-w-0 flex-1"
              value={config.leverage}
              onValueChange={(v) => patch({ leverage: clampLeverage(v) })}
              min={LEVERAGE_MIN}
              max={LEVERAGE_MAX}
              step={1}
              ariaLabel="Leverage"
              showValue={false}
            />
            <NumberInput
              value={config.leverage}
              onValueChange={(v) => patch({ leverage: clampLeverage(v) })}
              min={LEVERAGE_MIN}
              max={LEVERAGE_MAX}
              step={1}
              suffix="x"
              aria-label="Leverage value"
              className="w-20 pr-8 text-right"
            />
          </div>
        </FormField>
      </div>
    </>
  );
}
```

Also remove the `Dialog`, `DialogContent`, `DialogDescription`, `DialogFooter`, `DialogHeader`, `DialogTitle` imports since they're only used by the deleted confirm dialog. Keep all other imports.

- [ ] **Step 4: Run the BotConfigStep tests to confirm they all pass**

```bash
cd /Users/nguyenminhtri/.gemini/antigravity/scratch/trading_bot
pnpm test -- --reporter=verbose src/features/bot-builder/steps/BotConfigStep.test.tsx
```

Expected: All tests PASS including the new "Dry-run wallet always visible" test.

- [ ] **Step 5: Commit**

```bash
cd /Users/nguyenminhtri/.gemini/antigravity/scratch/trading_bot
git add src/features/bot-builder/steps/BotConfigStep.tsx \
        src/features/bot-builder/steps/BotConfigStep.test.tsx
git commit -m "refactor(BotConfigStep): remove trading-mode toggle; always show dry-run wallet"
```

---

## Task 4 — Summaries + translators: `BotConfigSummary`, `summary-modes.test`, `deploy-summary`, `risk.ts`, `summarize.test`

**Files:**
- Modify: `src/features/bot-builder/components/summaries/BotConfigSummary.tsx`
- Modify: `src/features/bot-builder/components/summaries/__tests__/summary-modes.test.tsx`
- Modify: `src/features/export-import/deploy-summary.ts`
- Modify: `src/features/bot-summary/translators/risk.ts`
- Modify: `src/features/bot-summary/__tests__/summarize.test.ts`

- [ ] **Step 1: Update `summary-modes.test.tsx` — remove `tradingMode` from seedBotConfig and mode assertions**

In `src/features/bot-builder/components/summaries/__tests__/summary-modes.test.tsx`:

In the `seedBotConfig` helper (lines 8-21), remove the line `tradingMode: 'dry-run',`:
```ts
// BEFORE
function seedBotConfig() {
  useBuilderStore.setState((s) => ({
    ...s,
    botConfig: {
      ...s.botConfig,
      pair: 'BTC-USDC',
      timeframe: '1h',
      leverage: 1,
      tradingMode: 'dry-run',
      stakeAmount: 100,
      stakeCurrency: 'USDT',
    },
  }));
}
```
```ts
// AFTER
function seedBotConfig() {
  useBuilderStore.setState((s) => ({
    ...s,
    botConfig: {
      ...s.botConfig,
      pair: 'BTC-USDC',
      timeframe: '1h',
      leverage: 1,
      stakeAmount: 100,
      stakeCurrency: 'USDT',
    },
  }));
}
```

In the visual mode test (line 35), remove:
```ts
expect(screen.getByText(/dry-run/i)).toBeInTheDocument();
```

In the narrative mode test (line 46-55), remove:
```ts
expect(text).toMatch(/Dry-run/i);
```

- [ ] **Step 2: Update `summarize.test.ts` — remove `tradingMode` from pristine state; remove live-mode warning test**

In `src/features/bot-summary/__tests__/summarize.test.ts`, line 71, remove `tradingMode: 'dry-run',` from the `empty` state object.

Remove the entire test `'high leverage on live mode → warning on risk block'` (lines 129-137). Replace it with a mode-agnostic version that confirms high leverage still triggers the warning:

```ts
it('high leverage (>=10x) → warning on risk block regardless of mode', () => {
  const state = toBuilderState(BUILT_IN_TEMPLATES[0]);
  state.botConfig.leverage = 50;
  state.botConfig.marketType = 'futures';
  const result = summarizeBot(state);
  const risk = result.blocks.find((b) => b.id === 'risk');
  expect(risk?.warning).toContain('50× leverage');
});
```

- [ ] **Step 3: Run the summary tests to confirm they fail (implementation not updated yet)**

```bash
cd /Users/nguyenminhtri/.gemini/antigravity/scratch/trading_bot
pnpm test -- --reporter=verbose \
  src/features/bot-builder/components/summaries/__tests__/summary-modes.test.tsx \
  src/features/bot-summary/__tests__/summarize.test.ts
```

Expected: Type errors / failures because `BotConfigSummary.tsx` and `risk.ts` still reference `tradingMode`.

- [ ] **Step 4: Update `BotConfigSummary.tsx` — remove `tradingMode`, `isLive`, mode chip and prose**

In `src/features/bot-builder/components/summaries/BotConfigSummary.tsx`:

Change the destructure (line 13):
```ts
// BEFORE
const { pair, timeframe, leverage, tradingMode, stakeAmount, stakeCurrency } =
  botConfig;
```
```ts
// AFTER
const { pair, timeframe, leverage, stakeAmount, stakeCurrency } = botConfig;
```

Remove line 25 `const isLive = tradingMode === 'live';`.

In the `narrative` branch (lines 27-61), remove the mode span entirely:
```tsx
// BEFORE (within the narrative return)
in{' '}
<span
  className={
    isLive ? 'font-medium text-bearish' : 'font-medium text-bullish'
  }
>
  {isLive ? 'Live' : 'Dry-run'}
</span>{' '}
mode ·{' '}
```
```tsx
// AFTER — remove the above span; join "leverage" and "stake" directly:
leverage · stake{' '}
```

Adjust the surrounding prose to flow naturally (e.g. "…leverage · stake $100 USDT per position.").

In the `visual` branch (lines 63-98), remove the `<ReadOnlyChip>` for Live/Dry-run (lines 72-80):
```tsx
// BEFORE
<ReadOnlyChip
  tone={isLive ? 'bearish' : 'bullish'}
  title={
    isLive ? 'Live trading — real money' : 'Dry-run — paper trading'
  }
>
  {isLive ? 'Live' : 'Dry-run'}
</ReadOnlyChip>
```
Remove entirely. The `AlertTriangle` import can stay (it's used elsewhere in the file for high-leverage indicator).

- [ ] **Step 5: Update `deploy-summary.ts` — replace `tradingMode` reference with literal `true`**

In `src/features/export-import/deploy-summary.ts`, change line 108:
```ts
// BEFORE
dryRun: c.tradingMode === 'dry-run',
```
```ts
// AFTER — always dry at create time; Launchpad sets mode at launch
dryRun: true,
```

- [ ] **Step 6: Update `risk.ts` — remove live/dry conditional copy and the live-mode high-leverage warning**

In `src/features/bot-summary/translators/risk.ts`, replace the entire `translateRisk` function body:

```ts
// BEFORE
export function translateRisk(c: BotConfigForm): TranslateRiskResult {
  const lines: SummaryLine[] = [];
  let warning: string | undefined;

  // ── Trading mode ──────────────────────────────────────────────
  if (c.tradingMode === 'live') {
    lines.push(line(t('Live trading', 'bearish'), t(' — using real funds.')));
  } else {
    lines.push(
      line(
        t(
          `Dry-run mode with a ${fmtMoney(c.dryRunWallet, c.stakeCurrency)} simulated wallet.`,
        ),
      ),
    );
  }

  // ── Stake + concurrency ──────────────────────────────────────
  const concurrency = ...
  lines.push(...);

  // ── Leverage / market ────────────────────────────────────────
  if (c.marketType === 'spot') { ... }
  else if (c.leverage <= 1) { ... }
  else if (c.leverage >= HIGH_LEVERAGE_THRESHOLD) {
    lines.push(...);
    if (c.tradingMode === 'live') {
      warning = `${c.leverage}× leverage on live capital — losses can exceed your stake.`;
    }
  } else { ... }

  return { lines, warning };
}
```

```ts
// AFTER — mode-agnostic; always dry at build time; live-mode warnings belong in Launchpad
export function translateRisk(c: BotConfigForm): TranslateRiskResult {
  const lines: SummaryLine[] = [];
  let warning: string | undefined;

  // ── Dry-run wallet (always shown — bot always starts dry until launched) ──
  lines.push(
    line(
      t(
        `Dry-run with a ${fmtMoney(c.dryRunWallet, c.stakeCurrency)} simulated wallet.`,
      ),
    ),
  );

  // ── Stake + concurrency ──────────────────────────────────────────────────
  const concurrency =
    c.maxOpenTrades === -1
      ? 'unlimited concurrent positions'
      : c.maxOpenTrades === 1
        ? '1 position at a time'
        : `up to ${c.maxOpenTrades} concurrent positions`;
  lines.push(
    line(
      t(
        `${fmtMoney(c.stakeAmount, c.stakeCurrency)} stake per trade, ${concurrency}.`,
      ),
    ),
  );

  // ── Leverage / market ────────────────────────────────────────────────────
  if (c.marketType === 'spot') {
    lines.push(line(t('Spot trading — no leverage, no liquidation risk.')));
  } else if (c.leverage <= 1) {
    lines.push(line(t(`No leverage (1×), ${c.marginMode}-margin futures.`)));
  } else if (c.leverage >= HIGH_LEVERAGE_THRESHOLD) {
    lines.push(
      line(
        t('Leverage '),
        t(`${c.leverage}×`, 'bearish'),
        t(` ${c.marginMode}-margin — high-leverage, monitor closely.`),
      ),
    );
    // Warning regardless of mode — high leverage is always risky
    warning = `${c.leverage}× leverage — losses can exceed your stake.`;
  } else {
    lines.push(line(t(`Leverage ${c.leverage}× ${c.marginMode}-margin.`)));
  }

  return { lines, warning };
}
```

- [ ] **Step 7: Run all summary tests to confirm they pass**

```bash
cd /Users/nguyenminhtri/.gemini/antigravity/scratch/trading_bot
pnpm test -- --reporter=verbose \
  src/features/bot-builder/components/summaries/__tests__/summary-modes.test.tsx \
  src/features/bot-summary/__tests__/summarize.test.ts
```

Expected: All PASS.

- [ ] **Step 8: Commit**

```bash
cd /Users/nguyenminhtri/.gemini/antigravity/scratch/trading_bot
git add \
  src/features/bot-builder/components/summaries/BotConfigSummary.tsx \
  src/features/bot-builder/components/summaries/__tests__/summary-modes.test.tsx \
  src/features/export-import/deploy-summary.ts \
  src/features/bot-summary/translators/risk.ts \
  src/features/bot-summary/__tests__/summarize.test.ts
git commit -m "refactor(summaries,risk): remove tradingMode from summaries; mode-agnostic risk translator"
```

---

## Task 5 — Templates, `TemplateDetailModal`, `validateSetup`, `i18n`

**Files:**
- Modify: `src/templates/catalog/breakout-btc-15m.ts`
- Modify: `src/templates/catalog/conservative-dca-btc.ts`
- Modify: `src/templates/catalog/cypheus-default.ts`
- Modify: `src/templates/catalog/grid-stable-usdt-pairs.ts`
- Modify: `src/templates/catalog/macd-momentum-bnb.ts`
- Modify: `src/templates/catalog/multi-tf-trend-alts.ts`
- Modify: `src/templates/catalog/rsi-oversold-eth-1h.ts`
- Modify: `src/templates/catalog/scalping-btc-1m.ts`
- Modify: `src/templates/types.ts`
- Modify: `src/templates/apply.ts`
- Modify: `src/features/templates/TemplateDetailModal.tsx`
- Modify: `src/lib/validateSetup.ts`
- Modify: `src/i18n/en.ts`

- [ ] **Step 1: Update `validateSetup.ts` — remove `tradingMode` from `botConfigSetupSchema`**

In `src/lib/validateSetup.ts`:
```ts
// BEFORE
// ── Bot Config Setup: pair + timeframe + tradingMode + leverage ──────────────
const botConfigSetupSchema = z.object({
  pair: z.string().min(3, 'Required'),
  timeframe: z.string().min(1, 'Required'),
  tradingMode: z.enum(['dry-run', 'live']),
  leverage: z.number().min(LEVERAGE_MIN).max(LEVERAGE_MAX),
});
```
```ts
// AFTER
// ── Bot Config Setup: pair + timeframe + leverage ────────────────────────────
const botConfigSetupSchema = z.object({
  pair: z.string().min(3, 'Required'),
  timeframe: z.string().min(1, 'Required'),
  leverage: z.number().min(LEVERAGE_MIN).max(LEVERAGE_MAX),
});
```

- [ ] **Step 2: Update `i18n/en.ts` — remove the `tradingMode` help text key; update affected descriptions**

In `src/i18n/en.ts`:

Remove the `tradingMode` entry from `helpText.botConfig` (lines 258-259):
```ts
// REMOVE this line:
tradingMode:
  'Dry-run simulates trades with a virtual wallet — no real funds at risk. Live places real orders.',
```

Update `steps.botConfig.description` (line 52):
```ts
// BEFORE
description: 'Pick the market, timeframe and trading mode.',
```
```ts
// AFTER
description: 'Pick the market, timeframe and stake configuration.',
```

Update `phase.botBasics.description` (line 79):
```ts
// BEFORE
description: 'Pick the market, timeframe and trading mode.',
```
```ts
// AFTER
description: 'Pick the market, timeframe and stake configuration.',
```

Update `botConfigDrawer.description` (line 221):
```ts
// BEFORE
description:
  'Pick the market, timeframe, trading mode and stake — all in one place.',
```
```ts
// AFTER
description:
  'Pick the market, timeframe, leverage and stake — all in one place.',
```

- [ ] **Step 3: Update `TemplateDetailModal.tsx` — remove `tradingMode` from the Mode row**

In `src/features/templates/TemplateDetailModal.tsx`, in `ParamHighlights`, change the `mode` row (line 153-155):
```ts
// BEFORE
{
  label: t.mode,
  value: `${c.tradingMode === 'dry-run' ? 'Dry-run' : 'Live'} · ${c.marketType}${c.leverage > 1 ? ` · ${c.leverage}x` : ''}`,
},
```
```ts
// AFTER — mode is launch-time only; show market type + leverage
{
  label: t.mode,
  value: `${c.marketType}${c.leverage > 1 ? ` · ${c.leverage}x` : ''}`,
},
```

- [ ] **Step 4: Bump `TEMPLATE_SCHEMA_VERSION` to 3 and add migration in `apply.ts`**

In `src/templates/types.ts`, change:
```ts
// BEFORE
export const TEMPLATE_SCHEMA_VERSION = 2;
```
```ts
// AFTER
export const TEMPLATE_SCHEMA_VERSION = 3;
```

In `src/templates/apply.ts`, add a v2→v3 migration branch in `migrateTemplateSnapshot`:
```ts
// BEFORE
function migrateTemplateSnapshot(
  snap: TemplateStateSnapshot,
  fromVersion: number,
): TemplateStateSnapshot {
  if (fromVersion === TEMPLATE_SCHEMA_VERSION) return snap;
  throw new Error(
    `Template schemaVersion ${fromVersion} not supported (current: ${TEMPLATE_SCHEMA_VERSION}). ` +
      'Update the template or add a migration branch.',
  );
}
```
```ts
// AFTER
function migrateTemplateSnapshot(
  snap: TemplateStateSnapshot,
  fromVersion: number,
): TemplateStateSnapshot {
  if (fromVersion === TEMPLATE_SCHEMA_VERSION) return snap;
  // v2 → v3: tradingMode removed from BotConfigForm
  if (fromVersion === 2) {
    const migrated = {
      ...snap,
      botConfig: { ...snap.botConfig } as Record<string, unknown>,
    };
    delete (migrated.botConfig as Record<string, unknown>)['tradingMode'];
    return migrated as TemplateStateSnapshot;
  }
  throw new Error(
    `Template schemaVersion ${fromVersion} not supported (current: ${TEMPLATE_SCHEMA_VERSION}). ` +
      'Update the template or add a migration branch.',
  );
}
```

- [ ] **Step 5: Remove `tradingMode` from all 8 catalog files**

For each file below, remove the `tradingMode: 'dry-run',` line from the `botConfig` object:

- `src/templates/catalog/breakout-btc-15m.ts` (line 31)
- `src/templates/catalog/conservative-dca-btc.ts` (line 33)
- `src/templates/catalog/cypheus-default.ts` (line 26)
- `src/templates/catalog/grid-stable-usdt-pairs.ts` (line 33)
- `src/templates/catalog/macd-momentum-bnb.ts` (line 31)
- `src/templates/catalog/multi-tf-trend-alts.ts` (line 32)
- `src/templates/catalog/rsi-oversold-eth-1h.ts` (line 33)
- `src/templates/catalog/scalping-btc-1m.ts` (line 32)

Also update `meta.schemaVersion` from `TEMPLATE_SCHEMA_VERSION` (which is now 3) — since the value is the exported constant, it picks up the new value automatically (no per-file change needed beyond removing `tradingMode`).

- [ ] **Step 6: Run the template validation test to confirm all templates pass**

```bash
cd /Users/nguyenminhtri/.gemini/antigravity/scratch/trading_bot
pnpm test -- --reporter=verbose \
  src/templates/__tests__/validate-all-templates.test.ts \
  src/templates/__tests__/apply.test.ts
```

Expected: All PASS.

- [ ] **Step 7: Commit**

```bash
cd /Users/nguyenminhtri/.gemini/antigravity/scratch/trading_bot
git add \
  src/templates/catalog/breakout-btc-15m.ts \
  src/templates/catalog/conservative-dca-btc.ts \
  src/templates/catalog/cypheus-default.ts \
  src/templates/catalog/grid-stable-usdt-pairs.ts \
  src/templates/catalog/macd-momentum-bnb.ts \
  src/templates/catalog/multi-tf-trend-alts.ts \
  src/templates/catalog/rsi-oversold-eth-1h.ts \
  src/templates/catalog/scalping-btc-1m.ts \
  src/templates/types.ts \
  src/templates/apply.ts \
  src/features/templates/TemplateDetailModal.tsx \
  src/lib/validateSetup.ts \
  src/i18n/en.ts
git commit -m "refactor(templates,i18n,validation): strip tradingMode from catalogs, bump schema to v3, update copy"
```

---

## Task 6 — Final verification: typecheck + lint + test + grep-zero

**Files:** None (verification only)

- [ ] **Step 1: Run `pnpm typecheck` — must exit 0**

```bash
cd /Users/nguyenminhtri/.gemini/antigravity/scratch/trading_bot
pnpm typecheck
```

Expected: No errors. If there are any, fix them (they will be residual references to `tradingMode` or `TradingMode`).

- [ ] **Step 2: Run `pnpm lint` — must exit 0**

```bash
cd /Users/nguyenminhtri/.gemini/antigravity/scratch/trading_bot
pnpm lint
```

Expected: No errors. Fix any unused-variable lint errors that arise from the deletions (e.g. imported but now-unused `AlertTriangle` in `BotConfigSummary` if not used elsewhere).

- [ ] **Step 3: Run the full test suite — must exit 0**

```bash
cd /Users/nguyenminhtri/.gemini/antigravity/scratch/trading_bot
pnpm test
```

Expected: All tests PASS.

- [ ] **Step 4: Grep to confirm zero remaining `tradingMode` references in `src/`**

```bash
cd /Users/nguyenminhtri/.gemini/antigravity/scratch/trading_bot
grep -rn "tradingMode" src/ --include="*.ts" --include="*.tsx"
```

Expected: **No output** (zero matches).

The only allowed survivors of `tradingMode` are:
- `src/schemas/unified-bot-strategy.schema.ts` — the variable `tradingModeSchema` refers to the *BE* `trading_mode` enum (spot/margin/futures), not our UI toggle. This is a different concept and must NOT be changed.

If the grep shows only that one occurrence, you are clean.

- [ ] **Step 5: Run `pnpm format` to normalize Tailwind class order**

```bash
cd /Users/nguyenminhtri/.gemini/antigravity/scratch/trading_bot
pnpm format
```

- [ ] **Step 6: Commit the format-only diff (if any)**

```bash
cd /Users/nguyenminhtri/.gemini/antigravity/scratch/trading_bot
git add -p  # review any changes from formatter
git commit -m "chore: pnpm format after trading-mode removal"
```

---

## Self-Review: Spec WS2 bullets → Tasks

| Spec requirement | Implemented in |
|---|---|
| Remove the Dry-run/Live toggle from `BotConfigStep.tsx` | Task 3 |
| `serializer.ts` stop reading `tradingMode`; hardcode `dry_run: true` on create | Task 1 |
| Remove `tradingMode` from `builder.store.ts` and `builder.types.ts` | Task 2 |
| Remove `tradingMode` from `BotConfigSummary.tsx` and `summary-modes.test` | Task 4 |
| Remove `tradingMode` from `deploy-summary.ts` | Task 4 |
| Remove live/dry conditional copy + high-leverage warning tied to `tradingMode==='live'` from `risk.ts` | Task 4 |
| Remove `tradingMode` from `validateSetup.ts` | Task 5 |
| Remove `tradingMode` from `i18n/en.ts` | Task 5 |
| Remove `tradingMode` from `TemplateDetailModal.tsx` | Task 5 |
| Remove `tradingMode` from all `src/templates/catalog/*.ts` entries | Task 5 |
| **KEEP** leverage, stake amount/currency, dry-run wallet | Dry-run wallet made unconditional in Task 3; leverage/stake untouched throughout |
| On import: drop `tradingMode` mapping from deserialisers; keep `dry_run_wallet` | Task 1 |
| Typecheck guard: no remaining `tradingMode` in `TemplateDetailModal`, `risk.ts`, `validateSetup.ts`, `i18n/en.ts` | Task 6 Step 4 |
| Launchpad/launch behavior unchanged (`launch-actions.ts:14` always overwrites `dry_run`) | Out of scope — no changes to `src/features/launchpad/launch-actions.ts` |

### Notes for the implementer

- `src/schemas/unified-bot-strategy.schema.ts` contains `tradingModeSchema` — this is the **BE** `trading_mode` field (enum: `spot | margin | futures`), NOT the FE `tradingMode` toggle. Do not touch it.
- The store persist `version` must bump to 4 so users with cached `tradingMode` in localStorage get it silently dropped on first load (Task 2 migration).
- Template `schemaVersion` bumps to 3 so the apply engine runs the migration for any installed templates. Since all catalog files are also updated to omit `tradingMode`, the migration is only needed for templates loaded from external JSON files or older local cache.
