import { useMemo } from 'react';
import { Chip } from '@/components/ui/chip';
import { BUILT_IN_TEMPLATES } from '@/templates';
import { strings } from '@/i18n/en';
import type {
  BotTemplate,
  TemplateDifficulty,
  TemplateRisk,
} from '@/templates';
import type { TemplateFilter } from './filter';

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
 */
export function FilterChips({
  filter,
  onChange,
  pool = BUILT_IN_TEMPLATES,
}: FilterChipsProps) {
  const allTags = useMemo(() => uniqueTags(pool), [pool]);

  const set = (patch: Partial<TemplateFilter>) => onChange({ ...filter, ...patch });

  return (
    <div className="space-y-3">
      <Row label={strings.templates.filter.difficulty}>
        {DIFFICULTIES.map((d) => (
          <Chip
            key={d}
            selected={filter.difficulty === d}
            onClick={() =>
              set({ difficulty: filter.difficulty === d ? undefined : d })
            }
          >
            {TITLE_CASE[d]}
          </Chip>
        ))}
      </Row>

      <Row label={strings.templates.filter.risk}>
        {RISKS.map((r) => (
          <Chip
            key={r}
            selected={filter.risk === r}
            onClick={() => set({ risk: filter.risk === r ? undefined : r })}
          >
            {TITLE_CASE[r]}
          </Chip>
        ))}
      </Row>

      <Row label={strings.templates.filter.tag}>
        {allTags.map((tag) => (
          <Chip
            key={tag}
            selected={filter.tag === tag}
            onClick={() => set({ tag: filter.tag === tag ? undefined : tag })}
          >
            #{tag}
          </Chip>
        ))}
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

