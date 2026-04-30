/**
 * The "Tell Cypheus what you're building" → animated demo entry point.
 *
 * Historically this file owned a hard-coded Bollinger Breakout BTC
 * timeline. Per Spec/Phase 1/bot_templates_plan.md PR-T1 the snapshot +
 * narration moved into a `BotTemplate` (`src/templates/catalog/cypheus-default.ts`)
 * and the timeline logic moved into a generic engine
 * (`src/templates/animation.ts`).
 *
 * This file is kept as a thin compatibility shim so the existing
 * Cypheus chat input flow (`runMagicBuild()` invoked from CypheusPanel)
 * keeps working without churn — it just delegates to the engine with the
 * default template.
 */
import { runTemplateAnimation } from '@/templates/animation';
import { getTemplateById } from '@/templates';

export async function runMagicBuild(): Promise<void> {
  const cypheusDefault = getTemplateById('cypheus-default');
  if (!cypheusDefault) {
    // Should never happen — `cypheus-default` is the seed template baked
    // into the registry. Fail loud if someone removes it.
    throw new Error(
      "cypheus-default template not found in registry — magic-build broken.",
    );
  }
  await runTemplateAnimation(cypheusDefault);
}
