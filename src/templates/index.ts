/**
 * Templates module entry point. Re-exports the registry + the most
 * useful types so consumers can `import { BUILT_IN_TEMPLATES, applyTemplate }
 * from '@/templates'` without reaching into nested files.
 */
import type { BotTemplate } from './types';
import { cypheusDefault } from './catalog/cypheus-default';

/** Built-in starter templates shipped with the bundle. Order = display
 * order in the gallery. PR-T2 will add the remaining 7. */
export const BUILT_IN_TEMPLATES: readonly BotTemplate[] = [
  cypheusDefault,
] as const;

export function getTemplateById(id: string): BotTemplate | undefined {
  return BUILT_IN_TEMPLATES.find((t) => t.id === id);
}

export type {
  BotTemplate,
  TemplateAnimationScript,
  TemplateDifficulty,
  TemplateRisk,
  TemplateStateSnapshot,
  Narration,
  NarrationLine,
} from './types';

export { TEMPLATE_SCHEMA_VERSION } from './types';
export { runTemplateAnimation } from './animation';
export { applyTemplate, TemplateConflictError } from './apply';
export type { ApplyTemplateOptions } from './apply';
export { useTemplateTrackingStore } from './store';
