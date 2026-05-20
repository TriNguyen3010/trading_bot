import { useMemo } from 'react';
import { Chip } from '@/components/ui/chip';
import { BUILT_IN_TEMPLATES } from '@/templates';
import { strings } from '@/i18n/en';
import type {
  BotTemplate,
  TemplateDifficulty,
  TemplateRisk,
} from '@/templates';
import { computeDimensionCounts, type TemplateFilter } from './filter';

export interface FilterChipsProps {
  filter: TemplateFilter;
  onChange: (filter: TemplateFilter) => void;
  /** Set of templates currently visible — used to grey-out tag chips that
   * would zero the result if combined with the current filter. Defaults
   * to BUILT_IN_TEMPLATES. */
  pool?: readonly BotTemplate[];
}

const DIFFICULTIES: readonly TemplateDifficulty[] = [
  'beginner',
  'intermediate',
  'advanced',
];

const RISKS: readonly TemplateRisk[] = [
  'conservative',
  'balanced',
  'aggressive',
];

const TITLE_CASE: Record<string, string> = {
  ...strings.templates.filter.difficultyOptions,
  ...strings.templates.filter.riskOptions,
};

function uniqueTags(templates: readonly BotTemplate[]): string[] {
  const set = new Set<string>();
  for (const t of templates) for (const tag of t.tags) set.add(tag);
  return Array.from(set).sort();
}

/**
 * Three-row chip filter for the templates dialog: difficulty, risk
 * level, and free-form tags. Each row is a single-select group — clicking
 * the active chip again clears it (so users can't get stuck in a filter
 * that returns 0 results without an obvious escape hatch).
 *
 * Tags are derived from the catalog metadata at render time so adding a
 * new template automatically extends the tag row.
 *
 * GUIDED FILTERING (facet narrowing):
 *   Pills that would zero the result when combined with the current
 *   filter are rendered disabled (greyed out). The currently-selected
 *   pill is never disabled — users always need a way to deselect. This
 *   prevents the "user clicks a pill and gets 0 results" dead-end.
 */
export function FilterChips({
  filter,
  onChange,
  pool = BUILT_IN_TEMPLATES,
}: FilterChipsProps) {
  const allTags = useMemo(() => uniqueTags(pool), [pool]);
  const counts = useMemo(
    () => computeDimensionCounts(pool, filter),
    [pool, filter],
  );

  const set = (patch: Partial<TemplateFilter>) =>
    onChange({ ...filter, ...patch });

  return (
    <div className="space-y-3">
      <Row label={strings.templates.filter.difficulty}>
        {DIFFICULTIES.map((d) => {
          const isSelected = filter.difficulty === d;
          const reachable = counts.difficulty[d] > 0;
          return (
            <Chip
              key={d}
              selected={isSelected}
              disabled={!isSelected && !reachable}
              onClick={() => set({ difficulty: isSelected ? undefined : d })}
            >
              {TITLE_CASE[d]}
            </Chip>
          );
        })}
      </Row>

      <Row label={strings.templates.filter.risk}>
        {RISKS.map((r) => {
          const isSelected = filter.risk === r;
          const reachable = counts.risk[r] > 0;
          return (
            <Chip
              key={r}
              selected={isSelected}
              disabled={!isSelected && !reachable}
              onClick={() => set({ risk: isSelected ? undefined : r })}
            >
              {TITLE_CASE[r]}
            </Chip>
          );
        })}
      </Row>

      <Row label={strings.templates.filter.tag}>
        {allTags.map((tag) => {
          const isSelected = filter.tag === tag;
          const reachable = (counts.tag[tag] ?? 0) > 0;
          return (
            <Chip
              key={tag}
              selected={isSelected}
              disabled={!isSelected && !reachable}
              onClick={() => set({ tag: isSelected ? undefined : tag })}
            >
              #{tag}
            </Chip>
          );
        })}
      </Row>
    </div>
  );
}

function Row({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="w-20 flex-shrink-0 text-xs font-medium uppercase tracking-wide text-fg-muted">
        {label}
      </span>
      <div className="flex flex-1 flex-wrap gap-1.5">{children}</div>
    </div>
  );
}
