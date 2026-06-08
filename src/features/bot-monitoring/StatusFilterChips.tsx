import { cn } from '@/lib/utils';
import { FILTER_CHIPS, type FilterCategory } from './bot-filter';

interface StatusFilterChipsProps {
  counts: Record<FilterCategory, number>;
  active: FilterCategory;
  onChange: (cat: FilterCategory) => void;
}

export function StatusFilterChips({
  counts,
  active,
  onChange,
}: StatusFilterChipsProps) {
  return (
    <div
      className="flex flex-wrap items-center gap-1.5"
      role="group"
      aria-label="Filter bots by status"
    >
      {FILTER_CHIPS.map((chip) => {
        const count = counts[chip.key];
        const isActive = active === chip.key;
        const disabled = chip.key !== 'all' && count === 0;
        return (
          <button
            key={chip.key}
            type="button"
            disabled={disabled}
            aria-pressed={isActive}
            onClick={() => onChange(chip.key)}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium transition',
              isActive
                ? 'border-brand bg-brand text-[#1a1300]'
                : 'border-border-subtle bg-surface-elevated text-fg-secondary hover:text-fg',
              disabled &&
                'cursor-not-allowed opacity-40 hover:text-fg-secondary',
            )}
          >
            {chip.label}
            <span
              className={cn(
                'font-mono tabular-nums',
                isActive ? 'text-[#1a1300]/70' : 'text-fg-muted',
              )}
            >
              {count}
            </span>
          </button>
        );
      })}
    </div>
  );
}
