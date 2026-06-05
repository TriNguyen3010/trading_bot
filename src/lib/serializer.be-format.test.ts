/**
 * BE-format conformance test.
 *
 * Goal (Tri's idea): take Tuấn's REAL `/bot-strategy/create` payloads
 * (status 201) as ground truth, build the matching builder-state, run our
 * serializer, and assert that — for every field Tuấn sends — our output
 * carries the same value. Extra fields the FE emits are allowed (Tuấn OK'd
 * dropping/keeping them); only the fields PRESENT in the sample are checked.
 *
 * This is the automated version of "open the two JSONs side by side and diff
 * them by eye". Samples live in `BE/source-of-truth/` and are the documented
 * chân lý (see PAYLOAD_SOURCE_OF_TRUTH.md).
 *
 * ── How it stays green while deviations still exist ──────────────────────
 * Every CURRENT, understood mismatch is listed in KNOWN_DEVIATIONS with a
 * category + note. The test asserts:
 *   1. No UNEXPECTED diff (a NEW deviation = real regression → fails).
 *   2. No STALE allowlist entry (a deviation got fixed but the entry is still
 *      here → fails, telling you to delete it).
 * So the allowlist below IS the living checklist of "tool JSON vs Tuấn JSON".
 * Shrinking it to empty == the tool fully matches the samples.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it, beforeEach } from 'vitest';
import { useBuilderStore } from '@/features/bot-builder/store/builder.store';
import {
  makeIndicator,
  indicatorOutputId,
} from '@/features/indicators/indicator-registry';
import { buildUnifiedPayload } from './serializer';

/* -------------------------------------------------------------------------- */
/*  Deep-subset diff: every leaf in `expected` must equal the same path in    */
/*  `actual`. Extra keys in `actual` are ignored. Returns ALL mismatches.     */
/* -------------------------------------------------------------------------- */
interface Diff {
  path: string;
  expected: unknown;
  actual: unknown;
  kind: 'value' | 'missing' | 'type';
}

function collectSubsetDiffs(expected: unknown, actual: unknown): Diff[] {
  const diffs: Diff[] = [];
  walk(expected, actual, '');
  return diffs;

  function walk(exp: unknown, act: unknown, path: string) {
    if (Array.isArray(exp)) {
      if (!Array.isArray(act)) {
        diffs.push({ path, expected: exp, actual: act, kind: 'type' });
        return;
      }
      exp.forEach((item, i) => {
        const np = `${path}[${i}]`;
        if (i >= act.length) {
          diffs.push({
            path: np,
            expected: item,
            actual: undefined,
            kind: 'missing',
          });
        } else {
          walk(item, act[i], np);
        }
      });
      return;
    }
    if (exp !== null && typeof exp === 'object') {
      if (act === null || typeof act !== 'object' || Array.isArray(act)) {
        diffs.push({ path, expected: exp, actual: act, kind: 'type' });
        return;
      }
      const a = act as Record<string, unknown>;
      for (const k of Object.keys(exp as Record<string, unknown>)) {
        const np = path ? `${path}.${k}` : k;
        if (!(k in a)) {
          diffs.push({
            path: np,
            expected: (exp as Record<string, unknown>)[k],
            actual: undefined,
            kind: 'missing',
          });
        } else {
          walk((exp as Record<string, unknown>)[k], a[k], np);
        }
      }
      return;
    }
    if (exp !== act) {
      diffs.push({ path, expected: exp, actual: act, kind: 'value' });
    }
  }
}

function loadSampleRequest(file: string): Record<string, unknown> {
  const raw = readFileSync(`BE/source-of-truth/${file}`, 'utf-8');
  return JSON.parse(raw).request as Record<string, unknown>;
}

/* -------------------------------------------------------------------------- */
/*  Known, understood deviations (the living checklist).                        */
/*                                                                             */
/*  category:                                                                  */
/*   - 'intentional'   FE transforms on purpose; BE accepts both. Won't fix.   */
/*   - 'be-question'   need Tuấn to confirm the right default before changing. */
/*   - 'fe-limitation' FE builder model can't represent this yet (design work).*/
/*   - 'migration'     part of the indicator-whitelist alignment (BBANDS/output)*/
/* -------------------------------------------------------------------------- */
type Category = 'intentional' | 'be-question' | 'fe-limitation' | 'migration';
interface Known {
  path: string;
  category: Category;
  note: string;
}

const KNOWN_DEVIATIONS: Record<string, Known[]> = {
  'sample-1-minimal': [
    {
      path: 'strategy_name',
      category: 'intentional',
      note: 'FE sanitizes to a valid Python class name (PascalCase) for BE codegen; BE also accepts the raw lowercase string.',
    },
    {
      path: 'process_only_new_candles',
      category: 'be-question',
      note: 'Sample=true, FE=false. Freqtrade runtime flag — confirm intended default with Tuấn before flipping.',
    },
    {
      path: 'force_entry_enable',
      category: 'be-question',
      note: 'Sample=true, FE=false. Enables forced entries via API — confirm intended default with Tuấn.',
    },
    {
      path: 'configurations.risk.stoploss',
      category: 'fe-limitation',
      note: 'Sample uses ROI steps AND a custom stoploss (-0.109). FE close-method is one-of (roi|tp_sl|indicator), so a roi bot always emits the -0.4 default SL.',
    },
    {
      path: 'configurations.use_exit_signal',
      category: 'fe-limitation',
      note: 'Sample=true on a roi bot; FE sets use_exit_signal=true only for the indicator close method.',
    },
  ],
  'sample-2-bbands': [
    {
      path: 'strategy_name',
      category: 'intentional',
      note: 'Same PascalCase sanitization as sample #1.',
    },
    {
      path: 'can_short',
      category: 'fe-limitation',
      note: 'Sample is a 2-way bot (can_short=true, all 4 signal slots filled). FE picks ONE direction, so can_short follows direction=long → false.',
    },
    {
      path: 'process_only_new_candles',
      category: 'be-question',
      note: 'Same as sample #1.',
    },
    {
      path: 'force_entry_enable',
      category: 'be-question',
      note: 'Same as sample #1.',
    },
    {
      path: 'configurations.signals.indicators[0].output',
      category: 'migration',
      note: 'Multi-output indicators must send `output` (e.g. "upperband"); FE has no output concept yet.',
    },
    {
      path: 'configurations.signals.entry_long.conditions[0].right_indicator',
      category: 'migration',
      note: 'FE emits shorthand "BBANDS-14-2-2"; BE sample uses "BBANDS (Upper Band) - 2.0, 2.0, 14". Tuấn: BE matches by key (name+output), not the exact string — so this is acceptable once name+output are correct.',
    },
    {
      path: 'configurations.signals.exit_long.conditions[0].right_indicator',
      category: 'migration',
      note: 'Same as entry_long right_indicator.',
    },
    {
      path: 'configurations.signals.entry_short.conditions[0]',
      category: 'fe-limitation',
      note: 'Sample fills all 4 signal slots (2-way bot). FE fills only the chosen direction (long), so short slots stay empty.',
    },
    {
      path: 'configurations.signals.exit_short.conditions[0]',
      category: 'fe-limitation',
      note: 'Same 2-way-bot limitation as entry_short.',
    },
  ],
};

/* -------------------------------------------------------------------------- */
/*  Builder-state factories — the "templates" derived from each sample.        */
/* -------------------------------------------------------------------------- */
function applySample1Minimal() {
  const s = useBuilderStore.getState();
  s.setBotName('my_bot');
  s.patchBotConfig({
    exchange: 'hyperliquid',
    marketType: 'futures',
    marginMode: 'cross',
    pair: 'BTC-USDC',
    timeframe: '5m',
    leverage: 10,
    stakeCurrency: 'USDC',
    stakeAmount: 10,
    maxOpenTrades: 3,
    dryRunWallet: 1000,
  });
  s.patchStrategy({
    name: 'asdas',
    candlestick: ['close'],
    indicators: [],
    startupCandleCount: 200,
    informativeTimeframes: [],
    entryConditions: { groupConnector: 'AND', groups: [] },
  });
  s.patchDirection({ direction: 'short', orderType: 'market' });
  s.patchCloseMethod({ type: 'roi', roiSteps: [{ minutes: 0, roi: 1 }] });
}

function applySample2Bbands() {
  const s = useBuilderStore.getState();
  s.setBotName('my_bot2');
  s.patchBotConfig({
    exchange: 'hyperliquid',
    marketType: 'futures',
    marginMode: 'cross',
    pair: 'BTC-USDC',
    timeframe: '5m',
    leverage: 11,
    stakeCurrency: 'USDC',
    stakeAmount: 10,
    maxOpenTrades: 3,
    dryRunWallet: 1000,
  });
  const bb = makeIndicator('BBANDS');
  bb.parameters = { timeperiod: 14, nbdevup: 2, nbdevdn: 2 };
  const bbRef = indicatorOutputId(bb);
  s.patchStrategy({
    name: 'mybot2',
    candlestick: ['close'],
    indicators: [bb],
    startupCandleCount: 200,
    informativeTimeframes: [],
    entryConditions: {
      groupConnector: 'AND',
      groups: [
        {
          id: 'g1',
          intraConnector: 'AND',
          rules: [
            {
              id: 'r1',
              left: 'candle.close',
              op: 'crosses_above',
              right_type: 'indicator',
              right_number: null,
              right_indicator: bbRef,
              lookback: 0,
            },
          ],
        },
      ],
    },
  });
  s.patchDirection({ direction: 'long', orderType: 'market' });
  s.patchCloseMethod({
    type: 'indicator',
    exitConditions: {
      groupConnector: 'AND',
      groups: [
        {
          id: 'g2',
          intraConnector: 'AND',
          rules: [
            {
              id: 'r2',
              left: 'candle.close',
              op: 'crosses_below',
              right_type: 'indicator',
              right_number: null,
              right_indicator: bbRef,
              lookback: 0,
            },
          ],
        },
      ],
    },
  });
}

const SAMPLES = [
  {
    label: 'sample-1-minimal',
    file: 'user_24_bot_strategy_create_POST_20260604_024552.json',
    apply: applySample1Minimal,
  },
  {
    label: 'sample-2-bbands',
    file: 'user_24_bot_strategy_create_POST_20260604_025319.json',
    apply: applySample2Bbands,
  },
] as const;

describe('serializer BE-format conformance', () => {
  beforeEach(() => {
    useBuilderStore.getState().resetAll();
  });

  for (const sample of SAMPLES) {
    describe(sample.label, () => {
      it('has no UNEXPECTED deviation from the real BE payload', () => {
        sample.apply();
        const out = buildUnifiedPayload(useBuilderStore.getState());
        const expected = loadSampleRequest(sample.file);
        const diffs = collectSubsetDiffs(expected, out);

        const known = new Set(
          KNOWN_DEVIATIONS[sample.label].map((k) => k.path),
        );
        const unexpected = diffs.filter((d) => !known.has(d.path));

        // If this fails, the serializer drifted: a field that used to match
        // Tuấn's sample no longer does. Fix the serializer (or, if the new
        // behaviour is correct and confirmed, add it to KNOWN_DEVIATIONS).
        expect(
          unexpected,
          `Unexpected BE-format deviations:\n${JSON.stringify(unexpected, null, 2)}`,
        ).toEqual([]);
      });

      it('allowlist is not stale (every known deviation still occurs)', () => {
        sample.apply();
        const out = buildUnifiedPayload(useBuilderStore.getState());
        const expected = loadSampleRequest(sample.file);
        const diffPaths = new Set(
          collectSubsetDiffs(expected, out).map((d) => d.path),
        );

        const fixed = KNOWN_DEVIATIONS[sample.label].filter(
          (k) => !diffPaths.has(k.path),
        );

        // If this fails, a listed deviation is now MATCHING — delete its entry
        // from KNOWN_DEVIATIONS so the checklist reflects reality.
        expect(
          fixed,
          `These KNOWN_DEVIATIONS are now fixed — remove them:\n${JSON.stringify(fixed, null, 2)}`,
        ).toEqual([]);
      });
    });
  }
});
