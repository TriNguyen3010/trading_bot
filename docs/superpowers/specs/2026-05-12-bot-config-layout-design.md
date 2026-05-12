# Bot Config Step Layout Redesign — Design Spec

**Status:** Approved by Tri 2026-05-12 (all Q1–Q4 + dry-run wallet Q = option a).
**Owner:** FE (Tri Nguyen).
**Scope:** UI compression in `BotConfigSetup` + `BotConfigConfigure`. Lock exchange to Hyperliquid and market type to Futures.

---

## 1. Goal

Reorganize the bot-basics drawer into a tighter, opinionated form. Six concrete changes:

1. **Pair + Timeframe in one row** (currently stacked).
2. **Leverage as a slider** (currently a `NumberInput`).
3. **Exchange locked to "Hyperliquid"** — replace the multi-option `Select` with a read-only chip. The wizard no longer offers other exchanges.
4. **Market type locked to "Futures"** — replace the `Spot / Futures` toggle with a read-only chip. Wizard no longer offers spot.
5. **Exchange + Market type share one row** (two read-only chips side by side).
6. **Max open trades + Stake currency + Stake amount share one row** (3-column grid).
7. **Remove the M3 note** ("Telegram, position adjustment…") at the bottom of `BotConfigConfigure`.

Dry-run wallet stays conditional (`tradingMode === 'dry-run'`) on its own row, below the 3-col stake row.

## 2. Non-goals

- Adding a real Hyperliquid OAuth / API-key field (still future work).
- Re-enabling spot mode (assume futures-only is the product reality for v1).
- Refactoring `BotConfigSetup` and `BotConfigConfigure` into a single component. They stay separate exports — `BotConfigDrawerContent` already renders them sequentially in one drawer body, so the visual flow is one form regardless.
- Backwards compatibility for existing user JSON imports that ship a non-Hyperliquid exchange — the deserializer keeps the value as-is, but the UI no longer lets the user change it through the wizard. Re-export will preserve whatever is in state.

## 3. Final layout

### `BotConfigSetup`

```
┌─ grid-cols-2 ──────────────────────────────┐
│  Pair *                  Timeframe *       │
│  [BTC-USDC          ]    [5 minutes ▼]     │
└────────────────────────────────────────────┘

Trading mode * (full-width ToggleGroup — Dry-run / Live)

Leverage
[──────●─────────────────] 1×          (slider 1..125 step 1, value chip on right)
```

### `BotConfigConfigure`

```
┌─ grid-cols-2 ──────────────────────────────┐
│  Exchange                Market type        │
│  [ Hyperliquid ]         [ Futures ]        │  (both read-only chips)
└────────────────────────────────────────────┘

Margin mode * (full-width ToggleGroup — Cross / Isolated)

┌─ grid-cols-3 ──────────────────────────────────────────────┐
│  Max open trades    Stake currency      Stake amount        │
│  [10]               [USDT ▼]            [100 USDT]          │
└────────────────────────────────────────────────────────────┘

(Only when tradingMode === 'dry-run')
Dry-run wallet
[1000 USDT]                                                   (full-width NumberInput)
```

The M3 dashed-border note disappears.

## 4. Component changes

### 4.1 New: `src/components/ui/slider.tsx`

Native HTML `<input type="range">` wrapped with Tailwind styling. Q1 decision: no Radix dependency.

**Props:**
```ts
interface SliderProps {
  value: number;
  onValueChange: (next: number) => void;
  min?: number;        // default 0
  max?: number;        // default 100
  step?: number;       // default 1
  suffix?: string;     // displayed next to the value, e.g. "x"
  ariaLabel?: string;
}
```

**Render shape:**
```
<div role="group" className="flex items-center gap-3">
  <input type="range" ... className="h-1 flex-1 cursor-pointer accent-brand" />
  <span className="min-w-[3rem] text-right text-sm font-medium tabular-nums text-fg">
    {value}{suffix}
  </span>
</div>
```

`accent-brand` colors the filled track + thumb to the Coin98 brand yellow on supporting browsers (Chrome/Edge/Firefox modern). Safari falls back to default blue — acceptable given target user base is desktop Chrome/Brave.

### 4.2 Modified: `src/features/bot-builder/steps/BotConfigStep.tsx`

Both `BotConfigSetup` and `BotConfigConfigure` get rewritten layouts. The store reads/writes stay the same (still `patchBotConfig`); only the JSX changes plus the `Leverage` swap from `NumberInput` to the new `Slider`.

For the Exchange and Market type chips, render a small label + value pair:

```tsx
<FormField label="Exchange" required>
  <div className="rounded-2xl border border-border bg-canvas/40 px-4 py-2 text-sm text-fg">
    Hyperliquid
  </div>
</FormField>
```

(Same shape for Market type with value "Futures". Don't make these editable.)

### 4.3 Modified: `src/features/bot-builder/store/builder.store.ts`

```diff
-  exchange: 'binance',
+  exchange: 'hyperliquid',
   marketType: 'futures',  // already correct
```

### 4.4 Modified: `src/lib/constants.ts`

Remove the `EXCHANGES` const (the multi-exchange picker is gone). If any other code references it (verify with grep), update those sites or keep the constant as-is — but the wizard no longer reads it.

### 4.5 Modified: 8 templates in `src/templates/catalog/`

Find every `exchange: 'binance'` → `exchange: 'hyperliquid'`. Find `grid-stable-usdt-pairs.ts`'s `marketType: 'spot'` → `marketType: 'futures'` (and its `marginMode` stays `'cross'`). This keeps the catalog consistent with the locked wizard.

Optional cleanup: `grid-stable-usdt-pairs` was a USDT spot-grid strategy — forcing futures changes its semantics. If keeping the template, rename to something like "Stable USDT Pairs Grid (Futures Cross)" so it doesn't lie. If undesirable, retire the template.

**This spec's call:** rename + futurize, don't retire. Tri can retire later if it doesn't backtest well.

### 4.6 BE value confirmation

Q4 = (a): Tri to verify with Tuấn that BE accepts `exchange: 'hyperliquid'` (lowercase string). If BE expects a different identifier (e.g. `'hyperliquid-perp'`, `'hl'`), update the constant in this design before merging. Smoke test = submit a bot to BE and confirm 201 Created.

## 5. Tests

| Layer | Test |
|---|---|
| Slider component | `src/components/ui/slider.test.tsx` — renders input with given value, onValueChange fires with new number on input event, value display reflects current. |
| BotConfigStep | No new component-level test (existing serializer round-trips cover the data path). |
| Existing tests | `serializer.test.ts`, `unified-bot-strategy.test.ts`, `summarize.test.ts`, template `validate-all-templates.test.ts` — all must still pass. Templates that referenced `'binance'` get updated to `'hyperliquid'` in the same commit as the wizard change, so the validate-all suite covers the new values. |

## 6. Files (summary)

**New (2):**
- `src/components/ui/slider.tsx`
- `src/components/ui/slider.test.tsx`

**Modified (~11):**
- `src/features/bot-builder/steps/BotConfigStep.tsx`
- `src/features/bot-builder/store/builder.store.ts`
- `src/lib/constants.ts` (remove unused `EXCHANGES`)
- `src/templates/catalog/macd-momentum-bnb.ts`
- `src/templates/catalog/grid-stable-usdt-pairs.ts` (and rename label)
- `src/templates/catalog/cypheus-default.ts`
- `src/templates/catalog/breakout-btc-15m.ts`
- `src/templates/catalog/multi-tf-trend-alts.ts`
- `src/templates/catalog/rsi-oversold-eth-1h.ts`
- `src/templates/catalog/conservative-dca-btc.ts`
- `src/templates/catalog/scalping-btc-1m.ts`

**Unchanged:**
- BE schema, serializer (it just passes `exchange` and `marketType` strings through).
- Zod schemas, types in `builder.types.ts`.
- `IndicatorExitForm`, `EntryStrategyStep`, all other steps.

## 7. Risks

Low. Mostly cosmetic + a string constant change. The one risk is Q4 (BE may not accept `'hyperliquid'` literally) — covered by Tri's BE verification step.

Secondary risk: existing user-saved local state (Zustand persist) has `exchange: 'binance'` (from before this change). On reload, the user sees a chip saying "Hyperliquid" but state still has `'binance'`. Solution: in the BotConfigConfigure mount, if `config.exchange !== 'hyperliquid'`, patch it to `'hyperliquid'` once (silent migration). Plan covers this as a step.

## 8. Out of scope

- A real exchange picker reappearing later. If Coin98 ships Binance/Bybit later, this design gets rolled back.
- Slider with two thumbs (range). Single-thumb only.
- Replacing the `Trading mode` ToggleGroup or the `Margin mode` ToggleGroup. They stay.
- Live mode confirmation dialog rewiring. Untouched.
- Pair autocomplete improvements. Untouched.
