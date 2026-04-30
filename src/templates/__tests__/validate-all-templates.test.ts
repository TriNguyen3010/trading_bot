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
import { BUILT_IN_TEMPLATES, TEMPLATE_SCHEMA_VERSION } from '@/templates';
import type { BotTemplate } from '@/templates';
import type { StepId, StepStatus } from '@/types/builder.types';

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
