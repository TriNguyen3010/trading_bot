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

/**
 * Per-dimension reachable counts under the current filter — used by
 * FilterChips to grey out pills that would zero the result if combined
 * with what the user has already picked.
 *
 * For each dimension we count templates that match the OTHER dimensions
 * of the current filter. So if `filter.difficulty='beginner'`, the
 * `risk` map only counts beginner templates per risk level, and the
 * `difficulty` map ignores its own dimension (so siblings stay
 * comparable when the user wants to switch difficulty).
 *
 * Complexity: O(n × tagsPerTemplate). Cheap enough to recompute on
 * every filter change for the catalog sizes we care about.
 */
export interface DimensionCounts {
  difficulty: Record<TemplateDifficulty, number>;
  risk: Record<TemplateRisk, number>;
  /** Tag map. Tags absent from any reachable template are simply missing
   * — callers can default to 0. */
  tag: Record<string, number>;
}

export function computeDimensionCounts(
  templates: readonly BotTemplate[],
  filter: TemplateFilter,
): DimensionCounts {
  const counts: DimensionCounts = {
    difficulty: {
      beginner: 0,
      intermediate: 0,
      advanced: 0,
    },
    risk: {
      conservative: 0,
      balanced: 0,
      aggressive: 0,
    },
    tag: {},
  };

  for (const t of templates) {
    // Difficulty count — vary difficulty, keep risk + tag fixed to
    // current filter.
    if (
      (!filter.risk || t.riskLevel === filter.risk) &&
      (!filter.tag || t.tags.includes(filter.tag))
    ) {
      counts.difficulty[t.difficulty] += 1;
    }

    // Risk count — vary risk, keep difficulty + tag fixed.
    if (
      (!filter.difficulty || t.difficulty === filter.difficulty) &&
      (!filter.tag || t.tags.includes(filter.tag))
    ) {
      counts.risk[t.riskLevel] += 1;
    }

    // Tag count — vary tag, keep difficulty + risk fixed.
    if (
      (!filter.difficulty || t.difficulty === filter.difficulty) &&
      (!filter.risk || t.riskLevel === filter.risk)
    ) {
      for (const tag of t.tags) {
        counts.tag[tag] = (counts.tag[tag] ?? 0) + 1;
      }
    }
  }

  return counts;
}
