/**
 * The "Tell Cypheus what you're building" entry point.
 *
 * The narration-driven auto-fill animation is gone (see the Cypheus
 * "Coming Soon" redesign). This shim snap-applies the default starter
 * template so existing call sites (`CypheusPanel`) keep working until
 * the broader Cypheus cleanup lands.
 */
import { applyTemplate, getTemplateById } from '@/templates';

export async function runMagicBuild(): Promise<void> {
  const cypheusDefault = getTemplateById('cypheus-default');
  if (!cypheusDefault) {
    // Should never happen — `cypheus-default` is the seed template baked
    // into the registry. Fail loud if someone removes it.
    throw new Error(
      "cypheus-default template not found in registry — magic-build broken.",
    );
  }
  await applyTemplate(cypheusDefault, { force: true });
}
