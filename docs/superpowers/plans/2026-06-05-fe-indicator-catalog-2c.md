# FE Indicator Catalog — Phase 2C Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans. **Do NOT start implementation until the BLOCKER section is resolved** (BE answers received). Steps use checkbox (`- [ ]`) syntax.

**Goal:** When a condition compares against an indicator on the RIGHT side (e.g. "candle.close crosses above BBANDS upper band"), emit the `right_indicator` as the exact BE descriptive string (`"BBANDS (Upper Band) - 2.0, 2.0, 14"`) instead of the FE id (`BBANDS-20-2-2.upperband`), and verify with a real BE round-trip.

**Spec:** `docs/superpowers/specs/2026-06-04-fe-indicator-catalog-phase2-design.md` §3.5 + API_SPEC.md "Đính chính 3".

**Depends on:** Phase 2B (`output` model + multi-output ids).

---

## ⛔ BLOCKER — resolve with Tuấn BEFORE implementing

This phase CANNOT be implemented correctly from the files we have. Two unknowns:

1. **Output → human description mapping.** BE wants `"BBANDS (Upper Band) - ..."`. The whitelist `outputs` are lowercase ids (`upperband`, `middleband`, `slowk`, `macdsignal`, ...). There is **no `(Upper Band)` display text anywhere in the whitelist or API_SPEC**. We cannot derive "Upper Band" from "upperband" reliably (no separator). Source: where does this mapping come from — a BE catalog, or does FE define it?

2. **Exact string format + whether it even matters.** API_SPEC "Đính chính 3" documents `{NAME} ({Output Description}) - {param values comma-separated}`, but Tuấn later said (PAYLOAD_SOURCE_OF_TRUTH, đợt 2) **"BE matches by key (name + output); param order doesn't matter."** So it is UNCLEAR whether the right side must be the full human string at all, or whether `name`+`output` (as 2B already produces) is sufficient. We must not invent a string convention.

**Questions for Tuấn (send before starting):**

> 1. Khi điều kiện so **vế phải là indicator** (vd close cắt lên dải trên Bollinger), `right_indicator` phải gửi dạng nào: chuỗi đầy đủ `"BBANDS (Upper Band) - 2.0, 2.0, 14"`, hay chỉ cần id `name`+`output` là BE match được?
> 2. Nếu cần chuỗi đầy đủ: phần `(Upper Band)` lấy ở đâu — em có catalog map `upperband→"Upper Band"` cho 14 indicator không, hay BE tự định? Thứ tự + format param (vd `2.0, 2.0, 14`) chuẩn là gì?
> 3. Có 1 mẫu payload THẬT (status 201) nào có điều kiện **indicator-vs-indicator** để em đối chiếu không? (2 mẫu create hiện có chỉ so với candle/number.)

**Until answered:** 2B's behavior (right side = FE id, BE matches by key) is the safe interim. Do NOT ship a guessed descriptive-string builder.

---

## Plan A — BE only needs name+output (likely cheapest)

If Tuấn confirms the right side only needs `name`+`output` (matches by key), then **2B already covers it** — `right_indicator` carries `BBANDS-20-2-2.upperband` which encodes name+output. 2C reduces to:

### Task A1: Live round-trip verification (manual, with Tri)

- [ ] Create a bot via the app (BE 8088) with an indicator-vs-indicator entry, e.g. `candle.close crosses_above BBANDS upper`.
- [ ] Use `GET /bot/{id}/download` (Tuấn's new endpoint) to fetch the generated strategy + indicator sample data.
- [ ] Confirm the generated Freqtrade strategy resolves the BBANDS upper column and the cross condition fires (sample data shows the indicator computed).
- [ ] If it resolves → done. Record the confirmed format in `PAYLOAD_SOURCE_OF_TRUTH.md` and remove the two `right_indicator` entries from `KNOWN_DEVIATIONS` in `serializer.be-format.test.ts`.

(No code change if Plan A holds — this is a verification + doc + checklist-shrink task.)

---

## Plan B — BE needs the full descriptive string

If Tuấn confirms the full string is required AND provides the output→description map:

### Task B1: Output-description catalog

**Files:** Create `src/features/indicators/output-labels.ts`

- [ ] **Step 1:** Add the BE-confirmed map, e.g.:

```ts
/** BE-confirmed human descriptions for multi-output channels, used to build
 *  the `right_indicator` wire string. Source: Tuấn <date>. */
export const OUTPUT_DESCRIPTION: Record<string, string> = {
  // FILL FROM TUẤN'S ANSWER — do not guess.
  upperband: 'Upper Band',
  middleband: 'Middle Band',
  lowerband: 'Lower Band',
  // ...macd/signal/hist, slowk/slowd, fastk/fastd, SUPERT_*, etc.
};
```

- [ ] **Step 2:** Test: every multi-output channel in the whitelist has a mapping (guards against a new indicator missing its label).

```ts
import { INDICATOR_WHITELIST } from './indicator-whitelist';
import { OUTPUT_DESCRIPTION } from './output-labels';
it('every multi-output channel has a description', () => {
  for (const ind of INDICATOR_WHITELIST) {
    if (ind.outputs.length > 1) {
      for (const o of ind.outputs) {
        expect(
          OUTPUT_DESCRIPTION[o] ?? OUTPUT_DESCRIPTION[`${ind.id}:${o}`],
        ).toBeDefined();
      }
    }
  }
});
```

### Task B2: `buildRightIndicatorString` util

**Files:** `src/lib/condition-tree.ts` (or a new `src/lib/indicator-ref.ts`)

- [ ] **Step 1: Failing test** — given an FE id `BBANDS-20-2-2.upperband` + registry params, returns `"BBANDS (Upper Band) - <params in BE-confirmed order/format>"`. Exact expected string FROM TUẤN'S ANSWER.
- [ ] **Step 2: Implement** — parse the id back to (name, params, output), look up `OUTPUT_DESCRIPTION`, format params per the confirmed convention.
- [ ] **Step 3:** Single-output / left side stays the shorthand (confirmed accepted in 2A: `RSI-14`, `ADX-14`). Only the **right_indicator** for multi-output indicators is rewritten.

### Task B3: Wire into serialization

**Files:** `src/lib/serializer.ts` / `src/lib/condition-tree.ts`

- [ ] At unified-payload build time, map each condition's `right_indicator` (when `right_type === 'indicator'`) through `buildRightIndicatorString`. Keep the FE id internal (store/round-trip); only the BE payload gets the descriptive string.
- [ ] Test: a BBANDS-right condition serializes `right_indicator: "BBANDS (Upper Band) - ..."`.

### Task B4: Round-trip verify (same as Task A1) + shrink checklist

- [ ] Live round-trip via BE 8088 + `GET /bot/{id}/download`.
- [ ] Remove the two `right_indicator` entries from `KNOWN_DEVIATIONS`.

---

## Self-Review Notes

- The whole phase hinges on the BLOCKER answers; do not implement Plan B speculatively.
- `left`-side indicator refs are already correct (shorthand, confirmed by 201 logs in 2A) — 2C only touches the **right** side.
- After 2C, the only remaining `KNOWN_DEVIATIONS` should be the genuine FE-limitation/be-question ones (2-way bot, process_only_new_candles, force_entry_enable, strategy_name PascalCase) — i.e. the indicator-format gap is fully closed.
