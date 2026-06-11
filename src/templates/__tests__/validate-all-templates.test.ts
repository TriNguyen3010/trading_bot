/**
 * CI gate: every built-in template must
 *   1. have a unique id and at least one tag,
 *   2. snapshot to a state that passes `validateBuilder()` once all 4
 *      sub-stepStatus are 'configured', AND
 *   3. serialise via `buildUnifiedPayload()` into a valid
 *      UnifiedBotStrategyCreate payload.
 *
 * Failing any of these means we'd ship a template that breaks the
 * Export flow — the test is the line of defence against shipping broken
 * templates. See Spec/Phase 1/bot_templates_plan.md §8.
 */
import { describe, expect, it, beforeEach } from 'vitest';
import { useBuilderStore } from '@/features/bot-builder/store/builder.store';
import { buildUnifiedPayload } from '@/lib/serializer';
import { unifiedBotStrategyCreateSchema } from '@/schemas/unified-bot-strategy.schema';
import { validateBuilder } from '@/lib/validator';
import {
  INDICATOR_REGISTRY,
  indicatorOutputId,
} from '@/features/indicators/indicator-registry';
import {
  BUILT_IN_TEMPLATES,
  TEMPLATE_SCHEMA_VERSION,
  buildBuiltInTemplates,
} from '@/templates';
import type { BotTemplate } from '@/templates';
import type { StepId, StepStatus } from '@/types/builder.types';

/** Every metric id a template's indicators can be referenced by. Multi-output
 *  indicators expand to one id per output (BBANDS → upper/middle/lower). */
function validIndicatorIds(t: BotTemplate): Set<string> {
  const ids = new Set<string>();
  for (const ind of t.state.strategy.indicators) {
    const def = INDICATOR_REGISTRY[ind.name];
    if (def && def.outputs.length > 1) {
      for (const o of def.outputs)
        ids.add(indicatorOutputId({ ...ind, output: o }));
    } else {
      ids.add(indicatorOutputId(ind));
    }
  }
  return ids;
}

/** Non-candle refs used on either side of every condition rule. */
function conditionRefs(t: BotTemplate): string[] {
  const refs: string[] = [];
  for (const tree of [
    t.state.strategy.entryConditions,
    t.state.closeMethod.exitConditions,
  ]) {
    for (const g of tree.groups) {
      for (const r of g.rules) {
        if (r.left && !r.left.startsWith('candle.')) refs.push(r.left);
        if (r.right_type === 'indicator' && r.right_indicator)
          refs.push(r.right_indicator);
      }
    }
  }
  return refs;
}

const ALL_CONFIGURED: Record<StepId, StepStatus> = {
  'bot-config': 'configured',
  'entry-strategy': 'configured',
  direction: 'configured',
  'close-method': 'configured',
};

function applySnapshot(t: BotTemplate) {
  const builder = useBuilderStore.getState();
  builder.resetAll();
  builder.setBotName(t.state.botName);
  builder.patchBotConfig(t.state.botConfig);
  builder.patchStrategy(t.state.strategy);
  builder.patchDirection(t.state.directionForm);
  builder.patchCloseMethod(t.state.closeMethod);
  (Object.keys(ALL_CONFIGURED) as StepId[]).forEach((id) =>
    builder.setStepStatus(id, ALL_CONFIGURED[id]),
  );
}

describe('built-in templates', () => {
  beforeEach(() => {
    useBuilderStore.getState().resetAll();
  });

  it('catalog is non-empty (PR-T1 ships at least cypheus-default)', () => {
    expect(BUILT_IN_TEMPLATES.length).toBeGreaterThanOrEqual(1);
  });

  // The QA "Always-On" template churns trades and loses fees by design — it
  // exists only to prove the live/dry-run pipeline opens positions. It must
  // never reach the production gallery where a real user could pick it and
  // Go Live. See PR #42 review.
  const QA_TEST_ID = 'test-always-on-btc-1m';

  it('strips the QA test template from production builds', () => {
    const prod = buildBuiltInTemplates(false);
    expect(prod.some((t) => t.id === QA_TEST_ID)).toBe(false);
  });

  it('surfaces the QA test template first in dev builds', () => {
    const dev = buildBuiltInTemplates(true);
    expect(dev[0]?.id).toBe(QA_TEST_ID);
  });

  it('every template id is unique', () => {
    const ids = BUILT_IN_TEMPLATES.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('every template has metadata + at least one tag', () => {
    for (const t of BUILT_IN_TEMPLATES) {
      expect(t.id, `template missing id`).toBeTruthy();
      expect(t.name, `${t.id} missing name`).toBeTruthy();
      expect(t.description, `${t.id} missing description`).toBeTruthy();
      expect(t.tags.length, `${t.id} has no tags`).toBeGreaterThan(0);
      expect(t.meta.schemaVersion).toBe(TEMPLATE_SCHEMA_VERSION);
    }
  });

  it.each(BUILT_IN_TEMPLATES.map((t) => [t.id, t]))(
    'template %s passes validateBuilder once applied',
    (_id, template) => {
      applySnapshot(template);
      const issues = validateBuilder(useBuilderStore.getState());
      if (issues.length > 0) {
        throw new Error(
          `Template "${template.id}" produces validator issues:\n` +
            issues.map((i) => `  - [${i.stepId}] ${i.message}`).join('\n'),
        );
      }
      expect(issues).toEqual([]);
    },
  );

  it.each(BUILT_IN_TEMPLATES.map((t) => [t.id, t]))(
    'template %s condition refs all resolve to a known metric',
    (_id, template) => {
      const valid = validIndicatorIds(template);
      const dangling = conditionRefs(template).filter((r) => !valid.has(r));
      expect(
        dangling,
        `Template "${template.id}" has condition refs that match no indicator metric: ${dangling.join(', ')}`,
      ).toEqual([]);
    },
  );

  it.each(BUILT_IN_TEMPLATES.map((t) => [t.id, t]))(
    'template %s serializes to valid UnifiedBotStrategyCreate',
    (_id, template) => {
      applySnapshot(template);
      const payload = buildUnifiedPayload(useBuilderStore.getState());
      const result = unifiedBotStrategyCreateSchema.safeParse(payload);
      if (!result.success) {
        throw new Error(
          `Template "${template.id}" payload fails Zod schema:\n` +
            JSON.stringify(result.error.issues, null, 2),
        );
      }
      expect(result.success).toBe(true);
    },
  );
});
