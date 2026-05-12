# Bot Config Step Layout Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Compress the bot-basics drawer (`BotConfigSetup` + `BotConfigConfigure`) into a tighter, opinionated form. Pair+Timeframe go on one row; Exchange and Market type become read-only "Hyperliquid" / "Futures" chips on a shared row; Max open + Stake currency + Stake amount share a 3-column row; Leverage becomes a slider; the M3 dashed-border note disappears. Templates and the store default get updated so `exchange === 'hyperliquid'` and `marketType === 'futures'` everywhere.

**Architecture:** New `Slider` primitive in `src/components/ui/` is a thin Tailwind-styled wrapper over native `<input type="range">` (no Radix dep). `BotConfigStep.tsx` gets a layout rewrite with `grid-cols-2` and `grid-cols-3` wrappers around existing FormFields. Store default + 8 template files swap exchange/marketType to the locked values. Existing user state (Zustand persist) that still has `'binance'` gets a silent on-mount migration. No serializer or BE schema changes — payload still carries `exchange` and `marketType` as plain strings.

**Tech Stack:** React 18, TypeScript 5.7, Tailwind 3, Vitest 2 + @testing-library/react.

**Spec:** `docs/superpowers/specs/2026-05-12-bot-config-layout-design.md`

**Approved design decisions** (Tri 2026-05-12):
- Slider: native HTML `<input type="range">` (no Radix dep).
- Exchange field: show as a read-only chip labeled "Hyperliquid" (not hidden).
- Templates: migrate all 8 catalog files to `exchange: 'hyperliquid'`. The single `marketType: 'spot'` template (`grid-stable-usdt-pairs`) flips to `'futures'` and gets its label updated.
- BE value: assume `'hyperliquid'` — Tri verifies with Tuấn that BE accepts this literal. Smoke step at end confirms via real submit (or flags 422 for a follow-up).
- Dry-run wallet: stays on its own conditional row below the 3-col stake row.

---

## File Structure

**New (2):**
| Path | Purpose |
|---|---|
| `src/components/ui/slider.tsx` | Tailwind-styled wrapper over `<input type="range">`. Props: `{ value, onValueChange, min, max, step, suffix, ariaLabel }`. Renders the input + a tabular-nums value chip beside it. |
| `src/components/ui/slider.test.tsx` | 3 tests: renders with given value, fires onValueChange with new number on input event, value chip reflects current value (including suffix). |

**Modified (11):**
| Path | Change |
|---|---|
| `src/features/bot-builder/steps/BotConfigStep.tsx` | Layout rewrite per §3 of spec. Pair+Timeframe `grid-cols-2`. Exchange+Market type as read-only chips in `grid-cols-2`. Max open + Stake currency + Stake amount in `grid-cols-3`. Dry-run wallet conditional own-row. Leverage uses new `<Slider>`. Remove M3 note block. Add `useEffect` silent migration: if `config.exchange !== 'hyperliquid'` or `config.marketType !== 'futures'` on mount, patch to those values. |
| `src/features/bot-builder/store/builder.store.ts` | Change `defaultBotConfig.exchange` from `'binance'` to `'hyperliquid'`. `marketType: 'futures'` is already correct, leave as is. |
| `src/lib/constants.ts` | Remove the unused `EXCHANGES` const. Verify no remaining importers via grep before deletion. |
| `src/templates/catalog/macd-momentum-bnb.ts` | `exchange: 'binance'` → `'hyperliquid'`. |
| `src/templates/catalog/cypheus-default.ts` | Same. |
| `src/templates/catalog/breakout-btc-15m.ts` | Same. |
| `src/templates/catalog/multi-tf-trend-alts.ts` | Same. |
| `src/templates/catalog/rsi-oversold-eth-1h.ts` | Same. |
| `src/templates/catalog/conservative-dca-btc.ts` | Same. |
| `src/templates/catalog/scalping-btc-1m.ts` | Same. |
| `src/templates/catalog/grid-stable-usdt-pairs.ts` | `exchange: 'binance'` → `'hyperliquid'`. **Also** `marketType: 'spot'` → `'futures'`. Update the template's `name` field from whatever it currently is to indicate it's now a futures variant (e.g. `'Stable USDT Pairs Grid (Futures Cross)'`). |

**Unchanged:** Zod schemas, serializer, BE payload shape, `IndicatorExitForm`, other steps. The Trading-mode and Margin-mode ToggleGroups stay. Live-mode confirmation dialog stays.

---

## Task 1: Create `Slider` component + tests

**Files:**
- Create: `src/components/ui/slider.tsx`
- Create: `src/components/ui/slider.test.tsx`

- [ ] **Step 1: Write the failing tests**

Create `src/components/ui/slider.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Slider } from './slider';

describe('Slider', () => {
  it('renders the input with the given value', () => {
    render(<Slider value={25} onValueChange={() => {}} min={1} max={125} ariaLabel="Leverage" />);
    const input = screen.getByRole('slider', { name: 'Leverage' }) as HTMLInputElement;
    expect(input).toBeInTheDocument();
    expect(input.value).toBe('25');
  });

  it('fires onValueChange with a number when user moves the slider', () => {
    const onValueChange = vi.fn();
    render(<Slider value={1} onValueChange={onValueChange} min={1} max={125} ariaLabel="Leverage" />);
    const input = screen.getByRole('slider', { name: 'Leverage' }) as HTMLInputElement;
    fireEvent.change(input, { target: { value: '50' } });
    expect(onValueChange).toHaveBeenCalledWith(50);
    expect(typeof onValueChange.mock.calls[0][0]).toBe('number');
  });

  it('displays the value with the suffix beside the slider', () => {
    render(<Slider value={10} onValueChange={() => {}} min={1} max={125} suffix="x" ariaLabel="Leverage" />);
    expect(screen.getByText('10x')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail (module-not-found)**

Run: `pnpm test -- --run src/components/ui/slider.test.tsx`
Expected: FAIL with "Failed to resolve import './slider'".

- [ ] **Step 3: Implement the component**

Create `src/components/ui/slider.tsx`:

```tsx
export interface SliderProps {
  value: number;
  onValueChange: (next: number) => void;
  min?: number;
  max?: number;
  step?: number;
  suffix?: string;
  ariaLabel?: string;
}

/**
 * Native HTML range input wrapped in Tailwind styling.
 *
 * Renders the slider on the left flexing to fill, with a fixed-width
 * tabular-nums value chip on the right. `accent-brand` colors the track
 * and thumb to the Coin98 brand on Chrome/Edge/Firefox; Safari falls
 * back to default.
 */
export function Slider({
  value,
  onValueChange,
  min = 0,
  max = 100,
  step = 1,
  suffix = '',
  ariaLabel,
}: SliderProps) {
  return (
    <div role="group" className="flex items-center gap-3">
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onValueChange(Number(e.target.value))}
        aria-label={ariaLabel}
        className="h-1 flex-1 cursor-pointer accent-brand"
      />
      <span className="min-w-[3rem] text-right text-sm font-medium tabular-nums text-fg">
        {value}
        {suffix}
      </span>
    </div>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test -- --run src/components/ui/slider.test.tsx`
Expected: 3 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/ui/slider.tsx src/components/ui/slider.test.tsx
git commit -m "$(cat <<'EOF'
feat(ui): add Slider primitive

Tailwind-styled wrapper over native <input type="range">. Single-thumb
range input + a tabular-nums value chip on the right. `accent-brand`
colors the track and thumb on Chrome/Edge/Firefox; Safari falls back to
default blue. Used next by the BotConfig leverage field, but lives in
src/components/ui/ so other features can reuse.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

DO NOT push.

---

## Task 2: Lock exchange + market type — store default, templates, constants

This task is mechanical search-and-replace plus a single one-line store change. Bundle the 8 template updates + store default + `EXCHANGES` constant removal into one commit since they're a single logical change ("lock the wizard to Hyperliquid + Futures across the catalog").

**Files:**
- Modify: `src/features/bot-builder/store/builder.store.ts`
- Modify: `src/lib/constants.ts`
- Modify: 8 template files (see below).

- [ ] **Step 1: Update the store default**

In `src/features/bot-builder/store/builder.store.ts`, find:

```ts
exchange: 'binance',
```

Replace with:

```ts
exchange: 'hyperliquid',
```

Leave `marketType: 'futures'` as-is (already correct).

- [ ] **Step 2: Update 7 simple templates**

For each of these files, replace `exchange: 'binance'` with `exchange: 'hyperliquid'`:

- `src/templates/catalog/macd-momentum-bnb.ts`
- `src/templates/catalog/cypheus-default.ts`
- `src/templates/catalog/breakout-btc-15m.ts`
- `src/templates/catalog/multi-tf-trend-alts.ts`
- `src/templates/catalog/rsi-oversold-eth-1h.ts`
- `src/templates/catalog/conservative-dca-btc.ts`
- `src/templates/catalog/scalping-btc-1m.ts`

- [ ] **Step 3: Update `grid-stable-usdt-pairs.ts` (spot → futures + label)**

In `src/templates/catalog/grid-stable-usdt-pairs.ts`:

- Change `exchange: 'binance'` → `exchange: 'hyperliquid'`.
- Change `marketType: 'spot'` → `marketType: 'futures'`. Leave `marginMode: 'cross'` as-is.
- Read the file's `name` field (template label shown in the picker). Update it to reflect the new mode. The current name is likely something like `"Stable USDT Pairs Grid"` — change to `"Stable USDT Pairs Grid (Futures Cross)"`.

If the template's body references spot-only fields (e.g. lower leverage, no margin), leave those — they remain valid in futures mode.

- [ ] **Step 4: Remove unused `EXCHANGES` constant**

Verify no remaining importers:

```bash
grep -rn "EXCHANGES" src --include='*.ts' --include='*.tsx'
```

Expected: only `src/lib/constants.ts` matches. If anything else matches, DO NOT delete — investigate.

If clean, in `src/lib/constants.ts` delete the entire `EXCHANGES` const block:

```ts
export const EXCHANGES = [
  { value: 'binance', label: 'Binance' },
  { value: 'okx', label: 'OKX' },
  { value: 'bybit', label: 'Bybit' },
  { value: 'kraken', label: 'Kraken' },
] as const;
```

(Keep `STAKE_CURRENCIES`, `TIMEFRAMES`, `PAIR_SUGGESTIONS`, `CANDLESTICK_OPTIONS` — untouched.)

- [ ] **Step 5: Run typecheck + tests**

Run: `pnpm typecheck && pnpm test`
Expected: clean. The `validate-all-templates.test.ts` suite checks every catalog file conforms to the unified Zod schema — it should still pass with `exchange: 'hyperliquid'` (the schema doesn't enforce a specific exchange string).

If any test fails because it referenced the old `'binance'` value or imported `EXCHANGES`, update the test. If a test asserted `marketType === 'spot'` for the grid template, change the assertion.

- [ ] **Step 6: Commit**

```bash
git add src/features/bot-builder/store/builder.store.ts \
  src/lib/constants.ts \
  src/templates/catalog/macd-momentum-bnb.ts \
  src/templates/catalog/cypheus-default.ts \
  src/templates/catalog/breakout-btc-15m.ts \
  src/templates/catalog/multi-tf-trend-alts.ts \
  src/templates/catalog/rsi-oversold-eth-1h.ts \
  src/templates/catalog/conservative-dca-btc.ts \
  src/templates/catalog/scalping-btc-1m.ts \
  src/templates/catalog/grid-stable-usdt-pairs.ts
git commit -m "$(cat <<'EOF'
chore(bot-config): lock exchange to hyperliquid + market type to futures

The wizard no longer offers other exchanges or spot trading — the
target market is Hyperliquid Futures only. This commit aligns the data
layer with that constraint:

- Store default exchange: 'binance' -> 'hyperliquid'.
- 7 templates: exchange 'binance' -> 'hyperliquid'.
- grid-stable-usdt-pairs: also flip marketType 'spot' -> 'futures' and
  rename the template label to reflect the futures variant.
- Remove the unused EXCHANGES constant from lib/constants.ts.

UI changes live in the next commit; this one is data-only so the diff
is easy to audit.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

DO NOT push.

---

## Task 3: Refactor `BotConfigStep` layout

This is the visual change. Both `BotConfigSetup` and `BotConfigConfigure` get rewritten layouts. The store reads/writes stay the same; only the JSX (and the Leverage input swap) change.

**Files:**
- Modify: `src/features/bot-builder/steps/BotConfigStep.tsx`

- [ ] **Step 1: Replace the file content**

Replace the ENTIRE content of `src/features/bot-builder/steps/BotConfigStep.tsx` with:

```tsx
import { useEffect, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { useBuilderStore } from '../store/builder.store';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { NumberInput } from '@/components/ui/number-input';
import { ToggleGroup } from '@/components/ui/toggle-group';
import { FormField } from '@/components/ui/form-field';
import { Slider } from '@/components/ui/slider';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import {
  TIMEFRAMES,
  STAKE_CURRENCIES,
  PAIR_SUGGESTIONS,
} from '@/lib/constants';
import type { TradingMode, MarginMode } from '@/types/builder.types';

export function BotConfigSetup() {
  const config = useBuilderStore((s) => s.botConfig);
  const patch = useBuilderStore((s) => s.patchBotConfig);
  const [pendingLive, setPendingLive] = useState(false);

  const handleTradingMode = (next: TradingMode) => {
    if (next === 'live' && config.tradingMode !== 'live') {
      setPendingLive(true);
      return;
    }
    patch({ tradingMode: next });
  };

  return (
    <>
      {/* Pair + Timeframe sit on one row to compress the form. */}
      <div className="grid grid-cols-2 gap-4">
        <div data-cy-anchor="bot-config:pair">
          <FormField
            label="Pair"
            required
            hint="Format: BASE-QUOTE (e.g. BTC-USDC)."
          >
            <Input
              list="pair-suggestions"
              placeholder="BTC-USDC"
              value={config.pair}
              onChange={(e) => patch({ pair: e.target.value.toUpperCase() })}
              autoFocus
            />
            <datalist id="pair-suggestions">
              {PAIR_SUGGESTIONS.map((p) => (
                <option key={p} value={p} />
              ))}
            </datalist>
          </FormField>
        </div>

        <FormField label="Timeframe" required>
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

      <FormField label="Trading mode" required>
        <ToggleGroup<TradingMode>
          value={config.tradingMode}
          onChange={handleTradingMode}
          fullWidth
          ariaLabel="Trading mode"
          options={[
            {
              value: 'dry-run',
              label: 'Dry-run',
              description: 'Simulated wallet, safe to test.',
            },
            {
              value: 'live',
              label: 'Live trade',
              description: 'Real funds — confirmation required.',
              tone: 'bearish',
            },
          ]}
        />
      </FormField>

      <div data-cy-anchor="bot-config:leverage">
        <FormField
          label="Leverage"
          hint="Multiplier applied to your stake. ≥10× will warn at export."
        >
          <Slider
            value={config.leverage}
            onValueChange={(v) =>
              patch({ leverage: Math.max(1, Math.min(125, v)) })
            }
            min={1}
            max={125}
            step={1}
            suffix="x"
            ariaLabel="Leverage"
          />
        </FormField>
      </div>

      <Dialog open={pendingLive} onOpenChange={setPendingLive}>
        <DialogContent>
          <DialogHeader>
            <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-bearish/15 text-bearish">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <DialogTitle>Switch to Live trading?</DialogTitle>
            <DialogDescription>
              Live mode places orders with real funds. Dry-run is recommended
              while you tune the strategy.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setPendingLive(false)}>
              Stay in Dry-run
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                patch({ tradingMode: 'live' });
                setPendingLive(false);
              }}
            >
              I understand, go Live
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

/**
 * Read-only chip used for the locked Exchange and Market type fields.
 * Mirrors the visual weight of an Input/Select so the form doesn't look
 * lopsided next to editable fields above and below.
 */
function LockedChip({ value }: { value: string }) {
  return (
    <div className="rounded-2xl border border-border bg-canvas/40 px-4 py-2 text-sm text-fg">
      {value}
    </div>
  );
}

export function BotConfigConfigure() {
  const config = useBuilderStore((s) => s.botConfig);
  const patch = useBuilderStore((s) => s.patchBotConfig);

  // Silent migration: any persisted state from before the lock that
  // still has a non-Hyperliquid exchange or spot market type gets
  // coerced once on mount. JSON imports and external state landing
  // here also get normalized so the chips don't lie.
  useEffect(() => {
    const updates: Partial<typeof config> = {};
    if (config.exchange !== 'hyperliquid') updates.exchange = 'hyperliquid';
    if (config.marketType !== 'futures') updates.marketType = 'futures';
    if (Object.keys(updates).length > 0) {
      patch(updates);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <>
      {/* Exchange + Market type are both locked — render as read-only
       *  chips on a 2-column row. */}
      <div className="grid grid-cols-2 gap-4">
        <div data-cy-anchor="bot-config:exchange">
          <FormField label="Exchange" required>
            <LockedChip value="Hyperliquid" />
          </FormField>
        </div>
        <FormField label="Market type" required>
          <LockedChip value="Futures" />
        </FormField>
      </div>

      <FormField label="Margin mode" required>
        <ToggleGroup<MarginMode>
          value={config.marginMode}
          onChange={(v) => patch({ marginMode: v })}
          fullWidth
          options={[
            { value: 'cross', label: 'Cross' },
            { value: 'isolated', label: 'Isolated' },
          ]}
        />
      </FormField>

      {/* Max open + Stake currency + Stake amount on one 3-col row. */}
      <div className="grid grid-cols-3 gap-4">
        <FormField label="Max open trades" hint="−1 = unlimited">
          <NumberInput
            value={config.maxOpenTrades}
            onValueChange={(v) => patch({ maxOpenTrades: v ?? -1 })}
            min={-1}
            step={1}
          />
        </FormField>
        <FormField label="Stake currency">
          <Select
            value={config.stakeCurrency}
            onChange={(e) => patch({ stakeCurrency: e.target.value })}
          >
            {STAKE_CURRENCIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </Select>
        </FormField>
        <FormField label="Stake amount" hint="Per-trade stake.">
          <NumberInput
            value={config.stakeAmount}
            onValueChange={(v) =>
              patch({ stakeAmount: Math.max(0, v ?? 0) })
            }
            min={0}
            step={1}
            suffix={config.stakeCurrency}
          />
        </FormField>
      </div>

      {/* Dry-run wallet appears on its own row only while in dry-run
       *  mode. Hidden in Live mode. */}
      {config.tradingMode === 'dry-run' ? (
        <FormField label="Dry-run wallet" hint="Simulated total balance.">
          <NumberInput
            value={config.dryRunWallet}
            onValueChange={(v) =>
              patch({ dryRunWallet: Math.max(0, v ?? 0) })
            }
            min={0}
            step={100}
            suffix={config.stakeCurrency}
          />
        </FormField>
      ) : null}
    </>
  );
}
```

Key changes from the previous version:
- `EXCHANGES` + `MarketType` imports removed (no longer used).
- `Slider` imported and used in Leverage; `NumberInput` no longer wraps Leverage.
- `Pair + Timeframe` wrapped in `<div className="grid grid-cols-2 gap-4">`.
- `BotConfigConfigure`: Exchange field rendered as `<LockedChip value="Hyperliquid" />`; Market type as `<LockedChip value="Futures" />`. Both wrapped in `grid-cols-2`. The conditional `marginMode === 'futures'` branch is gone since market type is now always futures — `Margin mode` always renders.
- Max open + Stake currency + Stake amount wrapped in `grid-cols-3` (was two separate 2-col rows).
- Dry-run wallet on its own conditional row.
- M3 note block deleted.
- Silent `useEffect` migration on mount sets `exchange`/`marketType` to the locked values if any persisted state still has the old values.

- [ ] **Step 2: Run typecheck + tests**

Run: `pnpm typecheck && pnpm test`
Expected: clean. The store/serializer tests still pass because the data shape is unchanged — only the JSX is different.

If lint complains about the unused `EXCHANGES` import being gone (it shouldn't, you've removed the import line), or unused `MarketType` type (same), fix by deleting the import. The plan's file content already does this.

- [ ] **Step 3: Commit**

```bash
git add src/features/bot-builder/steps/BotConfigStep.tsx
git commit -m "$(cat <<'EOF'
refactor(bot-config): compress drawer layout

- Pair + Timeframe share a 2-col row.
- Leverage uses the new Slider primitive (was NumberInput).
- Exchange + Market type render as locked read-only chips
  ("Hyperliquid" / "Futures") on a 2-col row — the wizard no longer
  offers other exchanges or spot.
- Max open + Stake currency + Stake amount share a 3-col row (was two
  2-col rows).
- Dry-run wallet moves to its own conditional row.
- Remove the M3 "Telegram, position adjustment..." dashed note.
- Silent useEffect migration coerces any persisted exchange != hyperliquid
  or marketType != futures back to the locked values, so chips never lie.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

DO NOT push.

---

## Task 4: Browser smoke test

End-to-end check. No code commit unless an issue surfaces.

- [ ] **Step 1: Start dev server**

Run `pnpm dev`. Wait for "ready in <Xms>" on `http://127.0.0.1:5173`.

- [ ] **Step 2: Manual flow**

Log in (`trinm@coin98.finance` / `Coin98@123`). Clear builder state: DevTools → Application → Local Storage → remove `trading-bot-builder` key. Reload.

1. Open the Bot Basics step. Confirm `Pair` and `Timeframe` are on the same row, side by side.
2. Confirm Leverage is a slider — drag from 1 to 25, see the value chip on the right update to `25x` live. Confirm dragging beyond 125 clamps to 125.
3. Open the Bot Basics step's lower content (or scroll). Confirm `Exchange` field shows a chip reading "Hyperliquid" (NOT a select) and is non-interactive. Same for `Market type` → "Futures". Both share one row.
4. Confirm `Margin mode` toggle (Cross / Isolated) is shown right below.
5. Confirm `Max open trades`, `Stake currency`, `Stake amount` are on one 3-col row.
6. Confirm `Dry-run wallet` is shown on its own row below (since default `tradingMode === 'dry-run'`). Switch to Live (and accept the confirmation dialog) — `Dry-run wallet` disappears. Switch back — it reappears.
7. Confirm the M3 dashed-border note at the bottom is GONE.
8. Open the Templates dialog. Apply `Stable USDT Pairs Grid (Futures Cross)`. Confirm: `exchange` lands as "Hyperliquid", `marketType` as "Futures", `marginMode` as "Cross". (Open DevTools → localStorage to verify the actual values.)
9. Apply another template like `Conservative DCA BTC`. Confirm same Hyperliquid + Futures.
10. **BE submit smoke** (validates Q4 = `'hyperliquid'` is accepted): fill out the rest of the wizard (entry conditions etc.), click Submit. Confirm BE returns 201 Created. If 422 with a complaint about `exchange`, capture the error message — the BE may expect a different identifier; flag it as a follow-up commit to update the locked value (e.g. to `'hyperliquid-perp'` or whatever Tuấn confirms).

- [ ] **Step 3: If issues are found, fix and commit separately. Otherwise no commit.**

---

## Out of scope (do NOT do in this plan)

- Adding Hyperliquid OAuth/API-key fields. Future work.
- Re-enabling Spot mode.
- Multi-thumb Slider (range selection). Single-thumb only.
- Refactoring `BotConfigSetup` + `BotConfigConfigure` into one component. They stay separate exports.
- Restyling the Trading-mode / Margin-mode ToggleGroups. Untouched.
- Live-mode confirmation dialog text or behavior. Untouched.
- Pair autocomplete improvements.

If the implementer notices an unrelated bug while in these files, file a separate task via `mcp__ccd_session__spawn_task` rather than bundling.
