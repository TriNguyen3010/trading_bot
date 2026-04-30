/**
 * Template filter type + predicate. Lives in its own file so the
 * FilterChips component module exports only React components — keeps
 * Vite Fast Refresh happy.
 */
import type {
  BotTemplate,
  TemplateDifficulty,
  TemplateRisk,
} from '@/templates';

export interface TemplateFilter {
  difficulty?: TemplateDifficulty;
  risk?: TemplateRisk;
  tag?: string;
}

export function applyTemplateFilter(
  templates: readonly BotTemplate[],
  filter: TemplateFilter,
): readonly BotTemplate[] {
  return templates.filter(
    (t) =>
      (!filter.difficulty || t.difficulty === filter.difficulty) &&
      (!filter.risk || t.riskLevel === filter.risk) &&
      (!filter.tag || t.tags.includes(filter.tag)),
  );
}
