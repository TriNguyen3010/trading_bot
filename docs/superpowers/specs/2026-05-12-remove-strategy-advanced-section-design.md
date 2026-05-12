# Remove Strategy Drawer "Advanced" Section — Design Spec

**Status:** Awaiting approval (Tri picked Option A 2026-05-12)
**Owner:** FE (Tri Nguyen)
**Tracking:** v1 only — full removal, not "collapsed by default".

---

## 1. Goal

Delete the "Advanced" accordion section from the Strategy drawer. The four fields it currently exposes are either dead code or have defaults that cover 99% of strategies the wizard can build today.

| Field | Current behavior | Decision |
|---|---|---|
| **Slippage tolerance** | Tracked in form state. NEVER sent to BE (see [serializer.ts:175-200](../../src/lib/serializer.ts:175) — `slippage` not in output payload). Dead UI. | Remove from code entirely. |
| **Startup candle count** | Sent to BE. Default `200` covers RSI-14, MA200, MACD, Bollinger — every indicator currently in the registry. BE schema has `.default(200)` fallback. | Remove from wizard UI. Keep in form state, store, serializer, templates — templates still set custom values (60, 100, 250) and JSON import works. |
| **Informative timeframes** | Sent to BE. Used only by multi-timeframe indicators (e.g. `MA200_1h`). Existing M3 note acknowledges this isn't supported yet. | Same as startup candle count — remove from wizard, keep plumbing. |
| **Limit offset (placeholder note)** | Inside `DirectionConfigure`. Shows "Switch to Limit to set offset" when `orderType === 'market'`. The actual `<NumberInput>` is hidden by the same conditional. | Move the input to `DirectionSetup` directly under the order type selector, rendered only when `orderType === 'limit'`. Drop the placeholder note. |

## 2. Non-goals

- BE schema changes.
- BotConfig step changes (the Advanced section in the screenshot is the **Strategy phase** Advanced — different drawer).
- Adding a "show advanced" toggle / collapse. Tri rejected this (option B/C) in favor of full removal.

## 3. Files to change

**Modified (12):**

| Path | Change |
|---|---|
| [src/features/bot-builder/components/StrategyDrawerContent.tsx](../../src/features/bot-builder/components/StrategyDrawerContent.tsx) | Delete the third `<StrategySection title={…advanced}>` block (lines 77-83). Drop the now-unused `DirectionConfigure` + `EntryStrategyConfigure` imports. |
| [src/features/bot-builder/steps/DirectionStep.tsx](../../src/features/bot-builder/steps/DirectionStep.tsx) | Inline the limit-offset `FormField` into `DirectionSetup` immediately under the order-type radio group, rendered only when `form.orderType === 'limit'`. Delete the `DirectionConfigure` export (now empty after slippage removal). |
| [src/features/bot-builder/steps/EntryStrategyStep.tsx](../../src/features/bot-builder/steps/EntryStrategyStep.tsx) | Delete the `EntryStrategyConfigure` export (becomes empty). Remove the `TIMEFRAMES` constant + `Chip` import if no longer used. |
| [src/types/builder.types.ts](../../src/types/builder.types.ts) | Drop `slippageTolerance` from `DirectionForm` interface. Add JSDoc on `startupCandleCount` + `informativeTimeframes` in `EntryStrategyForm`: `/** Set via templates / JSON import only — not exposed in the wizard UI. */`. |
| [src/features/bot-builder/store/builder.store.ts](../../src/features/bot-builder/store/builder.store.ts) | Drop `slippageTolerance: 0.5` from `defaultDirection`. |
| [src/lib/serializer.ts](../../src/lib/serializer.ts) | Drop `slippageTolerance: 0.5` from the two deserialize-fallback objects (lines 336 + 616). |
| [src/features/bot-summary/translators/direction.ts](../../src/features/bot-summary/translators/direction.ts) | Drop the `if (d.slippageTolerance > 0) { ... }` block (lines 46-48) that adds slippage to the bot summary. |
| [src/templates/animation.ts](../../src/templates/animation.ts) | Drop `slippageTolerance: d.slippageTolerance` (line 170). |
| [src/templates/catalog/*.ts](../../src/templates/catalog/) (8 files) | Drop `slippageTolerance` key from each `direction:` block. |
| [src/i18n/en.ts](../../src/i18n/en.ts) | Drop `strategyDrawer.sections.advanced` key (line 248). Drop `advanced: 'Advanced'` at line 222 ONLY if not referenced elsewhere — verify with grep first. |
| [src/features/cypheus/setup-progress/SetupProgress.test.tsx](../../src/features/cypheus/setup-progress/SetupProgress.test.tsx) | Drop `slippageTolerance: 0.5` from the test fixture. |
| [src/features/bot-summary/__tests__/summarize.test.ts](../../src/features/bot-summary/__tests__/summarize.test.ts) | Drop `slippageTolerance: 0.5` from the test fixture. If any assertion expected the slippage line in the summary output, drop that assertion. |

## 4. What stays put (intentionally)

- `startupCandleCount` and `informativeTimeframes`:
  - Form type: stays.
  - Store default: stays at `200` / `[]`.
  - Serializer → BE: stays. Templates override per-strategy. JSON import overrides per-bundle.
  - Tests: stay.
- BE schema `startup_candle_count: z.number().int().positive().default(200)` and `informative_timeframes: z.array(z.string()).default([])`: untouched.
- The `Strategy / Configurations / Signals` shape sent to BE: unchanged (all four mandatory configurations fields still present).

## 5. UX after change

Strategy drawer accordion goes from 3 sections to 2:
- **Entry** — indicators + entry conditions (unchanged).
- **Action** — direction + order type + (NEW) limit offset when limit + close method.

A typical user fills these 2 sections and can submit. The "Switch to Limit" placeholder and the M3 note disappear — both were noise.

## 6. Risk assessment

Low:
- Slippage tolerance is currently dead (verified via grep — only deserialize fallback writes it back into state, never serialized).
- Startup / informative still wired identically — bots build via wizard get `200` / `[]`; bots from templates get template values; bots from JSON import get whatever the file says. BE accepts all three paths today.
- Limit-offset relocation is a UI-only move; same field, same data path, just rendered earlier in the form.

Tests touched: 2 test fixtures lose `slippageTolerance`. Existing assertions don't depend on it.

## 7. Out of scope

- Phase 2 cleanup: full removal of `startupCandleCount` / `informativeTimeframes` from code if BE confirms it always uses its schema defaults. (Defer until BE confirms.)
- Re-adding an Advanced section when M3 lands (Custom indicator items). New scope at that time.
